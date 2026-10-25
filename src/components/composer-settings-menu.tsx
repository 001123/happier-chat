import * as React from 'react'
import { Menu } from '@base-ui/react/menu'
import { IconCheck, IconChevronRight, IconLoader2, IconMessage, IconSettings, IconVolume } from '@tabler/icons-react'
import { cn } from 'cn'

import { InputGroupButton } from '@/components/ui/input-group'
import { defineMessages, useMessages } from '@/lib/i18n'
import { setChatSetting, useChatSettings, useChatToggles } from '@/lib/chat-settings'
import { setSpeechSettings, useSpeechSettings } from '@/lib/speech-settings'
import { languageName, localeOf, shortName, useLocales, useVoices, voiceLocale } from '@/lib/voices'

const messages = defineMessages({
  vi: {
    settings: 'Cài đặt',
    chat: 'Trò chuyện',
    autoRead: 'Tự động đọc',
    on: 'Bật',
    off: 'Tắt',
    autoReadAnswers: 'Tự động đọc câu trả lời',
    speed: 'Tốc độ',
    pitch: 'Cao độ',
    language: 'Ngôn ngữ',
    voice: 'Giọng đọc',
    female: 'Nữ',
    male: 'Nam',
    voicesError: (error: string) => `Không tải được giọng: ${error}`,
    loading: 'Đang tải…',
  },
  en: {
    settings: 'Settings',
    chat: 'Chat',
    autoRead: 'Auto-read',
    on: 'On',
    off: 'Off',
    autoReadAnswers: 'Read answers aloud automatically',
    speed: 'Speed',
    pitch: 'Pitch',
    language: 'Language',
    voice: 'Voice',
    female: 'Female',
    male: 'Male',
    voicesError: (error: string) => `Could not load voices: ${error}`,
    loading: 'Loading…',
  },
})

export const popupClass =
  'min-w-52 rounded-xl border bg-popover p-1 text-popover-foreground shadow-md outline-none origin-(--transform-origin) transition-[opacity,scale] duration-150 data-starting-style:scale-95 data-starting-style:opacity-0 data-ending-style:scale-95 data-ending-style:opacity-0'
export const itemClass =
  'flex h-8 cursor-default items-center gap-2 rounded-lg px-2 text-sm outline-none select-none data-highlighted:bg-accent data-highlighted:text-accent-foreground data-popup-open:bg-accent [&_svg]:size-4 [&_svg]:shrink-0'

export function ComposerSettingsMenu() {
  const t = useMessages(messages)
  return (
    <Menu.Root>
      <Menu.Trigger
        openOnHover
        delay={100}
        render={<InputGroupButton type="button" size="icon-xs" aria-label={t.settings} />}
        className="text-muted-foreground data-popup-open:bg-muted data-popup-open:text-foreground"
      >
        <IconSettings />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner side="top" align="end" sideOffset={6} collisionPadding={8} className="z-50">
          <Menu.Popup className={popupClass}>
            <ChatSubmenu />
            <AutoReadSubmenu />
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  )
}

function SubmenuPopup({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <Menu.Portal>
      <Menu.Positioner side="left" align="start" sideOffset={4} alignOffset={-4} collisionPadding={8} className="z-50">
        <Menu.Popup className={cn(popupClass, className)}>{children}</Menu.Popup>
      </Menu.Positioner>
    </Menu.Portal>
  )
}

function SubmenuTrigger({ label, value, icon }: { label: string; value?: string; icon?: React.ReactNode }) {
  return (
    <Menu.SubmenuTrigger className={itemClass}>
      {icon}
      <span className="flex-1">{label}</span>
      {value && <span className="max-w-28 truncate text-xs text-muted-foreground">{value}</span>}
      <IconChevronRight className="text-muted-foreground" />
    </Menu.SubmenuTrigger>
  )
}

function ChatSubmenu() {
  const t = useMessages(messages)
  const settings = useChatSettings()
  const chatToggles = useChatToggles()

  return (
    <Menu.SubmenuRoot>
      <SubmenuTrigger icon={<IconMessage />} label={t.chat} />
      <SubmenuPopup>
        {chatToggles.map((option) => (
          <SwitchItem
            key={option.key}
            label={option.label}
            checked={settings[option.key]}
            onCheckedChange={(checked) => setChatSetting(option.key, checked)}
          />
        ))}
      </SubmenuPopup>
    </Menu.SubmenuRoot>
  )
}

