import * as React from 'react'
import { IconBrain, IconCheck, IconWifiOff } from '@tabler/icons-react'
import { cn } from 'cn'

import { ContextRing, ContextRingPlaceholder } from '@/components/chat-stats'
import type { RunStat } from '@/components/chat-stats'
import { ComposerModeChip, ComposerModeChipSkeleton } from '@/components/chat-modes'
import { ComposerProjectPicker } from '@/components/composer-project-picker'
import { ComposerSettingsMenu } from '@/components/composer-settings-menu'
import { ModelPicker } from '@/components/model-picker'
import { InputGroupText } from '@/components/ui/input-group'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { setChatSetting, useChatSettings } from '@/lib/chat-settings'
import { EFFORTS, isEffort, useEffortDescriptions, useEffortLabels } from '@/lib/effort'
import { defineMessages, useMessages } from '@/lib/i18n'
import type { ExplainStyleId, ModeId } from '@/lib/modes'

// Shared by the chat view and its server-rendered skeleton, so the toolbar is in place on first paint.

const messages = defineMessages({
  vi: { offline: 'Đang offline', effortTitle: 'Mức suy luận', effortHint: 'Càng cao càng kỹ, nhưng chậm và tốn token hơn.', current: 'Đang dùng' },
  en: { offline: 'Offline', effortTitle: 'Reasoning effort', effortHint: 'Higher thinks harder, but is slower and uses more tokens.', current: 'Current' },
})

/** Everything in the composer's bottom row except the send button. */
export function ComposerTools({
  threadId,
  offline = false,
  runs = [],
  turns = 0,
  messageCount = 0,
  started = false,
  skeleton = false,
  skeletonMode,
}: {
  threadId: string
  offline?: boolean
  runs?: Array<RunStat>
  turns?: number
  messageCount?: number
  /** The thread already has messages, even if they haven't been restored yet. */
  started?: boolean
  /** Server-rendered placeholder: only the inline script knows whether the chat has started. */
  skeleton?: boolean
  /** The thread's saved mode, known to the server before the thread store hydrates. */
  skeletonMode?: { mode: ModeId; explainStyle?: ExplainStyleId }
}) {
  const t = useMessages(messages)
  return (
    <>
      {skeletonMode ? <ComposerModeChipSkeleton {...skeletonMode} /> : <ComposerModeChip threadId={threadId} />}
      {offline ? (
        <InputGroupText className="text-xs text-destructive">
          <IconWifiOff />
          {t.offline}
        </InputGroupText>
      ) : (
        <ModelPicker />
      )}
      {messageCount > 0 ? (
        <ContextRing runs={runs} turns={turns} messageCount={messageCount} />
      ) : started ? (
        <ContextRingPlaceholder />
      ) : skeleton ? (
        <ContextRingPlaceholder className="hidden in-data-chat-started:inline-flex" />
      ) : null}
      <EffortSlider />
      <span className="ml-auto" />
      <ComposerProjectPicker threadId={threadId} />
      <ComposerSettingsMenu />
    </>
  )
}

/** Brain icon filled bottom-up to show how deep a level thinks. */
function EffortBrain({ index, fillClassName = 'text-primary' }: { index: number; fillClassName?: string }) {
  const level = (index + 1) / EFFORTS.length
  return (
    <span aria-hidden className="relative size-3.5 shrink-0">
      <IconBrain className="absolute inset-0 size-full opacity-40" />
      <IconBrain
        className={cn('absolute inset-0 size-full transition-[clip-path] duration-300 ease-out', fillClassName)}
        style={{ clipPath: `inset(${(1 - level) * 100}% 0 0 0)` }}
      />
    </span>
  )
}

/** Hover card on the brain icon explaining each effort level and when to use it. */
function EffortHelp({ children }: { children: React.ReactNode }) {
  const t = useMessages(messages)
  const labels = useEffortLabels()
  const descriptions = useEffortDescriptions()
  const { effort } = useChatSettings()
  return (
    <Tooltip>
      <TooltipTrigger render={<span className="flex cursor-help" />}>{children}</TooltipTrigger>
      {/* The tooltip is inverted (foreground surface), so emphasis uses `background`, never `primary`. */}
      <TooltipContent side="bottom" className="max-w-none flex-col items-stretch gap-1 py-2">
        <div className="flex items-center justify-between gap-3 pb-1">
          <span className="font-medium">{t.effortTitle}</span>
          <span className="flex items-center gap-1.5 rounded-full bg-background px-2 py-0.5 font-medium text-foreground">
            <EffortBrain index={EFFORTS.indexOf(effort)} fillClassName="text-current" />
            {labels[effort]}
          </span>
        </div>
        {EFFORTS.map((level, i) => {
          const current = level === effort
          return (
            <div
              key={level}
              aria-current={current || undefined}
              className={cn(
                '-mx-1.5 flex items-center gap-3 rounded-md px-1.5 py-1.5',
                current ? 'bg-background/15 ring-1 ring-background/40' : 'opacity-60',
              )}
            >
              <span className="flex w-18 shrink-0 items-center gap-1.5">
                <EffortBrain index={i} fillClassName="text-current" />
                <span className={cn(current && 'font-semibold')}>{labels[level]}</span>
              </span>
              <span className="flex-1 whitespace-nowrap">{descriptions[level]}</span>
              {current && <IconCheck aria-label={t.current} className="size-3.5 shrink-0" stroke={2.5} />}
            </div>
          )
        })}
        <div className="pt-1 opacity-70">{t.effortHint}</div>
      </TooltipContent>
    </Tooltip>
  )
}

