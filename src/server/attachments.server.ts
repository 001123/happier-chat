import { createHash } from 'node:crypto'
import { convertMessagesToModelMessages } from '@tanstack/ai'
import type { AnyTextAdapter, ContentPart, ModelMessage, UIMessage } from '@tanstack/ai'
import { extractText } from 'unpdf'

import { MAX_IMAGE_BYTES, MAX_PDF_BYTES, PDF_TYPE, attachmentIdOf, attachmentSupport, attachmentUrl } from '@/lib/attachments'
import type { AttachmentMeta, UploadedAttachment } from '@/lib/attachments'
import type { CatalogModel } from '@/lib/model-catalog'
import type { ModelApi } from '@/lib/providers'
import { getDb } from './db.server'
import { getFileStore } from './file-store.server'

type Row = {
  id: string
  name: string
  mime: string
  size: number
  storage_key: string
  text: string | null
}

export class AttachmentError extends Error {
  constructor(readonly code: 'unsupported' | 'tooLarge' | 'empty') {
    super(code)
  }
}

// About 50k tokens: enough for a long paper, small enough to leave room in a 128k context.
const MAX_PDF_TEXT = 200_000

/** The type from the file's first bytes; the browser's claim is not trusted, so an SVG or HTML file never gets in. */
function sniffType(bytes: Uint8Array) {
  const ascii = (start: number, end: number) => String.fromCharCode(...bytes.subarray(start, end))
  if (bytes[0] === 0x89 && ascii(1, 4) === 'PNG') return 'image/png'
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg'
  if (ascii(0, 4) === 'GIF8') return 'image/gif'
  if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'image/webp'
  // OpenAI's Responses adapter also rejects a PDF whose data does not start with the header.
  if (ascii(0, 5) === '%PDF-') return PDF_TYPE
  return null
}

function cleanName(name: string) {
  const base = name.split(/[\\/]/).pop() ?? ''
  return base.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 200) || 'file'
}

async function pdfText(bytes: Uint8Array) {
  try {
    // PDF.js may transfer the buffer it is given, so it gets a copy.
    const { text } = await extractText(bytes.slice(), { mergePages: false })
    const joined = text
      .map((page, i) => `--- Page ${i + 1} ---\n${page.trim()}`)
      .join('\n\n')
      .trim()
    if (!text.some((page) => page.trim())) return null
    return joined.length > MAX_PDF_TEXT ? `${joined.slice(0, MAX_PDF_TEXT)}\n\n[Truncated: the rest of the document is not included.]` : joined
  } catch (error) {
    console.error('PDF text extraction failed', error)
    return null
  }
}

/** Stores an upload for one of the user's threads. Identical content is kept once per user. */
export async function saveAttachment(userId: string, threadId: string, fileName: string, bytes: Uint8Array): Promise<UploadedAttachment> {
  if (bytes.byteLength === 0) throw new AttachmentError('empty')
  const mime = sniffType(bytes)
  if (!mime) throw new AttachmentError('unsupported')
  if (bytes.byteLength > (mime === PDF_TYPE ? MAX_PDF_BYTES : MAX_IMAGE_BYTES)) throw new AttachmentError('tooLarge')

  const db = getDb()
  const sha256 = createHash('sha256').update(bytes).digest('hex')
  const storageKey = `${userId}/${sha256}`
  const existing = db.prepare('select text from attachments where storage_key = ? limit 1').get(storageKey) as
    | Pick<Row, 'text'>
    | undefined
  if (!existing) await getFileStore().put(storageKey, bytes)
  const text = mime === PDF_TYPE ? (existing ? existing.text : await pdfText(bytes)) : null

  const id = crypto.randomUUID()
  const name = cleanName(fileName)
  db.prepare(
    'insert into attachments (id, user_id, thread_id, name, mime, size, sha256, storage_key, text, created_at) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
  ).run(id, userId, threadId, name, mime, bytes.byteLength, sha256, storageKey, text, Date.now())
  return { id, name, mime, size: bytes.byteLength, url: attachmentUrl(id) }
}

function getRow(userId: string, id: string) {
  return getDb()
    .prepare('select id, name, mime, size, storage_key, text from attachments where user_id = ? and id = ?')
    .get(userId, id) as Row | undefined
}

/** The attachment and its bytes, or null when it is not the user's or its file is gone. */
export async function readAttachment(userId: string, id: string) {
  const row = getRow(userId, id)
  if (!row) return null
  const bytes = await getFileStore().get(row.storage_key)
  return bytes ? { name: row.name, mime: row.mime, bytes } : null
}

/** Removes files no attachment row points at any more. Runs after the rows are gone, so a failure only leaves a stray file. */
function sweep(keys: Iterable<string>) {
  const used = getDb().prepare('select 1 from attachments where storage_key = ? limit 1')
  const store = getFileStore()
  for (const key of new Set(keys)) {
    if (used.get(key)) continue
    store.delete(key).catch((error) => console.error('Failed to delete attachment file', key, error))
  }
}

