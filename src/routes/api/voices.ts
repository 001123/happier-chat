import { createFileRoute } from '@tanstack/react-router'
import { listVoices } from '@tanstack/ai'

import { edgeSpeech } from '@/lib/edge-tts/adapter'

let cached: Promise<Response> | null = null

function load() {
  return listVoices({ adapter: edgeSpeech() }).then(({ voices }) => Response.json(voices))
}

export const Route = createFileRoute('/api/voices')({
  server: {
    handlers: {
      GET: async () => {
        cached ??= load().catch((error) => {
          cached = null
          throw error
        })
        return (await cached).clone()
      },
    },
  },
})
