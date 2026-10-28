import * as React from 'react'
import { Menu } from '@base-ui/react/menu'
import { useMutation } from '@tanstack/react-query'
import {
  IconBrandLeetcode,
  IconChalkboard,
  IconCheck,
  IconChevronDown,
  IconDice5,
  IconLanguage,
  IconLoader2,
  IconX,
} from '@tabler/icons-react'
import type { Icon } from '@tabler/icons-react'
import { cn } from 'cn'

import { popupClass } from '@/components/composer-settings-menu'
import { setChatSetting, useChatSettings } from '@/lib/chat-settings'
import { defineMessages, useMessages } from '@/lib/i18n'
import { DEFAULT_EXPLAIN_STYLE, EXPLAIN_STYLE_IDS, MODE_IDS, isExplainStyleId } from '@/lib/modes'
import type { ExplainStyleId, ModeId } from '@/lib/modes'
import { setThreadExplainStyle, setThreadMode, usePendingExplainStyle, usePendingMode, useThread } from '@/lib/threads'

const MODE_ICONS: Record<ModeId, Icon> = {
  leetcode: IconBrandLeetcode,
  english: IconLanguage,
  explain: IconChalkboard,
}

const messages = defineMessages({
  vi: {
    pickMode: 'Bắt đầu với…',
    tryAsking: 'Thử hỏi',
    shuffle: 'Gợi ý khác',
    shuffleHint: 'Nhờ model hiện tại nghĩ ra 3–5 câu hỏi ngẫu nhiên',
    shuffleFailed: 'Không tạo được gợi ý, thử lại nhé.',
    clearMode: (name: string) => `Tắt chế độ ${name}`,
    explainStyle: 'Kiểu giảng',
    changeStyle: 'Đổi kiểu giảng',
    appliesNext: 'Áp dụng từ câu hỏi tiếp theo',
    styles: {
      simple: { name: 'Dễ hiểu', description: 'Từ ngữ đơn giản, từng bước nhỏ' },
      standard: { name: 'Chuẩn', description: 'Rõ ràng, đầy đủ, cân bằng' },
      practical: { name: 'Thực hành', description: 'Ví dụ cụ thể, ít lý thuyết' },
      fun: { name: 'Vui', description: 'Hài hước, châm biếm nhẹ, vẫn chính xác' },
      deep: { name: 'Chuyên sâu', description: 'Đào tới cơ chế bên trong' },
      tldr: { name: 'TL;DR', description: '3–4 slide, vào thẳng ý chính' },
      visual: { name: 'Trực quan', description: 'Sơ đồ, hình vẽ và mô phỏng chạy theo lời giảng' },
    } satisfies Record<ExplainStyleId, { name: string; description: string }>,
    modes: {
      leetcode: {
        name: 'Học LeetCode',
        description: 'Gợi ý từng bước, chạy thử code ngay trong chat',
        starters: [
          'Gợi ý cho mình một bài Easy về mảng',
          'Giải thích bài Two Sum từng bước',
          'Ôn Sliding Window với 3 bài tăng dần độ khó',
          'Cho mình đề Valid Parentheses để tự làm',
        ],
      },
      english: {
        name: 'Học tiếng Anh',
        description: 'Từ vựng, sửa ngữ pháp, quiz và luyện hội thoại',
        starters: [
          'Dạy mình 3 từ vựng chủ đề công việc',
          'Sửa giúp mình: I has went to school yesterday',
          'Cho mình làm quiz thì hiện tại hoàn thành',
          'Luyện hội thoại phỏng vấn xin việc',
        ],
      },
      explain: {
        name: 'Giải thích bằng slide',
        description: 'Bài giảng slide có lời đọc, tạo ngay khi bạn hỏi',
        starters: [
          'Giải thích Event Loop trong JavaScript',
          'React useEffect chạy khi nào?',
          'Git rebase khác merge thế nào?',
          'Giải thích cách HTTPS bảo mật kết nối',
        ],
      },
    },
  },
  en: {
    pickMode: 'Start with…',
    tryAsking: 'Try asking',
    shuffle: 'Other ideas',
    shuffleHint: 'Ask the current model for 3–5 random questions',
    shuffleFailed: 'Could not get ideas, try again.',
    clearMode: (name: string) => `Turn off ${name}`,
    explainStyle: 'Teaching style',
    changeStyle: 'Change teaching style',
    appliesNext: 'Applies from your next question',
    styles: {
      simple: { name: 'Simple', description: 'Plain words, small steps' },
      standard: { name: 'Standard', description: 'Clear, well-rounded teaching' },
      practical: { name: 'Practical', description: 'Concrete examples, light on theory' },
      fun: { name: 'Fun', description: 'Funny and a bit sarcastic, still accurate' },
      deep: { name: 'Deep dive', description: 'Down to what happens under the hood' },
      tldr: { name: 'TL;DR', description: '3–4 slides, straight to the point' },
      visual: { name: 'Visual', description: 'Diagrams, drawings and simulations that move with the narration' },
    },
    modes: {
      leetcode: {
        name: 'LeetCode practice',
        description: 'Step-by-step hints, run code right in the chat',
        starters: [
          'Suggest an Easy array problem',
          'Explain Two Sum step by step',
          'Practise Sliding Window with 3 problems of rising difficulty',
          'Give me Valid Parentheses to solve myself',
        ],
      },
      english: {
        name: 'Learn English',
        description: 'Vocabulary, grammar fixes, quizzes and conversation practice',
        starters: [
          'Teach me 3 words about work',
          'Fix this: I has went to school yesterday',
          'Give me a quiz on the present perfect',
          'Practise a job interview conversation',
        ],
      },
      explain: {
        name: 'Slide explainer',
        description: 'Narrated slide lessons, built the moment you ask',
        starters: [
          'Explain the JavaScript event loop',
          'When does React useEffect run?',
          'How is git rebase different from merge?',
          'Explain how HTTPS secures a connection',
        ],
      },
    },
  },
})

