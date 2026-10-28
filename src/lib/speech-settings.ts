import { createPersistedStore, useStoreValue } from '@/lib/store'

/**
 * The voice service: Gemini TTS (an API key, the server's by default), Microsoft Edge TTS (free, no key), or
 * a speech model on OpenRouter (the server's key).
 */
export type SpeechEngine = 'gemini' | 'edge' | 'openrouter'

export type SpeechSettings = {
  engine: SpeechEngine
  geminiModel: string
  geminiVoice: string
  openrouterModel: string
  openrouterVoice: string
  /** An Edge voice, such as `vi-VN-HoaiMyNeural`. */
  voice: string
  speed: number
  /** Edge only: Gemini and OpenRouter take no pitch. */
  pitch: number
  autoRead: boolean
}

export const GEMINI_TTS_MODELS = [
  { id: 'gemini-3.8-flash-lite-tts', label: 'Gemini 3.8 Flash Lite' },
  { id: 'gemini-3.8-flash-tts', label: 'Gemini 3.8 Flash' },
]

// https://openrouter.ai/models?output_modalities=speech — the server only accepts these.
export const OPENROUTER_TTS_MODELS = [
  {
    id: 'heygen/heygen-voice-1-turbo:free',
    label: 'HeyGen Voice Turbo (free)',
    voices: ['nadine', 'tabitha', 'bram', 'gareth', 'noelle', 'meredith', 'sabrina', 'lucian', 'weston', 'vincent'],
  },
]

// https://ai.google.dev/gemini-api/docs/speech-generation#voices — every voice speaks every supported language.
export const GEMINI_VOICES = [
  'Zephyr', 'Puck', 'Charon', 'Kore', 'Fenrir', 'Leda', 'Orus', 'Aoede', 'Callirrhoe', 'Autonoe',
  'Enceladus', 'Iapetus', 'Umbriel', 'Algieba', 'Despina', 'Erinome', 'Algenib', 'Rasalgethi', 'Laomedeia', 'Achernar',
  'Alnilam', 'Schedar', 'Gacrux', 'Pulcherrima', 'Achird', 'Zubenelgenubi', 'Vindemiatrix', 'Sadachbia', 'Sadaltager', 'Sulafat',
]

export const DEFAULTS: SpeechSettings = {
  engine: 'gemini',
  geminiModel: 'gemini-3.8-flash-lite-tts',
  geminiVoice: 'Kore',
  openrouterModel: 'heygen/heygen-voice-1-turbo:free',
  openrouterVoice: 'nadine',
  voice: 'vi-VN-HoaiMyNeural',
  speed: 1,
  pitch: 0,
  autoRead: false,
}

const speechStore = createPersistedStore('speech-settings', DEFAULTS)

export function useSpeechSettings() {
  return useStoreValue(speechStore, (state) => state, () => DEFAULTS)
}

export function setSpeechSettings(patch: Partial<SpeechSettings>) {
  speechStore.setState((prev) => ({ ...prev, ...patch }))
}
