import { createPersistedStore, useStoreValue } from '@/lib/store'

/** The voice service: Gemini TTS (an API key, the server's by default) or Microsoft Edge TTS (free, no key). */
export type SpeechEngine = 'gemini' | 'edge'

export type SpeechSettings = {
  engine: SpeechEngine
  geminiModel: string
  geminiVoice: string
  /** An Edge voice, such as `vi-VN-HoaiMyNeural`. */
  voice: string
  speed: number
  /** Edge only: Gemini takes no pitch. */
  pitch: number
  autoRead: boolean
}

export const GEMINI_TTS_MODELS = [
  { id: 'gemini-3.8-flash-lite-tts', label: 'Gemini 3.8 Flash Lite' },
  { id: 'gemini-3.8-flash-tts', label: 'Gemini 3.8 Flash' },
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
