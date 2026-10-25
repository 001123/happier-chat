import { queryOptions } from '@tanstack/react-query'
import { localStoragePersistence } from '@tanstack/ai-react'
import { queryCollectionOptions } from '@tanstack/query-db-collection'
import { createCollection, eq, useLiveQuery } from '@tanstack/react-db'
import { Store, useSelector } from '@tanstack/react-store'
import type { QueryClient } from '@tanstack/react-query'

import { LOCALE_TAGS, getLocale } from '@/lib/i18n'
import { getDbQueryClient, persist, reportFailure } from '@/lib/db'
import { useHydrated } from '@/lib/hydrated'
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

// Where this browser kept the thread list before the server owned it; only read by the one-time upload.
const LEGACY_KEY = 'chat-threads'
// Set once this browser's pre-server threads have been uploaded; see migrateLocalThreads.
const MIGRATED_KEY = 'chat-threads-migrated'
const EMPTY: Array<Thread> = []

// Transcripts now live on the server. This adapter only reads (and cleans up) what older versions kept in this browser.
const legacyTranscripts = localStoragePersistence()

// `archived` is always set so queries can filter on it without three-valued logic.
const fetchThreads = async (): Promise<Array<Thread>> => (await getThreads()).map((t) => ({ ...t, archived: !!t.archived }))

export const threadsQueryOptions = queryOptions({ queryKey: ['threads'], queryFn: fetchThreads })

type ThreadPatch = { title?: string; renamed?: boolean; archived?: boolean; projectId?: string | null; mode?: ModeId | null }

function diff(original: Thread, modified: Thread): ThreadPatch {
  const patch: ThreadPatch = {}
  if (modified.title !== original.title) patch.title = modified.title
  if (!!modified.renamed !== !!original.renamed) patch.renamed = !!modified.renamed
  if (!!modified.archived !== !!original.archived) patch.archived = !!modified.archived
  if ((modified.projectId ?? null) !== (original.projectId ?? null)) patch.projectId = modified.projectId ?? null
  if ((modified.mode ?? null) !== (original.mode ?? null)) patch.mode = modified.mode ?? null
  return patch
}

function createThreadsCollection(queryClient: QueryClient) {
  return createCollection(
    queryCollectionOptions({
      queryKey: threadsQueryOptions.queryKey,
      queryFn: fetchThreads,
      queryClient,
      getKey: (thread) => thread.id,
      // The server keeps the first message's title until the user renames the thread.
      onInsert: ({ transaction, collection }) =>
        persist(collection, async () => {
          for (const { modified: t } of transaction.mutations) {
            await saveThread({
              data: { id: t.id, title: t.title, updatedAt: t.updatedAt, projectId: t.projectId, mode: t.mode },
            })
          }
        }),
      onUpdate: ({ transaction, collection }) =>
        persist(collection, async () => {
          // Edits that changed the same thing in the same way (archive five chats) go out as one request.
          const groups = new Map<string, { patch: ThreadPatch; ids: Array<string> }>()
          for (const { original, modified } of transaction.mutations) {
            const patch = diff(original, modified)
            const key = JSON.stringify(patch)
            const group = groups.get(key)
            if (group) group.ids.push(modified.id)
            else groups.set(key, { patch, ids: [modified.id] })
          }
          for (const { patch, ids } of groups.values()) await updateThreads({ data: { ids, patch } })
        }),
      onDelete: ({ transaction, collection }) =>
        persist(collection, () => removeThreads({ data: { ids: transaction.mutations.map((m) => m.key as string) } })),
    }),
  )
}

type ThreadsCollection = ReturnType<typeof createThreadsCollection>
let collection: ThreadsCollection | undefined

/** Undefined on the server, where collections do not exist. */
export function threadsCollection() {
  const client = getDbQueryClient()
  if (typeof window === 'undefined' || !client) return undefined
  return (collection ??= createThreadsCollection(client))
}

