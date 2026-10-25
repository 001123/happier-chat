import { Store, useSelector } from '@tanstack/react-store'

import { useHydrated } from '@/lib/hydrated'

const isBrowser = typeof window !== 'undefined'

function load<T>(key: string, fallback: T, merge: boolean): T {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(key) ?? 'null')
    if (stored === null) return fallback
    return merge ? { ...fallback, ...(stored as object) } : (stored as T)
  } catch {
    return fallback
  }
}

/**
 * A store backed by localStorage: it starts from what the browser saved (merged over `defaults`) and writes
 * every change back. On the server it only ever holds `defaults` and is never written to, so requests cannot
 * affect each other.
 */
export function createPersistedStore<T extends object>(key: string, defaults: T, options: { merge?: boolean } = {}) {
  const store = new Store<T>(isBrowser ? load(key, defaults, options.merge ?? true) : defaults)
  if (isBrowser) store.subscribe((value) => localStorage.setItem(key, JSON.stringify(value)))
  return store
}

/**
 * Reads a store slice. While the page hydrates it returns `server()` instead, which is what the server
 * rendered, so browser-only state (localStorage, cookies read on the client) never causes a mismatch.
 */
export function useStoreValue<T, S>(store: Store<T>, selector: (state: T) => S, server: () => T): S {
  const hydrated = useHydrated()
  const value = useSelector(store, selector)
  return hydrated ? value : selector(server())
}
