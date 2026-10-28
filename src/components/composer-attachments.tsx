import * as React from 'react'
import type { ContentPart } from '@tanstack/ai'
import type { UIMessage } from '@tanstack/ai-react'
import { IconAlertTriangle, IconFileTypePdf, IconLoader2, IconPaperclip, IconX } from '@tabler/icons-react'
import { cn } from 'cn'

import { AttachmentLightbox } from '@/components/attachment-lightbox'
import type { LightboxFile } from '@/components/attachment-lightbox'
import { InputGroupButton } from '@/components/ui/input-group'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  IMAGE_TYPES,
  MAX_ATTACHMENTS,
  MAX_IMAGE_BYTES,
  MAX_PDF_BYTES,
  PDF_TYPE,
  acceptedTypes,
  attachmentIdOf,
  attachmentSupport,
} from '@/lib/attachments'
import type { AttachmentMeta, UploadedAttachment } from '@/lib/attachments'
import { defineMessages, useMessages } from '@/lib/i18n'
import type { CatalogModel } from '@/lib/model-catalog'

const messages = defineMessages({
  vi: {
    attach: 'Đính kèm ảnh hoặc PDF',
    attachPdfOnly: 'Đính kèm PDF (model này không xem được ảnh)',
    remove: 'Bỏ file',
    unsupported: 'Chỉ hỗ trợ ảnh PNG, JPEG, WebP, GIF và PDF',
    tooLarge: 'File quá lớn',
    uploadFailed: 'Tải lên thất bại',
    noVision: 'Model đang chọn không xem được ảnh. Hãy đổi model hoặc bỏ ảnh.',
    preview: 'Xem',
  },
  en: {
    attach: 'Attach images or PDFs',
    attachPdfOnly: 'Attach PDFs (this model cannot see images)',
    remove: 'Remove file',
    unsupported: 'Only PNG, JPEG, WebP, GIF images and PDFs are supported',
    tooLarge: 'File too large',
    uploadFailed: 'Upload failed',
    noVision: 'The selected model cannot see images. Switch models or remove the image.',
    preview: 'Preview',
  },
})

type Kind = 'image' | 'pdf'

export type PendingAttachment = {
  id: string
  name: string
  size: number
  kind: Kind
  /** Object URL of an image, for its thumbnail. */
  preview: string | null
  status: 'uploading' | 'ready' | 'error'
  error?: string
  uploaded?: UploadedAttachment
}

const kindOf = (type: string): Kind | null =>
  (IMAGE_TYPES as ReadonlyArray<string>).includes(type) ? 'image' : type === PDF_TYPE ? 'pdf' : null

// Providers scale images down to about this size anyway (Anthropic to 1568px), and Anthropic refuses images over 5 MB.
const MAX_EDGE = 2048
const REENCODE_ABOVE = 3.5 * 1024 * 1024

/** A photo straight off a phone is shrunk before it travels; small images and GIFs (maybe animated) go as they are. */
async function prepareImage(file: File): Promise<File> {
  if (file.type === 'image/gif') return file
  const bitmap = await createImageBitmap(file).catch(() => null)
  if (!bitmap) return file
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height))
  if (scale === 1 && file.size <= REENCODE_ABOVE) {
    bitmap.close()
    return file
  }
  const canvas = new OffscreenCanvas(Math.round(bitmap.width * scale), Math.round(bitmap.height * scale))
  const context = canvas.getContext('2d')!
  // JPEG has no alpha: transparent areas become white rather than black.
  context.fillStyle = '#fff'
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.88 })
  return new File([blob], `${file.name.replace(/\.[^.]+$/, '')}.jpg`, { type: 'image/jpeg' })
}

