import { useSyncExternalStore } from 'react'

export type SpeechSettings = {
  voice: string
  speed: number
  pitch: number
  autoRead: boolean
}

const KEY = 'speech-settings'
export const DEFAULTS: SpeechSettings = {
  voice: 'vi-VN-HoaiMyNeural',
  speed: 1,
  pitch: 0,
  autoRead: false,
}
const listeners = new Set<() => void>()
let cache: SpeechSettings | null = null

function read(): SpeechSettings {
  if (cache) return cache
  try {
    cache = { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) ?? 'null') }
  } catch {
    cache = DEFAULTS
  }
  return cache!
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useSpeechSettings() {
  return useSyncExternalStore(subscribe, read, () => DEFAULTS)
}

export function setSpeechSettings(patch: Partial<SpeechSettings>) {
  cache = { ...read(), ...patch }
  localStorage.setItem(KEY, JSON.stringify(cache))
  listeners.forEach((l) => l())
}
