import * as React from 'react'
import {
  IconArrowRight,
  IconBulb,
  IconLoader2,
  IconMasksTheater,
  IconSquare,
  IconVolume,
} from '@tabler/icons-react'
import { cn } from 'cn'

import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { defineMessages, useMessages } from '@/lib/i18n'
import type { RoleplayInput } from '@/lib/tools'
import type { SpeakerStatus, useSpeaker } from '@/lib/use-speaker'

type Speaker = ReturnType<typeof useSpeaker>

export const ROLEPLAY_VOICES = { female: 'en-US-JennyNeural', male: 'en-US-GuyNeural' } as const

const messages = defineMessages({
  vi: {
    listen: 'Nghe',
    stop: 'Dừng',
    feedback: 'Sửa câu trước',
    showSuggestions: 'Gợi ý trả lời',
    hideSuggestions: 'Ẩn gợi ý',
    useReply: 'Dùng câu này',
    listenReply: 'Nghe câu này',
    preparing: 'Đang chuẩn bị lượt hội thoại…',
  },
  en: {
    listen: 'Listen',
    stop: 'Stop',
    feedback: 'Fixes for your last reply',
    showSuggestions: 'Reply ideas',
    hideSuggestions: 'Hide ideas',
    useReply: 'Use this reply',
    listenReply: 'Listen to this reply',
    preparing: 'Preparing the next turn…',
  },
})

export function RoleplayCard({
  id,
  input,
  active,
  speaker,
  onReply,
}: {
  id: string
  input: Partial<RoleplayInput>
  /** Only the latest turn offers sample replies to send. */
  active: boolean
  speaker: Speaker
  onReply: (text: string) => void
}) {
  const t = useMessages(messages)
  const [suggestionsOpen, setSuggestionsOpen] = React.useState(false)
  const { scenario, intro, character, line } = input
  const feedback = (input.feedback ?? []).filter((f) => f?.original && f.corrected)
  const suggestions = (input.suggestions ?? []).filter(Boolean)
  const voice = ROLEPLAY_VOICES[character?.voice ?? 'female'] ?? ROLEPLAY_VOICES.female

  function status(key: string): SpeakerStatus {
    return speaker.activeId === `${id}:${key}` ? speaker.status : 'idle'
  }
  function toggle(key: string, text: string) {
    const speechId = `${id}:${key}`
    if (speaker.activeId === speechId) return speaker.stop()
    void speaker.speak(speechId, text, { voice, pitch: 0 })
  }

  return (
    <div className="flex w-full max-w-2xl flex-col gap-3 animate-in fade-in slide-in-from-bottom-1 duration-200">
      {intro && (
        <div className="flex items-start gap-2.5 rounded-2xl border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">
          <IconMasksTheater className="mt-0.5 size-4 shrink-0 text-primary" />
          <div className="min-w-0">
            {scenario && <p className="font-medium text-foreground">{scenario}</p>}
            <p>{intro}</p>
          </div>
        </div>
      )}

      {feedback.length > 0 && (
        <div className="rounded-2xl bg-amber-500/10 px-4 py-3 text-sm">
          <p className="mb-2 text-xs font-medium tracking-wide text-amber-700 uppercase dark:text-amber-300">{t.feedback}</p>
          <ul className="flex flex-col gap-2">
            {feedback.map((f, i) => (
              <li key={i} className="flex flex-col gap-0.5">
                <p className="flex flex-wrap items-baseline gap-x-2">
                  <span className="text-muted-foreground line-through decoration-destructive/60">{f.original}</span>
                  <IconArrowRight className="size-3.5 shrink-0 self-center text-muted-foreground" />
                  <span className="font-medium text-emerald-700 dark:text-emerald-400">{f.corrected}</span>
                </p>
                {f.note && <p className="text-muted-foreground">{f.note}</p>}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex items-start gap-3">
        <div
          aria-hidden
          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-semibold text-primary"
        >
          {character?.name?.trim().charAt(0).toUpperCase() ?? '?'}
        </div>
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
            <span className="font-medium">{character?.name ?? <Skeleton className="inline-block h-3.5 w-20" />}</span>
            {character?.role && <span className="text-muted-foreground">{character.role}</span>}
          </p>
          <div className="mt-1.5 flex items-start gap-2 rounded-2xl rounded-tl-md border border-border bg-card px-4 py-3 text-card-foreground shadow-xs">
            <p className="min-w-0 flex-1 font-serif text-reply leading-[1.7]">
              {line ?? <Skeleton className="my-1.5 h-4 w-3/4" />}
            </p>
            {line && (
              <Button
                variant="ghost"
                size="icon-sm"
                className="-mr-1.5 shrink-0 text-muted-foreground"
                aria-label={status('line') === 'idle' ? t.listen : t.stop}
                title={status('line') === 'idle' ? t.listen : t.stop}
                onClick={() => toggle('line', line)}
              >
                <SpeakIcon status={status('line')} />
              </Button>
            )}
          </div>

          {active && suggestions.length > 0 && (
            <div className="mt-2">
              <Button
                variant="ghost"
                size="sm"
                aria-expanded={suggestionsOpen}
                className="-ml-2 text-muted-foreground aria-expanded:text-amber-600 dark:aria-expanded:text-amber-400"
                onClick={() => setSuggestionsOpen((o) => !o)}
              >
                <IconBulb />
                {suggestionsOpen ? t.hideSuggestions : t.showSuggestions}
              </Button>
              {suggestionsOpen && (
                <ul className="mt-1 flex flex-col gap-1 animate-in fade-in slide-in-from-top-1 duration-150">
                  {suggestions.map((s, i) => (
                    <li key={i} className="group/suggestion flex items-center gap-1 rounded-xl pr-1 transition-colors hover:bg-muted">
                      <button
                        type="button"
                        title={t.useReply}
                        onClick={() => onReply(s)}
                        className="min-w-0 flex-1 cursor-pointer px-3 py-2 text-left text-chat focus-visible:outline-none"
                      >
                        {s}
                      </button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className={cn(
                          'shrink-0 text-muted-foreground transition-opacity pointer-fine:opacity-0 group-hover/suggestion:opacity-100 focus-visible:opacity-100',
                          status(`s${i}`) !== 'idle' && 'opacity-100',
                        )}
                        aria-label={t.listenReply}
                        title={t.listenReply}
                        onClick={() => toggle(`s${i}`, s)}
                      >
                        <SpeakIcon status={status(`s${i}`)} />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export function RoleplayCardSkeleton() {
  const t = useMessages(messages)
  return (
    <div className="flex w-full max-w-2xl items-start gap-3" aria-label={t.preparing}>
      <Skeleton className="size-9 rounded-full" />
      <div className="flex flex-1 flex-col gap-2">
        <Skeleton className="h-3.5 w-32" />
        <Skeleton className="h-14 w-full rounded-2xl" />
      </div>
    </div>
  )
}

function SpeakIcon({ status }: { status: SpeakerStatus }) {
  if (status === 'loading') return <IconLoader2 className="size-4 animate-spin" />
  if (status === 'playing') return <IconSquare className="size-3.5 fill-current" />
  return <IconVolume className="size-4" />
}
