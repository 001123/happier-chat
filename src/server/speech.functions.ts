import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import { authMiddleware } from './auth.functions'
import { assertSameOrigin } from './session.server'
import { saveGeminiSpeechKey, speechKeyView } from './speech.server'

export const getSpeechKey = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async ({ context }) => speechKeyView(context.user.id))

export const setSpeechKey = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator(z.object({ apiKey: z.string().trim().max(500).nullable() }))
  .handler(async ({ context, data }) => {
    assertSameOrigin()
    return saveGeminiSpeechKey(context.user.id, data.apiKey || null)
  })
