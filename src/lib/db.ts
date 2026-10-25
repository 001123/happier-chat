import type { QueryClient } from '@tanstack/react-query'

// TanStack DB collections are browser-only (no SSR), so they hang off the router's QueryClient on the client
// and never exist on the server: a request can then never see another user's rows.
let client: QueryClient | undefined

export function bindDbQueryClient(queryClient: QueryClient) {
  client ??= queryClient
}

export function getDbQueryClient() {
  return client
}

let queued: Promise<unknown> = Promise.resolve()

/**
 * Runs persistence handlers one after another. Transactions otherwise persist concurrently, and e.g. a
 * rename must never reach the server before the create it follows. A failure rejects only its own task.
 */
export function inOrder<T>(task: () => Promise<T>): Promise<T> {
  const run = queued.then(task)
  queued = run.catch(() => {})
  return run
}

/** Mutations return a transaction whose rejection (a failed save, already rolled back) would otherwise be unhandled. */
export function reportFailure(label: string, transaction: { isPersisted: { promise: Promise<unknown> } }) {
  transaction.isPersisted.promise.catch((error) => console.error(label, error))
}

/** Persistence handler body: saves in order, then reloads the collection so server-side truth replaces the optimistic rows. */
export async function persist(collection: { utils: { refetch: () => Promise<unknown> } }, task: () => Promise<unknown>) {
  await inOrder(task)
  await collection.utils.refetch()
  return { refetch: false }
}
