import type { CatalogModel } from './model-catalog'

/** Message parts point at uploads through this route; the server swaps the bytes in before calling a model. */
export const ATTACHMENT_ROUTE = '/api/files/'

export const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'] as const
export const PDF_TYPE = 'application/pdf'

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024
// Anthropic caps a whole request at 32 MB, and a PDF travels base64-encoded (a third larger).
export const MAX_PDF_BYTES = 20 * 1024 * 1024
export const MAX_ATTACHMENTS = 10

/** Stored on each attachment part. `filename` is the key the Anthropic and OpenAI adapters read for a document's title. */
export type AttachmentMeta = { filename: string; size: number }

export type UploadedAttachment = { id: string; name: string; mime: string; size: number; url: string }

export const attachmentUrl = (id: string) => `${ATTACHMENT_ROUTE}${id}`

/** The upload id in an attachment URL, or null for any other URL. */
export function attachmentIdOf(url: string) {
  if (!url.startsWith(ATTACHMENT_ROUTE)) return null
  const id = url.slice(ATTACHMENT_ROUTE.length)
  return /^[\w-]{1,100}$/.test(id) ? id : null
}

/**
 * What the model can take. A model without catalog data may still see images, so it is given the benefit of
 * the doubt; PDFs always work, because the server falls back to their text for models that cannot read them.
 */
export function attachmentSupport(info: CatalogModel | null | undefined) {
  return { image: info ? info.input.includes('image') : true, pdf: true }
}

export function acceptedTypes(info: CatalogModel | null | undefined) {
  return [...(attachmentSupport(info).image ? IMAGE_TYPES : []), PDF_TYPE]
}