const HOVER_SELECT_DELAY = 1000
const LEVEL_HIT = 8

function EffortSlider() {
  const labels = useEffortLabels()
  const { effort } = useChatSettings()
  const index = EFFORTS.indexOf(effort)
  const last = EFFORTS.length - 1
  const pct = (index / last) * 100
  const fill = `color-mix(in oklab, var(--primary) ${45 + (55 * index) / last}%, transparent)`

  const [pending, setPending] = React.useState<number | null>(null)
  const [popping, setPopping] = React.useState(false)
  const timer = React.useRef<ReturnType<typeof setTimeout>>(undefined)
  React.useEffect(() => () => clearTimeout(timer.current), [])

  function select(i: number) {
    const next = EFFORTS[i]
    if (isEffort(next) && next !== effort) setChatSetting('effort', next)
  }

  function cancelPending() {
    clearTimeout(timer.current)
    setPending(null)
  }

  function onPointerMove(event: React.PointerEvent<HTMLInputElement>) {
    const track = event.currentTarget.nextElementSibling
    if (event.pointerType !== 'mouse' || !track) return
    const rect = track.getBoundingClientRect()
    const step = rect.width / last
    const i = Math.min(Math.max(Math.round((event.clientX - rect.left) / step), 0), last)
    const onLevel = Math.abs(event.clientX - (rect.left + i * step)) <= LEVEL_HIT

    if (!onLevel || i === index) return cancelPending()
    if (i === pending) return
    clearTimeout(timer.current)
    setPending(i)
    timer.current = setTimeout(() => {
      select(i)
      setPending(null)
      setPopping(true)
    }, HOVER_SELECT_DELAY)
  }

  return (
    <label className="group flex h-7 items-center gap-2 rounded-md pr-1 pl-2 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
      <EffortHelp>
        <EffortBrain index={index} />
      </EffortHelp>
      <span className="relative flex h-full w-24 items-center px-1.5">
        <input
          type="range"
          min={0}
          max={last}
          step={1}
          value={index}
          aria-label="Effort"
          aria-valuetext={labels[effort]}
          onChange={(event) => select(Number(event.target.value))}
          onPointerMove={onPointerMove}
          onPointerLeave={cancelPending}
          onPointerDown={cancelPending}
          className="peer absolute inset-0 z-10 size-full cursor-pointer appearance-none opacity-0"
        />
        <span className="relative h-1 w-full rounded-full bg-muted-foreground/20">
          <span
            className="absolute inset-y-0 left-0 rounded-full transition-[width,background-color] duration-200 ease-out"
            style={{ width: `${pct}%`, backgroundColor: fill }}
          />
          {EFFORTS.map((level, i) => (
            <span
              key={level}
              className={cn(
                'absolute top-1/2 size-1 -translate-1/2 rounded-full transition-[background-color,scale] duration-200',
                i <= index ? 'bg-primary-foreground/80' : 'bg-muted-foreground/40',
                (i === 0 || i === index) && 'opacity-0',
                i === pending && 'scale-150 bg-primary',
              )}
              style={{ left: `${(i / last) * 100}%` }}
            />
          ))}
          {pending !== null && (
            <span
              key={pending}
              aria-hidden
              className="pointer-events-none absolute top-1/2 size-3.5 -translate-1/2 rounded-full border-2 border-primary/60 animate-[effort-level-arm_linear_forwards] motion-reduce:animate-none"
              style={{ left: `${(pending / last) * 100}%`, animationDuration: `${HOVER_SELECT_DELAY}ms` }}
            />
          )}
          <span
            onAnimationEnd={() => setPopping(false)}
            className={cn(
              'absolute top-1/2 size-3.5 -translate-1/2 rounded-full border-2 border-primary bg-background shadow-sm transition-[left,scale] duration-200 ease-out group-hover:scale-110 group-active:scale-95 peer-focus-visible:ring-3 peer-focus-visible:ring-ring/50 motion-reduce:animate-none',
              popping && 'animate-[effort-knob-pop_320ms_ease-out]',
            )}
            style={{ left: `${pct}%` }}
          />
        </span>
      </span>
      <span className="min-w-12 font-medium text-foreground tabular-nums">
        {labels[effort]}
      </span>
    </label>
  )
}
