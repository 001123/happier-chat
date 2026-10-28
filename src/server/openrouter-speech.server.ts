import { BaseTTSAdapter } from '@tanstack/ai/adapters'
import type { TTSOptions, TTSResult } from '@tanstack/ai'

const SPEECH_URL = 'https://openrouter.ai/api/v1/audio/speech'

/** The server's OpenRouter key, shared by every signed-in user. */
export function openrouterSpeechKey() {
  return process.env.OPENROUTER_API_KEY?.trim() || null
}

/** A 44-byte WAV header, so the browser plays raw 16-bit PCM from a data URL. */
function wavHeader(bytes: number, rate: number, channels: number) {
  const header = Buffer.alloc(44)
  header.write('RIFF', 0)
  header.writeUInt32LE(36 + bytes, 4)
  header.write('WAVEfmt ', 8)
  header.writeUInt32LE(16, 16)
  header.writeUInt16LE(1, 20)
  header.writeUInt16LE(channels, 22)
  header.writeUInt32LE(rate, 24)
  header.writeUInt32LE(rate * channels * 2, 28)
  header.writeUInt16LE(channels * 2, 32)
  header.writeUInt16LE(16, 34)
  header.write('data', 36)
  header.writeUInt32LE(bytes, 40)
  return header
}

/** Reads `audio/pcm;rate=44100;channels=1`; HeyGen sends 16-bit samples at these rates. */
function pcmFormat(contentType: string) {
  const param = (name: string, fallback: number) => Number(new RegExp(`${name}=(\\d+)`).exec(contentType)?.[1] ?? fallback)
  return { rate: param('rate', 44100), channels: param('channels', 1) }
}

/**
 * OpenRouter's OpenAI-style speech endpoint. Its HeyGen voices only return raw PCM, so the audio is wrapped
 * as WAV. OpenRouter takes no speed: the client plays the audio faster or slower instead.
 */
class OpenRouterSpeechAdapter extends BaseTTSAdapter<string, Record<string, never>> {
  readonly name = 'openrouter'

  constructor(
    model: string,
    private readonly apiKey: string,
  ) {
    super(model, {})
  }

  async generateSpeech(options: TTSOptions<Record<string, never>>): Promise<TTSResult> {
    const { text, voice, logger, abortSignal } = options
    logger.request('openrouter speech', { model: this.model, voice, chars: text.length })
    const response = await fetch(SPEECH_URL, {
      method: 'POST',
      headers: { authorization: `Bearer ${this.apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({ model: this.model, input: text, voice, response_format: 'pcm' }),
      signal: abortSignal,
    })
    if (!response.ok) {
      const body = await response.text()
      let message = body
      try {
        message = (JSON.parse(body) as { error?: { message?: string } }).error?.message?.trim() || body
      } catch {}
      logger.errors('openrouter speech failed', { status: response.status, message })
      throw new Error(`OpenRouter TTS: ${message || response.statusText}`)
    }
    const pcm = Buffer.from(await response.arrayBuffer())
    const { rate, channels } = pcmFormat(response.headers.get('content-type') ?? '')
    return {
      id: this.generateId(),
      model: this.model,
      audio: Buffer.concat([wavHeader(pcm.length, rate, channels), pcm]).toString('base64'),
      format: 'wav',
      contentType: 'audio/wav',
      duration: pcm.length / (rate * channels * 2),
    }
  }
}

export function openrouterSpeech(model: string, apiKey: string) {
  return new OpenRouterSpeechAdapter(model, apiKey)
}