function AutoReadSubmenu() {
  const t = useMessages(messages)
  const settings = useSpeechSettings()
  const { voices, error } = useVoices()
  const locales = useLocales(voices)
  const locale = localeOf(settings.voice)
  const localeVoices = (voices ?? []).filter((v) => voiceLocale(v) === locale)
  const currentVoice = voices?.find((v) => v.voiceId === settings.voice)

  return (
    <Menu.SubmenuRoot>
      <SubmenuTrigger icon={<IconVolume />} label={t.autoRead} value={settings.autoRead ? t.on : t.off} />
      <SubmenuPopup className="w-64">
        <SwitchItem
          label={t.autoReadAnswers}
          checked={settings.autoRead}
          onCheckedChange={(autoRead) => setSpeechSettings({ autoRead })}
        />

        <Menu.Separator className="-mx-1 my-1 h-px bg-border" />

        <MenuSlider
          label={t.speed}
          min={0.5}
          max={2}
          step={0.05}
          value={settings.speed}
          format={(v) => `${v.toFixed(2)}×`}
          onChange={(speed) => setSpeechSettings({ speed })}
        />
        <MenuSlider
          label={t.pitch}
          min={-30}
          max={30}
          step={1}
          value={settings.pitch}
          format={(v) => `${v > 0 ? '+' : ''}${v} Hz`}
          onChange={(pitch) => setSpeechSettings({ pitch })}
        />

        <Menu.Separator className="-mx-1 my-1 h-px bg-border" />

        <Menu.SubmenuRoot>
          <SubmenuTrigger label={t.language} value={languageName(locale)} />
          <SubmenuPopup className="max-h-80 overflow-y-auto">
            <VoicesState voices={voices} error={error}>
              <Menu.RadioGroup
                value={locale}
                onValueChange={(next: string) => {
                  const voice = voices?.find((v) => voiceLocale(v) === next)
                  if (voice) setSpeechSettings({ voice: voice.voiceId })
                }}
              >
                {locales.map((l) => (
                  <RadioItem key={l.value} value={l.value} label={l.label} />
                ))}
              </Menu.RadioGroup>
            </VoicesState>
          </SubmenuPopup>
        </Menu.SubmenuRoot>

        <Menu.SubmenuRoot>
          <SubmenuTrigger
            label={t.voice}
            value={currentVoice ? shortName(currentVoice) : settings.voice}
          />
          <SubmenuPopup className="max-h-80 overflow-y-auto">
            <VoicesState voices={voices} error={error}>
              <Menu.RadioGroup
                value={settings.voice}
                onValueChange={(voice: string) => setSpeechSettings({ voice })}
              >
                {localeVoices.map((v) => (
                  <RadioItem
                    key={v.voiceId}
                    value={v.voiceId}
                    label={shortName(v)}
                    hint={v.labels?.gender === 'Female' ? t.female : t.male}
                  />
                ))}
              </Menu.RadioGroup>
            </VoicesState>
          </SubmenuPopup>
        </Menu.SubmenuRoot>
      </SubmenuPopup>
    </Menu.SubmenuRoot>
  )
}

function SwitchItem({
  label,
  checked,
  onCheckedChange,
}: {
  label: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}) {
  return (
    <Menu.CheckboxItem
      checked={checked}
      onCheckedChange={onCheckedChange}
      closeOnClick={false}
      className={itemClass}
    >
      <span className="flex-1">{label}</span>
      <span
        aria-hidden
        className={cn('relative h-4 w-7 rounded-full transition-colors', checked ? 'bg-primary' : 'bg-input')}
      >
        <span
          className={cn(
            'absolute top-0.5 left-0.5 size-3 rounded-full bg-background transition-transform',
            checked && 'translate-x-3',
          )}
        />
      </span>
    </Menu.CheckboxItem>
  )
}

function VoicesState({
  voices,
  error,
  children,
}: {
  voices: unknown
  error: string | null
  children: React.ReactNode
}) {
  const t = useMessages(messages)
  if (error) return <p className="px-2 py-1.5 text-sm text-destructive">{t.voicesError(error)}</p>
  if (!voices)
    return (
      <div className="flex items-center gap-2 px-2 py-1.5 text-sm text-muted-foreground">
        <IconLoader2 className="size-4 animate-spin" />
        {t.loading}
      </div>
    )
  return children
}

function RadioItem({ value, label, hint }: { value: string; label: string; hint?: string }) {
  return (
    <Menu.RadioItem value={value} closeOnClick={false} className={itemClass}>
      <span className="flex size-4 items-center justify-center">
        <Menu.RadioItemIndicator>
          <IconCheck />
        </Menu.RadioItemIndicator>
      </span>
      <span className="flex-1 truncate">{label}</span>
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </Menu.RadioItem>
  )
}

function MenuSlider({
  label,
  value,
  format,
  onChange,
  ...range
}: {
  label: string
  min: number
  max: number
  step: number
  value: number
  format: (value: number) => string
  onChange: (value: number) => void
}) {
  return (
    <label className="flex flex-col gap-1.5 px-2 py-1.5">
      <span className="flex items-center justify-between text-sm">
        {label}
        <span className="text-xs tabular-nums text-muted-foreground">{format(value)}</span>
      </span>
      <input
        type="range"
        {...range}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        onKeyDown={(e) => e.stopPropagation()}
        className="w-full accent-primary"
      />
    </label>
  )
}