async function upload(threadId: string, file: File, signal: AbortSignal): Promise<UploadedAttachment> {
  const form = new FormData()
  form.set('threadId', threadId)
  form.set('file', file)
  const res = await fetch('/api/files', { method: 'POST', body: form, signal })
  const body = (await res.json().catch(() => ({}))) as UploadedAttachment & { error?: string }
  if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`)
  return body
}

/** Files picked, dropped or pasted into the composer, uploaded as soon as they are added. */
export function useComposerAttachments(threadId: string) {
  const t = useMessages(messages)
  const [items, setItems] = React.useState<Array<PendingAttachment>>([])
  const itemsRef = React.useRef(items)
  itemsRef.current = items
  const uploads = React.useRef(new Map<string, AbortController>())

  const patch = (id: string, next: Partial<PendingAttachment>) =>
    setItems((current) => current.map((item) => (item.id === id ? { ...item, ...next } : item)))

  React.useEffect(
    () => () => {
      for (const controller of uploads.current.values()) controller.abort()
      for (const item of itemsRef.current) if (item.preview) URL.revokeObjectURL(item.preview)
    },
    [],
  )

  function add(files: Iterable<File>) {
    const room = MAX_ATTACHMENTS - itemsRef.current.length
    const added = [...files].slice(0, Math.max(0, room)).map((file) => {
      const kind = kindOf(file.type)
      const item: PendingAttachment = {
        id: crypto.randomUUID(),
        name: file.name || (kind === 'pdf' ? 'document.pdf' : 'image'),
        size: file.size,
        kind: kind ?? 'pdf',
        preview: kind === 'image' ? URL.createObjectURL(file) : null,
        status: 'uploading',
      }
      if (!kind) return { ...item, status: 'error' as const, error: t.unsupported }
      if (kind === 'pdf' && file.size > MAX_PDF_BYTES) return { ...item, status: 'error' as const, error: t.tooLarge }

      const controller = new AbortController()
      uploads.current.set(item.id, controller)
      void (async () => {
        try {
          const prepared = kind === 'image' ? await prepareImage(file) : file
          if (prepared.size > MAX_IMAGE_BYTES && kind === 'image') throw new Error(t.tooLarge)
          const uploaded = await upload(threadId, prepared, controller.signal)
          patch(item.id, { status: 'ready', uploaded, size: uploaded.size })
        } catch (error) {
          if (controller.signal.aborted) return
          patch(item.id, { status: 'error', error: (error as Error).message || t.uploadFailed })
        } finally {
          uploads.current.delete(item.id)
        }
      })()
      return item
    })
    if (added.length) setItems((current) => [...current, ...added])
  }

  function remove(id: string) {
    const item = itemsRef.current.find((entry) => entry.id === id)
    if (!item) return
    uploads.current.get(id)?.abort()
    if (item.preview) URL.revokeObjectURL(item.preview)
    // Never sent, so nothing points at it: the server can drop it.
    if (item.uploaded) void fetch(`/api/files/${item.uploaded.id}`, { method: 'DELETE' }).catch(() => {})
    setItems((current) => current.filter((entry) => entry.id !== id))
  }

  /** After sending: the uploads now belong to the message, so only the local previews go. */
  function clear() {
    for (const item of itemsRef.current) if (item.preview) URL.revokeObjectURL(item.preview)
    setItems([])
  }

  return { items, add, remove, clear }
}

/** Message parts for sent attachments, ahead of the text as providers recommend. */
export function attachmentParts(attachments: ReadonlyArray<UploadedAttachment>): Array<ContentPart> {
  return attachments.map((attachment) => {
    const metadata: AttachmentMeta = { filename: attachment.name, size: attachment.size }
    const source = { type: 'url' as const, value: attachment.url, mimeType: attachment.mime }
    return attachment.mime === PDF_TYPE ? { type: 'document', source, metadata } : { type: 'image', source, metadata }
  })
}

export type MessageFile = { kind: Kind; src: string; name: string | null; size: number | null }

/** Images (uploads and drawings) and uploaded PDFs in a message. */
export function messageFiles(message: UIMessage): Array<MessageFile> {
  return message.parts.flatMap((part): Array<MessageFile> => {
    if (part.type !== 'image' && part.type !== 'document') return []
    const meta = part.metadata as Partial<AttachmentMeta> | undefined
    const name = meta?.filename ?? null
    const size = meta?.size ?? null
    // A provider file handle is an opaque id the browser cannot load.
    if (part.source.type === 'file') return []
    if (part.type === 'document') {
      return part.source.type === 'url' && attachmentIdOf(part.source.value) ? [{ kind: 'pdf', src: part.source.value, name, size }] : []
    }
    const src = part.source.type === 'url' ? part.source.value : `data:${part.source.mimeType};base64,${part.source.value}`
    return [{ kind: 'image', src, name, size }]
  })
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export function AttachButton({
  info,
  disabled,
  onFiles,
}: {
  info: CatalogModel | null | undefined
  disabled?: boolean
  onFiles?: (files: Array<File>) => void
}) {
  const t = useMessages(messages)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const label = attachmentSupport(info).image ? t.attach : t.attachPdfOnly
  return (
    <>
      <Tooltip>
        <TooltipTrigger
          render={
            <InputGroupButton
              type="button"
              size="icon-xs"
              aria-label={label}
              disabled={disabled}
              className="text-muted-foreground"
              onClick={() => inputRef.current?.click()}
            />
          }
        >
          <IconPaperclip />
        </TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
      <input
        ref={inputRef}
        type="file"
        multiple
        hidden
        tabIndex={-1}
        accept={acceptedTypes(info).join(',')}
        onChange={(event) => {
          const files = [...(event.target.files ?? [])]
          event.target.value = ''
          if (files.length) onFiles?.(files)
        }}
      />
    </>
  )
}

/** Thumbnails and file chips above the composer's text, with upload state and a remove button. */
export function AttachmentTray({
  items,
  info,
  onRemove,
}: {
  items: ReadonlyArray<PendingAttachment>
  info: CatalogModel | null | undefined
  onRemove: (id: string) => void
}) {
  const t = useMessages(messages)
  const seesImages = attachmentSupport(info).image
  const blocked = !seesImages && items.some((item) => item.kind === 'image')
  // Images preview from the local file at once; a PDF once the server has it.
  const previews = items.flatMap((item) => {
    const src = item.kind === 'image' ? item.preview : item.uploaded?.url
    return src ? [{ id: item.id, file: { kind: item.kind, src, name: item.name } satisfies LightboxFile }] : []
  })
  const [shown, setShown] = React.useState<number | null>(null)
  return (
    <div className="flex w-full flex-col gap-2">
      <AttachmentLightbox files={previews.map((preview) => preview.file)} index={shown} onIndexChange={setShown} />
      <ul className="flex flex-wrap gap-2">
        {items.map((item) => {
          const unusable = item.kind === 'image' && !seesImages
          const problem = item.status === 'error' ? item.error : unusable ? t.noVision : undefined
          const previewIndex = previews.findIndex((preview) => preview.id === item.id)
          return (
            <li
              key={item.id}
              title={problem ?? item.name}
              className={cn(
                'group/attachment relative flex h-14 items-center gap-2 overflow-hidden rounded-lg border bg-background text-xs',
                item.kind === 'image' ? 'w-14' : 'max-w-56 pr-7 pl-2',
                problem ? 'border-destructive/60' : 'border-border',
              )}
            >
              <button
                type="button"
                disabled={previewIndex < 0}
                aria-label={`${t.preview}: ${item.name}`}
                onClick={() => setShown(previewIndex)}
                className="flex size-full min-w-0 items-center gap-2 enabled:cursor-zoom-in"
              >
                {item.kind === 'image' && item.preview ? (
                  <img src={item.preview} alt="" className={cn('size-full object-cover', (item.status !== 'ready' || unusable) && 'opacity-50')} />
                ) : (
                  <>
                    <IconFileTypePdf className="size-6 shrink-0 text-destructive" />
                    <span className="flex min-w-0 flex-col text-left">
                      <span className="truncate font-medium text-foreground">{item.name}</span>
                      <span className={cn('flex items-center gap-1 truncate', problem ? 'text-destructive' : 'text-muted-foreground')}>
                        {item.status === 'uploading' && <IconLoader2 aria-hidden className="size-3 shrink-0 animate-spin" />}
                        {item.status === 'error' ? item.error : formatSize(item.size)}
                      </span>
                    </span>
                  </>
                )}
              </button>
              {item.status === 'uploading' && item.kind === 'image' && (
                <IconLoader2 aria-hidden className="pointer-events-none absolute inset-0 m-auto size-4 animate-spin text-foreground" />
              )}
              {item.kind === 'image' && problem && (
                <IconAlertTriangle aria-hidden className="pointer-events-none absolute inset-0 m-auto size-5 text-destructive drop-shadow" />
              )}
              <button
                type="button"
                aria-label={`${t.remove}: ${item.name}`}
                onClick={() => onRemove(item.id)}
                className={cn(
                  'absolute top-0.5 right-0.5 flex size-5 items-center justify-center rounded-full bg-foreground/70 text-background transition-opacity hover:bg-foreground focus-visible:opacity-100',
                  'pointer-fine:opacity-0 group-hover/attachment:opacity-100',
                )}
              >
                <IconX className="size-3" />
              </button>
            </li>
          )
        })}
      </ul>
      {blocked && <p className="text-left text-xs text-destructive">{t.noVision}</p>}
    </div>
  )
}

/** Attachments shown above a user's message bubble; each opens in the lightbox. */
export function MessageAttachments({ files, imageAlt }: { files: ReadonlyArray<MessageFile>; imageAlt: string }) {
  const t = useMessages(messages)
  const [shown, setShown] = React.useState<number | null>(null)
  if (files.length === 0) return null
  return (
    <>
      <AttachmentLightbox
        files={files.map((file) => ({ ...file, name: file.name ?? (file.kind === 'image' ? imageAlt : null) }))}
        index={shown}
        onIndexChange={setShown}
      />
      {files.map((file, i) =>
        file.kind === 'image' ? (
          <button
            key={i}
            type="button"
            aria-label={`${t.preview}: ${file.name ?? imageAlt}`}
            onClick={() => setShown(i)}
            className="cursor-zoom-in overflow-hidden rounded-2xl rounded-br-md border border-border shadow-xs transition-opacity hover:opacity-90"
          >
            <img src={file.src} alt={file.name ?? imageAlt} className="block max-h-80 w-56 object-cover" />
          </button>
        ) : (
          <button
            key={i}
            type="button"
            aria-label={`${t.preview}: ${file.name ?? 'PDF'}`}
            onClick={() => setShown(i)}
            className="flex max-w-72 items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-left text-xs shadow-xs hover:bg-muted"
          >
            <IconFileTypePdf className="size-6 shrink-0 text-destructive" />
            <span className="flex min-w-0 flex-col">
              <span className="truncate font-medium text-foreground">{file.name ?? 'PDF'}</span>
              {file.size !== null && <span className="text-muted-foreground">{formatSize(file.size)}</span>}
            </span>
          </button>
        ),
      )}
    </>
  )
}
