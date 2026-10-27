import * as React from 'react'
import {
  IconArrowRight,
  IconArrowUp,
  IconBinoculars,
  IconChalkboard,
  IconLoader2,
  IconMaximize,
  IconMinimize,
  IconPlayerPauseFilled,
  IconPlayerPlayFilled,
  IconPlayerSkipBackFilled,
  IconPlayerSkipForwardFilled,
  IconRotateClockwise,
  IconVolume,
  IconVolume2,
  IconVolume3,
} from '@tabler/icons-react'
import { useHotkey } from '@tanstack/react-hotkeys'
import { cn } from 'cn'
import { Streamdown } from 'streamdown'
import { code } from '@streamdown/code'

import { useExplainStyleNames } from '@/components/chat-modes'
import { runnableCodeRenderers } from '@/components/runnable-code-block'
import { Button } from '@/components/ui/button'
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from '@/components/ui/input-group'
import { Skeleton } from '@/components/ui/skeleton'
import { Slider } from '@/components/ui/slider'
import { defineMessages, useMessages } from '@/lib/i18n'
import { peleMermaid } from '@/lib/pele-mermaid'
import { appHotkeys, useShortcutLabel, withShortcut } from '@/lib/shortcuts'
import { createPersistedStore, useStoreValue } from '@/lib/store'
import type { ExplainStyleId } from '@/lib/modes'
import type { ExplainDeckInput } from '@/lib/tools'
import type { useSpeaker } from '@/lib/use-speaker'

type Speaker = ReturnType<typeof useSpeaker>
type Slide = ExplainDeckInput['slides'][number]

const STREAMDOWN_PLUGINS = { code, mermaid: peleMermaid, renderers: runnableCodeRenderers }

const RATES = [0.75, 1, 1.25, 1.5, 2]
const PLAYER_DEFAULTS = { rate: 1, volume: 1, muted: false }
// The narration speed and volume are the player's own: other read-aloud keeps the speech settings.
const playerStore = createPersistedStore('lesson-player', PLAYER_DEFAULTS)
// Slide content is scaled up in full screen; the pointer measures rendered boxes, so it still lands right.
const FULLSCREEN_ZOOM = 1.4

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
    speed: 'Tốc độ đọc',
    volume: 'Âm lượng',
    mute: 'Tắt tiếng',
    unmute: 'Bật tiếng',
    fullscreen: 'Toàn màn hình',
    exitFullscreen: 'Thoát toàn màn hình',
    yourTurn: 'Đến lượt bạn',
    correct: 'Chính xác!',
    wrong: 'Chưa đúng rồi.',
    quizNext: 'Tiếp tục',
    goDeeper: 'Đi sâu hơn',
    goDeeperHint: (slide: string) => `Giảng sâu hơn phần "${slide}"`,
    deeperAsk: (slide: string, lesson: string) => `Giảng sâu hơn phần "${slide}" trong bài "${lesson}".`,
    revisePlaceholder: 'Muốn thay đổi gì trong bài giảng này…',
    revise: 'Gửi yêu cầu sửa',
    reviseAsk: (lesson: string, change: string) => `Sửa bài giảng "${lesson}": ${change}`,
    styleSwitched: 'Bạn vừa chuyển sang kiểu',
    later: 'Để sau',
    restyle: 'Giảng lại bài này',
    restyleAsk: (lesson: string, style: string) => `Giảng lại bài "${lesson}" theo kiểu ${style}.`,
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
    speed: 'Narration speed',
    volume: 'Volume',
    mute: 'Mute',
    unmute: 'Unmute',
    fullscreen: 'Full screen',
    exitFullscreen: 'Exit full screen',
    yourTurn: 'Your turn',
    correct: 'Correct!',
    wrong: 'Not quite.',
    quizNext: 'Continue',
    goDeeper: 'Go deeper',
    goDeeperHint: (slide: string) => `Explain "${slide}" in more depth`,
    deeperAsk: (slide: string, lesson: string) => `Go deeper into "${slide}" from the lesson "${lesson}".`,
    revisePlaceholder: 'Change anything about this lesson…',
    revise: 'Send change request',
    reviseAsk: (lesson: string, change: string) => `Revise the lesson "${lesson}": ${change}`,
    styleSwitched: 'You switched to',
    later: 'Later',
    restyle: 'Rebuild this lesson',
    restyleAsk: (lesson: string, style: string) => `Rebuild the lesson "${lesson}" in the ${style} style.`,
  },
})

