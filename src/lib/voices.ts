import * as React from 'react'
import type { CatalogVoice } from '@tanstack/ai'

import { LOCALE_TAGS, getLocale, useLocale } from './i18n'

export const languageName = (locale: string) => {
  try {
    return new Intl.DisplayNames([LOCALE_TAGS[getLocale()]], { type: 'language' }).of(locale) ?? locale
  } catch {
    return locale
  }
}

export const shortName = (voice: CatalogVoice) =>
  voice.name?.match(/^Microsoft (.+?) Online/)?.[1] ?? voice.voiceId

export const localeOf = (voiceId: string) => voiceId.split('-').slice(0, 2).join('-')

export const voiceLocale = (voice: CatalogVoice) => voice.labels?.locale ?? localeOf(voice.voiceId)

let request: Promise<Array<CatalogVoice>> | null = null
function loadVoices() {
  request ??= fetch('/api/voices')
    .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
    .catch((e: Error) => {
      request = null
      throw e
    })
  return request
}

export function useVoices() {
  const [voices, setVoices] = React.useState<Array<CatalogVoice> | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  React.useEffect(() => {
    let cancelled = false
    loadVoices()
      .then((data) => !cancelled && setVoices(data))
      .catch((e: Error) => !cancelled && setError(e.message))
    return () => {
      cancelled = true
    }
  }, [])
  return { voices, error }
}

export function useLocales(voices: Array<CatalogVoice> | null) {
  const uiLocale = useLocale()
  return React.useMemo(() => {
    const set = new Set((voices ?? []).map(voiceLocale))
    return [...set]
      .map((value) => ({ value, label: languageName(value) }))
      .sort((a, b) => a.label.localeCompare(b.label, LOCALE_TAGS[uiLocale]))
  }, [voices, uiLocale])
}
