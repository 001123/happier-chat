import * as React from 'react'
import { Tabs } from '@base-ui/react/tabs'
import {
  IconBook,
  IconExternalLink,
  IconLoader2,
  IconPhoto,
  IconPlayerPlay,
  IconQuote,
  IconSquare,
  IconVolume,
} from '@tabler/icons-react'
import { cn } from 'cn'

import { defineMessages, getLocale, useMessages } from '@/lib/i18n'
import { wordImageSchema } from '@/lib/tools'
import type { LearnWordInput, WordImage } from '@/lib/tools'
import type { SpeakerStatus, useSpeaker } from '@/lib/use-speaker'
import { Skeleton } from '@/components/ui/skeleton'

type Speaker = ReturnType<typeof useSpeaker>

const VOICE = { us: 'en-US-JennyNeural', uk: 'en-GB-SoniaNeural' } as const

const messages = defineMessages({
  vi: {
    listenUs: 'Nghe giọng Mỹ',
    listenUk: 'Nghe giọng Anh',
    tabPronunciation: 'Phát âm',
    tabContext: 'Ngữ cảnh',
    tabImages: 'Hình ảnh',
    readSentence: 'Đọc câu',
    noImages: 'Không tìm được ảnh minh hoạ.',
    youglishLoadFailed: 'Không tải được YouGlish',
    nativeSpeakers: 'Người bản xứ phát âm trên YouGlish',
    openYouglish: 'Mở YouGlish',
    youglishStalled: 'YouGlish phản hồi chậm hoặc bị trình duyệt/extension chặn, hãy thử mở trực tiếp bằng link bên trên.',
    youglishEmpty: 'YouGlish chưa có video cho từ này.',
    youglishError: 'Không tải được YouGlish, hãy mở trực tiếp bằng link bên trên.',
  },
  en: {
    listenUs: 'Listen to US accent',
    listenUk: 'Listen to UK accent',
    tabPronunciation: 'Pronunciation',
    tabContext: 'Context',
    tabImages: 'Images',
    readSentence: 'Read sentence aloud',
    noImages: 'No illustrations found.',
    youglishLoadFailed: 'Could not load YouGlish',
    nativeSpeakers: 'Native speakers pronouncing it on YouGlish',
    openYouglish: 'Open YouGlish',
    youglishStalled: 'YouGlish is slow to respond or blocked by your browser/extension. Try opening the link above directly.',
    youglishEmpty: 'YouGlish has no videos for this word yet.',
    youglishError: 'Could not load YouGlish. Open the link above directly.',
  },
})

export function parseWordImages(output: unknown): Array<WordImage> | null {
  let value = output
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value)
    } catch {
      return null
    }
  }
  const images = (value as { images?: unknown } | null)?.images
  const parsed = wordImageSchema.array().safeParse(images)
  return parsed.success ? parsed.data : null
}

