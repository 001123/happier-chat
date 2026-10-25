import * as React from 'react'
import { IconDeviceDesktop, IconMoon, IconSun } from '@tabler/icons-react'
import { cn } from 'cn'
import { applyCustomColors } from '@/lib/custom-colors'
import type { Mode } from '@/lib/custom-colors'
import { defineMessages, useMessages } from '@/lib/i18n'

export type ThemePreference = 'system' | 'light' | 'dark'

const messages = defineMessages({
  vi: { system: 'Theo hệ thống', light: 'Sáng', dark: 'Tối' },
  en: { system: 'System', light: 'Light', dark: 'Dark' },
})

const options = [
  { value: 'system', icon: IconDeviceDesktop },
  { value: 'light', icon: IconSun },
  { value: 'dark', icon: IconMoon },
] as const

// Runs before hydration: applies the stored theme and follows OS changes while on "system".
export const themeScript = `(() => {
  const mq = matchMedia('(prefers-color-scheme: dark)')
  const explicit = () => { const t = localStorage.getItem('theme'); return t === 'dark' || t === 'light' ? t : null }
  const t = explicit()
  document.documentElement.classList.toggle('dark', t ? t === 'dark' : mq.matches)
  mq.addEventListener('change', (e) => {
    if (!explicit()) window.dispatchEvent(new CustomEvent('systemthemechange', { detail: e.matches }))
  })
})()`

function render(dark: boolean) {
  document.documentElement.classList.toggle('dark', dark)
  applyCustomColors()
  window.dispatchEvent(new Event('themechange'))
}

if (typeof window !== 'undefined') {
  window.addEventListener('systemthemechange', (e) => render((e as CustomEvent<boolean>).detail))
}

export function getThemePreference(): ThemePreference {
  const t = localStorage.getItem('theme')
  return t === 'light' || t === 'dark' ? t : 'system'
}

export function applyTheme(theme: ThemePreference) {
  if (theme === 'system') localStorage.removeItem('theme')
  else localStorage.setItem('theme', theme)
  render(theme === 'system' ? matchMedia('(prefers-color-scheme: dark)').matches : theme === 'dark')
}

export function useThemePreference() {
  const [pref, setPref] = React.useState<ThemePreference>('system')
  React.useEffect(() => {
    const sync = () => setPref(getThemePreference())
    sync()
    window.addEventListener('themechange', sync)
    return () => window.removeEventListener('themechange', sync)
  }, [])
  return pref
}

/** The mode currently rendered on `<html>`, kept in sync with theme changes. */
export function useColorMode(): Mode {
  const [dark, setDark] = React.useState(() => document.documentElement.classList.contains('dark'))
  React.useEffect(() => {
    const sync = () => setDark(document.documentElement.classList.contains('dark'))
    window.addEventListener('themechange', sync)
    return () => window.removeEventListener('themechange', sync)
  }, [])
  return dark ? 'dark' : 'light'
}

export function ThemeSwitcher({ className }: { className?: string }) {
  const t = useMessages(messages)
  const pref = useThemePreference()

  return (
    <div role="radiogroup" className={cn('inline-flex rounded-md border p-0.5', className)}>
      {options.map(({ value, icon: Icon }) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={pref === value}
          aria-label={t[value]}
          title={t[value]}
          onClick={() => applyTheme(value)}
          className={cn(
            'flex size-6 items-center justify-center rounded-sm outline-hidden transition-colors focus-visible:ring-2 focus-visible:ring-ring [&>svg]:size-3.5',
            pref === value
              ? 'bg-accent text-accent-foreground'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <Icon />
        </button>
      ))}
    </div>
  )
}
