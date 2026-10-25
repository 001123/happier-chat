import { useSyncExternalStore } from 'react'
import { createIsomorphicFn } from '@tanstack/react-start'
import { getCookie } from '@tanstack/react-start/server'

export const LOCALES = ['vi', 'en'] as const
export type Locale = (typeof LOCALES)[number]

export const DEFAULT_LOCALE: Locale = 'vi'

/** Each language's name written in that language, so it reads right whatever the UI language is. */
export const LOCALE_NAMES: Record<Locale, string> = { vi: 'Tiếng Việt', en: 'English' }

/** BCP 47 tags for `Intl` / `toLocale*String`. */
export const LOCALE_TAGS: Record<Locale, string> = { vi: 'vi-VN', en: 'en-US' }

/** English names used when telling the model which language to write in. */
export const LOCALE_PROMPT_NAMES: Record<Locale, string> = { vi: 'Vietnamese', en: 'English' }

export function isLocale(value: unknown): value is Locale {
  return LOCALES.includes(value as Locale)
}

const COOKIE = 'lang'
const COOKIE_MAX_AGE = 365 * 24 * 60 * 60

// Kept in a cookie rather than localStorage so the server renders the right language on first paint
// and server functions can localize their error messages.
const readCookie = createIsomorphicFn()
  .server(() => getCookie(COOKIE))
  .client(() => document.cookie.match(/(?:^|;\s*)lang=([^;]*)/)?.[1])

/** Current UI language. Safe outside React: on the server it reads the request cookie. */
export function getLocale(): Locale {
  const value = readCookie()
  return isLocale(value) ? value : DEFAULT_LOCALE
}

const listeners = new Set<() => void>()
let cache: Locale | null = null

function read() {
  return (cache ??= getLocale())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useLocale(): Locale {
  return useSyncExternalStore(subscribe, read, getLocale)
}

export function setLocale(locale: Locale) {
  cache = locale
  document.cookie = `${COOKIE}=${locale}; path=/; max-age=${COOKIE_MAX_AGE}; samesite=lax`
  document.documentElement.lang = locale
  listeners.forEach((l) => l())
}

type Messages = Record<string, unknown>
type Translation<T extends Messages> = { [K in keyof T]: T[K] extends string ? string : T[K] }

/**
 * Declares a module's UI strings for every locale. `vi` sets the shape; the other locales must
 * provide the same keys (functions keep their signatures), so a missing translation is a type error.
 */
export function defineMessages<T extends Messages>(messages: { vi: T } & { [L in Exclude<Locale, 'vi'>]: Translation<T> }) {
  return messages as Record<Locale, Translation<T>>
}

/** Picks the current locale's strings from a `defineMessages()` table. */
export function useMessages<T>(messages: Record<Locale, T>): T {
  return messages[useLocale()]
}
