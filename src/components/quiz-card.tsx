import * as React from 'react'
import {
  IconBulb,
  IconCheck,
  IconChevronLeft,
  IconChevronRight,
  IconCopy,
  IconListCheck,
  IconLoader2,
  IconRotate,
  IconVolume,
  IconVolumeOff,
} from '@tabler/icons-react'
import { cn } from 'cn'

import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { setChatSetting, useChatSettings } from '@/lib/chat-settings'
import { defineMessages, useMessages } from '@/lib/i18n'
import type { QuizInput } from '@/lib/tools'
import type { SpeechSegment, useSpeaker } from '@/lib/use-speaker'

type Speaker = ReturnType<typeof useSpeaker>

const LETTERS = 'ABCD'

const messages = defineMessages({
  vi: {
    previous: 'Câu trước',
    next: 'Tiếp',
    nextQuestion: 'Câu sau',
    finish: 'Xem kết quả',
    hint: 'Gợi ý',
    noHint: 'Câu này không có gợi ý.',
    copy: 'Sao chép câu hỏi',
    copied: 'Đã sao chép',
    readAloud: 'Đọc to câu hỏi và đáp án',
    stopReading: 'Tắt đọc to',
    correct: 'Đúng rồi!',
    incorrect: (letter: string, text: string) => `Chưa đúng. Đáp án đúng là ${letter}: ${text}.`,
    building: 'Đang tạo quiz…',
    score: (right: number, total: number) => `Bạn đúng ${right}/${total} câu`,
    perfect: 'Xuất sắc, không sai câu nào!',
    reviewWrong: 'Giải thích các câu sai',
    review: 'Xem lại',
    retry: 'Làm lại',
    askReview: (title: string, items: string) =>
      `Mình vừa làm quiz "${title}" và sai các câu sau, giải thích kỹ hơn và cho mình vài câu luyện thêm nhé:\n${items}`,
    wrongItem: (question: string, picked: string, right: string) => `- ${question} (mình chọn "${picked}", đáp án "${right}")`,
  },
  en: {
    previous: 'Previous question',
    next: 'Next',
    nextQuestion: 'Next question',
    finish: 'See results',
    hint: 'Hint',
    noHint: 'No hint for this question.',
    copy: 'Copy question',
    copied: 'Copied',
    readAloud: 'Read questions and options aloud',
    stopReading: 'Stop reading aloud',
    correct: 'Correct!',
    incorrect: (letter: string, text: string) => `Not quite. The answer is ${letter}: ${text}.`,
    building: 'Building the quiz…',
    score: (right: number, total: number) => `You got ${right}/${total} right`,
    perfect: 'Perfect, no mistakes!',
    reviewWrong: 'Explain my mistakes',
    review: 'Review',
    retry: 'Try again',
    askReview: (title: string, items: string) =>
      `I just did the quiz "${title}" and got these wrong. Explain them in more detail and give me a few more to practise:\n${items}`,
    wrongItem: (question: string, picked: string, right: string) => `- ${question} (I picked "${picked}", answer "${right}")`,
  },
})

type QuizState = { answers: Array<number | null>; index: number; done: boolean }

// Progress is kept per tool call so a reload does not reset a half-finished quiz.
function useQuizState(id: string, total: number) {
  const key = `quiz:${id}`
  const [state, setState] = React.useState<QuizState>(() => {
    const fresh = { answers: Array<number | null>(total).fill(null), index: 0, done: false }
    try {
      const saved = JSON.parse(localStorage.getItem(key) ?? 'null') as QuizState | null
      return saved?.answers.length === total ? saved : fresh
    } catch {
      return fresh
    }
  })
  React.useEffect(() => {
    localStorage.setItem(key, JSON.stringify(state))
  }, [key, state])
  return [state, setState] as const
}

/** What the card reads aloud next; a new object each time, so the same cue can be read again. */
type Cue = { kind: 'question' | 'answer' | 'score' }

