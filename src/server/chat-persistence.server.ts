import { defineAIPersistence, defineInterruptStore, defineMessageStore, defineRunStore } from '@tanstack/ai-persistence'
import type { ChatWithInterruptsPersistence, InterruptRecord, RunRecord } from '@tanstack/ai-persistence'
import type { ModelMessage } from '@tanstack/ai'

import { getDb } from './db.server'

type Run = RunRecord
type Interrupt = InterruptRecord

let swept = false

/**
 * A run still marked running when the process starts lost its model loop with the old process, and nothing
 * will ever finish it. Left as is, every thread open would try to rejoin it.
 */
function abandonOrphanedRuns() {
  if (swept) return
  swept = true
  getDb()
    .prepare(
      `update chat_runs set status = 'aborted', data = json_set(data, '$.status', 'aborted', '$.finishedAt', ?) where status = 'running'`,
    )
    .run(Date.now())
}

/**
 * Chat state in the app database, confined to one user. The stores receive bare client-chosen thread and
 * run ids, so every statement filters on `user_id` and every primary key includes it: a guessed id from
 * another account reads as "no such thread" and a write creates the caller's own row instead.
 */
export function chatPersistenceFor(userId: string): ChatWithInterruptsPersistence {
  const db = getDb()
  abandonOrphanedRuns()

  const loadMessages = db.prepare('select messages from chat_messages where user_id = ? and thread_id = ?')
  const saveMessages = db.prepare(
    `insert into chat_messages (user_id, thread_id, messages, updated_at) values (?, ?, ?, ?)
     on conflict(user_id, thread_id) do update set messages = excluded.messages, updated_at = excluded.updated_at`,
  )

  const messages = defineMessageStore({
    // The paging hint is ignored on purpose: a full array is a valid answer and threads are small.
    loadThread: async (threadId: string) => {
      const row = loadMessages.get(userId, threadId) as { messages: string } | undefined
      return row ? (JSON.parse(row.messages) as Array<ModelMessage>) : []
    },
    saveThread: async (threadId, thread) => {
      saveMessages.run(userId, threadId, JSON.stringify(thread), Date.now())
    },
  })

  const getRun = db.prepare('select data from chat_runs where user_id = ? and run_id = ?')
  const insertRun = db.prepare(
    'insert into chat_runs (user_id, run_id, thread_id, status, started_at, data) values (?, ?, ?, ?, ?, ?) on conflict(user_id, run_id) do nothing',
  )
  const updateRun = db.prepare('update chat_runs set status = ?, data = ? where user_id = ? and run_id = ?')
  const runsByThread = db.prepare('select data from chat_runs where user_id = ? and thread_id = ? order by started_at, rowid')
  const runsByParent = db.prepare(
    "select data from chat_runs where user_id = ? and json_extract(data, '$.parentRunId') = ? order by started_at, rowid",
  )
  const reclaimable = db.prepare(
    "select data from chat_runs where user_id = ? and status = 'running' and json_extract(data, '$.detachedSince') <= ?",
  )
  const activeRun = db.prepare(
    "select data from chat_runs where user_id = ? and thread_id = ? and status = 'running' order by started_at desc, rowid desc limit 1",
  )

  const parseRun = (row: unknown) => (row ? (JSON.parse((row as { data: string }).data) as Run) : null)
  const parseRuns = (rows: Array<unknown>) => rows.map((row) => parseRun(row)!)

  const runs = defineRunStore({
    // Insert-if-absent: an existing run comes back untouched, which is what makes resume and double submit safe.
    createOrResume: async (input) => {
      const { runId, threadId, startedAt } = input
      const record: Run = {
        runId,
        threadId,
        status: input.status ?? 'running',
        startedAt,
        ...(input.parentRunId !== undefined && { parentRunId: input.parentRunId }),
        ...(input.subagentRunId !== undefined && { subagentRunId: input.subagentRunId }),
        ...(input.name !== undefined && { name: input.name }),
        ...(input.kind !== undefined && { kind: input.kind }),
        ...(input.activity !== undefined && { activity: input.activity }),
        ...(input.agent !== undefined && { agent: input.agent }),
        ...(input.principal !== undefined && { principal: input.principal }),
      }
      insertRun.run(userId, runId, threadId, record.status, startedAt, JSON.stringify(record))
      return parseRun(getRun.get(userId, runId))!
    },
    update: async (runId, patch) => {
      const existing = parseRun(getRun.get(userId, runId))
      if (!existing) return
      const next: Record<string, unknown> = { ...existing, ...patch }
      // JSON drops undefined, but an explicit undefined is a clear (e.g. reattach clears detachedSince).
      for (const key of Object.keys(patch)) if ((patch as Record<string, unknown>)[key] === undefined) delete next[key]
      updateRun.run((next as unknown as Run).status, JSON.stringify(next), userId, runId)
    },
    get: async (runId) => parseRun(getRun.get(userId, runId)),
    listByThread: async (threadId) => parseRuns(runsByThread.all(userId, threadId)),
    listByParentRun: async (parentRunId) => parseRuns(runsByParent.all(userId, parentRunId)),
    listReclaimable: async ({ now, ttlMs }) => parseRuns(reclaimable.all(userId, now - ttlMs)),
    findActiveRun: async (threadId) => parseRun(activeRun.get(userId, threadId)),
  })

  const getInterrupt = db.prepare('select data from chat_interrupts where user_id = ? and interrupt_id = ?')
  const insertInterrupt = db.prepare(
    `insert into chat_interrupts (user_id, interrupt_id, run_id, thread_id, status, requested_at, data)
     values (?, ?, ?, ?, 'pending', ?, ?) on conflict(user_id, interrupt_id) do nothing`,
  )
  const finishInterrupt = db.prepare('update chat_interrupts set status = ?, data = ? where user_id = ? and interrupt_id = ?')
  const interruptsByThread = db.prepare('select data from chat_interrupts where user_id = ? and thread_id = ? order by requested_at, rowid')
  const pendingByThread = db.prepare(
    "select data from chat_interrupts where user_id = ? and thread_id = ? and status = 'pending' order by requested_at, rowid",
  )
  const interruptsByRun = db.prepare('select data from chat_interrupts where user_id = ? and run_id = ? order by requested_at, rowid')
  const pendingByRun = db.prepare(
    "select data from chat_interrupts where user_id = ? and run_id = ? and status = 'pending' order by requested_at, rowid",
  )

  const parseInterrupt = (row: unknown) => (row ? (JSON.parse((row as { data: string }).data) as Interrupt) : null)
  const parseInterrupts = (rows: Array<unknown>) => rows.map((row) => parseInterrupt(row)!)

  function settle(interruptId: string, status: 'resolved' | 'cancelled', response?: unknown) {
    const existing = parseInterrupt(getInterrupt.get(userId, interruptId))
    if (!existing) return
    const next: Interrupt = {
      ...existing,
      status,
      resolvedAt: Date.now(),
      ...(status === 'resolved' && response !== undefined && { response }),
    }
    finishInterrupt.run(status, JSON.stringify(next), userId, interruptId)
  }

  const interrupts = defineInterruptStore({
    create: async (record) => {
      const full: Interrupt = { ...record, status: 'pending' }
      insertInterrupt.run(userId, record.interruptId, record.runId, record.threadId, record.requestedAt, JSON.stringify(full))
    },
    resolve: async (interruptId, response) => settle(interruptId, 'resolved', response),
    cancel: async (interruptId) => settle(interruptId, 'cancelled'),
    // All or nothing: validate every entry first, then write them in one transaction.
    commitBatch: async (entries) => {
      const seen = new Set<string>()
      for (const entry of entries) {
        if (seen.has(entry.interruptId)) throw new Error(`Duplicate interrupt ${entry.interruptId} in batch`)
        seen.add(entry.interruptId)
        const existing = parseInterrupt(getInterrupt.get(userId, entry.interruptId))
        if (!existing) throw new Error(`Unknown interrupt ${entry.interruptId}`)
        if (existing.status !== 'pending') throw new Error(`Interrupt ${entry.interruptId} is not pending`)
      }
      db.exec('begin')
      try {
        for (const entry of entries) {
          settle(entry.interruptId, entry.status, entry.status === 'resolved' ? entry.response : undefined)
        }
        db.exec('commit')
      } catch (error) {
        db.exec('rollback')
        throw error
      }
    },
    get: async (interruptId) => parseInterrupt(getInterrupt.get(userId, interruptId)),
    list: async (threadId) => parseInterrupts(interruptsByThread.all(userId, threadId)),
    listPending: async (threadId) => parseInterrupts(pendingByThread.all(userId, threadId)),
    listByRun: async (runId) => parseInterrupts(interruptsByRun.all(userId, runId)),
    listPendingByRun: async (runId) => parseInterrupts(pendingByRun.all(userId, runId)),
  })

  return defineAIPersistence({ stores: { messages, runs, interrupts } })
}
