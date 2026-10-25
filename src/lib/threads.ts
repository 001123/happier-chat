import { useSyncExternalStore } from 'react'
import { localStoragePersistence } from '@tanstack/ai-react'
import { clearReactions } from '@/lib/reactions'
import type { ModeId } from '@/lib/modes'

export type Thread = {
  id: string
  title: string
  updatedAt: number
  projectId?: string
  renamed?: boolean
  archived?: boolean
  mode?: ModeId
}

const KEY = 'chat-threads'
const EMPTY: Array<Thread> = []
const listeners = new Set<() => void>()
let cache: Array<Thread> | null = null

export const chatPersistence = localStoragePersistence()

function read(): Array<Thread> {
  if (cache) return cache
  try {
    cache = JSON.parse(localStorage.getItem(KEY) ?? '[]') as Array<Thread>
  } catch {
    cache = []
  }
  return cache
}

function write(threads: Array<Thread>) {
  cache = threads
  localStorage.setItem(KEY, JSON.stringify(threads))
  listeners.forEach((l) => l())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useThreads() {
  return useSyncExternalStore(subscribe, read, () => EMPTY)
}

const busy = new Set<string>()
const busyListeners = new Set<() => void>()

function subscribeBusy(listener: () => void) {
  busyListeners.add(listener)
  return () => busyListeners.delete(listener)
}

export function setThreadBusy(id: string, on: boolean) {
  if (busy.has(id) === on) return
  if (on) busy.add(id)
  else busy.delete(id)
  busyListeners.forEach((l) => l())
}

export function useThreadBusy(id: string) {
  return useSyncExternalStore(subscribeBusy, () => busy.has(id), () => false)
}

export function hasThread(id: string) {
  return read().some((t) => t.id === id)
}

const pendingProjects = new Map<string, string>()
const pendingListeners = new Set<() => void>()

function subscribePending(listener: () => void) {
  pendingListeners.add(listener)
  return () => pendingListeners.delete(listener)
}

export function newThreadInProject(projectId: string) {
  const id = crypto.randomUUID()
  pendingProjects.set(id, projectId)
  return id
}

export function pendingProject(id: string) {
  return pendingProjects.get(id) ?? null
}

/** Project chosen for a thread that has not been created yet. */
export function usePendingProject(id: string) {
  return useSyncExternalStore(subscribePending, () => pendingProject(id), () => null)
}

export function setPendingProject(id: string, projectId: string | null) {
  if (projectId) pendingProjects.set(id, projectId)
  else pendingProjects.delete(id)
  pendingListeners.forEach((l) => l())
}

const pendingModes = new Map<string, ModeId>()

/** Mode chosen for a thread that has not been created yet. */
export function usePendingMode(id: string) {
  return useSyncExternalStore(subscribePending, () => pendingModes.get(id) ?? null, () => null)
}

/** Sets the chat mode: kept as pending until the thread exists, then stored on the thread. */
export function setThreadMode(id: string, mode: ModeId | null) {
  if (read().some((t) => t.id === id)) {
    write(read().map((t) => (t.id === id ? { ...t, mode: mode ?? undefined } : t)))
    return
  }
  if (mode) pendingModes.set(id, mode)
  else pendingModes.delete(id)
  pendingListeners.forEach((l) => l())
}

export function upsertThread(id: string, title: string) {
  const threads = read()
  const existing = threads.find((t) => t.id === id)
  if (!existing) {
    const projectId = pendingProjects.get(id)
    const mode = pendingModes.get(id)
    pendingProjects.delete(id)
    pendingModes.delete(id)
    write([{ id, title, updatedAt: Date.now(), ...(projectId && { projectId }), ...(mode && { mode }) }, ...threads])
  } else if (!existing.renamed && existing.title !== title) {
    write(threads.map((t) => (t.id === id ? { ...t, title } : t)))
  }
}

export function renameThread(id: string, title: string) {
  write(read().map((t) => (t.id === id ? { ...t, title, renamed: true } : t)))
}

export function deleteThread(id: string) {
  write(read().filter((t) => t.id !== id))
  void chatPersistence.removeItem(id)
  clearReactions(id)
}

export function deleteThreads(ids: Iterable<string>) {
  const remove = new Set(ids)
  write(read().filter((t) => !remove.has(t.id)))
  for (const id of remove) {
    void chatPersistence.removeItem(id)
    clearReactions(id)
  }
}

// Archiving keeps projectId so a restored chat returns to its project.
export function setThreadsArchived(ids: Iterable<string>, archived: boolean) {
  const target = new Set(ids)
  write(
    read().map((t) => {
      if (!target.has(t.id) || !!t.archived === archived) return t
      const { archived: _, ...rest } = t
      return archived ? { ...rest, archived: true } : rest
    }),
  )
}

export function moveThread(id: string, projectId: string | null) {
  write(
    read().map((t) => {
      if (t.id !== id) return t
      const { projectId: _, ...rest } = t
      return projectId ? { ...rest, projectId } : rest
    }),
  )
}

export function unassignProject(projectId: string) {
  const threads = read()
  if (!threads.some((t) => t.projectId === projectId)) return
  write(
    threads.map((t) => {
      if (t.projectId !== projectId) return t
      const { projectId: _, ...rest } = t
      return rest
    }),
  )
}
