import { createFileRoute } from '@tanstack/react-router'
import { IconRotate } from '@tabler/icons-react'
import { cn } from 'cn'

import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import {
  DEFAULTS,
  setDisplaySettings,
  useDisplaySettings,
  useScaleOptions,
} from '@/lib/display-settings'
import {
  BUNDLED_FONTS,
  fontPreviewStylesheetUrl,
  fontStack,
  SANS_FONTS,
  SERIF_FONTS,
  type FontSlot,
  type GoogleFont,
} from '@/lib/google-fonts'
import { defineMessages, getLocale, useMessages } from '@/lib/i18n'

const messages = defineMessages({
  vi: {
    title: 'Hiển thị · Cài đặt · Happier Chat',
    heading: 'Hiển thị',
    intro: 'Điều chỉnh kích thước giao diện, cỡ chữ và các sidebar mặc định.',
    reset: 'Khôi phục mặc định',
    uiScale: 'Tỉ lệ giao diện',
    uiScaleHelp: 'Phóng to hoặc thu nhỏ toàn bộ ứng dụng: chữ, nút, khoảng cách, sidebar.',
    chatFont: 'Cỡ chữ trò chuyện',
    chatFontHelp: 'Cỡ chữ của tin nhắn, câu trả lời và ô nhập.',
    sansFont: 'Phông giao diện',
    sansFontHelp: 'Dùng cho nút, menu, tin nhắn của bạn và ô nhập.',
    serifFont: 'Phông câu trả lời',
    serifFontHelp: 'Dùng cho câu trả lời của AI và tiêu đề.',
    fontSource: 'Phông chữ khác Mặc định được tải từ Google Fonts.',
    defaultFont: 'Mặc định',
    leftSidebar: 'Mở sidebar trái',
    leftSidebarHelp: 'Danh sách cuộc trò chuyện mở sẵn khi tải ứng dụng.',
    rightSidebar: 'Mở bảng Tiện ích',
    rightSidebarHelp: 'Bảng Tiện ích bên phải mở sẵn khi vào một cuộc trò chuyện.',
    preview: 'Xem trước',
    sampleQuestion: 'Giải thích ngắn gọn về view transition?',
    sampleAnswer:
      'View Transitions API cho phép trình duyệt chụp lại trạng thái cũ và mới của trang, rồi tự tạo hiệu ứng chuyển tiếp mượt giữa hai trạng thái đó.',
  },
  en: {
    title: 'Display · Settings · Happier Chat',
    heading: 'Display',
    intro: 'Adjust the interface size, font size and default sidebars.',
    reset: 'Reset to default',
    uiScale: 'Interface scale',
    uiScaleHelp: 'Zoom the whole app in or out: text, buttons, spacing, sidebar.',
    chatFont: 'Chat font size',
    chatFontHelp: 'Font size of messages, replies and the input box.',
    sansFont: 'Interface font',
    sansFontHelp: 'Used for buttons, menus, your messages and the input box.',
    serifFont: 'Reply font',
    serifFontHelp: 'Used for AI replies and headings.',
    fontSource: 'Fonts other than Default are loaded from Google Fonts.',
    defaultFont: 'Default',
    leftSidebar: 'Open left sidebar',
    leftSidebarHelp: 'Show the conversation list when the app loads.',
    rightSidebar: 'Open Utilities panel',
    rightSidebarHelp: 'Show the Utilities panel on the right when opening a conversation.',
    preview: 'Preview',
    sampleQuestion: 'Briefly explain view transitions?',
    sampleAnswer:
      'The View Transitions API lets the browser capture the old and new state of a page, then automatically create a smooth transition between the two.',
  },
})

export const Route = createFileRoute('/_app/settings/display')({
  head: () => ({ meta: [{ title: messages[getLocale()].title }] }),
  component: DisplaySettingsPage,
})

