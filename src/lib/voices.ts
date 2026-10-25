import * as React from 'react'
import { queryOptions, useQuery } from '@tanstack/react-query'
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

const voicesQueryOptions = queryOptions({
  queryKey: ['voices'],
  queryFn: async (): Promise<Array<CatalogVoice>> => {
    const res = await fetch('/api/voices')
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return res.json()
  },
  // The voice list is static for the lifetime of a session.
  staleTime: Infinity,
})

export function useVoices() {
  const { data, error } = useQuery(voicesQueryOptions)
  return { voices: data ?? null, error: error?.message ?? null }
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
