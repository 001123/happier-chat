import { createPersistedStore, useStoreValue } from './store'
import type { Locale } from './i18n'

export type Mode = 'light' | 'dark'

export const colorTokens = [
  { key: 'background', label: { vi: 'Màu nền', en: 'Background' } satisfies Record<Locale, string>, vars: ['--background'] },
  {
    key: 'foreground',
    label: { vi: 'Màu chữ', en: 'Text' } satisfies Record<Locale, string>,
    vars: [
      '--foreground',
      '--card-foreground',
      '--popover-foreground',
      '--secondary-foreground',
      '--sidebar-foreground',
    ],
  },
  {
    key: 'primary',
    label: { vi: 'Màu chủ đạo', en: 'Primary' } satisfies Record<Locale, string>,
    vars: ['--primary', '--ring', '--sidebar-primary', '--sidebar-ring', '--chart-1'],
  },
  {
    key: 'primaryForeground',
    label: { vi: 'Chữ trên màu chủ đạo', en: 'Text on primary' } satisfies Record<Locale, string>,
    vars: ['--primary-foreground', '--sidebar-primary-foreground'],
  },
  { key: 'card', label: { vi: 'Thẻ & popup', en: 'Cards & popups' } satisfies Record<Locale, string>, vars: ['--card', '--popover'] },
  { key: 'secondary', label: { vi: 'Màu phụ', en: 'Secondary' } satisfies Record<Locale, string>, vars: ['--secondary', '--muted'] },
  { key: 'mutedForeground', label: { vi: 'Chữ mờ', en: 'Muted text' } satisfies Record<Locale, string>, vars: ['--muted-foreground'] },
  { key: 'accent', label: { vi: 'Màu hover', en: 'Hover' } satisfies Record<Locale, string>, vars: ['--accent', '--sidebar-accent'] },
  { key: 'border', label: { vi: 'Viền', en: 'Border' } satisfies Record<Locale, string>, vars: ['--border', '--input', '--sidebar-border'] },
  { key: 'sidebar', label: { vi: 'Nền sidebar', en: 'Sidebar background' } satisfies Record<Locale, string>, vars: ['--sidebar'] },
  { key: 'userBubble', label: { vi: 'Bong bóng tin nhắn', en: 'Message bubble' } satisfies Record<Locale, string>, vars: ['--user-bubble'] },
  { key: 'destructive', label: { vi: 'Màu cảnh báo', en: 'Warning' } satisfies Record<Locale, string>, vars: ['--destructive'] },
] as const

export type ColorKey = (typeof colorTokens)[number]['key']
export type Palette = Partial<Record<ColorKey, string>>
export type CustomColors = Record<Mode, Palette>