function must() {
  const threads = threadsCollection()
  if (!threads) throw new Error('Threads are only available in the browser')
  return threads
}

export type ThreadSort = 'newest' | 'oldest' | 'az' | 'za'

/** Live threads, empty until hydration so the first client render matches the server's. */
function useThreadQuery(options: { archived?: boolean; projectId?: string; sort?: ThreadSort }) {
  const hydrated = useHydrated()
  const { archived, projectId, sort = 'newest' } = options
  const result = useLiveQuery({
    query: (q) => {
      const threads = threadsCollection()
      if (!threads || !hydrated) return undefined
      let query = q.from({ thread: threads })
      if (archived !== undefined) query = query.where(({ thread }) => eq(thread.archived, archived))
      if (projectId !== undefined) query = query.where(({ thread }) => eq(thread.projectId, projectId))
      switch (sort) {
        case 'newest':
          return query.orderBy(({ thread }) => thread.updatedAt, 'desc')
        case 'oldest':
          return query.orderBy(({ thread }) => thread.updatedAt, 'asc')
        case 'az':
        case 'za':
          return query.orderBy(({ thread }) => thread.title, {
            direction: sort === 'az' ? 'asc' : 'desc',
            stringSort: 'locale',
            locale: LOCALE_TAGS[getLocale()],
          })
      }
    },
  })
  return { threads: (result.data ?? EMPTY) as Array<Thread>, ready: hydrated && result.isReady }
}

/** Every thread, newest first. */
export function useThreads() {
  return useThreadQuery({}).threads
}

/** Threads that are not archived (Recents plus the ones inside projects). */
export function useLiveThreads(sort: ThreadSort) {
  return useThreadQuery({ archived: false, sort }).threads
}

export function useArchivedThreads(sort: ThreadSort) {
  return useThreadQuery({ archived: true, sort }).threads
}

export function useProjectThreads(projectId: string, sort: ThreadSort = 'newest') {
  return useThreadQuery({ archived: false, projectId, sort }).threads
}

export function useThread(id: string): Thread | undefined {
  const hydrated = useHydrated()
  const { data } = useLiveQuery({
    query: (q) => {
      const threads = threadsCollection()
      if (!threads || !hydrated) return undefined
      return q.from({ thread: threads }).where(({ thread }) => eq(thread.id, id)).findOne()
    },
  })
  return data as Thread | undefined
}

/** True once the thread list has been loaded from the server. */
export function useThreadsSynced() {
  return useThreadQuery({}).ready
}

