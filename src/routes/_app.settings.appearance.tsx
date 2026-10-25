import * as React from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { IconAlertTriangle, IconCheck, IconMoon, IconRotate, IconSun } from '@tabler/icons-react'
import { cn } from 'cn'

import { applyTheme, useColorMode } from '@/components/theme-toggle'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  applyThemePreset,
  colorTokens,
  contrastRatio,
  defaultColors,
  isPresetActive,
  primaryPresets,
  readableOn,
  resetColors,
  setColor,
  setPrimary,
  themePresets,
  useCustomColors,
} from '@/lib/custom-colors'
import type { ColorKey, Mode, ThemePreset } from '@/lib/custom-colors'
import { defineMessages, getLocale, useLocale, useMessages } from '@/lib/i18n'

const messages = defineMessages({
  vi: {
    title: 'Chủ đề · Cài đặt · Happier Chat',
    heading: 'Chủ đề',
    intro: 'Chọn chủ đề và màu theo ý thích. Giao diện sáng và tối được lưu riêng trên trình duyệt này.',
    light: 'Sáng',
    dark: 'Tối',
    resetMode: (mode: Mode) => `Khôi phục giao diện ${mode === 'light' ? 'sáng' : 'tối'}`,
    resetAll: 'Khôi phục tất cả',
    themes: 'Chủ đề có sẵn',
    themesHint: 'Áp dụng cho cả giao diện sáng và tối.',
    suggested: 'Màu chủ đạo gợi ý',
    suggestedHint: 'Tông đậm, chữ trắng dễ đọc.',
    contrast: 'Độ tương phản',
    contrastHint: 'Theo chuẩn WCAG 2.1 AA.',
    contrastText: 'Chữ trên nền',
    contrastMuted: 'Chữ mờ trên thẻ',
    contrastPrimaryText: 'Chữ trên màu chủ đạo',
    contrastPrimary: 'Màu chủ đạo trên nền',
    pass: 'Đạt',
    fail: 'Chưa đạt',
    hexLabel: (label: string) => `Mã màu ${label}`,
    allColors: 'Tất cả màu',
    preview: 'Xem trước',
    resetColor: (label: string) => `Khôi phục ${label}`,
    resetDefault: 'Khôi phục mặc định',
    selected: 'Đang chọn',
    conversation: 'Cuộc trò chuyện',
    recent: 'Gần đây',
    sampleQuestion: 'Thời tiết Hà Nội hôm nay thế nào?',
    sampleAnswer: 'Trời nắng nhẹ, 28°C.',
    sampleUpdated: 'Cập nhật vài phút trước',
    primary: 'Chủ đạo',
    secondary: 'Phụ',
    border: 'Viền',
    delete: 'Xoá',
  },
  en: {
    title: 'Themes · Settings · Happier Chat',
    heading: 'Themes',
    intro: 'Pick a theme and colors you like. Light and dark themes are saved separately in this browser.',
    light: 'Light',
    dark: 'Dark',
    resetMode: (mode: Mode) => `Reset ${mode} theme`,
    resetAll: 'Reset all',
    themes: 'Theme presets',
    themesHint: 'Applies to both light and dark themes.',
    suggested: 'Suggested primary colors',
    suggestedHint: 'Deep tones that keep white text readable.',
    contrast: 'Contrast',
    contrastHint: 'Checked against WCAG 2.1 AA.',
    contrastText: 'Text on background',
    contrastMuted: 'Muted text on cards',
    contrastPrimaryText: 'Text on primary',
    contrastPrimary: 'Primary on background',
    pass: 'Pass',
    fail: 'Fail',
    hexLabel: (label: string) => `${label} hex code`,
    allColors: 'All colors',
    preview: 'Preview',
    resetColor: (label: string) => `Reset ${label}`,
    resetDefault: 'Reset to default',
    selected: 'Selected',
    conversation: 'Conversation',
    recent: 'Recent',
    sampleQuestion: "What's the weather in Hanoi today?",
    sampleAnswer: 'Mostly sunny, 28°C.',
    sampleUpdated: 'Updated a few minutes ago',
    primary: 'Primary',
    secondary: 'Secondary',
    border: 'Border',
    delete: 'Delete',
  },
})

export const Route = createFileRoute('/_app/settings/appearance')({
  head: () => ({ meta: [{ title: messages[getLocale()].title }] }),
  component: AppearanceSettings,
})

const HEX = /^#[0-9a-f]{6}$/i

