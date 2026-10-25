import { useSyncExternalStore } from 'react'
type Reactions = Record<string, Record<string, string>>

const KEY = 'chat-reactions'
const EMPTY: Record<string, string> = {}
const listeners = new Set<() => void>()
let cache: Reactions | null = null

function read(): Reactions {
  if (cache) return cache
  try {
    cache = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Reactions
  } catch {
    cache = {}
  }
  return cache
}

function write(reactions: Reactions) {
  cache = reactions
  localStorage.setItem(KEY, JSON.stringify(reactions))
  listeners.forEach((l) => l())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useReactions(threadId: string) {
  return useSyncExternalStore(
    subscribe,
    () => read()[threadId] ?? EMPTY,
    () => EMPTY,
  )
}

export function toggleReaction(threadId: string, messageId: string, emoji: string) {
  const all = read()
  const { [messageId]: current, ...rest } = all[threadId] ?? {}
  write({ ...all, [threadId]: current === emoji ? rest : { ...rest, [messageId]: emoji } })
}

export function clearReactions(threadId: string) {
  const { [threadId]: _, ...rest } = read()
  write(rest)
}
