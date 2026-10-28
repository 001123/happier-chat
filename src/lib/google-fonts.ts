/** Curated Google Fonts that ship a Vietnamese subset. `axes` is the css2 axis spec for the family. */
export type GoogleFont = { family: string; axes: string }

export const SANS_FONTS: ReadonlyArray<GoogleFont> = [
  { family: 'Inter', axes: 'wght@100..900' },
  { family: 'Be Vietnam Pro', axes: 'wght@300;400;500;600;700' },
  { family: 'Roboto', axes: 'wght@100..900' },
  { family: 'Open Sans', axes: 'wght@300..800' },
  { family: 'Noto Sans', axes: 'wght@100..900' },
  { family: 'Nunito', axes: 'wght@200..1000' },
  { family: 'Mulish', axes: 'wght@200..1000' },
  { family: 'Montserrat', axes: 'wght@100..900' },
  { family: 'Lexend', axes: 'wght@100..900' },
  { family: 'Quicksand', axes: 'wght@300..700' },
]

export const SERIF_FONTS: ReadonlyArray<GoogleFont> = [
  { family: 'Noto Serif', axes: 'wght@100..900' },
  { family: 'Literata', axes: 'wght@200..900' },
  { family: 'Lora', axes: 'wght@400..700' },
  { family: 'Merriweather', axes: 'wght@300;400;700' },
  { family: 'EB Garamond', axes: 'wght@400..800' },
  { family: 'Playfair Display', axes: 'wght@400..900' },
  { family: 'Roboto Slab', axes: 'wght@100..900' },
]

export type FontSlot = 'sans' | 'serif'

/** The self-hosted fonts each slot uses by default, and falls back to while a Google font loads. */
export const BUNDLED_FONTS: Record<FontSlot, string> = {
  sans: "'Geist Variable', sans-serif",
  serif: "'Source Serif 4 Variable', Georgia, serif",
}

const AXES: Record<string, string> = Object.fromEntries(
  [...SANS_FONTS, ...SERIF_FONTS].map((font) => [font.family, font.axes]),
)

function familyParam(family: string, axes?: string) {
  return `family=${family.replaceAll(' ', '+')}${axes ? `:${axes}` : ''}`
}

export function fontStylesheetUrl(family: string) {
  return `https://fonts.googleapis.com/css2?${familyParam(family, AXES[family])}&display=swap`
}

/** Loads only the glyphs of each family's name, so the picker can render every option in its own font cheaply. */
export function fontPreviewStylesheetUrl(fonts: ReadonlyArray<GoogleFont>) {
  const text = [...new Set(fonts.map((font) => font.family).join(''))].join('')
  return `https://fonts.googleapis.com/css2?${fonts.map((font) => familyParam(font.family)).join('&')}&text=${encodeURIComponent(text)}&display=swap`
}

export function fontStack(slot: FontSlot, family: string) {
  return `'${family}', ${BUNDLED_FONTS[slot]}`
}

/** Points `--app-font-<slot>` at the family and loads its stylesheet; `null` restores the bundled font. */
export function applyFont(slot: FontSlot, family: string | null) {
  const root = document.documentElement
  const id = `google-font-${slot}`
  const existing = document.getElementById(id) as HTMLLinkElement | null
  if (!family || !(family in AXES)) {
    existing?.remove()
    root.style.removeProperty(`--app-font-${slot}`)
    return
  }
  const href = fontStylesheetUrl(family)
  if (existing) {
    if (existing.href !== href) existing.href = href
  } else {
    const link = document.createElement('link')
    link.id = id
    link.rel = 'stylesheet'
    link.href = href
    document.head.append(link)
  }
  root.style.setProperty(`--app-font-${slot}`, fontStack(slot, family))
}

/** Inline, pre-hydration version of `applyFont` so a chosen font is in place before first paint. */
export const applyFontScript = `function applyFont(slot, family) {
  const axes = ${JSON.stringify(AXES)}[family]
  if (!axes) return
  const link = document.createElement('link')
  link.id = 'google-font-' + slot
  link.rel = 'stylesheet'
  link.href = 'https://fonts.googleapis.com/css2?family=' + family.replaceAll(' ', '+') + ':' + axes + '&display=swap'
  document.head.append(link)
  const fallback = ${JSON.stringify(BUNDLED_FONTS)}[slot]
  document.documentElement.style.setProperty('--app-font-' + slot, "'" + family + "', " + fallback)
}`
