import * as React from 'react'
import {
  IconChalkboard,
  IconLoader2,
  IconPlayerPauseFilled,
  IconPlayerPlayFilled,
  IconPlayerSkipBackFilled,
  IconPlayerSkipForwardFilled,
  IconRotateClockwise,
} from '@tabler/icons-react'
import { cn } from 'cn'
import { Streamdown } from 'streamdown'
import { code } from '@streamdown/code'

import { runnableCodeRenderers } from '@/components/runnable-code-block'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { defineMessages, useMessages } from '@/lib/i18n'
import { peleMermaid } from '@/lib/pele-mermaid'
import type { ExplainDeckInput } from '@/lib/tools'
import type { useSpeaker } from '@/lib/use-speaker'

type Speaker = ReturnType<typeof useSpeaker>
type Slide = ExplainDeckInput['slides'][number]

const STREAMDOWN_PLUGINS = { code, mermaid: peleMermaid, renderers: runnableCodeRenderers }

const messages = defineMessages({
  vi: {
    lesson: 'Bài giảng',
    play: 'Phát',
    pause: 'Tạm dừng',
    replay: 'Xem lại',
    prev: 'Slide trước',
    next: 'Slide sau',
    goTo: (n: number) => `Đến slide ${n}`,
    building: (n: number) => `Đang tạo slide ${n}…`,
    preparing: 'Đang soạn bài giảng…',
  },
  en: {
    lesson: 'Lesson',
    play: 'Play',
    pause: 'Pause',
    replay: 'Replay',
    prev: 'Previous slide',
    next: 'Next slide',
    goTo: (n: number) => `Go to slide ${n}`,
    building: (n: number) => `Building slide ${n}…`,
    preparing: 'Preparing the lesson…',
  },
})

export function ExplainCard({
  id,
  input,
  streaming,
  speaker,
}: {
  id: string
  input: Partial<ExplainDeckInput>
  /** The tool call is still streaming: more slides may arrive. */
  streaming: boolean
  speaker: Speaker
}) {
  const t = useMessages(messages)
  const slides = (input.slides ?? []).filter((s): s is Slide => Boolean(s?.title))
  // A slide is complete once the next one starts or the whole call has arrived; narration is its last field.
  const readyCount = streaming ? Math.max(0, slides.length - 1) : slides.length
  const [index, setIndex] = React.useState(0)
  // A deck that mounts while streaming is a fresh answer: play it right away, like a video.
  const [playing, setPlaying] = React.useState(streaming)
  const [ended, setEnded] = React.useState(false)
  const captionRef = React.useRef<HTMLParagraphElement>(null)
  // How far the narration of the current slide has been read, in characters; -1 before it starts.
  const [spoken, setSpoken] = React.useState(-1)

  const slide = slides[Math.min(index, slides.length - 1)]
  const ready = index < readyCount
  const speechId = `${id}:${index}`
  const status = speaker.activeId === speechId ? speaker.status : 'idle'

  React.useEffect(() => {
    if (!playing || !ready || !slide) return
    let cancelled = false
    setSpoken(-1)
    void speaker
      .speak(speechId, [{ text: slide.narration, element: captionRef.current ?? undefined }], undefined, {
        onProgress: (offset) => !cancelled && setSpoken(offset),
      })
      .then((finished) => {
        if (cancelled) return
        if (!finished) return setPlaying(false)
        // While streaming only slides with a successor are ready, so the next one always exists here.
        if (index + 1 < slides.length) return setIndex(index + 1)
        setPlaying(false)
        setEnded(true)
      })
    return () => {
      cancelled = true
    }
    // Restart only when the slide or play state changes, not on every streamed token.
  }, [playing, ready, speechId, speaker.speak])

  // A rejected deck unmounts while it may still be narrating; stop it so the corrected one starts clean.
  const speakerRef = React.useRef(speaker)
  speakerRef.current = speaker
  React.useEffect(
    () => () => {
      if (speakerRef.current.activeId?.startsWith(`${id}:`)) speakerRef.current.stop()
    },
    [id],
  )

  function go(next: number) {
    setEnded(false)
    setSpoken(-1)
    setIndex(Math.max(0, Math.min(next, Math.max(slides.length - 1, 0))))
  }

  function togglePlay() {
    if (playing) {
      setPlaying(false)
      if (speaker.activeId?.startsWith(`${id}:`)) speaker.stop()
      return
    }
    if (ended) go(0)
    setPlaying(true)
  }

  if (slides.length === 0) return <ExplainCardSkeleton />

  const cues = (slide.pointer ?? [])
    .flatMap((cue) => {
      if (!cue?.say || !cue.at || !slide.narration) return []
      const start = cueStart(slide.narration, cue.say)
      return start < 0 ? [] : [{ start, at: cue.at }]
    })
    .sort((a, b) => a.start - b.start)
  // Point at the heading until the narration reaches the first cue.
  const pointerTarget = cues.filter((cue) => cue.start <= spoken).at(-1)?.at ?? slide.title
  const pointerVisible = playing && ready && spoken >= 0

  return (
    <div className="flex w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-xs animate-in fade-in slide-in-from-bottom-1 duration-200">
      <div className="flex items-center gap-2 border-b border-border px-4 py-2.5 text-sm">
        <IconChalkboard className="size-4 shrink-0 text-primary" />
        <span className="min-w-0 flex-1 truncate font-medium">{input.title ?? t.lesson}</span>
        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
          {index + 1}/{slides.length}
        </span>
      </div>

      <div
        key={index}
        className="relative flex min-h-72 flex-col gap-3 px-6 py-5 animate-in fade-in duration-300"
      >
        <h3 className="text-lg font-semibold tracking-tight">{slide.title}</h3>
        <div className="min-w-0 text-chat">
          <Streamdown animated isAnimating={streaming && !ready} plugins={STREAMDOWN_PLUGINS}>
            {slide.content ?? ''}
          </Streamdown>
        </div>
        <SlidePointer target={pointerTarget} visible={pointerVisible} />
      </div>

      <div className="border-t border-border bg-muted/40 px-4 pt-3 pb-2">
        <p ref={captionRef} className="min-h-10 text-sm leading-relaxed text-muted-foreground">
          {slide.narration}
        </p>

        <div className="mt-2 flex gap-1" role="group">
          {slides.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={t.goTo(i + 1)}
              onClick={() => go(i)}
              className={cn(
                'h-1.5 flex-1 cursor-pointer rounded-full bg-border transition-colors',
                i < index && 'bg-primary/50',
                i === index && 'bg-primary',
              )}
            />
          ))}
        </div>

        <div className="mt-1.5 flex items-center gap-1">
          <Button variant="ghost" size="icon-sm" aria-label={t.prev} title={t.prev} disabled={index === 0} onClick={() => go(index - 1)}>
            <IconPlayerSkipBackFilled />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={playing ? t.pause : ended ? t.replay : t.play}
            title={playing ? t.pause : ended ? t.replay : t.play}
            onClick={togglePlay}
          >
            {playing && (status === 'loading' || !ready) ? (
              <IconLoader2 className="animate-spin" />
            ) : playing ? (
              <IconPlayerPauseFilled />
            ) : ended ? (
              <IconRotateClockwise />
            ) : (
              <IconPlayerPlayFilled />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t.next}
            title={t.next}
            disabled={index >= slides.length - 1}
            onClick={() => go(index + 1)}
          >
            <IconPlayerSkipForwardFilled />
          </Button>
          {streaming && <span className="ml-auto text-xs text-muted-foreground">{t.building(slides.length)}</span>}
        </div>
      </div>
    </div>
  )
}

