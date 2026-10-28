import { createFileRoute } from '@tanstack/react-router'

import { PDF_TYPE } from '@/lib/attachments'
import { deleteAttachment, readAttachment } from '@/server/attachments.server'
import { assertSameOrigin, getSessionUser } from '@/server/session.server'

export const Route = createFileRoute('/api/files/$id')({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const user = getSessionUser()
        if (!user) return new Response(null, { status: 401 })
        // Someone else's id reads as missing.
        const file = await readAttachment(user.id, params.id)
        if (!file) return new Response(null, { status: 404 })
        return new Response(file.bytes, {
          headers: {
            'content-type': file.mime,
            'content-length': String(file.bytes.byteLength),
            'content-disposition': `inline; filename*=UTF-8''${encodeURIComponent(file.name)}`,
            // An attachment never changes under its id; private keeps it out of shared caches.
            'cache-control': 'private, max-age=31536000, immutable',
            'x-content-type-options': 'nosniff',
            // Opened in a tab, an image gets no script and no access to the app's origin. A sandbox would also turn off
            // the browser's PDF viewer, so a PDF (shown by the viewer, never as a page) may only be framed by the app.
            'content-security-policy': file.mime === PDF_TYPE ? "frame-ancestors 'self'" : 'sandbox',
          },
        })
      },
      /** Drops an upload the user removed from the composer before sending. */
      DELETE: ({ params }) => {
        const user = getSessionUser()
        if (!user) return new Response(null, { status: 401 })
        try {
          assertSameOrigin()
        } catch {
          return new Response(null, { status: 403 })
        }
        deleteAttachment(user.id, params.id)
        return new Response(null, { status: 204 })
      },
    },
  },
})