export function deleteAttachment(userId: string, id: string) {
  const row = getRow(userId, id)
  if (!row) return
  getDb().prepare('delete from attachments where user_id = ? and id = ?').run(userId, id)
  sweep([row.storage_key])
}

export function deleteThreadAttachments(userId: string, threadIds: Array<string>) {
  const db = getDb()
  const select = db.prepare('select storage_key from attachments where user_id = ? and thread_id = ?')
  const remove = db.prepare('delete from attachments where user_id = ? and thread_id = ?')
  const keys: Array<string> = []
  for (const threadId of threadIds) {
    for (const row of select.all(userId, threadId) as Array<Pick<Row, 'storage_key'>>) keys.push(row.storage_key)
    remove.run(userId, threadId)
  }
  sweep(keys)
}

export type AttachmentTarget = { api: ModelApi; info: CatalogModel | null }

/**
 * Whether the model gets a PDF as is. The Chat Completions adapter has no document part, and Ollama takes
 * images only, so those always get the extracted text. Without catalog data, only the APIs that read PDFs for
 * every current model are trusted with one.
 */
function readsPdf({ api, info }: AttachmentTarget) {
  if (api === 'chat' || api === 'ollama') return false
  return info ? info.input.includes('pdf') : api === 'anthropic' || api === 'gemini'
}

type AttachmentPart = Extract<ContentPart, { type: 'image' | 'document' }>

function isAttachmentPart(part: ContentPart): part is AttachmentPart {
  return (part.type === 'image' || part.type === 'document') && part.source.type === 'url' && attachmentIdOf(part.source.value) !== null
}

/** Attachment kinds in the newest user message that the model cannot take, so the request can be refused up front. */
export function unsupportedAttachments(messages: Array<UIMessage | ModelMessage>, target: AttachmentTarget) {
  const last = convertMessagesToModelMessages(messages)
    .reverse()
    .find((message) => message.role === 'user')
  if (!last || !Array.isArray(last.content)) return null
  const hasImage = last.content.some((part) => isAttachmentPart(part) && part.type === 'image')
  return hasImage && !attachmentSupport(target.info).image ? 'image' : null
}

const note = (content: string): ContentPart => ({ type: 'text', content })
const escapeAttr = (value: string) => value.replace(/[&"<>]/g, (ch) => `&#${ch.charCodeAt(0)};`)

async function toModelPart(userId: string, part: AttachmentPart, target: AttachmentTarget): Promise<ContentPart> {
  const row = getRow(userId, attachmentIdOf(part.source.value)!)
  const name = row?.name ?? (part.metadata as AttachmentMeta | undefined)?.filename ?? 'file'
  const unavailable = note(`[The attachment "${name}" is no longer available.]`)
  if (!row) return unavailable

  if (part.type === 'image') {
    // Only an earlier turn gets here: a new message with an image for a model without vision is refused.
    if (!attachmentSupport(target.info).image) return note(`[The user attached the image "${name}", which the current model cannot see.]`)
    const bytes = await getFileStore().get(row.storage_key)
    if (!bytes) return unavailable
    return { type: 'image', source: { type: 'data', value: Buffer.from(bytes).toString('base64'), mimeType: row.mime } }
  }

  if (readsPdf(target)) {
    const bytes = await getFileStore().get(row.storage_key)
    if (!bytes) return unavailable
    return {
      type: 'document',
      source: { type: 'data', value: Buffer.from(bytes).toString('base64'), mimeType: PDF_TYPE },
      metadata: { filename: row.name },
    }
  }
  if (row.text) return note(`<document name="${escapeAttr(name)}">\n${row.text}\n</document>`)
  return note(
    `[The user attached the PDF "${name}", but it has no extractable text (it may be scanned) and the current model cannot read PDFs directly.]`,
  )
}

/**
 * The adapter, with attachment links in user messages replaced by what the model can take: the bytes for images
 * and PDFs it reads, the extracted text for PDFs it does not. This happens at the adapter so the stored transcript
 * keeps the links and never grows by the files. Parts are resolved once per request and reused across the steps of
 * the agent loop.
 */
export function withAttachments<TAdapter extends AnyTextAdapter>(adapter: TAdapter, userId: string, target: AttachmentTarget): TAdapter {
  const resolved = new Map<string, Promise<ContentPart>>()
  const resolvePart = (part: AttachmentPart) => {
    const key = `${part.type}:${part.source.value}`
    let found = resolved.get(key)
    if (!found) {
      found = toModelPart(userId, part, target)
      resolved.set(key, found)
    }
    return found
  }
  const resolveMessages = (messages: Array<ModelMessage>) =>
    Promise.all(
      messages.map(async (message) => {
        if (message.role !== 'user' || !Array.isArray(message.content) || !message.content.some(isAttachmentPart)) return message
        const content = await Promise.all(message.content.map((part) => (isAttachmentPart(part) ? resolvePart(part) : part)))
        return { ...message, content }
      }),
    )

  const chatStream = adapter.chatStream.bind(adapter)
  adapter.chatStream = async function* (options) {
    yield* chatStream({ ...options, messages: await resolveMessages(options.messages) })
  }
  return adapter
}
