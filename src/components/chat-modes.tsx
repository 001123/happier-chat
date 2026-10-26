import * as React from 'react'
import { IconBrandLeetcode, IconChalkboard, IconLanguage, IconX } from '@tabler/icons-react'
import type { Icon } from '@tabler/icons-react'
import { cn } from 'cn'

import { defineMessages, useMessages } from '@/lib/i18n'
import { MODE_IDS } from '@/lib/modes'
import type { ModeId } from '@/lib/modes'
import { setThreadMode, usePendingMode, useThread } from '@/lib/threads'

const MODE_ICONS: Record<ModeId, Icon> = {
  leetcode: IconBrandLeetcode,
  english: IconLanguage,
  explain: IconChalkboard,
}

const messages = defineMessages({
  vi: {
    pickMode: 'Chọn chế độ học',
    tryAsking: 'Thử hỏi',
    clearMode: (name: string) => `Tắt chế độ ${name}`,
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
    pickMode: 'Pick a learning mode',
    tryAsking: 'Try asking',
    clearMode: (name: string) => `Turn off ${name}`,
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

/** Empty-state panel: mode cards, or the active mode's starter prompts. */
export function ModeStarter({ threadId, onSend }: { threadId: string; onSend: (text: string) => void }) {
  const t = useMessages(messages)
  const mode = useChatMode(threadId)

  if (mode) {
    return (
      <div className="flex flex-col gap-2 animate-in fade-in duration-150">
        <span className="px-1 text-xs text-muted-foreground">{t.tryAsking}</span>
        <div className="flex flex-wrap gap-2">
          {t.modes[mode].starters.map((starter) => (
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
        'flex h-6 items-center gap-1 rounded-full border border-primary/40 bg-primary/12 pr-0.5 pl-2 text-xs font-medium text-primary animate-in fade-in zoom-in-95 duration-150',
        className,
      )}
    >
      <Icon aria-hidden className="size-3.5" />
      <span className="max-w-32 truncate">{name}</span>
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
