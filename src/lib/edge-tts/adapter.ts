import { BaseTTSAdapter } from '@tanstack/ai/adapters'
import type { ListVoicesResult, TTSOptions, TTSResult } from '@tanstack/ai'

import { listVoices, synthesize } from './client'
import { defineMessages, getLocale } from '@/lib/i18n'

const messages = defineMessages({
  vi: { mp3Only: (format: string) => `Edge TTS chỉ hỗ trợ mp3, không hỗ trợ ${format}` },
  en: { mp3Only: (format: string) => `Edge TTS only supports mp3, not ${format}` },
})

export type EdgeSpeechModel = 'edge-read-aloud'

export type EdgeSpeechOptions = {
  pitch?: number
  volume?: number
}

const signed = (n: number, unit: string) => `${n >= 0 ? '+' : ''}${Math.round(n)}${unit}`

class EdgeSpeechAdapter extends BaseTTSAdapter<EdgeSpeechModel, EdgeSpeechOptions> {
  readonly name = 'edge-tts'
  readonly capabilities = { timestamps: true }

  async generateSpeech(options: TTSOptions<EdgeSpeechOptions>): Promise<TTSResult> {
    const { text, voice = 'vi-VN-HoaiMyNeural', speed = 1, modelOptions, logger, abortSignal } = options
    if (options.format && options.format !== 'mp3') {
      throw new Error(messages[getLocale()].mp3Only(options.format))
    }
    logger.request('edge-tts synthesize', { voice, speed, chars: text.length })
    try {
      const { audio, words } = await synthesize(
        text,
        voice,
        {
          rate: signed((speed - 1) * 100, '%'),
          pitch: signed(modelOptions?.pitch ?? 0, 'Hz'),
          volume: signed(modelOptions?.volume ?? 0, '%'),
        },
        abortSignal,
      )
      return {
        id: this.generateId(),
        model: this.model,
        audio: audio.toString('base64'),
        format: 'mp3',
        contentType: 'audio/mpeg',
        duration: audio.length / 6000,
        ...(options.timestamps && {
          alignment: {
            unit: 'word' as const,
            texts: words.map((w) => w.text),
            startSeconds: words.map((w) => w.start),
            endSeconds: words.map((w) => w.end),
          },
        }),
      }
    } catch (error) {
      logger.errors('edge-tts synthesize failed', { error })
      throw error
    }
  }

  async listVoices(): Promise<ListVoicesResult> {
    const voices = await listVoices()
    return {
      voices: voices.map((v) => ({
        voiceId: v.ShortName,
        name: v.FriendlyName,
        origin: 'premade',
        labels: { locale: v.Locale, gender: v.Gender },
      })),
    }
  }
}

export function edgeSpeech(model: EdgeSpeechModel = 'edge-read-aloud') {
  return new EdgeSpeechAdapter(model)
}
