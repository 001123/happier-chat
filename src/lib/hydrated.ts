import { useSyncExternalStore } from 'react'

const subscribe = () => () => {}

/** False on the server and during the hydration pass, true afterwards: lets browser-only state wait for hydration. */
export function useHydrated() {
  return useSyncExternalStore(subscribe, () => true, () => false)
}
