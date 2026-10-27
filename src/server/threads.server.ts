import { convertMessagesToModelMessages } from '@tanstack/ai'
import type { ModelMessage, UIMessage } from '@tanstack/ai'

import { getDb } from './db.server'
import type { Thread } from '@/lib/threads'

type Row = {
  id: string
  title: string
  updated_at: number
  project_id: string | null
  renamed: number
  archived: number
  mode: string | null
  explain_style: string | null
}

function toThread(row: Row): Thread {
  return {
    id: row.id,
    title: row.title,
    updatedAt: row.updated_at,
    ...(row.project_id && { projectId: row.project_id }),
    ...(row.renamed && { renamed: true }),
    ...(row.archived && { archived: true }),
    ...(row.mode && { mode: row.mode as Thread['mode'] }),
    ...(row.explain_style && { explainStyle: row.explain_style as Thread['explainStyle'] }),
  }
}

export function listThreads(userId: string): Array<Thread> {
  const rows = getDb()
    .prepare('select id, title, updated_at, project_id, renamed, archived, mode, explain_style from chat_threads where user_id = ? order by updated_at desc')
    .all(userId) as Array<Row>
  return rows.map(toThread)
}

/** Creates the thread, or follows the first message's title until the user has renamed it. */
export function upsertThread(
  userId: string,
  thread: Pick<Thread, 'id' | 'title' | 'updatedAt' | 'projectId' | 'mode' | 'explainStyle'>,
) {
  getDb()
    .prepare(
      `insert into chat_threads (user_id, id, title, updated_at, project_id, mode, explain_style) values (?, ?, ?, ?, ?, ?, ?)
       on conflict(user_id, id) do update set title = excluded.title where chat_threads.renamed = 0`,
    )
    .run(
      userId,
      thread.id,
      thread.title,
      thread.updatedAt,
      thread.projectId ?? null,
      thread.mode ?? null,
      thread.explainStyle ?? null,
    )
}

export type ThreadPatch = {
  title?: string
  renamed?: boolean
  archived?: boolean
  projectId?: string | null
  mode?: string | null
  explainStyle?: string | null
}

export function patchThreads(userId: string, ids: Array<string>, patch: ThreadPatch) {
  const sets: Array<string> = []
  const values: Array<string | number | null> = []
  const add = (column: string, value: string | number | null) => {
    sets.push(`${column} = ?`)
    values.push(value)
  }
  if (patch.title !== undefined) add('title', patch.title)
  if (patch.renamed !== undefined) add('renamed', patch.renamed ? 1 : 0)
  if (patch.archived !== undefined) add('archived', patch.archived ? 1 : 0)
  if (patch.projectId !== undefined) add('project_id', patch.projectId)
  if (patch.mode !== undefined) add('mode', patch.mode)
  if (patch.explainStyle !== undefined) add('explain_style', patch.explainStyle)
  if (sets.length === 0 || ids.length === 0) return
  const update = getDb().prepare(`update chat_threads set ${sets.join(', ')} where user_id = ? and id = ?`)
  for (const id of ids) update.run(...values, userId, id)
}

const HISTORY_TABLES = [
  'delete from chat_messages where user_id = ? and thread_id = ?',
  'delete from chat_runs where user_id = ? and thread_id = ?',
  'delete from chat_interrupts where user_id = ? and thread_id = ?',
]

/** Drops a thread with everything stored for it: transcript, runs and interrupts. */
export function deleteThreads(userId: string, ids: Array<string>) {
  clearHistory(userId, ids, true)
}

/**
 * Empties a thread's stored transcript, keeping the thread itself. Needed when the first message is edited:
 * the server merges the client's transcript into what it has by message id, and an edited first message
 * shares no id with the old one, so the old messages would otherwise stay.
 */
export function clearThreadHistory(userId: string, id: string) {
  clearHistory(userId, [id], false)
}

function clearHistory(userId: string, ids: Array<string>, withThread: boolean) {
  const db = getDb()
  const statements = [
    ...(withThread ? ['delete from chat_threads where user_id = ? and id = ?'] : []),
    ...HISTORY_TABLES,
  ].map((sql) => db.prepare(sql))
  db.exec('begin')
  try {
    for (const id of ids) for (const statement of statements) statement.run(userId, id)
    db.exec('commit')
  } catch (error) {
    db.exec('rollback')
    throw error
  }
}

/**
 * One-time upload of a thread that only exists in a browser. Insert-or-ignore, so repeating it (a retry,
 * a second device with the same history) never overwrites what the server already has.
 */
export function importThread(
  userId: string,
  thread: Thread,
  messages: Array<UIMessage | ModelMessage>,
): { stored: boolean } {
  const db = getDb()
  let stored: string | null = null
  if (messages.length > 0) {
    try {
      stored = JSON.stringify(convertMessagesToModelMessages(messages))
    } catch {
      // A transcript that cannot be converted still keeps its place in the thread list.
    }
  }
  db.exec('begin')
  try {
    db.prepare(
      `insert into chat_threads (user_id, id, title, updated_at, project_id, renamed, archived, mode)
       values (?, ?, ?, ?, ?, ?, ?, ?) on conflict(user_id, id) do nothing`,
    ).run(
      userId,
      thread.id,
      thread.title,
      thread.updatedAt,
      thread.projectId ?? null,
      thread.renamed ? 1 : 0,
      thread.archived ? 1 : 0,
      thread.mode ?? null,
    )
    if (stored) {
      db.prepare('insert into chat_messages (user_id, thread_id, messages, updated_at) values (?, ?, ?, ?) on conflict(user_id, thread_id) do nothing').run(
        userId,
        thread.id,
        stored,
        thread.updatedAt,
      )
    }
    db.exec('commit')
  } catch (error) {
    db.exec('rollback')
    throw error
  }
  // The caller may drop its local copy only when the transcript is safely on the server.
  return { stored: messages.length === 0 || stored !== null }
}
