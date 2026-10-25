import { createPersistedStore, useStoreValue } from '@/lib/store'

export type SpeechSettings = {
  voice: string
  speed: number
  pitch: number
  autoRead: boolean
}

export const DEFAULTS: SpeechSettings = {
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
