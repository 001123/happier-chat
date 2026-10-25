import { defineMessages, useMessages } from './i18n'
import { createPersistedStore, useStoreValue } from './store'

export type DisplaySettings = {
  uiScale: number
  chatFontScale: number
  /** Whether the left (navigation) sidebar starts open when the app loads. */
  leftSidebarOpen: boolean
  /** Whether the right (utilities) panel starts open in a new chat view. */
  rightSidebarOpen: boolean
}

/** Mirrors `leftSidebarOpen` so the server can render the sidebar in its default state. */
export const LEFT_SIDEBAR_COOKIE = 'sidebar_default'

const messages = defineMessages({
  vi: { small: 'Nhỏ', default: 'Mặc định', medium: 'Vừa', large: 'Lớn', xLarge: 'Rất lớn' },
  en: { small: 'Small', default: 'Default', medium: 'Medium', large: 'Large', xLarge: 'Extra large' },
})

export function useScaleOptions() {
  const t = useMessages(messages)
  return {
    uiScaleOptions: [
      { value: 0.875, label: t.small },
      { value: 1, label: t.default },
      { value: 1.125, label: t.large },
      { value: 1.25, label: t.xLarge },
    ],
    chatFontScaleOptions: [
      { value: 0.875, label: t.small },
      { value: 1, label: t.medium },
      { value: 1.125, label: t.large },
      { value: 1.25, label: t.xLarge },
    ],
  }
}

const KEY = 'display-settings'
export const DEFAULTS: DisplaySettings = { uiScale: 1, chatFontScale: 1, leftSidebarOpen: true, rightSidebarOpen: false }
const displayStore = createPersistedStore(KEY, DEFAULTS)

export const displaySettingsScript = `(() => {
  try {
    const s = JSON.parse(localStorage.getItem('${KEY}') || 'null')
    if (!s) return
    const r = document.documentElement
    if (s.uiScale) r.style.fontSize = s.uiScale * 100 + '%'
    if (s.chatFontScale) r.style.setProperty('--chat-font-scale', String(s.chatFontScale))
  } catch {}
})()`

export function readDisplaySettings(): DisplaySettings {
  return displayStore.get()
}

export function useDisplaySettings() {
  return useStoreValue(displayStore, (state) => state, () => DEFAULTS)
}

function apply({ uiScale, chatFontScale, leftSidebarOpen }: DisplaySettings) {
  document.cookie = `${LEFT_SIDEBAR_COOKIE}=${leftSidebarOpen}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`
  const root = document.documentElement
  if (uiScale === 1) root.style.removeProperty('font-size')
  else root.style.fontSize = `${uiScale * 100}%`
  if (chatFontScale === 1) root.style.removeProperty('--chat-font-scale')
  else root.style.setProperty('--chat-font-scale', String(chatFontScale))
}

export function setDisplaySettings(patch: Partial<DisplaySettings>) {
  displayStore.setState((prev) => ({ ...prev, ...patch }))
  apply(displayStore.get())
}
