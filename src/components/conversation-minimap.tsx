import * as React from 'react'
import { cn } from 'cn'

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useMessageScroller, useMessageScrollerVisibility } from '@/components/ui/message-scroller'
import { defineMessages, useMessages } from '@/lib/i18n'

const messages = defineMessages({
  vi: {
    nav: 'Các câu hỏi trong cuộc trò chuyện',
    question: (n: number, text: string) => `Câu hỏi ${n}: ${text}`,
  },
  en: {
    nav: 'Questions in this conversation',
    question: (n: number, text: string) => `Question ${n}: ${text}`,
  },
})

export type MinimapQuestion = { id: string; text: string }

export function ConversationMinimap({
  questions,
  messageIds,
}: {
  questions: Array<MinimapQuestion>
  messageIds: Array<string>
}) {
  const t = useMessages(messages)
  const { scrollToMessage } = useMessageScroller()
  const { visibleMessageIds } = useMessageScrollerVisibility()

  const activeId = React.useMemo(() => {
    const visible = new Set(visibleMessageIds)
    const top = messageIds.findIndex((id) => visible.has(id))
    if (top === -1) return null
    const before = new Set(messageIds.slice(0, top + 1))
    return (
      questions.find((q) => visible.has(q.id))?.id ??
      [...questions].reverse().find((q) => before.has(q.id))?.id ??
      null
    )
  }, [visibleMessageIds, messageIds, questions])

  if (questions.length < 2) return null

  return (
    <nav
      data-print-exclude
      aria-label={t.nav}
      className="absolute top-1/2 left-4 z-10 flex max-h-[60%] -translate-y-1/2 flex-col items-start overflow-y-auto py-1 [scrollbar-width:none] max-sm:hidden"
    >
      {questions.map((question, index) => {
        const active = question.id === activeId
        return (
          <Tooltip key={question.id}>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  aria-label={t.question(index + 1, question.text)}
                  aria-current={active ? 'true' : undefined}
                  onClick={() => scrollToMessage(question.id, { behavior: 'smooth', align: 'start' })}
                  className="group/tick flex h-3 w-8 shrink-0 items-center justify-start outline-none"
                />
              }
            >
              <span
                className={cn(
                  'h-0.5 rounded-full transition-all duration-200',
                  active
                    ? 'w-5 bg-foreground'
                    : 'w-3 bg-muted-foreground/40 group-hover/tick:w-5 group-hover/tick:bg-muted-foreground group-focus-visible/tick:w-5 group-focus-visible/tick:bg-muted-foreground',
                )}
              />
            </TooltipTrigger>
            <TooltipContent side="right" className="line-clamp-3 block max-w-64">
              {question.text}
            </TooltipContent>
          </Tooltip>
        )
      })}
    </nav>
  )
}