/** Active mode of a thread, or the one picked before its first message. */
export function useChatMode(threadId: string): ModeId | null {
  const thread = useThread(threadId)
  const pending = usePendingMode(threadId)
  return thread ? (thread.mode ?? null) : pending
}

/** The slide explainer style of a thread: its own pick, else the one picked last anywhere. */
export function useExplainStyle(threadId: string): ExplainStyleId {
  const thread = useThread(threadId)
  const pending = usePendingExplainStyle(threadId)
  const last = useChatSettings().explainStyle
  const style = thread ? thread.explainStyle : pending
  return style ?? (isExplainStyleId(last) ? last : DEFAULT_EXPLAIN_STYLE)
}

/** Explain style names in the UI language, for labelling lessons. */
export function useExplainStyleNames(): Record<ExplainStyleId, string> {
  const { styles } = useMessages(messages)
  return Object.fromEntries(EXPLAIN_STYLE_IDS.map((id) => [id, styles[id].name])) as Record<ExplainStyleId, string>
}

function pickExplainStyle(threadId: string, style: ExplainStyleId) {
  setThreadExplainStyle(threadId, style)
  // New threads start with the style picked last.
  setChatSetting('explainStyle', style)
}

/** Empty-state panel: mode cards, or the active mode's starter prompts. */
export function ModeStarter({
  threadId,
  model,
  onSend,
}: {
  threadId: string
  /** The model picked in the composer, which comes up with new starters on request. */
  model?: string
  onSend: (text: string) => void
}) {
  const t = useMessages(messages)
  const mode = useChatMode(threadId)

  if (mode) {
    return (
      <div className="flex flex-col gap-2 animate-in fade-in duration-150">
        {mode === 'explain' && <ExplainStylePicker threadId={threadId} />}
        {/* Keyed by mode so starters made for one mode are not offered in another. */}
        <ModeStarters key={mode} threadId={threadId} mode={mode} model={model} onSend={onSend} />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="px-1 text-xs text-muted-foreground">{t.pickMode}</span>
      <div className="grid gap-3 sm:grid-cols-2">
        {MODE_IDS.map((id) => {
          const Icon = MODE_ICONS[id]
          return (
            <button
              key={id}
              type="button"
              onClick={() => setThreadMode(threadId, id)}
              className="group flex items-start gap-3 rounded-2xl border border-border bg-card p-4 text-left shadow-xs transition-colors hover:border-ring hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary">
                <Icon className="size-5" />
              </span>
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="font-medium text-card-foreground">{t.modes[id].name}</span>
                <span className="text-sm text-muted-foreground">{t.modes[id].description}</span>
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

/** The mode's starter prompts, which the current model can swap for random new ones. */
function ModeStarters({
  threadId,
  mode,
  model,
  onSend,
}: {
  threadId: string
  mode: ModeId
  model?: string
  onSend: (text: string) => void
}) {
  const t = useMessages(messages)
  const style = useExplainStyle(threadId)
  // Until the model makes some, the built-in starters follow the UI language.
  const [generated, setGenerated] = React.useState<ReadonlyArray<string> | null>(null)
  const starters = generated ?? t.modes[mode].starters
  // Everything the model offered so far, so new ideas do not circle back to old ones.
  const seen = React.useRef(new Set<string>())
  const shuffle = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/starters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, mode, style, avoid: [...starters, ...seen.current].slice(-20) }),
      })
      const { starters: items = [] } = (await res.json()) as { starters?: Array<string> }
      if (!items.length) throw new Error(t.shuffleFailed)
      return items
    },
    onSuccess: (items) => {
      for (const item of items) seen.current.add(item)
      setGenerated(items)
    },
  })

  return (
    <>
      <div className="flex items-center gap-2 px-1">
        <span className="text-xs text-muted-foreground">{t.tryAsking}</span>
        <button
          type="button"
          title={t.shuffleHint}
          disabled={!model || shuffle.isPending}
          onClick={() => shuffle.mutate()}
          className="flex cursor-pointer items-center gap-1 rounded-full px-1.5 py-0.5 text-xs text-primary transition-colors hover:bg-primary/12 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none disabled:cursor-default disabled:opacity-60"
        >
          {shuffle.isPending ? <IconLoader2 aria-hidden className="size-3.5 animate-spin" /> : <IconDice5 aria-hidden className="size-3.5" />}
          {t.shuffle}
        </button>
      </div>
      <div className="flex flex-wrap gap-2" aria-busy={shuffle.isPending}>
        {shuffle.isPending
          ? [44, 56, 40, 52].map((w) => (
              <span key={w} className="h-8 animate-pulse rounded-full bg-muted" style={{ width: `${w * 4}px` }} />
            ))
          : starters.map((starter) => (
              <button
                key={starter}
                type="button"
                onClick={() => onSend(starter)}
                className="rounded-full border border-border bg-card px-3 py-1.5 text-left text-sm text-card-foreground shadow-xs transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                {starter}
              </button>
            ))}
      </div>
      {shuffle.isError && <p className="px-1 text-xs text-destructive">{t.shuffleFailed}</p>}
    </>
  )
}