const TOKEN = /[\p{L}\p{N}_]{2,}/gu
const tokens = (text: string) => new Set(text.toLowerCase().match(TOKEN) ?? [])
// Blocks a cue can land on when its text is not copied exactly: bullets, cells, code lines, diagram labels.
const POINTABLE = 'h3, li, p, td, th, .line, text'

/** Where a cue phrase starts in the narration: exactly, or where most of its words appear close together. */
function cueStart(narration: string, say: string) {
  const lower = narration.toLowerCase()
  const exact = lower.indexOf(say.trim().toLowerCase())
  if (exact >= 0) return exact
  const wanted = tokens(say)
  const words = Array.from(lower.matchAll(TOKEN))
  let best = { start: -1, shared: 0 }
  for (let i = 0; i < words.length; i++) {
    if (!wanted.has(words[i]![0])) continue
    const nearby = new Set(words.slice(i, i + wanted.size + 2).map((m) => m[0]))
    let shared = 0
    for (const token of wanted) if (nearby.has(token)) shared++
    if (shared > best.shared) best = { start: words[i]!.index, shared }
  }
  return best.shared >= Math.ceil(wanted.size / 2) ? best.start : -1
}

/** Bounding box of text inside root: an exact case-insensitive match first, else the block sharing the most words. */
function locateText(root: HTMLElement, text: string): DOMRect | null {
  const needle = text.trim().toLowerCase()
  if (!needle) return null
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const start = (node as Text).data.toLowerCase().indexOf(needle)
    if (start < 0) continue
    const range = document.createRange()
    range.setStart(node, start)
    range.setEnd(node, start + needle.length)
    const rect = range.getBoundingClientRect()
    if (rect.width > 0) return rect
  }
  // Models paraphrase a little or quote diagram source ("A[main] --> B[merge]") instead of the label shown.
  const wanted = tokens(needle)
  let best: { el: Element; shared: number; ratio: number } | null = null
  for (const el of root.querySelectorAll(POINTABLE)) {
    const own = tokens(el.textContent ?? '')
    if (own.size === 0) continue
    let shared = 0
    for (const token of own) if (wanted.has(token)) shared++
    const ratio = shared / own.size
    if (shared < Math.ceil(Math.min(wanted.size, own.size) / 2)) continue
    if (!best || shared > best.shared || (shared === best.shared && ratio > best.ratio)) best = { el, shared, ratio }
  }
  const rect = best?.el.getBoundingClientRect()
  return rect && rect.width > 0 ? rect : null
}

