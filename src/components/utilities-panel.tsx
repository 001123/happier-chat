import { IconApps, IconPrinter, IconX } from '@tabler/icons-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { defineMessages, useMessages } from '@/lib/i18n'

const messages = defineMessages({
  vi: {
    title: 'Tiện ích',
    close: 'Đóng',
    print: 'In cuộc trò chuyện',
    printHint: 'Mở bản sao trang chat để xoá, sửa nội dung rồi mới in.',
  },
  en: {
    title: 'Utilities',
    close: 'Close',
    print: 'Print conversation',
    printHint: 'Opens a copy of the chat page so you can delete or edit content before printing.',
  },
})

export function UtilitiesPanel({
  open,
  onPrint,
  onClose,
}: {
  open: boolean
  onPrint?: () => void
  onClose: () => void
}) {
  const t = useMessages(messages)
  return (
    <div
      inert={!open}
      className={cn(
        'h-dvh shrink-0 overflow-hidden transition-[width] duration-150 ease-linear',
        open ? 'w-[380px]' : 'w-0',
      )}
    >
    <aside className="flex h-full w-[380px] flex-col border-l bg-sidebar">
      <header className="flex h-12 shrink-0 items-center gap-1.5 border-b px-3 text-sm font-medium [&>svg]:size-4">
        <IconApps />
        {t.title}
        <Button variant="ghost" size="icon-sm" className="ml-auto" onClick={onClose} aria-label={t.close}>
          <IconX />
        </Button>
      </header>
      <div className="flex flex-col gap-2 overflow-y-auto p-3">
        <button
          type="button"
          disabled={!onPrint}
          onClick={onPrint}
          className="flex items-start gap-3 rounded-lg border bg-card p-3 text-left transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-50"
        >
          <IconPrinter className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <span className="flex flex-col gap-0.5">
            <span className="text-sm font-medium">{t.print}</span>
            <span className="text-xs text-muted-foreground">
              {t.printHint}
            </span>
          </span>
        </button>
      </div>
    </aside>
    </div>
  )
}
