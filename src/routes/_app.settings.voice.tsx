import * as React from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { IconLoader2, IconPlayerPlay, IconRotate, IconSquare } from '@tabler/icons-react'
import { cn } from 'cn'

import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { DEFAULTS, setSpeechSettings, useSpeechSettings } from '@/lib/speech-settings'
import { defineMessages, getLocale, useMessages } from '@/lib/i18n'
import { useSpeaker } from '@/lib/use-speaker'
import { languageName, localeOf, shortName, useLocales, useVoices, voiceLocale } from '@/lib/voices'

const messages = defineMessages({
  vi: {
    title: 'Giọng nói · Cài đặt · Happier Chat',
    heading: 'Giọng nói',
    intro: 'Đọc to câu trả lời bằng Microsoft Edge TTS. Miễn phí, không cần API key.',
    reset: 'Khôi phục mặc định',
    autoRead: 'Tự động đọc câu trả lời',
    autoReadHelp: 'Đọc to mỗi câu trả lời ngay khi bot trả lời xong.',
    voice: 'Giọng đọc',
    voiceHelp: 'Chọn ngôn ngữ rồi chọn giọng. Bấm ▶ để nghe thử.',
    language: 'Ngôn ngữ',
    loadError: (error: string) => `Không tải được danh sách giọng: ${error}`,
    loading: 'Đang tải danh sách giọng…',
    female: 'Nữ',
    male: 'Nam',
    stop: 'Dừng',
    previewVoice: (name: string) => `Nghe thử ${name}`,
    speed: 'Tốc độ',
    speedHelp: 'Đọc nhanh hay chậm hơn bình thường.',
    pitch: 'Cao độ',
    pitchHelp: 'Giọng trầm hơn hay cao hơn.',
    listen: 'Nghe thử',
    play: 'Đọc thử',
    sample: 'Xin chào! Đây là giọng đọc bạn vừa chọn. Hôm nay trời đẹp, mình đi dạo một chút nhé?',
  },
  en: {
    title: 'Voice · Settings · Happier Chat',
    heading: 'Voice',
    intro: 'Read answers aloud with Microsoft Edge TTS. Free, no API key needed.',
    reset: 'Reset to default',
    autoRead: 'Read answers automatically',
    autoReadHelp: 'Read each answer aloud as soon as the bot finishes replying.',
    voice: 'Voice',
    voiceHelp: 'Pick a language, then a voice. Press ▶ to preview.',
    language: 'Language',
    loadError: (error: string) => `Could not load the voice list: ${error}`,
    loading: 'Loading voices…',
    female: 'Female',
    male: 'Male',
    stop: 'Stop',
    previewVoice: (name: string) => `Preview ${name}`,
    speed: 'Speed',
    speedHelp: 'Read faster or slower than normal.',
    pitch: 'Pitch',
    pitchHelp: 'A lower or higher voice.',
    listen: 'Preview',
    play: 'Play sample',
    sample: "Hello! This is the voice you just picked. It's a lovely day, shall we go for a walk?",
  },
})

export const Route = createFileRoute('/_app/settings/voice')({
  head: () => ({ meta: [{ title: messages[getLocale()].title }] }),
  component: VoiceSettingsPage,
})

