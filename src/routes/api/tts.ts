import { createFileRoute } from '@tanstack/react-router'
import { generateSpeech, generationParamsFromRequest, toServerSentEventsResponse } from '@tanstack/ai'

import { defineMessages, getLocale } from '@/lib/i18n'
import { edgeSpeech } from '@/lib/edge-tts/adapter'

const messages = defineMessages({
  vi: { missingText: 'Thiếu văn bản cần đọc.' },
  en: { missingText: 'Missing text to read aloud.' },
})

const MAX_CHARS = 20_000

export const Route = createFileRoute('/api/tts')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { input, threadId, runId } = await generationParamsFromRequest('tts', request)
        const text = typeof input.text === 'string' ? input.text.trim() : ''
        if (!text) return new Response(messages[getLocale()].missingText, { status: 400 })

        const stream = generateSpeech({
          adapter: edgeSpeech(),
          text: text.slice(0, MAX_CHARS),
          voice: input.voice,
          speed: input.speed,
          modelOptions: input.modelOptions,
          timestamps: input.timestamps,
          stream: true,
          threadId,
          runId,
          abortSignal: request.signal,
        })

        return toServerSentEventsResponse(stream)
      },
    },
  },
})