function DisplaySettingsPage() {
  const t = useMessages(messages)
  const { uiScaleOptions, chatFontScaleOptions } = useScaleOptions()
  const settings = useDisplaySettings()
  const customized = (Object.keys(DEFAULTS) as Array<keyof typeof DEFAULTS>).some(
    (key) => settings[key] !== DEFAULTS[key],
  )
  const sidebarToggles = [
    { key: 'leftSidebarOpen', label: t.leftSidebar, description: t.leftSidebarHelp },
    { key: 'rightSidebarOpen', label: t.rightSidebar, description: t.rightSidebarHelp },
  ] as const

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-serif text-2xl tracking-tight">{t.heading}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t.intro}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={!customized}
          onClick={() => setDisplaySettings(DEFAULTS)}
        >
          <IconRotate />
          {t.reset}
        </Button>
      </div>

      <div className="divide-y rounded-xl border bg-card">
        <SettingRow
          label={t.uiScale}
          description={t.uiScaleHelp}
        >
          <Segmented
            options={uiScaleOptions}
            value={settings.uiScale}
            onChange={(uiScale) => setDisplaySettings({ uiScale })}
          />
        </SettingRow>
        <SettingRow
          label={t.chatFont}
          description={t.chatFontHelp}
        >
          <Segmented
            options={chatFontScaleOptions}
            value={settings.chatFontScale}
            onChange={(chatFontScale) => setDisplaySettings({ chatFontScale })}
          />
        </SettingRow>
      </div>

      <div className="flex flex-col gap-2">
        <div className="divide-y rounded-xl border bg-card">
          <SettingRow label={t.sansFont} description={t.sansFontHelp} inline>
            <FontPicker
              slot="sans"
              fonts={SANS_FONTS}
              defaultLabel={`${t.defaultFont} · Geist`}
              googleLabel="Google Fonts"
              value={settings.sansFont}
              onChange={(sansFont) => setDisplaySettings({ sansFont })}
            />
          </SettingRow>
          <SettingRow label={t.serifFont} description={t.serifFontHelp} inline>
            <FontPicker
              slot="serif"
              fonts={SERIF_FONTS}
              defaultLabel={`${t.defaultFont} · Source Serif`}
              googleLabel="Google Fonts"
              value={settings.serifFont}
              onChange={(serifFont) => setDisplaySettings({ serifFont })}
            />
          </SettingRow>
        </div>
        <p className="px-1 text-xs text-muted-foreground">{t.fontSource}</p>
      </div>

      <div className="divide-y rounded-xl border bg-card">
        {sidebarToggles.map((option) => (
          <label key={option.key} className="flex cursor-pointer items-center justify-between gap-4 p-4">
            <div>
              <div className="text-sm font-medium">{option.label}</div>
              <p className="mt-0.5 text-sm text-muted-foreground">{option.description}</p>
            </div>
            <Switch
              checked={settings[option.key]}
              onCheckedChange={(checked) => setDisplaySettings({ [option.key]: checked })}
            />
          </label>
        ))}
      </div>

      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-medium">{t.preview}</h3>
        <div className="flex flex-col gap-3 rounded-xl border bg-background p-4">
          <div className="ml-auto max-w-[80%] rounded-2xl rounded-br-md border border-border bg-user-bubble px-4 py-2.5 text-chat leading-relaxed shadow-xs">
            {t.sampleQuestion}
          </div>
          <p className="w-fit max-w-[90%] rounded-2xl rounded-bl-md border border-border bg-card px-4 py-3 font-serif text-reply leading-[1.7] text-card-foreground shadow-xs">
            {t.sampleAnswer}
          </p>
        </div>
      </section>
    </div>
  )
}

function SettingRow({
  label,
  description,
  inline = false,
  children,
}: {
  label: string
  description: string
  /** Puts the control beside the label instead of below it. */
  inline?: boolean
  children: React.ReactNode
}) {
  return (
    <div className={cn('flex gap-3 p-4', inline ? 'flex-col sm:flex-row sm:items-center sm:justify-between' : 'flex-col')}>
      <div>
        <div className="text-sm font-medium">{label}</div>
        <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
      </div>
      {children}
    </div>
  )
}

function Segmented({
  options,
  value,
  onChange,
}: {
  options: Array<{ value: number; label: string }>
  value: number
  onChange: (value: number) => void
}) {
  return (
    <div className="inline-flex w-fit flex-wrap rounded-lg border p-0.5">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            'inline-flex h-7 items-center gap-1.5 rounded-md px-3 text-sm transition-colors',
            value === option.value
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:bg-accent hover:text-foreground',
          )}
        >
          {option.label}
          <span className="text-xs opacity-70">{Math.round(option.value * 100)}%</span>
        </button>
      ))}
    </div>
  )
}

const DEFAULT_FONT = 'default'

function FontPicker({
  slot,
  fonts,
  defaultLabel,
  googleLabel,
  value,
  onChange,
}: {
  slot: FontSlot
  fonts: ReadonlyArray<GoogleFont>
  defaultLabel: string
  googleLabel: string
  value: string | null
  onChange: (value: string | null) => void
}) {
  const options = [
    { value: DEFAULT_FONT, label: defaultLabel, fontFamily: BUNDLED_FONTS[slot] },
    ...fonts.map((font) => ({ value: font.family, label: font.family, fontFamily: fontStack(slot, font.family) })),
  ]
  const selected = options.find((option) => option.value === (value ?? DEFAULT_FONT)) ?? options[0]
  const [bundled, ...google] = options
  return (
    <>
      <link rel="stylesheet" href={fontPreviewStylesheetUrl(fonts)} precedence="default" />
      <Select
        items={Object.fromEntries(options.map((option) => [option.value, option.label]))}
        value={selected.value}
        onValueChange={(next: string | null) => next && onChange(next === DEFAULT_FONT ? null : next)}
      >
        <SelectTrigger className="w-full shrink-0 sm:w-56" style={{ fontFamily: selected.fontFamily }}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent alignItemWithTrigger={false} align="end" className="max-h-80">
          <SelectGroup>
            <FontItem option={bundled} />
          </SelectGroup>
          <SelectSeparator />
          <SelectGroup>
            <SelectLabel>{googleLabel}</SelectLabel>
            {google.map((option) => (
              <FontItem key={option.value} option={option} />
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </>
  )
}

function FontItem({ option }: { option: { value: string; label: string; fontFamily: string } }) {
  return (
    <SelectItem value={option.value} className="py-1.5 text-[0.9375rem]" style={{ fontFamily: option.fontFamily }}>
      {option.label}
    </SelectItem>
  )
}
