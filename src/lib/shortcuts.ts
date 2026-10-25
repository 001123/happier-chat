import { formatForDisplay } from '@tanstack/react-hotkeys'

import { useHydrated } from '@/lib/hydrated'

export const SHORTCUTS = {
  newChat: 'Mod+Shift+O',
  searchThreads: 'Mod+K',
  focusComposer: '/',
  focusComposerAlt: 'Shift+Escape',
  toggleSidebar: 'Mod+B',
} as const

/** The shortcut as the user's platform writes it. Empty until hydration, because the server cannot know the platform. */
export function useShortcutLabel(hotkey: (typeof SHORTCUTS)[keyof typeof SHORTCUTS]) {
  const hydrated = useHydrated()
  return hydrated ? formatForDisplay(hotkey) : ''
}

/** Appends the shortcut to a tooltip: `New chat (⌘⇧O)`. */
export function withShortcut(label: string, shortcut: string) {
  return shortcut ? `${label} (${shortcut})` : label
}