export function WordCard({
  id,
  input,
  images,
  imagesLoading,
  speaker,
}: {
  id: string
  input: Partial<LearnWordInput>
  images: Array<WordImage> | null
  imagesLoading: boolean
  speaker: Speaker
}) {
  const t = useMessages(messages)
  const { word, partOfSpeech, ipaUs, ipaUk, meaningVi } = input
  const examples = (input.examples ?? []).filter((e) => e?.en)

  function status(key: string): SpeakerStatus {
    return speaker.activeId === `${id}:${key}` ? speaker.status : 'idle'
  }
  function toggle(key: string, text: string, voice: string) {
    const speechId = `${id}:${key}`
    if (speaker.activeId === speechId) return speaker.stop()
    void speaker.speak(speechId, text, { voice, pitch: 0 })
  }

  return (
    <div className="w-full max-w-2xl overflow-hidden rounded-3xl border border-border bg-card text-card-foreground shadow-lg shadow-black/5 animate-in fade-in zoom-in-95 duration-200">
      <div className="flex flex-col gap-3 p-5">
        <div className="flex items-start gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-sky-500/10 text-sky-600 dark:text-sky-400">
            <IconBook className="size-4.5" />
          </div>
          <div className="min-w-0">
            <div className="font-serif text-3xl leading-tight font-semibold">
              {word ?? <Skeleton className="h-8 w-32" />}
            </div>
            {partOfSpeech && <p className="text-sm text-muted-foreground italic">{partOfSpeech}</p>}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {(['us', 'uk'] as const).map((accent) => {
            const ipa = accent === 'us' ? ipaUs : ipaUk
            if (!ipa) return null
            return (
              <button
                key={accent}
                type="button"
                disabled={!word}
                onClick={() => word && toggle(accent, word, VOICE[accent])}
                aria-label={accent === 'us' ? t.listenUs : t.listenUk}
                className="inline-flex items-center gap-2 rounded-full border bg-background px-3 py-1.5 text-sm transition-colors hover:bg-muted"
              >
                <span className="text-xs font-semibold text-muted-foreground uppercase">{accent}</span>
                <span className="font-mono">{ipa}</span>
                <SpeakIcon status={status(accent)} />
              </button>
            )
          })}
        </div>

        {meaningVi && <p className="text-chat leading-relaxed">{meaningVi}</p>}
      </div>

      <Tabs.Root defaultValue="video">
        <Tabs.List className="relative z-0 flex gap-1 border-y border-border px-3">
          {[
            { value: 'video', label: t.tabPronunciation, icon: IconPlayerPlay },
            { value: 'context', label: t.tabContext, icon: IconQuote, count: examples.length },
            { value: 'images', label: t.tabImages, icon: IconPhoto, count: images?.length },
          ].map(({ value, label, icon: Icon, count }) => (
            <Tabs.Tab
              key={value}
              value={value}
              className="flex h-10 items-center gap-1.5 px-2 text-sm text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:text-foreground data-active:font-medium data-active:text-foreground"
            >
              <Icon className="size-4" />
              {label}
              {!!count && <span className="text-xs text-muted-foreground tabular-nums">{count}</span>}
            </Tabs.Tab>
          ))}
          <Tabs.Indicator className="absolute bottom-0 left-(--active-tab-left) -z-10 h-0.5 w-(--active-tab-width) rounded-full bg-sky-500 transition-all duration-200" />
        </Tabs.List>

        <Tabs.Panel value="video" className="p-5 outline-none">
          {word && input.examples !== undefined ? (
            <YouglishPlayer word={word} />
          ) : (
            <Skeleton className="h-40 rounded-2xl" />
          )}
        </Tabs.Panel>

        <Tabs.Panel value="context" className="p-5 outline-none">
          <ol className="flex flex-col gap-2">
            {examples.map((example, i) => (
              <li key={i} className="flex items-start gap-2 rounded-2xl bg-muted/50 px-3 py-2">
                <span className="mt-0.5 w-4 shrink-0 text-sm text-muted-foreground tabular-nums">{i + 1}.</span>
                <div className="min-w-0 flex-1">
                  <p className="font-serif text-reply leading-snug">
                    <Highlight text={example.en} word={word} />
                  </p>
                  {example.vi && <p className="text-sm text-muted-foreground">{example.vi}</p>}
                </div>
                <button
                  type="button"
                  onClick={() => toggle(`ex:${i}`, example.en, VOICE.us)}
                  aria-label={t.readSentence}
                  className="flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
                >
                  <SpeakIcon status={status(`ex:${i}`)} />
                </button>
              </li>
            ))}
            {examples.length < 5 &&
              Array.from({ length: 5 - examples.length }, (_, i) => (
                <Skeleton key={`s${i}`} className="h-14 rounded-2xl" />
              ))}
          </ol>
        </Tabs.Panel>

        <Tabs.Panel value="images" className="p-5 outline-none">
          <div className="grid grid-cols-3 gap-2">
            {images?.map((image) => (
              <a
                key={image.thumbUrl}
                href={image.pageUrl}
                target="_blank"
                rel="noreferrer"
                title={image.title}
                className="group/img relative aspect-square overflow-hidden rounded-2xl bg-muted"
              >
                <img
                  src={image.thumbUrl}
                  alt={image.title}
                  loading="lazy"
                  className="size-full object-cover transition-transform duration-300 group-hover/img:scale-105"
                />
              </a>
            ))}
            {imagesLoading &&
              Array.from({ length: 3 }, (_, i) => (
                <div key={i} className="flex aspect-square animate-pulse items-center justify-center rounded-2xl bg-muted">
                  <IconPhoto className="size-5 text-muted-foreground" />
                </div>
              ))}
            {!imagesLoading && !images?.length && (
              <p className="col-span-3 text-sm text-muted-foreground">{t.noImages}</p>
            )}
          </div>
        </Tabs.Panel>
      </Tabs.Root>
    </div>
  )
}

function SpeakIcon({ status }: { status: SpeakerStatus }) {
  if (status === 'loading') return <IconLoader2 className="size-4 animate-spin" />
  if (status === 'playing') return <IconSquare className="size-3.5 fill-current" />
  return <IconVolume className="size-4" />
}

function Highlight({ text, word }: { text: string; word?: string }) {
  if (!word) return text
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const parts = text.split(new RegExp(`(\\b${escaped}\\w*)`, 'gi'))
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <mark key={i} className="rounded bg-sky-500/15 px-0.5 font-semibold text-inherit">
        {part}
      </mark>
    ) : (
      part
    ),
  )
}