export function QuizCard({
  id,
  input,
  onAsk,
  speaker,
  fresh = false,
}: {
  id: string
  input: QuizInput
  onAsk: (text: string) => void
  speaker: Speaker
  /** Just generated in this session: with read-aloud on, the first question is read as the card appears. */
  fresh?: boolean
}) {
  const t = useMessages(messages)
  const questions = input.questions
  const total = questions.length
  const [state, setState] = useQuizState(id, total)
  const readAloud = useChatSettings().quizReadAloud
  const [cue, setCue] = React.useState<Cue | null>(() => (fresh && readAloud ? { kind: 'question' } : null))
  const questionRef = React.useRef<HTMLParagraphElement>(null)
  const optionRefs = React.useRef<Array<HTMLButtonElement | null>>([])
  const [hintOpen, setHintOpen] = React.useState(false)
  const [copied, setCopied] = React.useState(false)
  const { answers, index, done } = state
  const current = questions[Math.min(index, total - 1)]!
  const picked = answers[index] ?? null
  const answered = picked !== null
  const right = answers.filter((a, i) => a === questions[i]!.answer).length

  const speechId = `${id}:quiz`
  const reading = speaker.activeId === speechId
  const read = (kind: Cue['kind']) => readAloud && setCue({ kind })

  // Read once the cued question or result is on screen, so the read can highlight what it is saying.
  const speakerRef = React.useRef(speaker)
  speakerRef.current = speaker
  React.useEffect(() => {
    if (!cue) return
    let content: string | Array<SpeechSegment>
    if (cue.kind === 'score') {
      content = right === total ? t.perfect : t.score(right, total)
    } else if (cue.kind === 'answer' && picked !== null) {
      const answer = current.options[current.answer]!
      content = [
        picked === current.answer ? t.correct : t.incorrect(LETTERS[current.answer]!, answer.text),
        answer.explanation,
      ].join(' ')
    } else {
      content = [
        { text: current.question, element: questionRef.current ?? undefined },
        ...current.options.map((o, i) => ({ text: `${LETTERS[i]}. ${o.text}`, element: optionRefs.current[i] ?? undefined })),
      ]
    }
    void speakerRef.current.speak(speechId, content)
    // Only a new cue starts a read; answering or moving on sets one.
  }, [cue])

  const toggleReadAloud = () => {
    setChatSetting('quizReadAloud', !readAloud)
    if (readAloud) {
      if (reading) speaker.stop()
      setCue(null)
    } else {
      setCue({ kind: done ? 'score' : answered ? 'answer' : 'question' })
    }
  }
  const go = (next: number) => {
    setHintOpen(false)
    setState((s) => ({ ...s, index: next, done: false }))
    if (readAloud) read('question')
    else if (reading) speaker.stop()
  }
  const finish = () => {
    setState((s) => ({ ...s, done: true }))
    read('score')
  }
  const pick = (option: number) => {
    if (answered) return
    setState((s) => ({ ...s, answers: s.answers.map((a, i) => (i === s.index ? option : a)) }))
    read('answer')
  }
  const copyQuestion = async () => {
    const text = [input.title, current.question, ...current.options.map((o, i) => `${LETTERS[i]}. ${o.text}`)].join('\n')
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  const askReview = () => {
    const items = questions
      .map((q, i) => ({ q, a: answers[i] }))
      .filter(({ q, a }) => a !== null && a !== q.answer)
      .map(({ q, a }) => t.wrongItem(q.question, q.options[a!]!.text, q.options[q.answer]!.text))
      .join('\n')
    onAsk(t.askReview(input.title, items))
  }

  return (
    <div className="w-full max-w-2xl rounded-3xl border border-border bg-card p-5 text-card-foreground shadow-lg shadow-black/5 animate-in fade-in zoom-in-95 duration-200">
      <div className="flex items-start gap-3">
        <p className="min-w-0 flex-1 pt-1.5 text-[0.95rem] text-muted-foreground">{input.title}</p>
        <div className="flex shrink-0 items-center gap-0.5 text-muted-foreground">
          {!done && (
            <>
              <Button variant="ghost" size="icon-sm" aria-label={t.previous} title={t.previous} disabled={index === 0} onClick={() => go(index - 1)}>
                <IconChevronLeft />
              </Button>
              <span className="min-w-10 text-center text-sm tabular-nums text-foreground">
                {index + 1}/{total}
              </span>
              <Button variant="ghost" size="icon-sm" aria-label={t.nextQuestion} title={t.nextQuestion} disabled={index === total - 1} onClick={() => go(index + 1)}>
                <IconChevronRight />
              </Button>
              <Button variant="ghost" size="icon-sm" aria-label={t.hint} title={t.hint} aria-pressed={hintOpen} onClick={() => setHintOpen((o) => !o)} className="ml-1 aria-pressed:text-amber-500">
                <IconBulb />
              </Button>
              <Button variant="ghost" size="icon-sm" aria-label={copied ? t.copied : t.copy} title={copied ? t.copied : t.copy} onClick={copyQuestion}>
                {copied ? <IconCheck /> : <IconCopy />}
              </Button>
            </>
          )}
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={readAloud ? t.stopReading : t.readAloud}
            title={readAloud ? t.stopReading : t.readAloud}
            aria-pressed={readAloud}
            onClick={toggleReadAloud}
            className="aria-pressed:text-primary"
          >
            {reading && speaker.status === 'loading' ? (
              <IconLoader2 className="animate-spin" />
            ) : readAloud ? (
              <IconVolume />
            ) : (
              <IconVolumeOff />
            )}
          </Button>
        </div>
      </div>

      {done ? (
        <QuizSummary
          right={right}
          total={total}
          labels={t}
          onReviewWrong={right < total ? askReview : undefined}
          onReview={() => go(0)}
          onRetry={() => {
            setState({ answers: Array<number | null>(total).fill(null), index: 0, done: false })
            read('question')
          }}
        />
      ) : (
        <>
          {hintOpen && (
            <p className="mt-3 flex items-start gap-2 rounded-xl bg-amber-500/10 px-3 py-2 text-sm text-amber-700 animate-in fade-in dark:text-amber-300">
              <IconBulb className="mt-0.5 size-4 shrink-0" />
              {current.hint ?? t.noHint}
            </p>
          )}
          <p ref={questionRef} className="mt-6 rounded-md text-lg font-semibold">
            {current.question}
          </p>
          <ol className="mt-4 flex flex-col gap-1">
            {current.options.map((option, i) => {
              const isAnswer = i === current.answer
              const isPicked = i === picked
              const state = !answered ? 'idle' : isAnswer ? 'right' : isPicked ? 'wrong' : 'dim'
              return (
                <li key={i}>
                  <button
                    ref={(el) => {
                      optionRefs.current[i] = el
                    }}
                    type="button"
                    disabled={answered}
                    onClick={() => pick(i)}
                    className={cn(
                      'flex w-full items-start gap-4 rounded-2xl px-2 py-2 text-left transition-colors',
                      state === 'idle' && 'cursor-pointer hover:bg-muted focus-visible:bg-muted focus-visible:outline-none',
                      state === 'dim' && 'opacity-50',
                    )}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        'flex size-9 shrink-0 items-center justify-center rounded-full border text-sm font-semibold transition-colors',
                        state === 'right' && 'border-transparent bg-emerald-600 text-white',
                        state === 'wrong' && 'border-transparent bg-destructive text-white',
                        (state === 'idle' || state === 'dim') && 'border-border text-muted-foreground',
                      )}
                    >
                      {LETTERS[i]}
                    </span>
                    <span className="flex min-w-0 flex-col gap-1 pt-1.5">
                      <span className="text-[1.05rem]">{option.text}</span>
                      {(state === 'right' || state === 'wrong') && (
                        <span className="text-sm text-muted-foreground animate-in fade-in slide-in-from-top-1 duration-200">
                          {option.explanation}
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              )
            })}
          </ol>
          <div className="mt-4 flex min-h-9 justify-end">
            {answered && (
              <Button
                variant="outline"
                className="rounded-full px-5 animate-in fade-in"
                onClick={() => (index < total - 1 ? go(index + 1) : finish())}
              >
                {index < total - 1 ? t.next : t.finish}
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function QuizSummary({
  right,
  total,
  labels: t,
  onReviewWrong,
  onReview,
  onRetry,
}: {
  right: number
  total: number
  labels: (typeof messages)['vi']
  onReviewWrong?: () => void
  onReview: () => void
  onRetry: () => void
}) {
  const ratio = right / total
  return (
    <div className="flex flex-col items-center gap-4 py-6 text-center animate-in fade-in">
      <div
        className={cn(
          'flex size-20 items-center justify-center rounded-full text-2xl font-semibold tabular-nums',
          ratio >= 0.8 ? 'bg-emerald-600/15 text-emerald-600 dark:text-emerald-400' : ratio >= 0.5 ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400' : 'bg-destructive/15 text-destructive',
        )}
      >
        {right}/{total}
      </div>
      <p className="text-lg font-semibold">{right === total ? t.perfect : t.score(right, total)}</p>
      <div className="flex flex-wrap justify-center gap-2">
        {onReviewWrong && (
          <Button className="rounded-full" onClick={onReviewWrong}>
            <IconListCheck />
            {t.reviewWrong}
          </Button>
        )}
        <Button variant="outline" className="rounded-full" onClick={onReview}>
          {t.review}
        </Button>
        <Button variant="outline" className="rounded-full" onClick={onRetry}>
          <IconRotate />
          {t.retry}
        </Button>
      </div>
    </div>
  )
}

export function QuizCardSkeleton() {
  const t = useMessages(messages)
  return (
    <div className="flex w-full max-w-2xl flex-col gap-4 rounded-3xl border border-border bg-card p-5" aria-label={t.building}>
      <Skeleton className="h-4 w-2/3" />
      <Skeleton className="mt-2 h-5 w-1/2" />
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="flex items-center gap-4">
          <Skeleton className="size-9 rounded-full" />
          <Skeleton className="h-4 w-40" />
        </div>
      ))}
    </div>
  )
}