function VoiceSettingsPage() {
  const t = useMessages(messages)
  const settings = useSpeechSettings()
  const { voices, error } = useVoices()
  const speaker = useSpeaker()
  const [locale, setLocale] = React.useState(() => localeOf(settings.voice))
  const [sample, setSample] = React.useState(t.sample)

  const locales = useLocales(voices)
  const localeVoices = (voices ?? []).filter((v) => voiceLocale(v) === locale)

  const customized =
    settings.voice !== DEFAULTS.voice ||
    settings.speed !== DEFAULTS.speed ||
    settings.pitch !== DEFAULTS.pitch

  function preview(voice = settings.voice) {
    speaker.speak(`preview:${voice}`, sample, { voice })
  }

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
          onClick={() => setSpeechSettings({ voice: DEFAULTS.voice, speed: DEFAULTS.speed, pitch: DEFAULTS.pitch })}
        >
          <IconRotate />
          {t.reset}
        </Button>
      </div>

      <div className="divide-y rounded-xl border bg-card">
        <label className="flex cursor-pointer items-center justify-between gap-4 p-4">
          <div>
            <div className="text-sm font-medium">{t.autoRead}</div>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {t.autoReadHelp}
            </p>
          </div>
          <Switch
            checked={settings.autoRead}
            onCheckedChange={(autoRead) => setSpeechSettings({ autoRead })}
          />
        </label>

        <div className="flex flex-col gap-3 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-medium">{t.voice}</div>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {t.voiceHelp}
              </p>
            </div>
            <select
              value={locale}
              onChange={(e) => setLocale(e.target.value)}
              disabled={!voices}
              aria-label={t.language}
              className="h-8 max-w-60 rounded-lg border bg-background px-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {locales.length === 0 && <option value={locale}>{languageName(locale)}</option>}
              {locales.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.label}
                </option>
              ))}
            </select>
          </div>

          {error ? (
            <p className="text-sm text-destructive">{t.loadError(error)}</p>
          ) : !voices ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <IconLoader2 className="size-4 animate-spin" />
              {t.loading}
            </div>
          ) : (
            <div role="radiogroup" aria-label={t.voice} className="grid gap-2 sm:grid-cols-2">
              {localeVoices.map((voice) => {
                const selected = voice.voiceId === settings.voice
                const previewing = speaker.activeId === `preview:${voice.voiceId}`
                return (
                  <div
                    key={voice.voiceId}
                    className={cn(
                      'flex items-center gap-2 rounded-lg border p-1 pl-3 transition-colors',
                      selected ? 'border-primary bg-primary/5' : 'hover:bg-accent',
                    )}
                  >
                    <button
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => setSpeechSettings({ voice: voice.voiceId })}
                      className="flex min-w-0 flex-1 flex-col items-start py-1 text-left outline-none"
                    >
                      <span className="truncate text-sm font-medium">{shortName(voice)}</span>
                      <span className="text-xs text-muted-foreground">
                        {voice.labels?.gender === 'Female' ? t.female : t.male} · {voice.voiceId}
                      </span>
                    </button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={previewing ? t.stop : t.previewVoice(shortName(voice))}
                      onClick={() => (previewing ? speaker.stop() : preview(voice.voiceId))}
                    >
                      {previewing && speaker.status === 'loading' ? (
                        <IconLoader2 className="animate-spin" />
                      ) : previewing ? (
                        <IconSquare className="fill-current" />
                      ) : (
                        <IconPlayerPlay />
                      )}
                    </Button>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <SliderRow
          label={t.speed}
          description={t.speedHelp}
          min={0.5}
          max={2}
          step={0.05}
          value={settings.speed}
          format={(v) => `${v.toFixed(2)}×`}
          onChange={(speed) => setSpeechSettings({ speed })}
        />
        <SliderRow
          label={t.pitch}
          description={t.pitchHelp}
          min={-30}
          max={30}
          step={1}
          value={settings.pitch}
          format={(v) => `${v > 0 ? '+' : ''}${v} Hz`}
          onChange={(pitch) => setSpeechSettings({ pitch })}
        />
      </div>

      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-medium">{t.listen}</h3>
        <div className="flex flex-col gap-3 rounded-xl border bg-card p-4">
          <Textarea value={sample} onChange={(e) => setSample(e.target.value)} rows={3} />
          <div className="flex items-center gap-3">
            <Button
              size="sm"
              disabled={!sample.trim()}
              onClick={() => (speaker.activeId ? speaker.stop() : preview())}
            >
              {speaker.status === 'loading' ? (
                <IconLoader2 className="animate-spin" />
              ) : speaker.status === 'playing' ? (
                <IconSquare className="fill-current" />
              ) : (
                <IconPlayerPlay />
              )}
              {speaker.activeId ? t.stop : t.play}
            </Button>
            {speaker.error && (
              <p className="text-sm text-destructive">{speaker.error.message}</p>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}

function SliderRow({
  label,
  description,
  value,
  format,
  onChange,
  ...range
}: {
  label: string
  description: string
  min: number
  max: number
  step: number
  value: number
  format: (value: number) => string
  onChange: (value: number) => void
}) {
  return (
    <label className="flex flex-col gap-3 p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm font-medium">{label}</div>
          <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
        </div>
        <span className="shrink-0 text-sm tabular-nums text-muted-foreground">{format(value)}</span>
      </div>
      <input
        type="range"
        {...range}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-primary"
      />
    </label>
  )
}
