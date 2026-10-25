import { useSyncExternalStore } from 'react'
import { createIsomorphicFn } from '@tanstack/react-start'
import { getCookie } from '@tanstack/react-start/server'

import { isEffort } from '@/lib/effort'
import type { Effort } from '@/lib/effort'
import { defineMessages, useMessages } from '@/lib/i18n'
import type { Locale } from '@/lib/i18n'

/** `model` is a `<providerId>/<modelId>` key, see `modelKey()`. */
export type ChatSettings = {
  showThinking: boolean
  showTools: boolean
  showSuggestions: boolean
  effort: Effort
  model: string | null
  customInstructions: string
  replyLanguages: Array<Locale> | null
}

export const CUSTOM_INSTRUCTIONS_MAX = 4000

type ChatToggleKey = 'showThinking' | 'showTools' | 'showSuggestions'

const toggleMessages = defineMessages({
  vi: {
    showThinking: ['Hiển thị suy nghĩ', 'Hiện quá trình suy luận (thinking) của mô hình trước câu trả lời.'],
    showTools: [
      'Hiển thị tool',
      'Hiện các lần gọi tool cùng tham số và kết quả. Thẻ thời tiết và hộp duyệt email vẫn luôn hiển thị.',
    ],
    showSuggestions: ['Gợi ý câu hỏi tiếp theo', 'Sau mỗi câu trả lời, tạo 3-5 gợi ý để bấm vào và chat tiếp ngay.'],
  } satisfies Record<ChatToggleKey, [string, string]>,
  en: {
    showThinking: ['Show thinking', "Show the model's reasoning before its answer."],
    showTools: [
      'Show tools',
      'Show tool calls with their arguments and results. Weather cards and email approvals are always shown.',
    ],
    showSuggestions: ['Follow-up suggestions', 'After each answer, offer 3-5 suggestions you can click to keep chatting.'],
  },
})

/** The on/off chat options, labelled in the current UI language. */
export function useChatToggles() {
  const messages = useMessages(toggleMessages)
  return (Object.keys(messages) as Array<ChatToggleKey>).map((key) => ({
    key,
    label: messages[key][0],
    description: messages[key][1],
  }))
}

/** The checked reply languages; `null` (never set) follows the UI language. */
export function resolveReplyLanguages(settings: ChatSettings, uiLocale: Locale): Array<Locale> {
  return settings.replyLanguages ?? [uiLocale]
}

const KEY = 'chat-settings'
const DEFAULTS: ChatSettings = {
  showThinking: true,
  showTools: true,
  showSuggestions: true,
  effort: 'high',
  model: null,
  customInstructions: '',
  replyLanguages: null,
}
const listeners = new Set<() => void>()
let cache: ChatSettings | null = null

/** Mirrors the composer's model and effort so the server renders the composer as the browser will show it. */
export const COMPOSER_COOKIE = 'chat_composer'

const readCookie = createIsomorphicFn()
  .server(() => getCookie(COMPOSER_COOKIE))
  .client(() => document.cookie.match(new RegExp(`(?:^|;\\s*)${COMPOSER_COOKIE}=([^;]*)`))?.[1])

function fromCookie(): ChatSettings {
  try {
    const { model, effort } = JSON.parse(decodeURIComponent(readCookie() ?? '')) as Record<string, unknown>
    return { ...DEFAULTS, ...(typeof model === 'string' && { model }), ...(isEffort(effort) && { effort }) }
  } catch {
    return DEFAULTS
  }
}

function writeCookie({ model, effort }: ChatSettings) {
  const value = encodeURIComponent(JSON.stringify({ model, effort }))
  document.cookie = `${COMPOSER_COOKIE}=${value}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`
}

function read(): ChatSettings {
  if (cache) return cache
  try {
    cache = { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) ?? 'null') }
  } catch {
    cache = DEFAULTS
  }
  // Settings saved before the cookie existed still need mirroring for the next server render.
  writeCookie(cache!)
  return cache!
}

// On the server every request reads its own cookie; in the browser hydration needs one stable snapshot.
let hydrationSnapshot: ChatSettings | null = null
const readServerSnapshot = () =>
  typeof window === 'undefined' ? fromCookie() : (hydrationSnapshot ??= fromCookie())

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useChatSettings() {
  return useSyncExternalStore(subscribe, read, readServerSnapshot)
}

export function setChatSetting<K extends keyof ChatSettings>(key: K, value: ChatSettings[K]) {
  cache = { ...read(), [key]: value }
  localStorage.setItem(KEY, JSON.stringify(cache))
  if (key === 'model' || key === 'effort') writeCookie(cache)
  listeners.forEach((l) => l())
}
