import { useSyncExternalStore } from 'react'
import { localStoragePersistence } from '@tanstack/ai-react'
import { clearReactions } from '@/lib/reactions'
import { getThreads, importLocalThread, removeThreads, saveThread, updateThreads } from '@/server/threads.functions'
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
// Set once this browser's pre-server threads have been uploaded; see migrateLocalThreads.
const MIGRATED_KEY = 'chat-threads-migrated'
const EMPTY: Array<Thread> = []
const listeners = new Set<() => void>()
let cache: Array<Thread> | null = null

// Transcripts now live on the server. This adapter only reads (and cleans up) what older versions kept in this browser.
const legacyTranscripts = localStoragePersistence()

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

// The server owns the thread list. Edits apply locally first, then go out in order so that, for example,
// a rename never overtakes the create it follows.
let queued = Promise.resolve()
let unsent = 0

function remote(task: () => Promise<unknown>) {
  unsent++
  queued = queued
    .then(async () => {
      await task()
    })
    .catch((error) => console.error('Could not save thread changes', error))
    .finally(() => unsent--)
}

let synced = false

export function useThreadsSynced() {
  return useSyncExternalStore(subscribe, () => synced, () => false)
}

/** Replaces the local list with the server's, unless local edits are still on their way to the server. */
export function applyServerThreads(server: Array<Thread>) {
  synced = true
  if (unsent > 0) return listeners.forEach((l) => l())
  write(server)
}

export async function refreshThreads() {
  try {
    applyServerThreads(await getThreads())
  } catch (error) {
    console.error('Could not load threads', error)
  }
}

function readLocalThreads(): Array<Thread> {
  try {
    const stored = JSON.parse(localStorage.getItem(KEY) ?? '[]') as unknown
    return Array.isArray(stored) ? (stored as Array<Thread>) : []
  } catch {
    return []
  }
}

function readLocalTranscript(id: string): Array<{ role: string }> {
  try {
    const stored = legacyTranscripts.getItem(id) as unknown
    // Older library versions stored a bare message array, newer ones { messages, resume }.
    const messages = Array.isArray(stored) ? stored : (stored as { messages?: unknown } | null)?.messages
    return Array.isArray(messages) ? (messages as Array<{ role: string }>) : []
  } catch {
    return []
  }
}

/**
 * Uploads threads that exist only in this browser (everything created before chats were stored on the
 * server) once per browser. Safe to repeat: the server ignores threads it already has, and the flag is only
 * set after every upload succeeded, so an interrupted run resumes on the next load. `local` must be read
 * before applyServerThreads replaces the local list.
 */
export async function migrateLocalThreads(local: Array<Thread>, server: Array<Thread>) {
  if (localStorage.getItem(MIGRATED_KEY)) return
  const known = new Set(server.map((t) => t.id))
  try {
    for (const thread of local.filter((t) => !known.has(t.id))) {
      const messages = readLocalTranscript(thread.id)
      const { stored } = await importLocalThread({ data: { thread, messages } })
      if (stored) legacyTranscripts.removeItem(thread.id)
    }
    localStorage.setItem(MIGRATED_KEY, '1')
    await refreshThreads()
  } catch (error) {
    console.error('Could not upload local threads', error)
  }
}

/** First sync of a session: takes the server list, then uploads whatever only this browser knew about. */
export function syncThreadsFromServer(server: Array<Thread>) {
  const local = readLocalThreads()
  applyServerThreads(server)
  void migrateLocalThreads(local, server)
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
    remote(() => updateThreads({ data: { ids: [id], patch: { mode } } }))
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
    const thread: Thread = { id, title, updatedAt: Date.now(), ...(projectId && { projectId }), ...(mode && { mode }) }
    write([thread, ...threads])
    remote(() => saveThread({ data: thread }))
  } else if (!existing.renamed && existing.title !== title) {
    write(threads.map((t) => (t.id === id ? { ...t, title } : t)))
    remote(() => saveThread({ data: { ...existing, title } }))
  }
}

export function renameThread(id: string, title: string) {
  write(read().map((t) => (t.id === id ? { ...t, title, renamed: true } : t)))
  remote(() => updateThreads({ data: { ids: [id], patch: { title, renamed: true } } }))
}

export function deleteThread(id: string) {
  deleteThreads([id])
}

export function deleteThreads(ids: Iterable<string>) {
  const remove = new Set(ids)
  write(read().filter((t) => !remove.has(t.id)))
  for (const id of remove) {
    void legacyTranscripts.removeItem(id)
    clearReactions(id)
  }
  remote(() => removeThreads({ data: { ids: [...remove] } }))
}

// Archiving keeps projectId so a restored chat returns to its project.
export function setThreadsArchived(ids: Iterable<string>, archived: boolean) {
  const target = new Set(ids)
  const changed = read().filter((t) => target.has(t.id) && !!t.archived !== archived)
  if (changed.length > 0) remote(() => updateThreads({ data: { ids: changed.map((t) => t.id), patch: { archived } } }))
  write(
    read().map((t) => {
      if (!target.has(t.id) || !!t.archived === archived) return t
      const { archived: _, ...rest } = t
      return archived ? { ...rest, archived: true } : rest
    }),
  )
}

export function moveThread(id: string, projectId: string | null) {
  remote(() => updateThreads({ data: { ids: [id], patch: { projectId } } }))
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
  const affected = threads.filter((t) => t.projectId === projectId)
  if (affected.length === 0) return
  remote(() => updateThreads({ data: { ids: affected.map((t) => t.id), patch: { projectId: null } } }))
  write(
    threads.map((t) => {
      if (t.projectId !== projectId) return t
      const { projectId: _, ...rest } = t
      return rest
    }),
  )
}
