import { createFileRoute } from '@tanstack/react-router'
import { generateSpeech, generationParamsFromRequest, toServerSentEventsResponse } from '@tanstack/ai'
import { createGeminiSpeech } from '@tanstack/ai-gemini'
import type { GeminiTTSModels } from '@tanstack/ai-gemini'

// A model id the installed adapter may not list yet is still passed through as is.
type GeminiTTSModel = (typeof GeminiTTSModels)[number]

import { defineMessages, getLocale } from '@/lib/i18n'
import { edgeSpeech } from '@/lib/edge-tts/adapter'
import { GEMINI_VOICES } from '@/lib/speech-settings'
import { getSessionUser } from '@/server/session.server'
import { geminiSpeechKey } from '@/server/speech.server'

const messages = defineMessages({
  vi: {
    missingText: 'Thiếu văn bản cần đọc.',
    loginRequired: 'Cần đăng nhập để dùng giọng Gemini.',
    missingGeminiKey: 'Chưa có API key Gemini cho giọng đọc. Thêm key trong Cài đặt → Giọng nói, hoặc chuyển sang Edge.',
    invalidGeminiModel: 'Model Gemini TTS không hợp lệ.',
  },
  en: {
    missingText: 'Missing text to read aloud.',
    loginRequired: 'Sign in to use the Gemini voice.',
    missingGeminiKey: 'No Gemini API key for speech. Add one in Settings → Voice, or switch to Edge.',
    invalidGeminiModel: 'Invalid Gemini TTS model.',
  },
})

const MAX_CHARS = 20_000
// Any Gemini TTS model id, so a newer one can be picked in the settings without a code change.
const GEMINI_TTS_MODEL = /^gemini-[\w.-]+-tts(-preview)?$/

// The dev proxy reuses the connection after a streamed response and the next request on it fails with a bare 400,
// so every other read failed; a closed connection costs one handshake per request.
const SSE_INIT = { headers: { Connection: 'close' } }

/** Gemini's adapter, with API errors (a JSON body as the message) reduced to their readable message. */
function geminiAdapter(model: string, apiKey: string) {
  const adapter = createGeminiSpeech(model as GeminiTTSModel, apiKey)
  const generate = adapter.generateSpeech.bind(adapter)
  adapter.generateSpeech = (options) =>
    generate(options).catch((error: Error) => {
      let message = error.message
      try {
        message = (JSON.parse(message) as { error?: { message?: string } }).error?.message?.trim() || message
      } catch {}
      throw new Error(`Gemini TTS: ${message}`, { cause: error })
    })
  return adapter
}

export const Route = createFileRoute('/api/tts')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const t = messages[getLocale()]
        const { input, threadId, runId } = await generationParamsFromRequest('tts', request)
        const text = typeof input.text === 'string' ? input.text.trim().slice(0, MAX_CHARS) : ''
        if (!text) return new Response(t.missingText, { status: 400 })
        const { engine, model, ...modelOptions } = (input.modelOptions ?? {}) as {
          engine?: string
          model?: string
          pitch?: number
        }
        const common = { text, stream: true as const, threadId, runId, abortSignal: request.signal }

        if (engine === 'gemini') {
          const user = getSessionUser()
          if (!user) return new Response(t.loginRequired, { status: 401 })
          const apiKey = geminiSpeechKey(user.id)
          if (!apiKey) return new Response(t.missingGeminiKey, { status: 400 })
          if (!model || !GEMINI_TTS_MODEL.test(model)) return new Response(t.invalidGeminiModel, { status: 400 })
          // Gemini takes neither speed nor pitch, and returns no word timings: the client plays the audio faster or
          // slower, and estimates where the reading is.
          const stream = generateSpeech({
            ...common,
            adapter: geminiAdapter(model, apiKey),
            voice: GEMINI_VOICES.includes(input.voice ?? '') ? input.voice : 'Kore',
          })
          return toServerSentEventsResponse(stream, SSE_INIT)
        }

        const stream = generateSpeech({
          ...common,
          adapter: edgeSpeech(),
          voice: input.voice,
          speed: input.speed,
          modelOptions,
          timestamps: input.timestamps,
        })
        return toServerSentEventsResponse(stream, SSE_INIT)
      },
    },
  },
})
