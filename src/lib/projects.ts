import { queryOptions } from '@tanstack/react-query'
import { queryCollectionOptions } from '@tanstack/query-db-collection'
import { createCollection, useLiveQuery } from '@tanstack/react-db'
import type { QueryClient } from '@tanstack/react-query'

import { getDbQueryClient, persist, reportFailure } from '@/lib/db'
import { useHydrated } from '@/lib/hydrated'
import { unassignProject } from '@/lib/threads'
import { getProjects, removeProjects, saveProjects, updateProject } from '@/server/projects.functions'

export type Project = {
  id: string
  name: string
  createdAt: number
  collapsed?: boolean
  instructions?: string
}

const LEGACY_KEY = 'chat-projects'
// Set once this browser's pre-server projects have been uploaded; see migrateLocalProjects.
const MIGRATED_KEY = 'chat-projects-migrated'
const EMPTY: Array<Project> = []

const fetchProjects = async (): Promise<Array<Project>> => (await getProjects()).map((p) => ({ ...p, collapsed: !!p.collapsed }))

export const projectsQueryOptions = queryOptions({ queryKey: ['projects'], queryFn: fetchProjects })

function createProjectsCollection(queryClient: QueryClient) {
  return createCollection(
    queryCollectionOptions({
      queryKey: projectsQueryOptions.queryKey,
      queryFn: fetchProjects,
      queryClient,
      getKey: (project) => project.id,
      onInsert: ({ transaction, collection }) =>
        persist(collection, () => saveProjects({ data: { projects: transaction.mutations.map((m) => m.modified) } })),
      onUpdate: ({ transaction, collection }) =>
        persist(collection, async () => {
          for (const { original, modified } of transaction.mutations) {
            const patch: { name?: string; collapsed?: boolean; instructions?: string | null } = {}
            if (modified.name !== original.name) patch.name = modified.name
            if (!!modified.collapsed !== !!original.collapsed) patch.collapsed = !!modified.collapsed
            if ((modified.instructions ?? null) !== (original.instructions ?? null)) patch.instructions = modified.instructions ?? null
            await updateProject({ data: { id: modified.id, patch } })
          }
        }),
      onDelete: ({ transaction, collection }) => persist(collection, () => removeProjects({ data: { ids: transaction.mutations.map((m) => m.key as string) } })),
    }),
  )
}

type ProjectsCollection = ReturnType<typeof createProjectsCollection>
let collection: ProjectsCollection | undefined

/** Undefined on the server, where collections do not exist. */
export function projectsCollection() {
  const client = getDbQueryClient()
  if (typeof window === 'undefined' || !client) return undefined
  return (collection ??= createProjectsCollection(client))
}

function must() {
  const projects = projectsCollection()
  if (!projects) throw new Error('Projects are only available in the browser')
  return projects
}

export function useProjects() {
  const hydrated = useHydrated()
  const { data } = useLiveQuery({
    query: (q) => {
      const projects = projectsCollection()
      if (!projects || !hydrated) return undefined
      return q.from({ project: projects }).orderBy(({ project }) => project.createdAt, 'asc')
    },
  })
  return (data ?? EMPTY) as Array<Project>
}

export function createProject(name: string) {
  const id = crypto.randomUUID()
  reportFailure('Could not save project', must().insert({ id, name, createdAt: Date.now(), collapsed: false }))
  return id
}

function patch(id: string, changes: Partial<Omit<Project, 'id'>>) {
  reportFailure(
    'Could not save project',
    must().update(id, (draft) => {
      Object.assign(draft, changes)
    }),
  )
}

export function renameProject(id: string, name: string) {
  patch(id, { name })
}

export function setProjectInstructions(id: string, instructions: string) {
  patch(id, { instructions: instructions.trim() || undefined })
}

export function setProjectCollapsed(id: string, collapsed: boolean) {
  if (!!must().get(id)?.collapsed === collapsed) return
  patch(id, { collapsed })
}

export function deleteProject(id: string) {
  unassignProject(id)
  reportFailure('Could not delete project', must().delete(id))
}

/**
 * Uploads projects that exist only in this browser (everything created before projects were stored on the
 * server) once per browser. Insert-or-ignore on the server, and the flag is set only after the upload succeeded.
 */
export async function migrateLocalProjects(server: Array<Project>) {
  if (localStorage.getItem(MIGRATED_KEY)) return
  try {
    const stored = JSON.parse(localStorage.getItem(LEGACY_KEY) ?? '[]') as unknown
    const known = new Set(server.map((p) => p.id))
    const local = (Array.isArray(stored) ? (stored as Array<Project>) : []).filter((p) => !known.has(p.id))
    if (local.length > 0) await saveProjects({ data: { projects: local } })
    localStorage.setItem(MIGRATED_KEY, '1')
    if (local.length > 0) await projectsCollection()?.utils.refetch()
  } catch (error) {
    console.error('Could not upload local projects', error)
  }
}
