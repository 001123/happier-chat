import { IconActivity, IconGauge, IconTrash, IconX } from '@tabler/icons-react'
import { cn } from 'cn'

import { AguiEventList } from '@/components/agui-inspector'
import type { AguiEntry } from '@/components/agui-inspector'
import { ChatStatsPanel } from '@/components/chat-stats'
import type { RunStat } from '@/components/chat-stats'
import { Button } from '@/components/ui/button'
import { Sheet, SheetClose, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { defineMessages, useMessages } from '@/lib/i18n'

const messages = defineMessages({
  vi: { info: 'Thông tin', clearLog: 'Xoá log', close: 'Đóng' },
  en: { info: 'Info', clearLog: 'Clear log', close: 'Close' },
})

export type DebugTab = 'stats' | 'events'

export function DebugDrawer({
  open,
  onOpenChange,
  tab,
  onTabChange,
  entries,
  runs,
  turns,
  messageCount,
  onClearEvents,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  tab: DebugTab
  onTabChange: (tab: DebugTab) => void
  entries: Array<AguiEntry>
  runs: Array<RunStat>
  turns: number
  messageCount: number
  onClearEvents: () => void
}) {
  const t = useMessages(messages)
  const tabs = [
    { id: 'stats', label: t.info, icon: IconGauge, count: undefined },
    { id: 'events', label: 'Events', icon: IconActivity, count: entries.length },
  ] as const

  return (
    <Sheet open={open} onOpenChange={onOpenChange} modal={false}>
      <SheetContent
        side="left"
        showOverlay={false}
        showCloseButton={false}
        className="gap-0 bg-sidebar data-[side=left]:w-[380px] data-[side=left]:sm:max-w-[380px]"
      >
        <SheetTitle className="sr-only">Debug</SheetTitle>
        <header className="flex h-12 shrink-0 items-center gap-1 border-b px-2">
          <div role="tablist" aria-label="Debug" className="flex items-center gap-1">
            {tabs.map(({ id, label, icon: Icon, count }) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={tab === id}
                onClick={() => onTabChange(id)}
                className={cn(
                  'flex h-8 items-center gap-1.5 whitespace-nowrap rounded-md px-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground [&_svg]:size-4',
                  tab === id && 'bg-muted font-medium text-foreground',
                )}
              >
                <Icon />
                {label}
                {count !== undefined && <span className="text-xs text-muted-foreground tabular-nums">{count}</span>}
              </button>
            ))}
          </div>
          {tab === 'events' && (
            <Button variant="ghost" size="icon-sm" className="ml-auto" onClick={onClearEvents} aria-label={t.clearLog}>
              <IconTrash />
            </Button>
          )}
          <SheetClose
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                className={cn(tab !== 'events' && 'ml-auto')}
                aria-label={t.close}
              />
            }
          >
            <IconX />
          </SheetClose>
        </header>
        {tab === 'events' ? (
          <AguiEventList entries={entries} />
        ) : (
          <ChatStatsPanel runs={runs} turns={turns} messageCount={messageCount} />
        )}
      </SheetContent>
    </Sheet>
  )
}