function readLocalThreads(): Array<Thread> {
  try {
    const stored = JSON.parse(localStorage.getItem(LEGACY_KEY) ?? '[]') as unknown
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
 * set after every upload succeeded, so an interrupted run resumes on the next load.
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

/** Uploads whatever only this browser knew about (see migrateLocalThreads), then reloads the list. */
export function syncLegacyThreads(server: Array<Thread>) {
  void migrateLocalThreads(readLocalThreads(), server)
}

export async function refreshThreads() {
  try {
    await threadsCollection()?.utils.refetch()
  } catch (error) {
    console.error('Could not load threads', error)
  }
}

const busy = new Store<ReadonlySet<string>>(new Set<string>())

export function setThreadBusy(id: string, on: boolean) {
  if (busy.get().has(id) === on) return
  busy.setState((prev) => {
    const next = new Set(prev)
    if (on) next.add(id)
    else next.delete(id)
    return next
  })
}

export function useThreadBusy(id: string) {
  return useSelector(busy, (ids) => ids.has(id))
}

export function hasThread(id: string) {
  return threadsCollection()?.has(id) ?? false
}

// Chosen for threads that do not exist yet; they move onto the thread when it is created.
const pending = new Store<{ projects: Readonly<Record<string, string>>; modes: Readonly<Record<string, ModeId>> }>({
  projects: {},
  modes: {},
})

function without<T>(record: Readonly<Record<string, T>>, id: string) {
  const { [id]: _, ...rest } = record
  return rest
}

export function newThreadInProject(projectId: string) {
  const id = crypto.randomUUID()
  pending.setState((prev) => ({ ...prev, projects: { ...prev.projects, [id]: projectId } }))
  return id
}

export function pendingProject(id: string) {
  return pending.get().projects[id] ?? null
}

/** Project chosen for a thread that has not been created yet. */
export function usePendingProject(id: string) {
  return useSelector(pending, (state) => state.projects[id] ?? null)
}

export function setPendingProject(id: string, projectId: string | null) {
  pending.setState((prev) => ({
    ...prev,
    projects: projectId ? { ...prev.projects, [id]: projectId } : without(prev.projects, id),
  }))
}

/** Mode chosen for a thread that has not been created yet. */
export function usePendingMode(id: string) {
  return useSelector(pending, (state) => state.modes[id] ?? null)
}

/** Sets the chat mode: kept as pending until the thread exists, then stored on the thread. */
export function setThreadMode(id: string, mode: ModeId | null) {
  const threads = must()
  if (threads.has(id)) {
    reportFailure(
      'Could not save thread changes',
      threads.update(id, (draft) => {
        draft.mode = mode ?? undefined
      }),
    )
    return
  }
  pending.setState((prev) => ({ ...prev, modes: mode ? { ...prev.modes, [id]: mode } : without(prev.modes, id) }))
}

export function upsertThread(id: string, title: string) {
  const threads = must()
  const existing = threads.get(id)
  if (!existing) {
    const { projects, modes } = pending.get()
    const projectId = projects[id]
    const mode = modes[id]
    pending.setState((prev) => ({ projects: without(prev.projects, id), modes: without(prev.modes, id) }))
    reportFailure(
      'Could not save thread changes',
      threads.insert({ id, title, updatedAt: Date.now(), archived: false, ...(projectId && { projectId }), ...(mode && { mode }) }),
    )
  } else if (!existing.renamed && existing.title !== title) {
    reportFailure(
      'Could not save thread changes',
      threads.update(id, (draft) => {
        draft.title = title
      }),
    )
  }
}

export function renameThread(id: string, title: string) {
  reportFailure(
    'Could not save thread changes',
    must().update(id, (draft) => {
      draft.title = title
      draft.renamed = true
    }),
  )
}

export function deleteThread(id: string) {
  deleteThreads([id])
}

export function deleteThreads(ids: Iterable<string>) {
  const remove = [...new Set(ids)]
  if (remove.length === 0) return
  for (const id of remove) {
    void legacyTranscripts.removeItem(id)
    clearReactions(id)
  }
  reportFailure('Could not delete threads', must().delete(remove))
}

// Archiving keeps projectId so a restored chat returns to its project.
export function setThreadsArchived(ids: Iterable<string>, archived: boolean) {
  const threads = must()
  const changed = [...new Set(ids)].filter((id) => threads.has(id) && !!threads.get(id)?.archived !== archived)
  if (changed.length === 0) return
  reportFailure(
    'Could not save thread changes',
    threads.update(changed, (drafts: Array<Thread>) => {
      for (const draft of drafts) draft.archived = archived
    }),
  )
}

export function moveThread(id: string, projectId: string | null) {
  reportFailure(
    'Could not save thread changes',
    must().update(id, (draft) => {
      draft.projectId = projectId ?? undefined
    }),
  )
}

export function unassignProject(projectId: string) {
  const threads = must()
  const affected = [...threads.values()].filter((t) => t.projectId === projectId).map((t) => t.id)
  if (affected.length === 0) return
  reportFailure(
    'Could not save thread changes',
    threads.update(affected, (drafts: Array<Thread>) => {
      for (const draft of drafts) draft.projectId = undefined
    }),
  )
}
