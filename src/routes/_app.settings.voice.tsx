import * as React from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { IconLoader2, IconPlayerPlay, IconRotate, IconSquare } from '@tabler/icons-react'
import { cn } from 'cn'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { DEFAULTS, GEMINI_TTS_MODELS, GEMINI_VOICES, setSpeechSettings, useSpeechSettings } from '@/lib/speech-settings'
import type { SpeechEngine } from '@/lib/speech-settings'
import { defineMessages, getLocale, useMessages } from '@/lib/i18n'
import { useSpeaker } from '@/lib/use-speaker'
import { languageName, localeOf, shortName, useLocales, useVoices, voiceLocale } from '@/lib/voices'
import { getSpeechKey, setSpeechKey } from '@/server/speech.functions'

const messages = defineMessages({
  vi: {
    title: 'Giọng nói · Cài đặt · Happier Chat',
    heading: 'Giọng nói',
    intro: 'Đọc to câu trả lời và bài giảng bằng Gemini TTS hoặc Microsoft Edge TTS.',
    engine: 'Dịch vụ giọng đọc',
    engineHelp: 'Gemini ổn định hơn và cần API key; Edge miễn phí nhưng đôi lúc chập chờn.',
    gemini: 'Gemini',
    geminiHelp: 'Cần API key Google AI Studio',
    edge: 'Microsoft Edge',
    edgeHelp: 'Miễn phí, không cần key',
    model: 'Model',
    modelHelp: 'Flash Lite rẻ hơn, Flash cho giọng tự nhiên hơn.',
    apiKey: 'API key Gemini',
    apiKeyHelp: {
      user: (hint: string) => `Đang dùng key của bạn (${hint}).`,
      server: 'Đang dùng key của server. Nhập key riêng để dùng key của bạn.',
      none: 'Server chưa có key: nhập key Google AI Studio để dùng giọng Gemini.',
    },
    keyPlaceholder: 'Dán API key mới',
    saveKey: 'Lưu key',
    useServerKey: 'Dùng key của server',
    geminiVoiceHelp: 'Giọng Gemini đọc được mọi ngôn ngữ. Bấm ▶ để nghe thử.',
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
    intro: 'Read answers and lessons aloud with Gemini TTS or Microsoft Edge TTS.',
    engine: 'Voice service',
    engineHelp: 'Gemini is more reliable and needs an API key; Edge is free but sometimes flaky.',
    gemini: 'Gemini',
    geminiHelp: 'Needs a Google AI Studio API key',
    edge: 'Microsoft Edge',
    edgeHelp: 'Free, no key needed',
    model: 'Model',
    modelHelp: 'Flash Lite costs less, Flash sounds more natural.',
    apiKey: 'Gemini API key',
    apiKeyHelp: {
      user: (hint: string) => `Using your own key (${hint}).`,
      server: "Using the server's key. Enter a key to use your own.",
      none: 'The server has no key: enter a Google AI Studio key to use the Gemini voice.',
    },
    keyPlaceholder: 'Paste a new API key',
    saveKey: 'Save key',
    useServerKey: "Use the server's key",
    geminiVoiceHelp: 'Gemini voices speak every language. Press ▶ to preview.',
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
    settings.engine !== DEFAULTS.engine ||
    settings.geminiModel !== DEFAULTS.geminiModel ||
    settings.geminiVoice !== DEFAULTS.geminiVoice ||
    settings.voice !== DEFAULTS.voice ||
    settings.speed !== DEFAULTS.speed ||
    settings.pitch !== DEFAULTS.pitch

  const gemini = settings.engine === 'gemini'

  function preview(voice = gemini ? settings.geminiVoice : settings.voice) {
    speaker.speak(`preview:${voice}`, sample, gemini ? { geminiVoice: voice } : { voice })
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
          onClick={() => {
            const { autoRead: _, ...defaults } = DEFAULTS
            setSpeechSettings(defaults)
          }}
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
          <div>
            <div className="text-sm font-medium">{t.engine}</div>
            <p className="mt-0.5 text-sm text-muted-foreground">{t.engineHelp}</p>
          </div>
          <div role="radiogroup" aria-label={t.engine} className="grid gap-2 sm:grid-cols-2">
            {(
              [
                ['gemini', t.gemini, t.geminiHelp],
                ['edge', t.edge, t.edgeHelp],
              ] as Array<[SpeechEngine, string, string]>
            ).map(([engine, label, help]) => (
              <button
                key={engine}
                type="button"
                role="radio"
                aria-checked={settings.engine === engine}
                onClick={() => setSpeechSettings({ engine })}
                className={cn(
                  'flex flex-col items-start rounded-lg border px-3 py-2 text-left outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50',
                  settings.engine === engine ? 'border-primary bg-primary/5' : 'hover:bg-accent',
                )}
              >
                <span className="text-sm font-medium">{label}</span>
                <span className="text-xs text-muted-foreground">{help}</span>
              </button>
            ))}
          </div>
        </div>

        {gemini && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <div className="text-sm font-medium">{t.model}</div>
                <p className="mt-0.5 text-sm text-muted-foreground">{t.modelHelp}</p>
              </div>
              <select
                value={settings.geminiModel}
                onChange={(e) => setSpeechSettings({ geminiModel: e.target.value })}
                aria-label={t.model}
                className="h-8 max-w-60 rounded-lg border bg-background px-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                {!GEMINI_TTS_MODELS.some((m) => m.id === settings.geminiModel) && (
                  <option value={settings.geminiModel}>{settings.geminiModel}</option>
                )}
                {GEMINI_TTS_MODELS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
            <GeminiKeyRow />
            <div className="flex flex-col gap-3 p-4">
              <div>
                <div className="text-sm font-medium">{t.voice}</div>
                <p className="mt-0.5 text-sm text-muted-foreground">{t.geminiVoiceHelp}</p>
              </div>
              <div role="radiogroup" aria-label={t.voice} className="grid gap-2 sm:grid-cols-3">
                {GEMINI_VOICES.map((voice) => (
                  <VoiceOption
                    key={voice}
                    name={voice}
                    selected={voice === settings.geminiVoice}
                    previewing={speaker.activeId === `preview:${voice}`}
                    loading={speaker.status === 'loading'}
                    onSelect={() => setSpeechSettings({ geminiVoice: voice })}
                    onPreview={() => (speaker.activeId === `preview:${voice}` ? speaker.stop() : preview(voice))}
                  />
                ))}
              </div>
            </div>
          </>
        )}

        {!gemini && (
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
                {localeVoices.map((voice) => (
                  <VoiceOption
                    key={voice.voiceId}
                    name={shortName(voice)}
                    detail={`${voice.labels?.gender === 'Female' ? t.female : t.male} · ${voice.voiceId}`}
                    selected={voice.voiceId === settings.voice}
                    previewing={speaker.activeId === `preview:${voice.voiceId}`}
                    loading={speaker.status === 'loading'}
                    onSelect={() => setSpeechSettings({ voice: voice.voiceId })}
                    onPreview={() =>
                      speaker.activeId === `preview:${voice.voiceId}` ? speaker.stop() : preview(voice.voiceId)
                    }
                  />
                ))}
              </div>
            )}
          </div>
        )}

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
        {!gemini && (
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
        )}
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