function AppearanceSettings() {
  const t = useMessages(messages)
  const locale = useLocale()
  const mode = useColorMode()
  const colors = useCustomColors()
  const palette = { ...defaultColors[mode], ...colors[mode] }
  const customized = Object.keys(colors[mode]).length > 0

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h2 className="font-serif text-2xl tracking-tight">{t.heading}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t.intro}
        </p>
      </div>

      <section className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-lg border p-0.5">
          {(['light', 'dark'] as const).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={mode === m}
              onClick={() => applyTheme(m)}
              className={cn(
                'inline-flex h-7 items-center gap-1.5 rounded-md px-3 text-sm transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
                mode === m
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground',
              )}
            >
              {m === 'light' ? <IconSun className="size-4" /> : <IconMoon className="size-4" />}
              {m === 'light' ? t.light : t.dark}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={!customized} onClick={() => resetColors(mode)}>
            <IconRotate />
            {t.resetMode(mode)}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => resetColors()}>
            {t.resetAll}
          </Button>
        </div>
      </section>

      <section className="flex flex-col gap-3" aria-labelledby="theme-presets">
        <SectionHeading id="theme-presets" hint={t.themesHint}>{t.themes}</SectionHeading>
        <div role="radiogroup" aria-labelledby="theme-presets" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {themePresets.map((preset) => (
            <ThemeCard
              key={preset.id}
              preset={preset}
              mode={mode}
              label={preset.name[locale]}
              active={isPresetActive(preset, colors, mode)}
            />
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3" aria-labelledby="primary-presets">
        <SectionHeading id="primary-presets" hint={t.suggestedHint}>{t.suggested}</SectionHeading>
        <div role="radiogroup" aria-labelledby="primary-presets" className="flex flex-wrap gap-3">
          {primaryPresets.map((preset) => {
            const value = preset[mode]
            const active = palette.primary.toLowerCase() === value
            return (
              <button
                key={preset.name.en}
                type="button"
                role="radio"
                aria-checked={active}
                title={preset.name[locale]}
                aria-label={preset.name[locale]}
                onClick={() => setPrimary(mode, value)}
                className={cn(
                  'flex size-10 items-center justify-center rounded-full ring-offset-2 ring-offset-background transition-transform outline-none hover:scale-110 focus-visible:ring-3 focus-visible:ring-ring/60 motion-reduce:transition-none motion-reduce:hover:scale-100',
                  active && 'ring-2 ring-foreground focus-visible:ring-foreground',
                )}
                style={{ backgroundColor: value }}
              >
                {active && <IconCheck className="size-5" stroke={2.5} style={{ color: readableOn(value) }} />}
              </button>
            )
          })}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-medium">{t.allColors}</h3>
        <div className="grid gap-2 sm:grid-cols-2">
          {colorTokens.map((token) => (
            <ColorField
              key={`${mode}-${token.key}`}
              mode={mode}
              colorKey={token.key}
              label={token.label[locale]}
              value={palette[token.key]}
              changed={token.key in colors[mode]}
            />
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3" aria-labelledby="contrast-check">
        <SectionHeading id="contrast-check" hint={t.contrastHint}>{t.contrast}</SectionHeading>
        <ul className="grid gap-2 sm:grid-cols-2">
          <ContrastRow label={t.contrastText} fg={palette.foreground} bg={palette.background} min={4.5} />
          <ContrastRow label={t.contrastMuted} fg={palette.mutedForeground} bg={palette.card} min={4.5} />
          <ContrastRow label={t.contrastPrimaryText} fg={palette.primaryForeground} bg={palette.primary} min={4.5} />
          <ContrastRow label={t.contrastPrimary} fg={palette.primary} bg={palette.background} min={3} />
        </ul>
      </section>

      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-medium">{t.preview}</h3>
        <Preview />
      </section>
    </div>
  )
}

function SectionHeading({ id, hint, children }: { id: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 id={id} className="text-sm font-medium">{children}</h3>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

function ThemeCard({
  preset,
  mode,
  label,
  active,
}: {
  preset: ThemePreset
  mode: Mode
  label: string
  active: boolean
}) {
  const c = preset[mode]
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={() => applyThemePreset(preset)}
      className={cn(
        'group flex flex-col gap-2 rounded-xl border p-1.5 text-left transition-colors outline-none hover:border-foreground/40 focus-visible:ring-3 focus-visible:ring-ring/50',
        active && 'border-foreground ring-1 ring-foreground',
      )}
    >
      <span
        aria-hidden
        className="flex h-16 overflow-hidden rounded-lg border"
        style={{ backgroundColor: c.background, borderColor: c.border }}
      >
        <span className="flex w-1/4 flex-col gap-1 p-1.5" style={{ backgroundColor: c.sidebar }}>
          <span className="h-1.5 rounded-full" style={{ backgroundColor: c.accent }} />
          <span className="h-1.5 w-3/4 rounded-full" style={{ backgroundColor: c.mutedForeground, opacity: 0.5 }} />
        </span>
        <span className="flex flex-1 flex-col justify-between p-1.5">
          <span className="ml-auto h-2.5 w-1/2 rounded-full" style={{ backgroundColor: c.userBubble }} />
          <span className="flex flex-col gap-1 rounded-md p-1" style={{ backgroundColor: c.card }}>
            <span className="h-1.5 w-4/5 rounded-full" style={{ backgroundColor: c.foreground }} />
            <span className="h-1.5 w-1/2 rounded-full" style={{ backgroundColor: c.mutedForeground }} />
          </span>
          <span className="h-2.5 w-1/3 rounded-full" style={{ backgroundColor: c.primary }} />
        </span>
      </span>
      <span className="flex items-center justify-between gap-1 px-1 pb-0.5 text-sm">
        {label}
        {active && <IconCheck className="size-4 shrink-0" aria-hidden />}
      </span>
    </button>
  )
}

function ContrastRow({ label, fg, bg, min }: { label: string; fg: string; bg: string; min: number }) {
  const t = useMessages(messages)
  const ratio = contrastRatio(fg, bg)
  const pass = ratio >= min
  return (
    <li className="flex items-center gap-3 rounded-lg border bg-card p-2 text-sm">
      <span
        aria-hidden
        className="flex size-8 shrink-0 items-center justify-center rounded-md border text-xs font-semibold"
        style={{ backgroundColor: bg, color: fg }}
      >
        Aa
      </span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <span className="font-mono text-xs tabular-nums">
        {ratio.toFixed(1)}:1 <span className="text-muted-foreground">/ {min}</span>
      </span>
      <span
        className={cn(
          'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium',
          pass ? 'bg-secondary text-foreground' : 'bg-destructive/10 text-destructive',
        )}
      >
        {pass ? <IconCheck className="size-3.5" aria-hidden /> : <IconAlertTriangle className="size-3.5" aria-hidden />}
        {pass ? t.pass : t.fail}
      </span>
    </li>
  )
}

function ColorField({
  mode,
  colorKey,
  label,
  value,
  changed,
}: {
  mode: Mode
  colorKey: ColorKey
  label: string
  value: string
  changed: boolean
}) {
  const t = useMessages(messages)
  const [draft, setDraft] = React.useState(value)
  React.useEffect(() => setDraft(value), [value])

  return (
    <div className="flex items-center gap-3 rounded-lg border bg-card p-2">
      <label className="relative size-8 shrink-0 cursor-pointer overflow-hidden rounded-md border">
        <span className="absolute inset-0" style={{ backgroundColor: value }} />
        <input
          type="color"
          value={value}
          onChange={(e) => setColor(mode, colorKey, e.target.value)}
          className="absolute inset-0 cursor-pointer opacity-0"
          aria-label={label}
        />
      </label>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm">{label}</div>
        <Input
          value={draft}
          spellCheck={false}
          aria-label={t.hexLabel(label)}
          aria-invalid={!HEX.test(draft)}
          onChange={(e) => {
            const next = e.target.value.trim()
            setDraft(next)
            if (HEX.test(next)) setColor(mode, colorKey, next.toLowerCase())
          }}
          onBlur={() => setDraft(value)}
          className="mt-0.5 h-6 px-1.5 font-mono text-xs"
        />
      </div>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={t.resetColor(label)}
        title={t.resetDefault}
        disabled={!changed}
        onClick={() => setColor(mode, colorKey, undefined)}
        className={cn(!changed && 'invisible')}
      >
        <IconRotate />
      </Button>
    </div>
  )
}

function Preview() {
  const t = useMessages(messages)
  return (
    <div className="flex overflow-hidden rounded-xl border">
      <div className="hidden w-36 shrink-0 flex-col gap-1 border-r bg-sidebar p-2 text-sm text-sidebar-foreground sm:flex">
        <div className="rounded-md bg-sidebar-accent px-2 py-1">{t.selected}</div>
        <div className="px-2 py-1">{t.conversation}</div>
        <div className="px-2 py-1 text-muted-foreground">{t.recent}</div>
      </div>
      <div className="flex flex-1 flex-col gap-3 bg-background p-4">
        <div className="ml-auto max-w-[80%] rounded-2xl bg-user-bubble px-3 py-2 text-sm">
          {t.sampleQuestion}
        </div>
        <div className="rounded-lg border bg-card p-3 text-sm text-card-foreground">
          {t.sampleAnswer}
          <p className="mt-1 text-xs text-muted-foreground">{t.sampleUpdated}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm">{t.primary}</Button>
          <Button size="sm" variant="secondary">{t.secondary}</Button>
          <Button size="sm" variant="outline">{t.border}</Button>
          <Button size="sm" variant="destructive">{t.delete}</Button>
        </div>
      </div>
    </div>
  )
}
