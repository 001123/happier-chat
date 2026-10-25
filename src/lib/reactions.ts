import { createPersistedStore, useStoreValue } from '@/lib/store'

type Reactions = Record<string, Record<string, string>>

const EMPTY: Record<string, string> = {}
const NONE: Reactions = {}

const reactionsStore = createPersistedStore<Reactions>('chat-reactions', NONE, { merge: false })

export function useReactions(threadId: string) {
  return useStoreValue(reactionsStore, (all) => all[threadId] ?? EMPTY, () => NONE)
}

export function toggleReaction(threadId: string, messageId: string, emoji: string) {
  reactionsStore.setState((all) => {
    const { [messageId]: current, ...rest } = all[threadId] ?? {}
    return { ...all, [threadId]: current === emoji ? rest : { ...rest, [messageId]: emoji } }
  })
}

export function clearReactions(threadId: string) {
  reactionsStore.setState((all) => {
    const { [threadId]: _, ...rest } = all
    return rest
  })
}
