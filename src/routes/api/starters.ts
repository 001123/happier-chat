import { createFileRoute } from '@tanstack/react-router'
import { chat } from '@tanstack/ai'
import { z } from 'zod'

import { defineMessages, getLocale } from '@/lib/i18n'
import { EXPLAIN_STYLE_PROMPTS, isExplainStyleId, isModeId } from '@/lib/modes'
import type { ModeId } from '@/lib/modes'
import { parseModelKey } from '@/lib/providers'
import { createUserAdapter } from '@/server/providers.server'
import { getSessionUser } from '@/server/session.server'

const messages = defineMessages({
  vi: { loginRequired: 'Bạn cần đăng nhập' },
  en: { loginRequired: 'You need to sign in' },
})

const LANGUAGES = { vi: 'Vietnamese', en: 'English' } as const

/** What a good opening message looks like in each mode. */
const MODE_TOPICS: Record<ModeId, string> = {
  leetcode:
    'The user practises LeetCode-style algorithm problems with a tutor: asking for a problem by difficulty and topic, a step-by-step walkthrough of a named problem, reviewing a pattern (two pointers, sliding window, DP, graphs...), or getting a problem to solve alone.',
  english:
    'The user learns English with a tutor: vocabulary on a theme, fixing a sentence with a mistake (include the sentence), a quiz on a grammar point, or role-playing an everyday conversation.',
  explain:
    'The user asks for a short narrated slide lesson explaining one concept, mostly programming, web, computer science or how a technology works.',
  quiz:
    'The user asks for a multiple-choice quiz to review one topic: programming, computer science, school subjects or general knowledge, sometimes with a difficulty or number of questions.',
  '3d':
    'The user asks for an interactive 3D scene: an everyday object or vehicle, a science model (solar system, molecule, cell), a mechanism, a math surface or a small physics simulation, sometimes with motion, labels or sliders.',
}

const StartersSchema = z.object({
  starters: z
    .array(z.string().meta({ description: 'A first message the user could send' }))
    .meta({ description: '3 to 5 distinct first messages' }),
})

export const Route = createFileRoute('/api/starters')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const user = getSessionUser()
        const locale = getLocale()
        if (!user) return Response.json({ error: messages[locale].loginRequired }, { status: 401 })
        const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
        const selected = typeof body.model === 'string' ? parseModelKey(body.model) : null
        const mode = isModeId(body.mode) ? body.mode : null
        if (!selected || !mode) return Response.json({ starters: [] })
        const style = mode === 'explain' && isExplainStyleId(body.style) ? EXPLAIN_STYLE_PROMPTS[body.style] : null
        // Shown ones are left out, so each click brings new ideas instead of the model's favourites again.
        const avoid = Array.isArray(body.avoid)
          ? body.avoid.filter((item): item is string => typeof item === 'string').slice(0, 20)
          : []

        try {
          const threadId = crypto.randomUUID()
          const resolved = createUserAdapter(user.id, selected.providerId, selected.modelId, threadId)
          const { starters } = await chat({
            adapter: resolved.adapter,
            systemPrompts: [
              'You suggest first messages a user could send to start a chat with a learning assistant.',
              MODE_TOPICS[mode],
              ...(style ? [`The lessons are built in this style, so fit the questions to it: ${style}`] : []),
              `Write a random mix of 3 to 5 messages in ${LANGUAGES[locale]}, phrased as the user speaking. Each is under 12 words, specific, and on a different topic from the others. Pick varied, less obvious topics, not only the most common ones.`,
            ],
            messages: [
              {
                role: 'user',
                content: [
                  // A random seed nudges models that would otherwise answer the same prompt the same way.
                  `Seed: ${crypto.randomUUID().slice(0, 8)}`,
                  ...(avoid.length ? ['Do not repeat or rephrase these:', ...avoid.map((item) => `- ${item}`)] : []),
                ].join('\n'),
              },
            ],
            threadId,
            outputSchema: StartersSchema,
            modelOptions: resolved.api === 'anthropic' ? { max_tokens: 1024 } : {},
            abortController: abortFrom(request.signal),
          })
          const cleaned = [...new Set(starters.map((s) => s.trim()).filter(Boolean))].slice(0, 5)
          return Response.json({ starters: cleaned })
        } catch (error) {
          if (request.signal.aborted) return new Response(null, { status: 499 })
          return Response.json({ error: (error as Error).message, starters: [] }, { status: 502 })
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