export const themePresets = [
  {
    id: 'terracotta',
    name: { vi: 'Đất nung', en: 'Terracotta' } satisfies Record<Locale, string>,
    light: { background: '#faf9f5', foreground: '#3d3929', primary: '#b4532f', primaryForeground: '#ffffff', card: '#ffffff', secondary: '#f0eee6', mutedForeground: '#6a6862', accent: '#ebe9df', border: '#e5e2d6', sidebar: '#f5f4ee', userBubble: '#f0eee6', destructive: '#b5452c' },
    dark: { background: '#262624', foreground: '#e5e3db', primary: '#c05430', primaryForeground: '#ffffff', card: '#30302e', secondary: '#3a3936', mutedForeground: '#acaaa2', accent: '#3a3936', border: '#3e3d39', sidebar: '#1f1e1d', userBubble: '#141413', destructive: '#e8806a' },
  },
  {
    id: 'ocean',
    name: { vi: 'Đại dương', en: 'Ocean' } satisfies Record<Locale, string>,
    light: { background: '#f8fafc', foreground: '#0f172a', primary: '#1d4ed8', primaryForeground: '#ffffff', card: '#ffffff', secondary: '#eef2f7', mutedForeground: '#5b6578', accent: '#e5eaf2', border: '#dfe5ee', sidebar: '#f1f5f9', userBubble: '#e8eef7', destructive: '#b91c1c' },
    dark: { background: '#141b2d', foreground: '#e2e8f0', primary: '#386ee3', primaryForeground: '#ffffff', card: '#1c2438', secondary: '#263049', mutedForeground: '#9aa6bc', accent: '#263049', border: '#2c3650', sidebar: '#0e1424', userBubble: '#233056', destructive: '#f87171' },
  },
  {
    id: 'forest',
    name: { vi: 'Rừng thông', en: 'Forest' } satisfies Record<Locale, string>,
    light: { background: '#f7f9f6', foreground: '#1c2a21', primary: '#15803d', primaryForeground: '#ffffff', card: '#ffffff', secondary: '#ecf1ea', mutedForeground: '#5d6b62', accent: '#e3eae0', border: '#dde5da', sidebar: '#f0f4ee', userBubble: '#e6efe4', destructive: '#b42318' },
    dark: { background: '#18201b', foreground: '#e1e8e2', primary: '#1c8548', primaryForeground: '#ffffff', card: '#212b25', secondary: '#2b3730', mutedForeground: '#9db0a3', accent: '#2b3730', border: '#324037', sidebar: '#121814', userBubble: '#0d120f', destructive: '#f2836f' },
  },
  {
    id: 'lavender',
    name: { vi: 'Oải hương', en: 'Lavender' } satisfies Record<Locale, string>,
    light: { background: '#faf8fd', foreground: '#2a2238', primary: '#6d28d9', primaryForeground: '#ffffff', card: '#ffffff', secondary: '#f1edf8', mutedForeground: '#6b6380', accent: '#ebe5f5', border: '#e4ddf0', sidebar: '#f4f1fa', userBubble: '#efe8fb', destructive: '#be123c' },
    dark: { background: '#1d1a26', foreground: '#e8e3f3', primary: '#8956e1', primaryForeground: '#ffffff', card: '#26222f', secondary: '#312c3d', mutedForeground: '#a9a1bd', accent: '#312c3d', border: '#383246', sidebar: '#16131d', userBubble: '#2b2240', destructive: '#fb7185' },
  },
  {
    id: 'rose',
    name: { vi: 'Hoa hồng', en: 'Rose' } satisfies Record<Locale, string>,
    light: { background: '#fdf8f9', foreground: '#3a2229', primary: '#be185d', primaryForeground: '#ffffff', card: '#ffffff', secondary: '#f7eef1', mutedForeground: '#7a6168', accent: '#f2e4e9', border: '#efdfe4', sidebar: '#faf1f4', userBubble: '#f7e6ec', destructive: '#b42318' },
    dark: { background: '#251c1f', foreground: '#f1e4e8', primary: '#d92872', primaryForeground: '#ffffff', card: '#2f2428', secondary: '#3a2d32', mutedForeground: '#b9a3aa', accent: '#3a2d32', border: '#44353a', sidebar: '#1c1517', userBubble: '#140f11', destructive: '#f38b75' },
  },
  {
    id: 'graphite',
    name: { vi: 'Than chì', en: 'Graphite' } satisfies Record<Locale, string>,
    light: { background: '#fafafa', foreground: '#18181b', primary: '#27272a', primaryForeground: '#fafafa', card: '#ffffff', secondary: '#f1f1f2', mutedForeground: '#5f5f68', accent: '#ececee', border: '#e4e4e7', sidebar: '#f4f4f5', userBubble: '#efeff1', destructive: '#b91c1c' },
    dark: { background: '#18181b', foreground: '#ececee', primary: '#e4e4e7', primaryForeground: '#18181b', card: '#222226', secondary: '#2c2c31', mutedForeground: '#a1a1aa', accent: '#2c2c31', border: '#34343a', sidebar: '#111113', userBubble: '#2c2c31', destructive: '#f87171' },
  },
  {
    id: 'high-contrast',
    name: { vi: 'Tương phản cao', en: 'High contrast' } satisfies Record<Locale, string>,
    light: { background: '#ffffff', foreground: '#000000', primary: '#0b3fae', primaryForeground: '#ffffff', card: '#ffffff', secondary: '#f0f0f0', mutedForeground: '#3d3d3d', accent: '#e6e6e6', border: '#767676', sidebar: '#f5f5f5', userBubble: '#ebebeb', destructive: '#a50e0e' },
    dark: { background: '#000000', foreground: '#ffffff', primary: '#ffd60a', primaryForeground: '#000000', card: '#0f0f0f', secondary: '#1f1f1f', mutedForeground: '#d0d0d0', accent: '#262626', border: '#8a8a8a', sidebar: '#0a0a0a', userBubble: '#1f1f1f', destructive: '#ff8a80' },
  },
  {
    // Inspired by the "Ultra Amber for VSCode" theme (guimar10dev.amber-for-vscode).
    id: 'ultra-amber',
    name: { vi: 'Hổ phách', en: 'Ultra Amber' } satisfies Record<Locale, string>,
    light: { background: '#fdf8ef', foreground: '#3f1400', primary: '#b45309', primaryForeground: '#ffffff', card: '#ffffff', secondary: '#f8ecd9', mutedForeground: '#7a4a26', accent: '#f3e2c6', border: '#ecd9b8', sidebar: '#faf0de', userBubble: '#f6e3c2', destructive: '#b42318' },
    dark: { background: '#3f1400', foreground: '#f3c7ac', primary: '#e69e21', primaryForeground: '#3f1400', card: '#4f1900', secondary: '#5c2705', mutedForeground: '#d49a72', accent: '#663000', border: '#6f3c0f', sidebar: '#2c1500', userBubble: '#663000', destructive: '#f48771' },
  },
  {
    // Inspired by the "Amber Schematic" theme (dang-w.theme-amber-schematic).
    id: 'amber-schematic',
    name: { vi: 'Bản vẽ hổ phách', en: 'Amber Schematic' } satisfies Record<Locale, string>,
    light: { background: '#faf6ef', foreground: '#2a241c', primary: '#b8471d', primaryForeground: '#ffffff', card: '#ffffff', secondary: '#f1ebe0', mutedForeground: '#6e6254', accent: '#e9e1d3', border: '#e2d9c9', sidebar: '#f4efe6', userBubble: '#efe6d8', destructive: '#b42318' },
    dark: { background: '#1c1814', foreground: '#e8e0d0', primary: '#e86a3a', primaryForeground: '#1f1b16', card: '#252019', secondary: '#2a241c', mutedForeground: '#b8a898', accent: '#3d352a', border: '#332d24', sidebar: '#1f1b16', userBubble: '#2a241c', destructive: '#ff6b6b' },
  },
  {
    id: 'teal',
    name: { vi: 'Ngọc lam', en: 'Teal' } satisfies Record<Locale, string>,
    light: { background: '#f6faf9', foreground: '#13302c', primary: '#0f766e', primaryForeground: '#ffffff', card: '#ffffff', secondary: '#eaf2f0', mutedForeground: '#566b67', accent: '#e0ebe8', border: '#d9e5e2', sidebar: '#eff5f4', userBubble: '#e2efec', destructive: '#b42318' },
    dark: { background: '#152120', foreground: '#dfeae8', primary: '#0f8375', primaryForeground: '#ffffff', card: '#1d2a29', secondary: '#273634', mutedForeground: '#98b0ac', accent: '#273634', border: '#2e3e3c', sidebar: '#0f1817', userBubble: '#0a1110', destructive: '#f2836f' },
  },
  {
    // Inspired by Nord.
    id: 'frost',
    name: { vi: 'Băng giá', en: 'Frost' } satisfies Record<Locale, string>,
    light: { background: '#eceff4', foreground: '#2e3440', primary: '#4c6a92', primaryForeground: '#ffffff', card: '#ffffff', secondary: '#e5e9f0', mutedForeground: '#4c566a', accent: '#dde3ec', border: '#d8dee9', sidebar: '#e5e9f0', userBubble: '#dfe6f0', destructive: '#a33a42' },
    dark: { background: '#2e3440', foreground: '#eceff4', primary: '#88c0d0', primaryForeground: '#2e3440', card: '#3b4252', secondary: '#434c5e', mutedForeground: '#b4bccb', accent: '#434c5e', border: '#4c566a', sidebar: '#272c36', userBubble: '#3b4252', destructive: '#e5949b' },
  },
  {
    // Inspired by Catppuccin (Latte / Mocha).
    id: 'mocha',
    name: { vi: 'Mocha', en: 'Mocha' } satisfies Record<Locale, string>,
    light: { background: '#eff1f5', foreground: '#4c4f69', primary: '#8839ef', primaryForeground: '#ffffff', card: '#ffffff', secondary: '#e6e9ef', mutedForeground: '#5c5f77', accent: '#dce0e8', border: '#ccd0da', sidebar: '#e6e9ef', userBubble: '#e4e0f5', destructive: '#d20f39' },
    dark: { background: '#1e1e2e', foreground: '#cdd6f4', primary: '#cba6f7', primaryForeground: '#1e1e2e', card: '#262637', secondary: '#313244', mutedForeground: '#a6adc8', accent: '#313244', border: '#3a3b50', sidebar: '#181825', userBubble: '#313244', destructive: '#f38ba8' },
  },
] as const satisfies ReadonlyArray<{ id: string; name: Record<Locale, string> } & Record<Mode, Record<ColorKey, string>>>

