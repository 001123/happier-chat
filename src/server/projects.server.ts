import { getDb } from './db.server'
import type { Project } from '@/lib/projects'

type Row = {
  id: string
  name: string
  created_at: number
  collapsed: number
  instructions: string | null
}

function toProject(row: Row): Project {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
    collapsed: row.collapsed === 1,
    ...(row.instructions && { instructions: row.instructions }),
  }
}

export function listProjects(userId: string): Array<Project> {
  const rows = getDb()
    .prepare('select id, name, created_at, collapsed, instructions from chat_projects where user_id = ? order by created_at asc')
    .all(userId) as Array<Row>
  return rows.map(toProject)
}

/** Insert-or-ignore, so a retried create or a repeated legacy import never overwrites what the server has. */
export function insertProjects(userId: string, projects: Array<Project>) {
  const insert = getDb().prepare(
    'insert into chat_projects (user_id, id, name, created_at, collapsed, instructions) values (?, ?, ?, ?, ?, ?) on conflict(user_id, id) do nothing',
  )
  for (const p of projects) insert.run(userId, p.id, p.name, p.createdAt, p.collapsed ? 1 : 0, p.instructions ?? null)
}

export type ProjectPatch = {
  name?: string
  collapsed?: boolean
  instructions?: string | null
}

export function patchProject(userId: string, id: string, patch: ProjectPatch) {
  const sets: Array<string> = []
  const values: Array<string | number | null> = []
  if (patch.name !== undefined) (sets.push('name = ?'), values.push(patch.name))
  if (patch.collapsed !== undefined) (sets.push('collapsed = ?'), values.push(patch.collapsed ? 1 : 0))
  if (patch.instructions !== undefined) (sets.push('instructions = ?'), values.push(patch.instructions))
  if (sets.length === 0) return
  getDb()
    .prepare(`update chat_projects set ${sets.join(', ')} where user_id = ? and id = ?`)
    .run(...values, userId, id)
}

/** Deleting a project keeps its chats: they fall back to Recents. */
export function deleteProjects(userId: string, ids: Array<string>) {
  const db = getDb()
  const unassign = db.prepare('update chat_threads set project_id = null where user_id = ? and project_id = ?')
  const remove = db.prepare('delete from chat_projects where user_id = ? and id = ?')
  db.exec('begin')
  try {
    for (const id of ids) {
      unassign.run(userId, id)
      remove.run(userId, id)
    }
    db.exec('commit')
  } catch (error) {
    db.exec('rollback')
    throw error
  }
}