// Matches the slide transition of the cursor, so the click lands once it has arrived.
const POINTER_MOVE_MS = 700
const PARTICLES = 8
// The arrow tip sits at (2, 2) in the 24px cursor.
const TIP = 2

/** A presenter-style cursor that glides to the text being talked about; it positions itself in its parent element. */
function SlidePointer({ target, visible }: { target: string; visible: boolean }) {
  const ref = React.useRef<SVGSVGElement>(null)
  const [position, setPosition] = React.useState<{ x: number; y: number } | null>(null)
  // Bumped for each simulated click; keys the press and the particle burst so their animations replay.
  const [clicks, setClicks] = React.useState(0)
  const placed = React.useRef(false)
  const visibleRef = React.useRef(visible)
  visibleRef.current = visible

  React.useLayoutEffect(() => {
    const container = ref.current?.parentElement
    if (!container) return
    let found = false
    const update = () => {
      const rect = locateText(container, target)
      if (!rect) return
      found = true
      const box = container.getBoundingClientRect()
      setPosition({
        x: rect.left - box.left + Math.min(rect.width / 2, 32),
        y: rect.top - box.top + rect.height * 0.75,
      })
    }
    update()
    // Code highlighting and diagrams render after the text, which moves things around.
    const observer = new ResizeObserver(update)
    observer.observe(container)
    // Click when moving to a new cue, not when the cursor first appears on the slide.
    const moved = placed.current && found
    placed.current ||= found
    const click = moved
      ? window.setTimeout(() => {
          if (visibleRef.current) setClicks((n) => n + 1)
        }, POINTER_MOVE_MS)
      : undefined
    return () => {
      observer.disconnect()
      window.clearTimeout(click)
    }
  }, [target])

  const particles = React.useMemo(
    () =>
      Array.from({ length: PARTICLES }, (_, i) => {
        const angle = (i / PARTICLES) * Math.PI * 2 + (Math.random() - 0.5) * 0.6
        const distance = 12 + Math.random() * 10
        return { dx: Math.cos(angle) * distance, dy: Math.sin(angle) * distance, size: 2.5 + Math.random() * 2 }
      }),
    [clicks],
  )

  return (
    <>
      {clicks > 0 && position && (
        <span
          key={clicks}
          aria-hidden
          className="pointer-events-none absolute top-0 left-0 motion-reduce:hidden"
          style={{ transform: `translate(${position.x + TIP}px, ${position.y + TIP}px)` }}
        >
          {particles.map((p, i) => (
            <span
              key={i}
              // Starts as the press bottoms out, so the burst reads as the result of the click.
              className="absolute rounded-full bg-primary animate-[pointer-particle_600ms_cubic-bezier(0.2,0.7,0.3,1)_160ms_both]"
              style={
                {
                  width: p.size,
                  height: p.size,
                  marginLeft: -p.size / 2,
                  marginTop: -p.size / 2,
                  '--dx': `${p.dx}px`,
                  '--dy': `${p.dy}px`,
                } as React.CSSProperties
              }
            />
          ))}
        </span>
      )}
      <svg
        ref={ref}
        aria-hidden
        viewBox="0 0 24 24"
        className={cn(
          // `scale` animates on its own property, so it never fights the translate that moves the cursor.
          'pointer-events-none absolute top-0 left-0 size-6 origin-top-left text-primary drop-shadow-md transition-[transform,opacity] duration-700 ease-out animate-[pointer-breathe_3.2s_ease-in-out_infinite] motion-reduce:animate-none motion-reduce:transition-none',
          visible && position ? 'opacity-100' : 'opacity-0',
        )}
        style={position ? { transform: `translate(${position.x}px, ${position.y}px)` } : undefined}
      >
        {/* The press lives on its own element: its scale multiplies the breathing one instead of replacing it mid-cycle. */}
        <g
          key={clicks}
          className={cn(clicks > 0 && 'animate-[pointer-click_480ms_cubic-bezier(0.45,0,0.55,1)] motion-reduce:animate-none')}
          style={{ transformOrigin: `${TIP}px ${TIP}px` }}
        >
          <path d="M2 2 L9.5 21 L12.5 13 L21 10.5 Z" fill="currentColor" stroke="var(--card)" strokeWidth="1.5" strokeLinejoin="round" />
        </g>
      </svg>
    </>
  )
}

export function ExplainCardSkeleton() {
  const t = useMessages(messages)
  return (
    <div className="flex w-full max-w-2xl flex-col gap-3 rounded-2xl border border-border p-4" aria-label={t.preparing}>
      <Skeleton className="h-4 w-48" />
      <Skeleton className="h-56 w-full rounded-xl" />
      <Skeleton className="h-3 w-3/4" />
    </div>
  )
}