export function ExplainCard({
  id,
  input,
  streaming,
  speaker,
  style,
  restyle,
  onAsk,
}: {
  id: string
  input: Partial<ExplainDeckInput>
  /** The tool call is still streaming: more slides may arrive. */
  streaming: boolean
  speaker: Speaker
  /** The teaching style the lesson was built in, once the server has recorded it. */
  style?: ExplainStyleId
  /** The style picked now; when it differs from `style`, the card offers to rebuild the lesson in it. */
  restyle?: ExplainStyleId
  /** Sends a chat message, for going deeper or asking for changes; the model answers with a new deck. */
  onAsk?: (text: string) => void
}) {
  const t = useMessages(messages)
  const slides = (input.slides ?? []).filter((s): s is Slide => Boolean(s?.title))
  // A slide is complete once the next one starts or the whole call has arrived; narration is its last field.
  const readyCount = streaming ? Math.max(0, slides.length - 1) : slides.length
  const [index, setIndex] = React.useState(0)
  // A deck that mounts while streaming is a fresh answer: play it right away, like a video.
  const [playing, setPlaying] = React.useState(streaming)
  const [ended, setEnded] = React.useState(false)
  // Whether the viewer has played or browsed the deck; until then a paused deck shows a big play button.
  const [started, setStarted] = React.useState(streaming)
  const rate = useStoreValue(playerStore, (state) => state.rate, () => PLAYER_DEFAULTS)
  const volume = useStoreValue(playerStore, (state) => state.volume, () => PLAYER_DEFAULTS)
  const muted = useStoreValue(playerStore, (state) => state.muted, () => PLAYER_DEFAULTS)
  // Muting keeps the level, so unmuting returns to it.
  const loudness = muted ? 0 : volume
  const cardRef = React.useRef<HTMLDivElement>(null)
  const fullscreen = useIsFullscreen(cardRef)
  const captionRef = React.useRef<HTMLParagraphElement>(null)
  const contentRef = React.useRef<HTMLDivElement>(null)
  // How far the current caption has been read, in characters; -1 before it starts.
  const [spoken, setSpoken] = React.useState(-1)
  // A quiz slide is read in two parts: the narration that asks, then the explanation once the viewer answers.
  const [part, setPart] = React.useState<0 | 1>(0)
  // The quiz narration has ended and the player is waiting for the viewer to pick an option.
  const [awaiting, setAwaiting] = React.useState(false)
  const [answers, setAnswers] = React.useState<Record<number, number>>({})
  const [revision, setRevision] = React.useState('')
  // Where in the narration each built step of the slide appears, and its text, so the cursor can follow the build.
  const [steps, setSteps] = React.useState<Array<{ start: number; size: number; target: PointerTarget }>>([])
  // The diagram nodes and table rows, columns and cells the narration names, and where, for the cursor to visit.
  const [marks, setMarks] = React.useState<Array<PointerMark>>([])
  const styleNames = useExplainStyleNames()
  // The style whose rebuild offer the viewer put off; switching to another style offers again.
  const [deferredStyle, setDeferredStyle] = React.useState<ExplainStyleId | null>(null)

  const slide = slides[Math.min(index, slides.length - 1)]
  const ready = index < readyCount
  const quiz = slide?.layout === 'quiz' ? slide.quiz : undefined
  const picked = answers[index]
  // The explanation opens with the verdict, read aloud like a teacher reacting to the answer.
  const verdict = quiz && picked !== undefined ? (picked === quiz.answer ? t.correct : t.wrong) : ''
  const caption = (part === 1 ? [verdict, quiz?.explanation?.replace(/`/g, '')].filter(Boolean).join(' ') : slide?.narration) ?? ''
  const speechId = `${id}:${index}:${part}`
  const status = speaker.activeId === speechId ? speaker.status : 'idle'

  React.useEffect(() => {
    if (!playing || !ready || !slide) return
    let cancelled = false
    setSpoken(-1)
    void speaker
      .speak(speechId, [{ text: caption, element: captionRef.current ?? undefined }], undefined, {
        onProgress: (offset) => !cancelled && setSpoken(offset),
        playbackRate: rate,
        volume: loudness,
      })
      .then((finished) => {
        if (cancelled) return
        if (!finished) return setPlaying(false)
        if (quiz && part === 0) {
          // Like a teacher who asked a question: wait for the answer, or explain it right away if it is already in.
          if (answers[index] === undefined) return setAwaiting(true)
          return setPart(1)
        }
        // While streaming only slides with a successor are ready, so the next one always exists here.
        if (index + 1 < slides.length) return go(index + 1)
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

  function go(next: number, play = false) {
    const target = Math.max(0, Math.min(next, Math.max(slides.length - 1, 0)))
    setStarted(true)
    if (play) setPlaying(true)
    // Arrow keys past either end must not reset the progress of the slide being narrated.
    if (target === index && !ended) return
    setEnded(false)
    setSpoken(-1)
    setPart(0)
    setAwaiting(false)
    setIndex(target)
  }

  function answer(option: number) {
    if (answers[index] !== undefined) return
    setAnswers((prev) => ({ ...prev, [index]: option }))
    setStarted(true)
    setAwaiting(false)
    // Answering is the viewer's cue to go on, so the explanation plays even if the deck was paused.
    setSpoken(-1)
    setPart(1)
    setPlaying(true)
  }

  function togglePlay() {
    if (playing) {
      setPlaying(false)
      if (speaker.activeId?.startsWith(`${id}:`)) speaker.stop()
      return
    }
    if (ended) go(0)
    setStarted(true)
    setPlaying(true)
  }
  function ask(text: string) {
    // The reply is a new deck that plays on its own; this one should not talk over it.
    setPlaying(false)
    if (speaker.activeId?.startsWith(`${id}:`)) speaker.stop()
    onAsk?.(text)
  }

  function cycleRate() {
    const next = RATES[(RATES.indexOf(rate) + 1) % RATES.length] ?? 1
    playerStore.setState((state) => ({ ...state, rate: next }))
    if (speaker.activeId?.startsWith(`${id}:`)) speaker.setPlaybackRate(next)
  }
  function setLoudness(next: { volume?: number; muted?: boolean }) {
    const state = { ...playerStore.state, ...next }
    playerStore.setState(() => state)
    if (speaker.activeId?.startsWith(`${id}:`)) speaker.setVolume(state.muted ? 0 : state.volume)
  }
  function toggleFullscreen() {
    if (document.fullscreenElement) void document.exitFullscreen()
    else void cardRef.current?.requestFullscreen()
  }
  // Player keys only fire while focus is inside this deck, so several decks in a thread never fight over them.
  const keys = { target: cardRef, enabled: slides.length > 0 }
  useHotkey(appHotkeys['lesson.playPause'], togglePlay, { ...keys, requireReset: true })
  useHotkey(appHotkeys['lesson.prev'], () => go(index - 1), keys)
  useHotkey(appHotkeys['lesson.next'], () => go(index + 1), keys)
  useHotkey(appHotkeys['lesson.fullscreen'], toggleFullscreen, { ...keys, requireReset: true })
  const shortcut = {
    playPause: useShortcutLabel('lesson.playPause'),
    prev: useShortcutLabel('lesson.prev'),
    next: useShortcutLabel('lesson.next'),
    fullscreen: useShortcutLabel('lesson.fullscreen'),
  }

  // Build the slide like a presenter: bullets appear as the narration reaches them. Browsing a paused deck shows
  // everything, and so does a finished lesson. A slide that streams while the deck plays keeps its bullets hidden
  // until its narration starts, instead of showing them as they arrive and hiding them again to build.
  const building = !ended && part === 0 && (playing || (ready && spoken >= 0))
  // Cues come in narration order, so each phrase is looked for after the previous one: a phrase said twice
  // matches where this cue means it, not its first mention.
  const cues: Array<{ start: number; length: number; at: PointerTarget }> = []
  for (const cue of slide?.pointer ?? []) {
    if (!cue?.say || !cue.at || !slide?.narration) continue
    const from = cues.at(-1)?.start ?? 0
    const start = cueStart(slide.narration, cue.say, from)
    const anywhere = start < 0 ? cueStart(slide.narration, cue.say) : start
    if (anywhere >= 0) cues.push({ start: anywhere, length: cue.say.length, at: shownText(cue.at) })
  }
  // Set off a little before the phrase so the cursor arrives, and clicks, as it is said.
  const lead = POINTER_LEAD_CHARS * rate
  React.useLayoutEffect(() => {
    const root = contentRef.current
    if (!root || !slide) return
    // Layouts mark their own steps (cards); Markdown slides build their top-level bullets.
    const marked = Array.from(root.querySelectorAll<HTMLElement>('[data-build]'))
    const selector = marked.length ? '[data-build]' : 'li:not(li li)'
    const items = marked.length ? marked : Array.from(root.querySelectorAll<HTMLElement>(selector))
    if (!building) {
      for (const li of items) li.removeAttribute('data-reveal')
      return
    }
    if (!ready) {
      for (const li of items) li.setAttribute('data-reveal', 'hidden')
      return
    }
    const starts =
      items.length < 2
        ? items.map(() => 0)
        : revealStarts(slide.narration, items.map((el) => el.dataset.buildLabel ?? el.textContent ?? ''))
    // A cue shows the step it points at, and the steps before it, as the cursor gets there: pointing at a card
    // that has not appeared yet would point at nothing.
    for (const cue of cues) {
      const step = typeof cue.at === 'string' ? stepWith(items, cue.at) : -1
      if (step < 0) continue
      const at = Math.max(0, cue.start - lead)
      for (let i = 0; i <= step; i++) starts[i] = Math.min(starts[i]!, at)
    }
    items.forEach((li, i) => li.setAttribute('data-reveal', starts[i]! <= spoken ? 'shown' : 'hidden'))
    // The cursor traces the whole step, a card's title and text or a bullet with its sub-bullets, so it is
    // pointed at as an element rather than looked up by its text, which could also be written elsewhere.
    const next = items.flatMap((el, index) => {
      const size = (el.textContent ?? '').trim().length
      return size ? [{ start: starts[index]!, size, target: { selector, index } }] : []
    })
    setSteps((previous) => (JSON.stringify(previous) === JSON.stringify(next) ? previous : next))
    const found = pointerMarks(root, slide.narration ?? '')
    setMarks((previous) => (JSON.stringify(previous) === JSON.stringify(found) ? previous : found))
  })
  if (slides.length === 0) return <ExplainCardSkeleton />

  // The cursor also follows the build, landing on each step as it appears, and visits the diagram nodes and table
  // rows the narration names, so it keeps moving when the cues are missing or do not match the narration. A cue
  // said at the same moment is more precise, so the others give way to it.
  const saidWithCue = (at: number) => cues.some((cue) => cue.start - lead <= at && at < cue.start + cue.length)
  const events: Array<{ from: number; start: number; length: number; at: PointerTarget; pace?: number }> = [
    ...cues.map((cue) => ({ from: cue.start - lead, ...cue })),
    // A step is traced at about reading pace, not stretched over all the narration until the next one, so the
    // cursor underlines it while it appears and then rests at its end.
    ...(building ? steps : [])
      .filter((step) => !saidWithCue(step.start))
      .map((step) => ({ from: step.start, start: step.start, length: 0, at: step.target, pace: step.size * TRACE_PACE })),
    // Walking the diagram is only for when nothing else moves the cursor.
    ...(building ? marks : [])
      .filter((mark) => !saidWithCue(mark.start) && !(mark.walk && (cues.length > 0 || steps.length > 1)))
      .map((mark) => ({ from: mark.start - lead, start: mark.start, length: 0, at: mark.target })),
  ].sort((a, b) => a.from - b.from)
  // Steps and marks have no phrase of their own, so they are traced until the narration moves on: across a row
  // while it is talked about, down a column.
  for (const [i, event] of events.entries()) {
    if (event.length) continue
    const span = (events[i + 1]?.start ?? caption.length) - event.start
    event.length = Math.max(1, Math.min(span, event.pace ?? span))
  }
  const event = events.filter((event) => event.from <= spoken).at(-1)
  // Trace the heading until the narration reaches the first cue or step, or over all of it when there is none.
  const pointerTarget = event?.at ?? slide.title
  // How far the phrase has been read, so the cursor traces its text while it is said and rests at the end after.
  const pointerSweep = event
    ? Math.min(1, Math.max(0, (spoken - event.start) / Math.max(1, event.length)))
    : Math.min(1, Math.max(0, spoken / Math.max(1, events[0]?.from ?? caption.length)))
  const pointerVisible = playing && ready && spoken >= 0 && part === 0

  // How much of the current slide has been read, so its progress segment fills like a video timeline. A quiz
  // spends the first half on its question and the second on its explanation.
  const partProgress = spoken < 0 || !caption ? 0 : Math.min(1, spoken / caption.length)
  const slideProgress = ended ? 1 : quiz ? (awaiting ? 0.5 : (part + partProgress) / 2) : partProgress
  const layout = slide.layout ?? 'content'
  const playLabel = playing ? t.pause : ended ? t.replay : t.play

  return (
    <div
      ref={cardRef}
      // Focusable so the player keys work once the viewer clicks into the deck.
      tabIndex={0}
      className={cn(
        'flex w-full flex-col overflow-hidden bg-card text-card-foreground outline-none animate-in fade-in slide-in-from-bottom-1 duration-200',
        fullscreen
          ? 'h-full'
          : 'max-w-2xl rounded-2xl border border-border shadow-xs focus-visible:ring-2 focus-visible:ring-ring/50',
      )}
    >
      <div className="flex items-center gap-2 border-b border-border px-4 py-2.5 text-sm">
        <IconChalkboard className="size-4 shrink-0 text-primary" />
        <span className="min-w-0 flex-1 truncate font-medium">{input.title ?? t.lesson}</span>
        {style && (
          <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">
            {styleNames[style]}
          </span>
        )}
        {onAsk && !streaming && (
          <Button
            variant="ghost"
            size="sm"
            title={t.goDeeperHint(slide.title)}
            onClick={() => ask(t.deeperAsk(slide.title, input.title ?? t.lesson))}
            className="-my-1 shrink-0 text-xs text-primary"
          >
            <IconBinoculars />
            {t.goDeeper}
          </Button>
        )}
        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
          {index + 1}/{slides.length}
        </span>
      </div>

      <div className={cn('relative flex flex-col', fullscreen ? 'min-h-0 flex-1 overflow-y-auto' : 'min-h-72')}>
        {(fullscreen || layout === 'title') && <SlideWaves tall={fullscreen} />}
        <div
          key={index}
          className={cn(
            'relative flex flex-1 flex-col gap-3 px-6 py-5 animate-in fade-in duration-300',
            layout === 'title' && 'justify-center',
            fullscreen && 'mx-auto my-auto w-full max-w-5xl flex-none',
          )}
        >
          <div
            className={cn('flex flex-col gap-3', layout === 'title' && 'items-center py-6 text-center')}
            style={fullscreen ? { zoom: FULLSCREEN_ZOOM } : undefined}
          >
            <h3
              className={cn(
                'font-semibold tracking-tight',
                layout === 'title' ? 'text-3xl text-balance' : 'text-lg',
              )}
            >
              {slide.title}
            </h3>
            <div
              ref={contentRef}
              // Lets CSS hide build steps the moment they render, before the layout effect has marked them.
              data-building={building || undefined}
              className={cn('min-w-0 text-chat', layout === 'title' && 'max-w-md text-balance text-muted-foreground')}
            >
              {layout === 'cards' ? (
                <SlideCards cards={slide.cards ?? []} />
              ) : layout === 'quiz' ? (
                quiz && (
                  <SlideQuiz
                    quiz={quiz}
                    picked={answers[index]}
                    awaiting={awaiting}
                    disabled={!ready}
                    onPick={answer}
                    onNext={index + 1 < slides.length ? () => go(index + 1, true) : undefined}
                    labels={t}
                  />
                )
              ) : (
                <Streamdown animated isAnimating={streaming && !ready} plugins={STREAMDOWN_PLUGINS}>
                  {slide.content ?? ''}
                </Streamdown>
              )}
            </div>
          </div>
          <SlidePointer target={pointerTarget} sweep={pointerSweep} visible={pointerVisible} />
        </div>
        {!started && !playing && (
          <button
            type="button"
            aria-label={t.play}
            onClick={togglePlay}
            className="absolute inset-0 flex cursor-pointer items-center justify-center bg-card/30 transition-colors hover:bg-card/10"
          >
            <span className="flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105">
              <IconPlayerPlayFilled className="size-6 translate-x-px" />
            </span>
          </button>
        )}
      </div>

      <div className="border-t border-border bg-muted/40 px-4 pt-3 pb-2">
        <p
          ref={captionRef}
          // Full screen shows paged subtitles instead; the full caption stays for screen readers and word timing.
          className={cn('min-h-10 text-sm leading-relaxed text-muted-foreground', fullscreen && 'sr-only')}
        >
          {caption}
        </p>
        {fullscreen && <Subtitle text={caption} spoken={spoken} />}

        <div className="mt-2 flex gap-1" role="group">
          {slides.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={t.goTo(i + 1)}
              onClick={() => go(i)}
              // A taller hit area around the thin bar.
              className="group flex h-3 flex-1 cursor-pointer items-center"
            >
              <span className="h-1.5 w-full overflow-hidden rounded-full bg-border transition-[height] group-hover:h-2">
                <span
                  className={cn(
                    'block h-full rounded-full bg-primary',
                    i === index && 'transition-[width] duration-300 ease-linear motion-reduce:transition-none',
                  )}
                  style={{ width: `${(i < index ? 1 : i === index ? slideProgress : 0) * 100}%` }}
                />
              </span>
            </button>
          ))}
        </div>

        <div className="mt-1.5 flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t.prev}
            title={withShortcut(t.prev, shortcut.prev)}
            disabled={index === 0}
            onClick={() => go(index - 1)}
          >
            <IconPlayerSkipBackFilled />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={playLabel}
            title={withShortcut(playLabel, shortcut.playPause)}
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
            title={withShortcut(t.next, shortcut.next)}
            disabled={index >= slides.length - 1}
            onClick={() => go(index + 1)}
          >
            <IconPlayerSkipForwardFilled />
          </Button>
          {streaming && <span className="text-xs text-muted-foreground">{t.building(slides.length)}</span>}
          {/* The slider opens on hover or focus, like a video player's, so the bar stays as quiet as before. */}
          <div className="group/volume ml-auto flex items-center">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={muted ? t.unmute : t.mute}
              title={muted ? t.unmute : t.mute}
              onClick={() => setLoudness({ muted: !muted, volume: muted && volume === 0 ? 1 : volume })}
            >
              {loudness === 0 ? <IconVolume3 /> : loudness < 0.5 ? <IconVolume2 /> : <IconVolume />}
            </Button>
            <div className="w-0 overflow-hidden py-2 transition-[width] duration-200 group-focus-within/volume:w-24 group-hover/volume:w-24 motion-reduce:transition-none">
              <Slider
                aria-label={t.volume}
                className="w-20 px-2"
                min={0}
                max={1}
                step={0.05}
                value={[loudness]}
                onValueChange={(next: number | ReadonlyArray<number>) => {
                  const level = Array.isArray(next) ? next[0]! : (next as number)
                  setLoudness({ volume: level, muted: level === 0 })
                }}
              />
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            aria-label={t.speed}
            title={t.speed}
            onClick={cycleRate}
            className="min-w-12 px-2 text-xs tabular-nums"
          >
            {rate}×
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={fullscreen ? t.exitFullscreen : t.fullscreen}
            title={withShortcut(fullscreen ? t.exitFullscreen : t.fullscreen, shortcut.fullscreen)}
            onClick={toggleFullscreen}
          >
            {fullscreen ? <IconMinimize /> : <IconMaximize />}
          </Button>
        </div>

        {onAsk && !streaming && (
          <form
            className="mt-1.5"
            onSubmit={(event) => {
              event.preventDefault()
              const change = revision.trim()
              if (!change) return
              setRevision('')
              ask(t.reviseAsk(input.title ?? t.lesson, change))
            }}
          >
            <InputGroup className="h-8 bg-background">
              <InputGroupInput
                value={revision}
                onChange={(event) => setRevision(event.target.value)}
                placeholder={t.revisePlaceholder}
                aria-label={t.revisePlaceholder}
                className="text-sm"
              />
              <InputGroupAddon align="inline-end">
                <InputGroupButton type="submit" size="icon-xs" aria-label={t.revise} title={t.revise} disabled={!revision.trim()}>
                  <IconArrowUp />
                </InputGroupButton>
              </InputGroupAddon>
            </InputGroup>
          </form>
        )}
      </div>

      {onAsk && !streaming && style && restyle && restyle !== style && deferredStyle !== restyle && (
        <div className="flex items-center gap-2 border-t border-border bg-primary/8 px-4 py-2 text-sm animate-in fade-in slide-in-from-bottom-1 duration-200">
          <span className="min-w-0 flex-1">
            {t.styleSwitched} <strong className="font-medium">{styleNames[restyle]}</strong>.
          </span>
          <Button variant="ghost" size="sm" className="text-xs text-muted-foreground" onClick={() => setDeferredStyle(restyle)}>
            {t.later}
          </Button>
          <Button size="sm" className="text-xs" onClick={() => ask(t.restyleAsk(input.title ?? t.lesson, styleNames[restyle]))}>
            {t.restyle}
          </Button>
        </div>
      )}
    </div>
  )
}

const PAGE_WORDS = 10

/** Subtitles like a video's: a page of the caption at a time, words lighting up as they are read. */
function Subtitle({ text, spoken }: { text: string; spoken: number }) {
  const words = Array.from(text.matchAll(/\S+/g))
  if (words.length === 0) return null
  let current = -1
  while (current + 1 < words.length && words[current + 1]!.index <= spoken) current++
  const first = Math.floor(Math.max(current, 0) / PAGE_WORDS) * PAGE_WORDS
  return (
    <p aria-hidden className="mx-auto min-h-10 w-fit max-w-4xl rounded-lg bg-background/70 px-4 py-1.5 text-center text-xl leading-relaxed">
      {words.slice(first, first + PAGE_WORDS).map((word, i) => (
        <span
          key={first + i}
          className={cn('transition-colors duration-150', first + i <= current ? 'text-foreground' : 'text-muted-foreground/60')}
        >
          {word[0]}{' '}
        </span>
      ))}
    </p>
  )
}

/** Layered waves across the top of a slide, tinted with the theme color, for title slides and full screen. */
function SlideWaves({ tall }: { tall: boolean }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 1200 200"
      preserveAspectRatio="none"
      className={cn('pointer-events-none absolute inset-x-0 top-0 w-full text-primary', tall ? 'h-1/3' : 'h-20')}
    >
      <path d="M0 0H1200V120C1000 170 820 90 600 120S200 180 0 130Z" fill="currentColor" opacity="0.06" />
      <path d="M0 0H1200V80C980 130 800 50 600 85S220 140 0 95Z" fill="currentColor" opacity="0.08" />
      <path d="M0 0H1200V45C1020 85 780 20 600 50S240 95 0 55Z" fill="currentColor" opacity="0.1" />
    </svg>
  )
}

type Card = NonNullable<Slide['cards']>[number]

/** Parallel ideas side by side; each is a build step, so it appears when the narration reaches it. */
function SlideCards({ cards }: { cards: Array<Partial<Card> | undefined> }) {
  const shown = cards.filter((card): card is Partial<Card> => Boolean(card?.title))
  return (
    <div className={cn('grid gap-3', shown.length === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2')}>
      {shown.map((card, i) => (
        <div key={i} data-build data-build-label={card.title} className="flex flex-col gap-1.5 rounded-xl border border-border bg-muted/30 p-4">
          <p className="font-semibold">
            <InlineCode text={card.title} /> {card.emoji}
          </p>
          <p className="text-sm leading-relaxed text-muted-foreground">
            <InlineCode text={card.text} />
          </p>
        </div>
      ))}
    </div>
  )
}

/** Short model text with `code` spans, which the quiz and cards render without a full Markdown pass. */
function InlineCode({ text }: { text: string | undefined }) {
  return (text ?? '').split(/(`[^`\n]+`)/).map((part, i) =>
    part.length > 2 && part.startsWith('`') && part.endsWith('`') ? (
      <code key={i} className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.9em]">
        {part.slice(1, -1)}
      </code>
    ) : (
      part
    ),
  )
}

type Quiz = NonNullable<Slide['quiz']>
const LETTERS = 'ABCD'

function SlideQuiz({
  quiz,
  picked,
  awaiting,
  disabled,
  onPick,
  onNext,
  labels,
}: {
  quiz: Partial<Quiz>
  picked: number | undefined
  /** The narration has asked the question and the player waits for an answer. */
  awaiting: boolean
  disabled: boolean
  onPick: (option: number) => void
  /** Moves on to the next slide; absent on the last one. */
  onNext?: () => void
  labels: { yourTurn: string; correct: string; wrong: string; quizNext: string }
}) {
  const answered = picked !== undefined
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-muted/20 p-4">
      <span
        className={cn(
          'text-xs font-semibold text-amber-600 dark:text-amber-400',
          awaiting && 'animate-pulse motion-reduce:animate-none',
        )}
      >
        {labels.yourTurn}
      </span>
      <p className="font-semibold text-balance">
        <InlineCode text={quiz.question} />
      </p>
      <div className="flex flex-col gap-2">
        {(quiz.options ?? []).map((option, i) => {
          const state = !answered ? 'idle' : i === quiz.answer ? 'right' : i === picked ? 'wrong' : 'dim'
          return (
            <button
              key={i}
              type="button"
              data-point
              disabled={answered || disabled}
              onClick={() => onPick(i)}
              className={cn(
                'flex items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors',
                state === 'idle' && 'cursor-pointer border-border hover:bg-muted focus-visible:bg-muted focus-visible:outline-none',
                state === 'right' && 'border-emerald-600/60 bg-emerald-600/10',
                state === 'wrong' && 'border-destructive/60 bg-destructive/10',
                state === 'dim' && 'border-border opacity-50',
              )}
            >
              <span
                aria-hidden
                className={cn(
                  'flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                  state === 'right' ? 'bg-emerald-600 text-white' : state === 'wrong' ? 'bg-destructive text-white' : 'bg-muted text-muted-foreground',
                )}
              >
                {LETTERS[i]}
              </span>
              <span className="min-w-0">
                <InlineCode text={option} />
              </span>
            </button>
          )
        })}
      </div>
      {answered && (
        // The explanation stays on the slide, so a viewer who reads instead of listening still learns why.
        <div className="flex flex-col gap-3 animate-in fade-in slide-in-from-top-1 duration-200">
          <p className="text-sm">
            <span
              className={cn(
                'font-medium',
                picked === quiz.answer ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive',
              )}
            >
              {picked === quiz.answer ? labels.correct : labels.wrong}
            </span>{' '}
            <InlineCode text={quiz.explanation} />
          </p>
          {onNext && (
            <Button size="sm" className="self-end" onClick={onNext}>
              {labels.quizNext}
              <IconArrowRight />
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

/** Whether the element is the one shown full screen. */
function useIsFullscreen(ref: React.RefObject<HTMLElement | null>) {
  const [fullscreen, setFullscreen] = React.useState(false)
  React.useEffect(() => {
    const update = () => setFullscreen(document.fullscreenElement !== null && document.fullscreenElement === ref.current)
    document.addEventListener('fullscreenchange', update)
    return () => document.removeEventListener('fullscreenchange', update)
  }, [ref])
  return fullscreen
}

const TOKEN = /[\p{L}\p{N}_]{2,}/gu
const SENTENCE_BREAK = /[.!?;:…]/
const tokens = (text: string) => new Set(text.toLowerCase().match(TOKEN) ?? [])
// Blocks a cue can land on when its text is not copied exactly: bullets, cells, code lines, diagram labels.
// Streamdown draws each line of a code block as a span in its code element, numbered with CSS.
const CODE_LINE = '[data-streamdown="code-block-body"] code > span'
const POINTABLE = `h3, li, p, td, th, ${CODE_LINE}, text, [data-point]`

/**
 * Where in the narration each bullet should appear: where the narration mentions it, else spread evenly between
 * its mentioned neighbours. The first bullet shows from the start unless it is mentioned later, and bullets
 * never appear out of order.
 */
function revealStarts(narration: string, texts: Array<string>) {
  const found: Array<number> = []
  for (const [i, text] of texts.entries()) {
    const from = Math.max(0, ...found)
    // A long bullet is rarely read out word for word, but its opening words (a card's name) usually are.
    const words = text.toLowerCase().match(TOKEN) ?? []
    const opening = words.slice(0, 3).join(' ')
    let start = cueStart(narration, text, from)
    if (start < 0) start = cueStart(narration, opening, from)
    // Else its closing words: "không chạy khi biến khác đổi" is said as "những biến khác đổi".
    if (start < 0 && words.length > 3) start = cueStart(narration, words.slice(-3).join(' '), from)
    found.push(start < 0 && i === 0 ? 0 : start)
  }
  // Leave the last bullets some narration of their own instead of showing them as the slide ends.
  const end = narration.length * 0.85
  const starts: Array<number> = []
  for (let i = 0; i < found.length; i++) {
    const prev = starts[i - 1] ?? 0
    if (found[i]! >= 0) {
      starts.push(Math.max(found[i]!, prev))
      continue
    }
    let next = i + 1
    while (next < found.length && found[next]! < 0) next++
    const until = Math.max(next < found.length ? found[next]! : end, prev)
    starts.push(prev + (until - prev) / (next - i + 1))
  }
  return starts
}

/** The build step whose text holds a cue's target: the one containing it, else the one sharing most of its words. */
function stepWith(items: Array<HTMLElement>, at: string) {
  const needle = at.trim().toLowerCase()
  const texts = items.map((el) => (el.textContent ?? '').toLowerCase())
  const exact = texts.findIndex((text) => text.includes(needle))
  if (exact >= 0) return exact
  const wanted = tokens(needle)
  let best = { step: -1, shared: 0 }
  for (const [step, text] of texts.entries()) {
    let shared = 0
    for (const token of tokens(text)) if (wanted.has(token)) shared++
    if (shared > best.shared) best = { step, shared }
  }
  return best.shared >= Math.max(1, Math.ceil(wanted.size * 0.6)) ? best.step : -1
}

const isWordChar = (char: string | undefined) => char !== undefined && /[\p{L}\p{N}_]/u.test(char)

/** Where needle occurs in text as whole words, at or after from: "ip" must not match inside "ship". */
function findWords(text: string, needle: string, from = 0) {
  if (!needle) return -1
  for (let i = text.indexOf(needle, from); i >= 0; i = text.indexOf(needle, i + 1)) {
    if (!isWordChar(text[i - 1]) && !isWordChar(text[i + needle.length])) return i
  }
  return -1
}

/**
 * Where a phrase starts in the narration, at or after from: exactly, else where most of its words follow each
 * other in the same order. Vietnamese words are syllables and short ones repeat everywhere, so matching loose
 * words would fire on the wrong sentence.
 */
function cueStart(narration: string, say: string, from = 0) {
  const lower = narration.toLowerCase()
  const exact = findWords(lower, say.trim().toLowerCase(), from)
  if (exact >= 0) return exact
  const wanted: Array<string> = say.toLowerCase().match(TOKEN) ?? []
  if (wanted.length < 2) return -1
  const words = Array.from(lower.matchAll(TOKEN)).filter((m) => m.index >= from)
  let best = { start: -1, matched: 0 }
  for (let i = 0; i < words.length; i++) {
    let next = wanted.indexOf(words[i]![0])
    if (next < 0) continue
    let matched = 0
    // A small gap is fine (the narration adds a word or drops one), the order is not, and neither is a sentence
    // break: "như sau. … gửi cookie" is two thoughts, not the label "lần sau gửi lại cookie".
    for (let w = i; w < Math.min(words.length, i + wanted.length * 2) && next < wanted.length; w++) {
      if (w > i && SENTENCE_BREAK.test(lower.slice(words[w - 1]!.index, words[w]!.index))) break
      const at = wanted.indexOf(words[w]![0], next)
      if (at < 0) continue
      matched++
      next = at + 1
    }
    if (matched > best.matched) best = { start: words[i]!.index, matched }
  }
  return best.matched >= Math.max(2, Math.ceil(wanted.length * 0.6)) ? best.start : -1
}

/**
 * Where text sits inside root, as line boxes relative to root, top to bottom: an exact case-insensitive match
 * first, else the block sharing the most words.
 */
function locateLines(root: HTMLElement, target: PointerTarget, reveal = true): Array<DOMRect> {
  const box = root.getBoundingClientRect()
  if (typeof target !== 'string') {
    const found = Array.from(root.querySelectorAll(target.selector))
    const elements = target.index === undefined ? found : found.slice(target.index, target.index + 1)
    if (target.text) {
      for (const el of elements) {
        const lines = exactLines(el, target.text.toLowerCase(), box, reveal)
        if (lines) return lines
      }
    }
    return textLines(elements, box)
  }
  const needle = target.trim().toLowerCase()
  if (!needle) return []
  const exact = exactLines(root, needle, box, reveal)
  if (exact) return exact
  // Models paraphrase a little or quote diagram source ("A[main] --> B[merge]") instead of the label shown.
  const wanted = tokens(needle)
  // Nothing to compare ("[]"): every block would share all of none of its words.
  if (wanted.size === 0) return []
  let best: { el: Element; shared: number; ratio: number } | null = null
  for (const el of root.querySelectorAll(POINTABLE)) {
    const own = tokens(el.textContent ?? '')
    if (own.size === 0) continue
    let shared = 0
    for (const token of own) if (wanted.has(token)) shared++
    const ratio = shared / own.size
    if (shared < Math.ceil(Math.min(wanted.size, own.size) * 0.6)) continue
    if (!best || shared > best.shared || (shared === best.shared && ratio > best.ratio)) best = { el, shared, ratio }
  }
  if (!best) return []
  if (reveal) revealInScroller(best.el.getBoundingClientRect(), best.el)
  return textLines(tableSpan(best.el) ?? [best.el], box)
}

/**
 * Where needle is written inside scope, as whole words, relative to origin. It searches the text of the whole
 * scope, not node by node: highlighted code and bold words split a phrase ("document.title", "mỗi khi **count**
 * đổi") across several text nodes. Separate blocks are kept apart, so two table cells or two code lines do not
 * run into one word.
 */
function exactLines(scope: Element, needle: string, origin: DOMRect, reveal: boolean): Array<DOMRect> | null {
  const nodes: Array<{ node: Text; at: number }> = []
  let text = ''
  let block: Element | null = null
  const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT)
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const own = node.parentElement?.closest(TEXT_BLOCK) ?? null
    if (own !== block) text += '\n'
    block = own
    nodes.push({ node: node as Text, at: text.length })
    text += (node as Text).data.toLowerCase()
  }
  const nodeAt = (offset: number) => {
    let found = nodes[0]!
    for (const entry of nodes) if (entry.at <= offset) found = entry
    return found
  }
  for (let start = findWords(text, needle); start >= 0; start = findWords(text, needle, start + 1)) {
    const first = nodeAt(start)
    const last = nodeAt(start + needle.length - 1)
    const span = tableSpan(first.node.parentElement)
    if (span) return textLines(span, origin)
    const range = document.createRange()
    range.setStart(first.node, start - first.at)
    range.setEnd(last.node, start + needle.length - last.at)
    if (reveal) revealInScroller(range.getBoundingClientRect(), first.node.parentElement)
    const lines = lineBoxes(range.getClientRects(), origin)
    if (lines.length > 0) return lines
  }
  return null
}

/**
 * Scrolls a code block so text the cursor heads for is in view: a long line or a tall block scrolls inside the
 * slide, and the cursor would point past its edge. The pointer measures again as it scrolls.
 */
function revealInScroller(rect: DOMRect, el: Element | null) {
  const scroller = el?.closest<HTMLElement>('[data-streamdown="code-block-body"]')
  if (!scroller) return
  const view = scroller.getBoundingClientRect()
  const margin = 24
  let left = scroller.scrollLeft
  let top = scroller.scrollTop
  if (rect.right > view.right - margin) left += rect.right - view.right + margin
  if (rect.left < view.left + margin) left -= view.left + margin - rect.left
  if (rect.bottom > view.bottom - margin) top += rect.bottom - view.bottom + margin
  if (rect.top < view.top + margin) top -= view.top + margin - rect.top
  if (left === scroller.scrollLeft && top === scroller.scrollTop) return
  scroller.scrollTo({ left, top, behavior: reducedMotion() ? 'auto' : 'smooth' })
}

// What a phrase's text nodes are grouped by, so phrases are not matched across two of them.
const TEXT_BLOCK = `p, li, td, th, h1, h2, h3, h4, h5, h6, ${CODE_LINE}, text, button, div`

/**
 * A table header or row heading stands for more than its cell: the cells of its column under a header, and its
 * row from the first cell, so the cursor runs down the column or across the row.
 */
function tableSpan(el: Element | null): Array<Element> | null {
  const cell = el?.closest('td, th')
  const row = cell?.parentElement
  const table = row?.closest('table')
  if (!cell || !row || !table) return null
  const column = Array.from(row.children).indexOf(cell)
  if (row.closest('thead')) return Array.from(table.querySelectorAll(`tr > :nth-child(${column + 1})`))
  return column === 0 ? [row] : null
}

/** A cue's target as the slide shows it: models copy the Markdown source, like `[]` or **bold**. */
const shownText = (text: string) => text.replace(/`+|\*\*|__/g, '').trim()

/**
 * The lines of text inside some elements, relative to origin. It measures the text nodes, not the blocks: a nested
 * paragraph's box spans the whole column, not its words, and the cells of a table row merge into one line.
 */
function textLines(elements: Array<Element>, origin: DOMRect) {
  const rects: Array<DOMRect> = []
  for (const el of elements) {
    const inside = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
    for (let node = inside.nextNode(); node; node = inside.nextNode()) {
      if (!node.textContent?.trim()) continue
      const range = document.createRange()
      range.selectNodeContents(node)
      rects.push(...range.getClientRects())
    }
  }
  const lines = lineBoxes(rects, origin)
  return lines.length > 0 ? lines : lineBoxes(elements.map((el) => el.getBoundingClientRect()), origin)
}

/**
 * What the cursor points at: some text on the slide, or the elements a selector picks (one of them, with index),
 * or some text inside them.
 */
type PointerTarget = string | { selector: string; index?: number; text?: string }
// A walk mark is not named by the narration, only spread over it.
type PointerMark = { start: number; target: PointerTarget; walk?: boolean }
const targetKey = (target: PointerTarget) => (typeof target === 'string' ? target : JSON.stringify(target))

// Marks closer than this many characters of narration to the previous one are skipped, so the cursor does not jitter.
const MARK_GAP_CHARS = 12
// Without any named, the cursor walks at most this many nodes, rows or paragraphs.
const WALK_MAX = 6
// Code lines are short to read, so more of them are walked.
const CODE_WALK_MAX = 12
// Names in code worth pointing at when the narration says them: long enough not to be a word said anyway.
const IDENTIFIER = /[A-Za-z_$][\w$]{3,}/g
// Keywords and names that read as plain English words in a narration ("this", "then", "true").
const CODE_STOPWORDS = new Set([
  'this', 'then', 'else', 'with', 'from', 'true', 'false', 'null', 'none', 'self', 'type', 'case', 'when',
  'each', 'data', 'item', 'value', 'name', 'list', 'text', 'time', 'some', 'have', 'done', 'next', 'last',
  'first', 'only'
])

/** Every place the narration names a label: each exact mention, else where most of its words are said. */
function mentions(narration: string, label: string) {
  const lower = narration.toLowerCase()
  const needle = label.trim().toLowerCase()
  const found: Array<number> = []
  for (let at = findWords(lower, needle); at >= 0; at = findWords(lower, needle, at + needle.length)) found.push(at)
  if (found.length > 0) return found
  const loose = cueStart(narration, needle)
  return loose < 0 ? [] : [loose]
}

/**
 * What on a diagram or table the narration names, and where: nodes and edge labels, table rows by their first cell,
 * columns by their header, and other cells. A row is traced across and a column down, the way a presenter walks a
 * table. Short or one-word labels that are not a node, row or column ("có", "không") are left out: they are said
 * everywhere. When the narration names none of them, the cursor walks the nodes or rows in order instead.
 */
function pointerMarks(root: HTMLElement, narration: string): Array<PointerMark> {
  const named: Array<{ label: string; target: PointerTarget; strict: boolean }> = []
  const walk: Array<PointerTarget> = []
  root.querySelectorAll('.pele-node').forEach((node, index) => {
    const target = { selector: '.pele-node', index }
    named.push({ label: node.textContent ?? '', target, strict: false })
    walk.push(target)
  })
  root.querySelectorAll('.pele-edge-label').forEach((edge, index) => {
    named.push({ label: edge.textContent ?? '', target: { selector: '.pele-edge-label', index }, strict: true })
  })
  let cell = -1
  root.querySelectorAll('tr').forEach((row, index) => {
    const header = row.closest('thead') !== null
    for (const [column, el] of Array.from(row.children).entries()) {
      cell++
      const label = el.textContent ?? ''
      if (header) named.push({ label, target: { selector: `tr > :nth-child(${column + 1})` }, strict: false })
      else if (column === 0) named.push({ label, target: { selector: 'tr', index }, strict: false })
      else named.push({ label, target: { selector: 'td, th', index: cell }, strict: true })
    }
    if (!header) walk.push({ selector: 'tr', index })
  })
  // Identifiers the narration says are pointed at in the code, where they first appear.
  const lines = Array.from(root.querySelectorAll(CODE_LINE))
  const seen = new Set<string>()
  for (const [index, line] of lines.entries()) {
    for (const [name] of (line.textContent ?? '').matchAll(IDENTIFIER)) {
      const key = name.toLowerCase()
      if (seen.has(key) || CODE_STOPWORDS.has(key)) continue
      seen.add(key)
      named.push({ label: name, target: { selector: CODE_LINE, index, text: name }, strict: false })
    }
  }
  const codeWalk = lines.flatMap((line, index) =>
    line.textContent?.trim() ? [{ selector: CODE_LINE, index } as PointerTarget] : [],
  )
  if (!narration) return []
  const found: Array<PointerMark & { size: number }> = []
  for (const { label, target, strict } of named) {
    const words = label.toLowerCase().match(TOKEN) ?? []
    if (words.length === 0 || label.trim().length < 3 || (strict && words.length < 2)) continue
    for (const start of mentions(narration, label)) found.push({ start, target, size: label.trim().length })
  }
  // The longer label wins where two are said at once: "merge commit" over "merge".
  found.sort((a, b) => a.start - b.start || b.size - a.size)
  const marks: Array<PointerMark> = []
  let end = -1
  for (const { start, target, size } of found) {
    const previous = marks.at(-1)
    const crowded = previous && start - previous.start < MARK_GAP_CHARS
    if (start < end || crowded || (previous && targetKey(previous.target) === targetKey(target))) continue
    marks.push({ start, target })
    end = start + size
  }
  if (marks.length > 0) return marks
  const spread = (targets: Array<PointerTarget>, from: number, to: number, max = WALK_MAX) =>
    targets.slice(0, max).map((target, i, all) => ({
      start: Math.round(narration.length * (from + ((to - from) * i) / all.length)),
      target,
      walk: true,
    }))
  if (walk.length >= 2) return spread(walk, 0, 0.85)
  // Code is read top to bottom, a line at a time.
  if (codeWalk.length >= 2) return spread(codeWalk, 0.1, 0.9, CODE_WALK_MAX)
  // A slide of plain text, like the title slide's subtitle: the heading is traced first, then each paragraph.
  const paragraphs = Array.from(root.querySelectorAll('p')).flatMap((p, index) =>
    p.textContent?.trim() && !p.closest('li, table') ? [{ selector: 'p', index }] : [],
  )
  return spread(paragraphs, 0.45, 0.9)
}

/** Merges the fragments of some text into one box per rendered line, so a phrase that wraps is traced line by line. */
function lineBoxes(rects: Iterable<DOMRect>, origin: DOMRect) {
  const lines: Array<DOMRect> = []
  for (const rect of rects) {
    if (rect.width === 0 || rect.height === 0) continue
    const middle = rect.top + rect.height / 2
    const line = lines.find((l) => Math.abs(l.top + l.height / 2 - middle) < Math.min(l.height, rect.height) / 2)
    if (!line) {
      lines.push(new DOMRect(rect.left - origin.left, rect.top - origin.top, rect.width, rect.height))
      continue
    }
    const left = Math.min(line.left, rect.left - origin.left)
    const top = Math.min(line.top, rect.top - origin.top)
    line.width = Math.max(line.right, rect.right - origin.left) - left
    line.height = Math.max(line.bottom, rect.bottom - origin.top) - top
    line.x = left
    line.y = top
  }
  return lines.sort((a, b) => a.top - b.top)
}

/** The point a share of the way through lines of text, read left to right and top to bottom. */
function pointAlong(lines: Array<DOMRect>, share: number) {
  let distance = share * lines.reduce((sum, line) => sum + line.width, 0)
  for (const [i, line] of lines.entries()) {
    if (distance > line.width && i < lines.length - 1) {
      distance -= line.width
      continue
    }
    // Keep the tip a little inside the text at either end.
    const inset = Math.min(line.width / 2, 6)
    return { x: line.left + Math.min(Math.max(distance, inset), line.width - inset), y: line.top + line.height * 0.75 }
  }
  return null
}

// How many characters of narration the cursor spends tracing each character of a step's text.
const TRACE_PACE = 1.5
// About how much narration is read while the cursor travels to a cue at normal speed, so the click lands on the phrase.
const POINTER_LEAD_CHARS = 10
// Spring stiffness and damping of the cursor: just under critically damped, so it settles with no visible overshoot.
const SPRING = { stiffness: 110, damping: 20 }
// A move to a new cue bows by this share of its length, up to a cap, so it reads as a hand and not a ruler.
// Short hops stay straight.
const ARC_BEND = 0.12
const ARC_MAX_PX = 36
const ARC_MIN_PX = 40
// Within this many pixels of the cue the cursor counts as arrived and clicks.
const POINTER_CLICK_PX = 4
const PARTICLES = 8
// The arrow tip sits at (2, 2) in the 24px cursor.
const TIP = 2

type PointerMotion = {
  x: number
  y: number
  vx: number
  vy: number
  goal: { x: number; y: number }
  frame: number
  // The bow of the current move: a unit normal, its peak offset, the move's length and how far along it got.
  arc: { nx: number; ny: number; bend: number; total: number; progress: number } | null
  // Offset of the drawn cursor from the spring's position, from the arc.
  ox: number
  oy: number
}

/** Bows the move from where the cursor is drawn to its goal: upward, or into the left margin on a vertical move. */
function startArc(motion: PointerMotion) {
  // Restart from the drawn position, so a move that interrupts another does not jump.
  motion.x += motion.ox
  motion.y += motion.oy
  motion.ox = motion.oy = 0
  const dx = motion.goal.x - motion.x
  const dy = motion.goal.y - motion.y
  const total = Math.hypot(dx, dy)
  if (total < ARC_MIN_PX) {
    motion.arc = null
    return
  }
  let nx = dy / total
  let ny = -dx / total
  if (ny > 0.1 || (Math.abs(ny) <= 0.1 && nx > 0)) {
    nx = -nx
    ny = -ny
  }
  motion.arc = { nx, ny, bend: Math.min(total * ARC_BEND, ARC_MAX_PX), total, progress: 0 }
}

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * A presenter-style cursor that glides to the text being talked about and traces it while it is said; it
 * positions itself in its parent element. It moves on a spring, so a new goal mid-flight bends the path instead
 * of restarting it.
 */
function SlidePointer({ target, sweep, visible }: { target: PointerTarget; sweep: number; visible: boolean }) {
  const ref = React.useRef<SVGSVGElement>(null)
  const lines = React.useRef<Array<DOMRect>>([])
  const motion = React.useRef<PointerMotion | null>(null)
  // Set when the cursor heads for a new cue, so it clicks once it has arrived.
  const clickPending = React.useRef(false)
  const [placed, setPlaced] = React.useState(false)
  // Each simulated click keys the press and the particle burst so their animations replay.
  const [click, setClick] = React.useState<{ id: number; x: number; y: number } | null>(null)
  const sweepRef = React.useRef(sweep)
  sweepRef.current = sweep
  const visibleRef = React.useRef(visible)
  visibleRef.current = visible
  const targetRef = React.useRef(target)
  targetRef.current = target
  const key = targetKey(target)

  // Sets the goal from the current lines and sweep, and runs the spring until the cursor settles on it.
  const aim = React.useCallback(() => {
    const goal = pointAlong(lines.current, sweepRef.current)
    const el = ref.current
    if (!goal || !el) return
    const paint = (x: number, y: number) => (el.style.transform = `translate(${x}px, ${y}px)`)
    const current = motion.current
    if (!current || reducedMotion()) {
      if (current) cancelAnimationFrame(current.frame)
      motion.current = { ...goal, vx: 0, vy: 0, goal, frame: 0, arc: null, ox: 0, oy: 0 }
      clickPending.current = false
      paint(goal.x, goal.y)
      setPlaced(true)
      return
    }
    current.goal = goal
    if (current.frame) return
    let last = performance.now()
    const tick = (now: number) => {
      // A long frame (a hidden tab) would fling the cursor, so the step is capped.
      const dt = Math.min((now - last) / 1000, 1 / 30)
      last = now
      const dx = current.goal.x - current.x
      const dy = current.goal.y - current.y
      current.vx += (SPRING.stiffness * dx - SPRING.damping * current.vx) * dt
      current.vy += (SPRING.stiffness * dy - SPRING.damping * current.vy) * dt
      current.x += current.vx * dt
      current.y += current.vy * dt
      const distance = Math.hypot(dx, dy)
      const settled = distance < 0.5 && Math.hypot(current.vx, current.vy) < 5
      if (settled) {
        current.x = current.goal.x
        current.y = current.goal.y
      }
      const arc = current.arc
      if (arc && (settled || distance < POINTER_CLICK_PX)) {
        // Arrived: tracing the phrase from here runs straight along the text.
        current.arc = null
        current.ox = current.oy = 0
      } else if (arc) {
        // Never goes back, so the bow does not grow again when the goal shifts.
        arc.progress = Math.max(arc.progress, Math.min(1, 1 - distance / arc.total))
        const lift = Math.sin(arc.progress * Math.PI) * arc.bend
        current.ox = arc.nx * lift
        current.oy = arc.ny * lift
      }
      paint(current.x + current.ox, current.y + current.oy)
      if (clickPending.current && distance < POINTER_CLICK_PX) {
        clickPending.current = false
        const { x, y } = current
        if (visibleRef.current) setClick((previous) => ({ id: (previous?.id ?? 0) + 1, x, y }))
      }
      current.frame = settled ? 0 : requestAnimationFrame(tick)
    }
    current.frame = requestAnimationFrame(tick)
  }, [])

  React.useLayoutEffect(() => {
    const container = ref.current?.parentElement
    if (!container) return
    // Scrolls a code block to the target once, when it is chosen; measuring as that scroll runs only follows it.
    const measure = (reveal = true) => {
      lines.current = locateLines(container, targetRef.current, reveal)
      aim()
    }
    const follow = () => measure(false)
    // Click and bow when moving to a new cue, not when the cursor first appears on the slide.
    const moving = motion.current !== null
    measure()
    if (moving && motion.current && lines.current.length > 0 && !reducedMotion()) {
      clickPending.current = true
      startArc(motion.current)
    }
    // Code highlighting and diagrams render after the text, which moves things around.
    const observer = new ResizeObserver(follow)
    observer.observe(container)
    // A code block scrolled to bring the target into view moves the text under the cursor.
    container.addEventListener('scroll', follow, { capture: true, passive: true })
    return () => {
      observer.disconnect()
      container.removeEventListener('scroll', follow, { capture: true })
    }
  }, [key, aim])

  React.useLayoutEffect(() => aim(), [sweep, aim])

  React.useEffect(
    () => () => {
      // Strict Mode unmounts and mounts again with the same refs: a frame left set would read as a spring still
      // running, and the cursor would never move again.
      if (!motion.current) return
      cancelAnimationFrame(motion.current.frame)
      motion.current.frame = 0
    },
    [],
  )

  const particles = React.useMemo(
    () =>
      Array.from({ length: PARTICLES }, (_, i) => {
        const angle = (i / PARTICLES) * Math.PI * 2 + (Math.random() - 0.5) * 0.6
        const distance = 12 + Math.random() * 10
        return { dx: Math.cos(angle) * distance, dy: Math.sin(angle) * distance, size: 2.5 + Math.random() * 2 }
      }),
    [click?.id],
  )

  return (
    <>
      {click && (
        <span
          key={click.id}
          aria-hidden
          className="pointer-events-none absolute top-0 left-0 motion-reduce:hidden"
          style={{ transform: `translate(${click.x + TIP}px, ${click.y + TIP}px)` }}
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
          // The spring writes `transform` every frame; `scale` animates on its own property, so the breathing never fights it.
          'pointer-events-none absolute top-0 left-0 size-6 origin-top-left text-primary drop-shadow-md transition-opacity duration-300 animate-[pointer-breathe_3.2s_ease-in-out_infinite] motion-reduce:animate-none motion-reduce:transition-none',
          visible && placed ? 'opacity-100' : 'opacity-0',
        )}
      >
        {/* The press lives on its own element: its scale multiplies the breathing one instead of replacing it mid-cycle. */}
        <g
          key={click?.id ?? 0}
          className={cn(click && 'animate-[pointer-click_480ms_cubic-bezier(0.45,0,0.55,1)] motion-reduce:animate-none')}
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
