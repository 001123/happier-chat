import { Store } from '@tanstack/react-store'
import { defineAppHotkeys, formatForDisplay, useAppHotkeys } from '@tanstack/react-hotkeys'
import type { AppHotkeyId } from '@tanstack/react-hotkeys'

import { useHydrated } from '@/lib/hydrated'

/** Every app-wide shortcut, in the order the shortcuts dialog lists them. Ids are keys for saved custom hotkeys. */
export const appHotkeys = defineAppHotkeys({
  'chat.new': { hotkey: 'Mod+Shift+O', meta: { name: 'New chat' } },
  'threads.search': { hotkey: 'Mod+K', meta: { name: 'Search conversations' } },
  'sidebar.toggle': { hotkey: 'Mod+B', meta: { name: 'Toggle sidebar' } },
  'composer.focus': { hotkey: '/', meta: { name: 'Focus message box' } },
  'composer.focusAlt': { hotkey: 'Shift+Escape', meta: { name: 'Focus message box' } },
  'chat.stop': { hotkey: 'Escape', meta: { name: 'Stop generating' } },
  'help.shortcuts': { hotkey: 'Mod+/', meta: { name: 'Keyboard shortcuts' } },
})

declare module '@tanstack/react-hotkeys' {
  interface Register {
    appHotkeys: typeof appHotkeys
  }
}

/** The shortcut as the user's platform writes it. Empty until hydration, because the server cannot know the platform. */
export function useShortcutLabel(id: AppHotkeyId) {
  const hydrated = useHydrated()
  const hotkey = useAppHotkeys()[id].hotkey
  return hydrated && hotkey ? formatForDisplay(hotkey) : ''
}

/** Appends the shortcut to a tooltip: `New chat (⌘⇧O)`. */
export function withShortcut(label: string, shortcut: string) {
  return shortcut ? `${label} (${shortcut})` : label
}

/** Whether the keyboard shortcuts dialog is open; the user menu and `Mod+/` both open it. */
export const shortcutsDialogStore = new Store(false)

export function setShortcutsDialogOpen(open: boolean) {
  shortcutsDialogStore.setState(() => open)
}
