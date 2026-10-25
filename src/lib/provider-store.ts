import { createContext, useContext, useMemo, useSyncExternalStore } from 'react'

import { useChatSettings } from '@/lib/chat-settings'
import { modelKey } from '@/lib/providers'
import type { CatalogModel } from '@/lib/model-catalog'
import type { ProviderView } from '@/lib/providers'
import { getProviders } from '@/server/providers.functions'

type State = { providers: Array<ProviderView>; loaded: boolean; error: string | null }

const EMPTY: State = { providers: [], loaded: false, error: null }
const listeners = new Set<() => void>()
let state = EMPTY
let pending: Promise<void> | null = null

function emit(next: State) {
  state = next
  listeners.forEach((l) => l())
}

/** Loads the user's providers from the server; later calls reuse the result until `refreshProviders()`. */
export function refreshProviders() {
  pending = getProviders()
    .then((providers) => emit({ providers, loaded: true, error: null }))
    .catch((error: Error) => emit({ ...state, loaded: true, error: error.message }))
  return pending
}

export function setProviders(providers: Array<ProviderView>) {
  emit({ providers, loaded: true, error: null })
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  if (!pending) void refreshProviders()
  return () => listeners.delete(listener)
}

const InitialProviders = createContext<Array<ProviderView> | null>(null)

/** Providers loaded with the page, so the model picker renders on the server instead of after a fetch. */
export const InitialProvidersProvider = InitialProviders.Provider

export function useProviders() {
  const initial = useContext(InitialProviders)
  // Seed the browser store once instead of fetching what the page already carries.
  if (initial && !pending && typeof window !== 'undefined') {
    state = { providers: initial, loaded: true, error: null }
    pending = Promise.resolve()
  }
  const serverState = useMemo(() => (initial ? { providers: initial, loaded: true, error: null } : EMPTY), [initial])
  return useSyncExternalStore(subscribe, () => state, () => serverState)
}

export type ModelOption = {
  key: string
  providerId: string
  providerName: string
  modelId: string
  info: CatalogModel | null
}

export function useModelOptions(): Array<ModelOption> {
  const { providers } = useProviders()
  return providers.flatMap((provider) =>
    provider.models
      .filter((model) => model.enabled)
      .map((model) => ({
        key: modelKey(provider.id, model.id),
        providerId: provider.id,
        providerName: provider.name,
        modelId: model.id,
        info: model.info ?? null,
      })),
  )
}

/** The chosen model if it is still enabled, else the first enabled one. */
export function useActiveModel(): ModelOption | null {
  const { model } = useChatSettings()
  const options = useModelOptions()
  return options.find((option) => option.key === model) ?? options[0] ?? null
}
