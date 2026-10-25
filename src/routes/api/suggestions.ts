import { createFileRoute } from '@tanstack/react-router'
import { chat } from '@tanstack/ai'
import { z } from 'zod'

import { defineMessages, getLocale } from '@/lib/i18n'
import { parseModelKey } from '@/lib/providers'
import { createUserAdapter } from '@/server/providers.server'
import { getSessionUser } from '@/server/session.server'

const messages = defineMessages({
  vi: { loginRequired: 'Bạn cần đăng nhập' },
  en: { loginRequired: 'You need to sign in' },
})

const MAX_CHARS = 6000

const SuggestionsSchema = z.object({
  suggestions: z
    .array(z.string().meta({ description: 'A short follow-up message the user could send next' }))
    .meta({ description: '3 to 5 distinct follow-up messages' }),
})

const text = (value: unknown) => (typeof value === 'string' ? value.trim().slice(-MAX_CHARS) : '')

export const Route = createFileRoute('/api/suggestions')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const user = getSessionUser()
        if (!user) return Response.json({ error: messages[getLocale()].loginRequired }, { status: 401 })
        const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
        const question = text(body.question)
        const answer = text(body.answer)
        const selected = typeof body.model === 'string' ? parseModelKey(body.model) : null
        const threadId = typeof body.threadId === 'string' ? body.threadId : crypto.randomUUID()
        if (!answer || !selected) return Response.json({ suggestions: [] })

        try {
          const resolved = createUserAdapter(user.id, selected.providerId, selected.modelId, threadId)
          const { suggestions } = await chat({
            adapter: resolved.adapter,
            systemPrompts: [
              'You suggest what the user might want to say next in a chat with an assistant.',
              'Write 3 to 5 follow-up messages phrased as the user speaking to the assistant (e.g. "Explain part X in more detail", "Give me an example of Y"). Each is under 12 words, specific to the conversation, and distinct from the others. Do not repeat the question that was already asked.',
              'Write them in the same language as the answer.',
            ],
            messages: [
              {
                role: 'user',
                content: `<question>\n${question}\n</question>\n<answer>\n${answer}\n</answer>`,
              },
            ],
            threadId,
            outputSchema: SuggestionsSchema,
            modelOptions: resolved.api === 'anthropic' ? { max_tokens: 1024 } : {},
            abortController: abortFrom(request.signal),
          })
          const cleaned = [...new Set(suggestions.map((s) => s.trim()).filter(Boolean))].slice(0, 5)
          return Response.json({ suggestions: cleaned })
        } catch (error) {
          if (request.signal.aborted) return new Response(null, { status: 499 })
          return Response.json({ error: (error as Error).message, suggestions: [] }, { status: 502 })
        }
      },
    },
  },
})

function abortFrom(signal: AbortSignal) {
  const controller = new AbortController()
  signal.addEventListener('abort', () => controller.abort(), { once: true })
  return controller
}