type YGWidget = { fetch: (query: string, lang: string, accent?: string) => void; close?: () => void }
type YGWidgetOptions = {
  width?: number
  components?: number
  autoStart?: number
  height?: number
  scroll?: 'inner'
  captionSize?: number
  events?: Record<string, (event: { totalResult?: number }) => void>
}
declare global {
  interface Window {
    YG?: { Widget: new (id: string, options: YGWidgetOptions) => YGWidget }
    onYouglishAPIReady?: () => void
  }
}

let youglishReady: Promise<void> | null = null

function loadYouglish() {
  youglishReady ??= new Promise<void>((resolve, reject) => {
    if (window.YG) return resolve()
    window.onYouglishAPIReady = () => resolve()
    const script = document.createElement('script')
    script.src = 'https://youglish.com/public/emb/widget.js'
    script.async = true
    script.onerror = () => {
      youglishReady = null
      reject(new Error(messages[getLocale()].youglishLoadFailed))
    }
    document.head.append(script)
  })
  return youglishReady
}

const YG_COMPONENTS = 2 + 8 + 16 + 64
const YG_CHROME_PX = 150
const YG_CAPTION_SIZE = 18

function YouglishPlayer({ word }: { word: string }) {
  const t = useMessages(messages)
  const boxRef = React.useRef<HTMLDivElement>(null)
  const containerRef = React.useRef<HTMLDivElement>(null)
  const [state, setState] = React.useState<'loading' | 'ready' | 'empty' | 'error'>('loading')
  const [boxWidth, setBoxWidth] = React.useState(0)
  const [stalled, setStalled] = React.useState(false)

  React.useEffect(() => {
    const box = boxRef.current
    if (!box) return
    const observer = new ResizeObserver(() => setBoxWidth(box.clientWidth))
    observer.observe(box)
    return () => observer.disconnect()
  }, [])
  const height = boxWidth ? Math.round((boxWidth * 9) / 16) + YG_CHROME_PX : undefined

  React.useEffect(() => {
    const container = containerRef.current
    if (!container || !height) return
    const target = document.createElement('div')
    target.id = `yg-${Math.random().toString(36).slice(2)}`
    container.append(target)
    let widget: YGWidget | undefined
    let cancelled = false
    let fetched = false
    setState('loading')
    setStalled(false)
    loadYouglish().then(
      () => {
        if (cancelled || !window.YG) return
        widget = new window.YG.Widget(target.id, {
          width: boxWidth,
          height,
          scroll: 'inner',
          components: YG_COMPONENTS,
          captionSize: YG_CAPTION_SIZE,
          autoStart: 0,
          events: {
            onFetchDone: (event) => {
              fetched = true
              setStalled(false)
              setState(event.totalResult ? 'ready' : 'empty')
            },
          },
        })
        widget.fetch(word, 'english')
      },
      () => !cancelled && setState('error'),
    )
    const reveal = setTimeout(() => {
      if (container.querySelector('iframe')) setState((s) => (s === 'loading' ? 'ready' : s))
    }, 4000)
    const giveUp = setTimeout(() => {
      if (!container.querySelector('iframe')) setState((s) => (s === 'loading' ? 'error' : s))
      else if (!fetched) setStalled(true)
    }, 10_000)
    return () => {
      cancelled = true
      clearTimeout(reveal)
      clearTimeout(giveUp)
      try {
        widget?.close?.()
      } catch {}
      container.replaceChildren()
    }
  }, [word, !!height])

  const link = `https://youglish.com/pronounce/${encodeURIComponent(word)}/english`
  const failed = state === 'empty' || state === 'error'

  return (
    <section data-print-exclude className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm text-muted-foreground">{t.nativeSpeakers}</h3>
        <a
          href={link}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          {t.openYouglish}
          <IconExternalLink className="size-3.5" />
        </a>
      </div>
      {!failed && (
        <div
          ref={boxRef}
          style={height ? ({ height, '--yg-h': `${height}px` } as React.CSSProperties) : undefined}
          className="relative aspect-video overflow-hidden rounded-2xl bg-muted"
        >
          {state !== 'ready' && (
            <div className="absolute inset-0 flex animate-pulse items-center justify-center">
              <IconPlayerPlay className="size-8 text-muted-foreground/60" />
            </div>
          )}
          <div
            ref={containerRef}
            className={cn(
              'transition-opacity duration-300 [&_iframe]:h-(--yg-h)! [&_iframe]:w-full! [&_iframe]:max-w-full',
              state !== 'ready' && 'opacity-0',
            )}
          />
        </div>
      )}
      {stalled && state === 'ready' && (
        <p className="text-sm text-muted-foreground">{t.youglishStalled}</p>
      )}
      {state === 'empty' && <p className="text-sm text-muted-foreground">{t.youglishEmpty}</p>}
      {state === 'error' && (
        <p className="text-sm text-muted-foreground">{t.youglishError}</p>
      )}
    </section>
  )
}
