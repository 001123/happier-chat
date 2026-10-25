import { useSyncExternalStore } from 'react'
import { unassignProject } from '@/lib/threads'

export type Project = {
  id: string
  name: string
  createdAt: number
  collapsed?: boolean
  instructions?: string
}

const KEY = 'chat-projects'
const EMPTY: Array<Project> = []
const listeners = new Set<() => void>()
let cache: Array<Project> | null = null

function read(): Array<Project> {
  if (cache) return cache
  try {
    cache = JSON.parse(localStorage.getItem(KEY) ?? '[]') as Array<Project>
  } catch {
    cache = []
  }
  return cache
}

function write(projects: Array<Project>) {
  cache = projects
  localStorage.setItem(KEY, JSON.stringify(projects))
  listeners.forEach((l) => l())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useProjects() {
  return useSyncExternalStore(subscribe, read, () => EMPTY)
}

export function createProject(name: string) {
  const id = crypto.randomUUID()
  write([...read(), { id, name, createdAt: Date.now() }])
  return id
}

function patch(id: string, changes: Partial<Project>) {
  write(read().map((p) => (p.id === id ? { ...p, ...changes } : p)))
}

export function renameProject(id: string, name: string) {
  patch(id, { name })
}

export function setProjectInstructions(id: string, instructions: string) {
  patch(id, { instructions: instructions.trim() || undefined })
}

export function setProjectCollapsed(id: string, collapsed: boolean) {
  patch(id, { collapsed })
}

export function deleteProject(id: string) {
  write(read().filter((p) => p.id !== id))
  unassignProject(id)
}