/** Row of style toggles shown above the explainer's starter prompts. */
function ExplainStylePicker({ threadId }: { threadId: string }) {
  const t = useMessages(messages)
  const style = useExplainStyle(threadId)
  return (
    <div className="mb-2 flex flex-col gap-2">
      <span id={`${threadId}-explain-style`} className="px-1 text-xs text-muted-foreground">
        {t.explainStyle}
      </span>
      <div role="radiogroup" aria-labelledby={`${threadId}-explain-style`} className="flex flex-wrap gap-1.5">
        {EXPLAIN_STYLE_IDS.map((id) => (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={style === id}
            title={t.styles[id].description}
            onClick={() => pickExplainStyle(threadId, id)}
            className={cn(
              'rounded-full border px-3 py-1 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none',
              style === id
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-card text-muted-foreground hover:bg-accent hover:text-accent-foreground',
            )}
          >
            {t.styles[id].name}
          </button>
        ))}
      </div>
    </div>
  )
}

/** Composer chip showing the active mode, with a button to turn it off. */
export function ComposerModeChip({ threadId, className }: { threadId: string; className?: string }) {
  const t = useMessages(messages)
  const mode = useChatMode(threadId)
  if (!mode) return null
  const Icon = MODE_ICONS[mode]
  const name = t.modes[mode].name
  return (
    <span
      className={cn(
        'flex h-6 min-w-0 items-center gap-1 rounded-full border border-primary/40 bg-primary/12 pr-0.5 pl-2 text-xs font-medium text-primary animate-in fade-in zoom-in-95 duration-150',
        className,
      )}
    >
      <Icon aria-hidden className="size-3.5" />
      <span className="max-w-32 truncate">{name}</span>
      {mode === 'explain' && <ExplainStyleMenu threadId={threadId} />}
      <button
        type="button"
        aria-label={t.clearMode(name)}
        title={t.clearMode(name)}
        onClick={() => setThreadMode(threadId, null)}
        className="flex size-5 cursor-pointer items-center justify-center rounded-full transition-colors hover:bg-primary/20 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <IconX aria-hidden className="size-3" />
      </button>
    </span>
  )
}

/** The explainer chip's style switcher: the current style, opening a menu of all of them. */
function ExplainStyleMenu({ threadId }: { threadId: string }) {
  const t = useMessages(messages)
  const style = useExplainStyle(threadId)
  return (
    <Menu.Root>
      <Menu.Trigger
        aria-label={t.changeStyle}
        title={t.changeStyle}
        className="-mr-0.5 flex h-5 cursor-pointer items-center gap-0.5 rounded-full px-1 font-normal opacity-80 transition-colors hover:bg-primary/20 hover:opacity-100 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none data-popup-open:bg-primary/20 data-popup-open:opacity-100"
      >
        <span aria-hidden>·</span>
        <span className="max-w-24 truncate">{t.styles[style].name}</span>
        <IconChevronDown aria-hidden className="size-3" />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner side="top" align="start" sideOffset={8} collisionPadding={8} className="z-50">
          <Menu.Popup className={cn(popupClass, 'w-72')}>
            <Menu.RadioGroup
              value={style}
              onValueChange={(next: string) => isExplainStyleId(next) && pickExplainStyle(threadId, next)}
            >
              {EXPLAIN_STYLE_IDS.map((id) => (
                <Menu.RadioItem
                  key={id}
                  value={id}
                  closeOnClick
                  className="flex cursor-default items-center gap-2 rounded-lg px-2 py-1.5 outline-none select-none data-highlighted:bg-accent data-highlighted:text-accent-foreground"
                >
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="text-sm font-medium">{t.styles[id].name}</span>
                    <span className="truncate text-xs text-muted-foreground">{t.styles[id].description}</span>
                  </span>
                  <Menu.RadioItemIndicator className="text-primary">
                    <IconCheck className="size-4" />
                  </Menu.RadioItemIndicator>
                </Menu.RadioItem>
              ))}
            </Menu.RadioGroup>
            <Menu.Separator className="-mx-1 my-1 h-px bg-border" />
            <p className="px-2 py-1 text-xs text-muted-foreground">{t.appliesNext}</p>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  )
}
