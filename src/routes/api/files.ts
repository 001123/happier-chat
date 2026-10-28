import { createFileRoute } from '@tanstack/react-router'

import { MAX_PDF_BYTES } from '@/lib/attachments'
import { defineMessages, getLocale } from '@/lib/i18n'
import { AttachmentError, saveAttachment } from '@/server/attachments.server'
import { assertSameOrigin, getSessionUser } from '@/server/session.server'

const messages = defineMessages({
  vi: {
    loginRequired: 'Bạn cần đăng nhập',
    invalidOrigin: 'Origin không hợp lệ',
    missingFile: 'Thiếu file hoặc thread',
    unsupported: 'Chỉ hỗ trợ ảnh PNG, JPEG, WebP, GIF và PDF',
    tooLarge: 'File quá lớn (ảnh tối đa 10 MB, PDF tối đa 20 MB)',
    empty: 'File rỗng',
  },
  en: {
    loginRequired: 'You need to sign in',
    invalidOrigin: 'Invalid origin',
    missingFile: 'Missing file or thread',
    unsupported: 'Only PNG, JPEG, WebP, GIF images and PDFs are supported',
    tooLarge: 'File too large (images up to 10 MB, PDFs up to 20 MB)',
    empty: 'The file is empty',
  },
})

export const Route = createFileRoute('/api/files')({
  server: {
    handlers: {
      /** Multipart upload with `file` and `threadId`; answers with the attachment to put in a message. */
      POST: async ({ request }) => {
        const t = messages[getLocale()]
        const user = getSessionUser()
        if (!user) return Response.json({ error: t.loginRequired }, { status: 401 })
        try {
          assertSameOrigin()
        } catch {
          return Response.json({ error: t.invalidOrigin }, { status: 403 })
        }
        // Refused before the body is read; the form overhead is far below the margin.
        if (Number(request.headers.get('content-length') ?? 0) > MAX_PDF_BYTES + 1024 * 1024) {
          return Response.json({ error: t.tooLarge }, { status: 413 })
        }
        const form = await request.formData().catch(() => null)
        const file = form?.get('file')
        const threadId = form?.get('threadId')
        if (!(file instanceof File) || typeof threadId !== 'string' || !/^[\w-]{1,100}$/.test(threadId)) {
          return Response.json({ error: t.missingFile }, { status: 400 })
        }
        try {
          const attachment = await saveAttachment(user.id, threadId, file.name, new Uint8Array(await file.arrayBuffer()))
          return Response.json(attachment)
        } catch (error) {
          if (error instanceof AttachmentError) {
            return Response.json({ error: t[error.code] }, { status: error.code === 'tooLarge' ? 413 : 415 })
          }
          throw error
        }
      },
    },
  },
})