export type ThemePreset = (typeof themePresets)[number]

export const defaultColors: Record<Mode, Record<ColorKey, string>> = {
  light: themePresets[0].light,
  dark: themePresets[0].dark,
}

// Deep tones: white text passes WCAG AA (>= 4.5:1) and each tone keeps >= 3:1 against the default background.
export const primaryPresets = [
  { name: { vi: 'Đất nung', en: 'Terracotta' } satisfies Record<Locale, string>, light: '#b4532f', dark: '#c05430' },
  { name: { vi: 'Xanh dương', en: 'Blue' } satisfies Record<Locale, string>, light: '#1d4ed8', dark: '#386ee3' },
  { name: { vi: 'Xanh ngọc', en: 'Teal' } satisfies Record<Locale, string>, light: '#0f766e', dark: '#0f8375' },
  { name: { vi: 'Xanh lá', en: 'Green' } satisfies Record<Locale, string>, light: '#15803d', dark: '#1c8548' },
  { name: { vi: 'Tím', en: 'Violet' } satisfies Record<Locale, string>, light: '#6d28d9', dark: '#8956e1' },
  { name: { vi: 'Hồng', en: 'Rose' } satisfies Record<Locale, string>, light: '#be185d', dark: '#d92872' },
  { name: { vi: 'Hổ phách', en: 'Amber' } satisfies Record<Locale, string>, light: '#b45309', dark: '#b35e09' },
  { name: { vi: 'Xám đá', en: 'Slate' } satisfies Record<Locale, string>, light: '#334155', dark: '#627693' },
]