function VoiceOption({
  name,
  detail,
  selected,
  previewing,
  loading,
  onSelect,
  onPreview,
}: {
  name: string
  detail?: string
  selected: boolean
  previewing: boolean
  loading: boolean
  onSelect: () => void
  onPreview: () => void
}) {
  const t = useMessages(messages)
  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-lg border p-1 pl-3 transition-colors',
        selected ? 'border-primary bg-primary/5' : 'hover:bg-accent',
      )}
    >
      <button
        type="button"
        role="radio"
        aria-checked={selected}
        onClick={onSelect}
        className="flex min-w-0 flex-1 flex-col items-start py-1 text-left outline-none"
      >
        <span className="truncate text-sm font-medium">{name}</span>
        {detail && <span className="text-xs text-muted-foreground">{detail}</span>}
      </button>
      <Button variant="ghost" size="icon-sm" aria-label={previewing ? t.stop : t.previewVoice(name)} onClick={onPreview}>
        {previewing && loading ? (
          <IconLoader2 className="animate-spin" />
        ) : previewing ? (
          <IconSquare className="fill-current" />
        ) : (
          <IconPlayerPlay />
        )}
      </Button>
    </div>
  )
}

const speechKeyQuery = { queryKey: ['speech-key'], queryFn: () => getSpeechKey() }

/** The user's own Gemini key for speech: saved on the server, shown only as a hint, removable to fall back. */
function GeminiKeyRow() {
  const t = useMessages(messages)
  const queryClient = useQueryClient()
  const { data } = useQuery(speechKeyQuery)
  const [draft, setDraft] = React.useState('')
  const save = useMutation({
    mutationFn: (apiKey: string | null) => setSpeechKey({ data: { apiKey } }),
    onSuccess: (view) => {
      queryClient.setQueryData(speechKeyQuery.queryKey, view)
      setDraft('')
    },
  })

  return (
    <form
      className="flex flex-col gap-3 p-4"
      onSubmit={(e) => {
        e.preventDefault()
        if (draft.trim()) save.mutate(draft.trim())
      }}
    >
      <div>
        <label htmlFor="speech-key" className="text-sm font-medium">
          {t.apiKey}
        </label>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {!data ? '…' : data.source === 'user' ? t.apiKeyHelp.user(data.keyHint) : t.apiKeyHelp[data.source]}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          id="speech-key"
          type="password"
          autoComplete="off"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={t.keyPlaceholder}
          className="max-w-80 flex-1"
        />
        <Button type="submit" size="sm" disabled={!draft.trim() || save.isPending}>
          {save.isPending && <IconLoader2 className="animate-spin" />}
          {t.saveKey}
        </Button>
        {data?.source === 'user' && (
          <Button type="button" variant="ghost" size="sm" disabled={save.isPending} onClick={() => save.mutate(null)}>
            {t.useServerKey}
          </Button>
        )}
      </div>
      {save.error && <p className="text-sm text-destructive">{save.error.message}</p>}
    </form>
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
