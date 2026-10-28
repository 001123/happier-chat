import { ScriptOnce, useLoaderData, useRouteContext } from '@tanstack/react-router'

import { AttachButton } from '@/components/composer-attachments'
import { ComposerTools } from '@/components/composer-tools'
import { Logo } from '@/components/logo'
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupTextarea } from '@/components/ui/input-group'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { IconArrowUp } from '@tabler/icons-react'
import { defineMessages, useMessages } from '@/lib/i18n'

// Kept apart from chat-view so the server-rendered placeholder doesn't pull in the whole chat bundle;
// the composer toolbar is shared through composer-tools.

export const shellCopy = defineMessages({
  vi: {
    morning: 'Chào buổi sáng',
    noon: 'Chào buổi trưa',
    afternoon: 'Chào buổi chiều',
    evening: 'Chào buổi tối',
    messageLabel: 'Tin nhắn',
  },
  en: {
    morning: 'Good morning',
    noon: 'Good midday',
    afternoon: 'Good afternoon',
    evening: 'Good evening',
    messageLabel: 'Message',
  },
})

type ShellCopy = (typeof shellCopy)['vi']

const timeOfDay = (hour: number) => (hour < 11 ? 'morning' : hour < 14 ? 'noon' : hour < 18 ? 'afternoon' : 'evening')

export function greeting(t: ShellCopy, name: string) {
  const text = t[timeOfDay(new Date().getHours())]
  return name ? `${text}, ${name}` : text
}

/** Marks the composer textarea whose text the real composer takes over after hydration. */
export const COMPOSER_FALLBACK_ATTR = 'data-composer-fallback'

/** Reads text typed into the server-rendered composer before the chat bundle loaded. */
export function takeFallbackInput() {
  return document.querySelector<HTMLTextAreaElement>(`[${COMPOSER_FALLBACK_ATTR}]`)?.value ?? ''
}

// The server's clock may sit in another time zone; rewrite the greeting with the browser's hour before paint.
const greetingScript = (t: ShellCopy, name: string) => `(() => {
  const el = document.currentScript.previousElementSibling.lastElementChild
  const timeOfDay = ${timeOfDay.toString()}
  const copy = ${JSON.stringify({ morning: t.morning, noon: t.noon, afternoon: t.afternoon, evening: t.evening })}
  const name = ${JSON.stringify(name)}
  const text = copy[timeOfDay(new Date().getHours())]
  el.textContent = name ? text + ', ' + name : text
})()`

// Mirrors a few chat turns: user bubble, "thought" trace line, then the reply card.
const TURNS = [
  { user: ['w-48'], reply: ['w-full', 'w-11/12', 'w-4/5', 'w-2/3'] },
  { user: ['w-64', 'w-36'], reply: ['w-full', 'w-5/6', 'w-3/5'] },
]

/** Placeholder chat turns for a started chat, shown until the bundle restores its messages. */
function MessagesSkeleton() {
  return (
    <div
      aria-hidden
      className="hidden min-h-0 flex-1 flex-col justify-start gap-6 overflow-hidden px-2 pt-4 animate-pulse in-data-chat-started:flex motion-reduce:animate-none"
    >
      {TURNS.map((turn, i) => (
        <div key={i} className="flex flex-col gap-6">
          <div className="flex max-w-[85%] flex-col items-end gap-2 self-end rounded-2xl rounded-br-md border border-border bg-user-bubble px-4 py-3.5 shadow-xs">
            {turn.user.map((width, j) => (
              <div key={j} className={`h-3 max-w-full rounded-full bg-muted-foreground/15 ${width}`} />
            ))}
          </div>
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <div className="size-3.5 rounded-full bg-muted-foreground/15" />
              <div className="h-3 w-20 rounded-full bg-muted-foreground/15" />
            </div>
            <div className="flex w-[85%] flex-col gap-3 rounded-2xl rounded-bl-md border border-border bg-card px-4 py-4 shadow-xs">
              {turn.reply.map((width, j) => (
                <div key={j} className={`h-3 rounded-full bg-muted-foreground/12 ${width}`} />
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

/**
 * Server-rendered stand-in for the client-only chat view: the composer is visible and typeable on first paint.
 */
export function ChatViewSkeleton({ threadId }: { threadId: string }) {
  const t = useMessages(shellCopy)
  const { user } = useRouteContext({ from: '/_app' })
  // The thread list comes with the page and a thread exists once it has a message, so the server already knows
  // which layout to draw.
  const { threads } = useLoaderData({ from: '/_app' })
  const thread = threads.find((item) => item.id === threadId)
  const started = thread !== undefined

  return (
    <div className="flex h-dvh flex-col" data-chat-started={started ? '' : undefined}>
      <header className="flex h-12 shrink-0 items-center px-3">
        <SidebarTrigger />
      </header>
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-8 px-4 pb-[12vh] in-data-chat-started:max-w-4xl in-data-chat-started:justify-end in-data-chat-started:pb-4">
        <h1 className="flex items-center justify-center gap-3 font-serif text-4xl font-light text-foreground in-data-chat-started:hidden">
          <Logo className="size-8" />
          <span suppressHydrationWarning>{greeting(t, user.name)}</span>
        </h1>
        <ScriptOnce>{greetingScript(t, user.name)}</ScriptOnce>
        <MessagesSkeleton />
        <div className="w-full">
          <InputGroup className="h-auto rounded-2xl border-ring bg-card shadow-[0_0.25rem_1.25rem_rgba(0,0,0,0.04)] ring-3 ring-ring/50 dark:bg-card">
            <InputGroupTextarea
              aria-label={t.messageLabel}
              className="min-h-14 px-4 pt-4 text-chat"
              {...{ [COMPOSER_FALLBACK_ATTR]: '' }}
              autoFocus
            />
            <InputGroupAddon align="block-end" className="px-3 pb-3">
              <AttachButton info={undefined} />
              <ComposerTools
                threadId={threadId}
                skeleton
                skeletonMode={thread?.mode ? { mode: thread.mode, explainStyle: thread.explainStyle } : undefined}
              />
              <InputGroupButton type="button" variant="default" size="icon-sm" className="rounded-lg">
                <IconArrowUp />
              </InputGroupButton>
            </InputGroupAddon>
          </InputGroup>
        </div>
      </div>
    </div>
  )
}