function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** WCAG 2.x contrast ratio between two `#rrggbb` colors. */
export function contrastRatio(a: string, b: string) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

/** White or near-black, whichever reads better on `hex`. */
export function readableOn(hex: string) {
  return contrastRatio(hex, '#ffffff') >= contrastRatio(hex, '#18181b') ? '#ffffff' : '#18181b'
}

const KEY = 'custom-colors'
const EMPTY: CustomColors = { light: {}, dark: {} }
const varMap = Object.fromEntries(colorTokens.map((t) => [t.key, t.vars]))
const colorsStore = createPersistedStore<CustomColors>(KEY, EMPTY)

export const customColorsScript = `(() => {
  try {
    const c = JSON.parse(localStorage.getItem('${KEY}') || 'null')
    if (!c) return
    const map = ${JSON.stringify(varMap)}
    const p = c[document.documentElement.classList.contains('dark') ? 'dark' : 'light'] || {}
    for (const k in p) for (const v of map[k] || []) document.documentElement.style.setProperty(v, p[k])
  } catch {}
})()`

function write(colors: CustomColors) {
  colorsStore.setState(() => colors)
  applyCustomColors()
}

export function useCustomColors() {
  return useStoreValue(colorsStore, (state) => state, () => EMPTY)
}

export function applyCustomColors() {
  const root = document.documentElement
  const mode: Mode = root.classList.contains('dark') ? 'dark' : 'light'
  const palette = colorsStore.get()[mode]
  for (const token of colorTokens) {
    const value = palette[token.key]
    for (const v of token.vars) {
      if (value) root.style.setProperty(v, value)
      else root.style.removeProperty(v)
    }
  }
}

export function setColor(mode: Mode, key: ColorKey, value: string | undefined) {
  const current = colorsStore.get()
  const palette = { ...current[mode] }
  if (value === undefined || value === defaultColors[mode][key]) delete palette[key]
  else palette[key] = value
  write({ ...current, [mode]: palette })
}

export function setPrimary(mode: Mode, value: string) {
  const current = colorsStore.get()
  const palette: Palette = { ...current[mode], primary: value, primaryForeground: readableOn(value) }
  for (const key of ['primary', 'primaryForeground'] as const) {
    if (palette[key] === defaultColors[mode][key]) delete palette[key]
  }
  write({ ...current, [mode]: palette })
}

export function applyThemePreset(preset: ThemePreset) {
  const diff = (mode: Mode) =>
    Object.fromEntries(
      Object.entries(preset[mode]).filter(([key, value]) => defaultColors[mode][key as ColorKey] !== value),
    ) as Palette
  write({ light: diff('light'), dark: diff('dark') })
}

/** Temporarily paints `preset` without saving it; `null` restores the saved colors. */
export function previewThemePreset(preset: ThemePreset | null) {
  if (!preset) return applyCustomColors()
  const root = document.documentElement
  const palette = preset[root.classList.contains('dark') ? 'dark' : 'light']
  for (const token of colorTokens) {
    for (const v of token.vars) root.style.setProperty(v, palette[token.key])
  }
}

export function isPresetActive(preset: ThemePreset, colors: CustomColors, mode: Mode) {
  return colorTokens.every(
    (token) => (colors[mode][token.key] ?? defaultColors[mode][token.key]).toLowerCase() === preset[mode][token.key],
  )
}

export function resetColors(mode?: Mode) {
  write(mode ? { ...colorsStore.get(), [mode]: {} } : EMPTY)
}
