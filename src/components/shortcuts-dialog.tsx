import * as React from 'react'
import { Dialog } from '@base-ui/react/dialog'
import { useSelector } from '@tanstack/react-store'
import { HotkeysProvider, formatForDisplay, useAppHotkeyList, useHotkey } from '@tanstack/react-hotkeys'
import type { AppHotkeyId } from '@tanstack/react-hotkeys'
import { IconKeyboard, IconX } from '@tabler/icons-react'

import { appHotkeys, setShortcutsDialogOpen, shortcutsDialogStore } from '@/lib/shortcuts'
import { defineMessages, useMessages } from '@/lib/i18n'

const messages = defineMessages({
  vi: {
    title: 'Phím tắt',
    description: 'Thao tác nhanh bằng bàn phím.',
    close: 'Đóng',
    or: 'hoặc',
    names: {
      'chat.new': 'Cuộc trò chuyện mới',
      'threads.search': 'Tìm cuộc trò chuyện',
      'sidebar.toggle': 'Ẩn/hiện thanh bên',
      'composer.focus': 'Đến ô nhập tin nhắn',
      'composer.focusAlt': 'Đến ô nhập tin nhắn',
      'chat.stop': 'Dừng trả lời',
      'help.shortcuts': 'Mở bảng phím tắt',
      'lesson.playPause': 'Bài giảng: phát/tạm dừng',
      'lesson.prev': 'Bài giảng: slide trước',
      'lesson.next': 'Bài giảng: slide sau',
      'lesson.fullscreen': 'Bài giảng: toàn màn hình',
    } satisfies Record<AppHotkeyId, string>,
  },
  en: {
    title: 'Keyboard shortcuts',
    description: 'Get around faster with the keyboard.',
    close: 'Close',
    or: 'or',
    names: {
      'chat.new': 'New chat',
      'threads.search': 'Search conversations',
      'sidebar.toggle': 'Toggle sidebar',
      'composer.focus': 'Focus message box',
      'composer.focusAlt': 'Focus message box',
      'chat.stop': 'Stop generating',
      'help.shortcuts': 'Show keyboard shortcuts',
      'lesson.playPause': 'Lesson: play/pause',
      'lesson.prev': 'Lesson: previous slide',
      'lesson.next': 'Lesson: next slide',
      'lesson.fullscreen': 'Lesson: full screen',
    },
  },
})

/** Lists every app hotkey. Mounted once in the app layout; `Mod+/` or the user menu opens it. */
export function ShortcutsDialog() {
  const open = useSelector(shortcutsDialogStore, (state) => state)
  useHotkey(appHotkeys['help.shortcuts'], () => setShortcutsDialogOpen(true), { enabled: !open })

  return (
    <Dialog.Root open={open} onOpenChange={setShortcutsDialogOpen}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/20 transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0 supports-backdrop-filter:backdrop-blur-xs" />
        <Dialog.Popup className="fixed top-1/2 left-1/2 z-50 grid w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 gap-4 rounded-2xl border bg-popover p-5 text-sm text-popover-foreground shadow-xl outline-hidden transition-all duration-150 data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0">
          {/* Only the dialog's own hotkeys fire while it is open. */}
          <HotkeysProvider scope="shortcuts-dialog" exclusive>
            <ShortcutsDialogBody />
          </HotkeysProvider>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function ShortcutsDialogBody() {
  const t = useMessages(messages)
  const items = useAppHotkeyList()
  // The same keys that opened the dialog close it.
  useHotkey(appHotkeys['help.shortcuts'], () => setShortcutsDialogOpen(false))

  // Several hotkeys can run one action (`/` and Shift+Esc both focus the composer): show them on one row.
  const rows: Array<{ name: string; keys: Array<string> }> = []
  for (const { appHotkey } of items) {
    if (!appHotkey.hotkey) continue
    const name = t.names[appHotkey.id]
    const keys = formatForDisplay(appHotkey.hotkey)
    const row = rows.find((r) => r.name === name)
    if (row) row.keys.push(keys)
    else rows.push({ name, keys: [keys] })
  }

  return (
    <>
      <div className="flex gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <IconKeyboard className="size-4" />
        </span>
        <div className="grid flex-1 gap-1">
          <Dialog.Title className="font-serif text-lg font-medium tracking-tight">{t.title}</Dialog.Title>
          <Dialog.Description className="text-muted-foreground">{t.description}</Dialog.Description>
        </div>
        <Dialog.Close
          aria-label={t.close}
          className="-mt-1 -mr-1 flex size-7 items-center justify-center self-start rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground"
        >
          <IconX className="size-4" />
        </Dialog.Close>
      </div>
      <ul className="-mx-2 grid">
        {rows.map((row) => (
          <li key={row.name} className="flex items-center gap-3 rounded-md px-2 py-1.5">
            <span className="flex-1">{row.name}</span>
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              {row.keys.map((keys, i) => (
                <React.Fragment key={keys}>
                  {i > 0 && <span>{t.or}</span>}
                  <kbd className="min-w-6 rounded-md border bg-muted px-1.5 py-0.5 text-center font-sans text-foreground tabular-nums">
                    {keys}
                  </kbd>
                </React.Fragment>
              ))}
            </span>
          </li>
        ))}
      </ul>
    </>
  )
}
