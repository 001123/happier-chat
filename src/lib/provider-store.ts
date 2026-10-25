import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { useChatSettings } from '@/lib/chat-settings'
import { modelKey } from '@/lib/providers'
import type { CatalogModel } from '@/lib/model-catalog'
import type { ProviderView } from '@/lib/providers'
import { getProviders, removeProvider, upsertProvider } from '@/server/providers.functions'

const NO_PROVIDERS: Array<ProviderView> = []

/**
 * The `_app` loader ensures this, so the composer's model picker renders from the dehydrated cache without a
 * request. It never goes stale on its own; the mutations below invalidate it.
 */
export const providersQueryOptions = queryOptions({
  queryKey: ['providers'],
  queryFn: () => getProviders(),
  staleTime: Infinity,
})

export function useProviders() {
  const { data, isPending, error } = useQuery(providersQueryOptions)
  return { providers: data ?? NO_PROVIDERS, loaded: !isPending, error: error?.message ?? null }
}

export function useSaveProvider() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: Parameters<typeof upsertProvider>[0]['data']) => upsertProvider({ data }),
    onSuccess: () => queryClient.invalidateQueries(providersQueryOptions),
  })
}

export function useDeleteProvider() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => removeProvider({ data: { id } }),
    onSuccess: () => queryClient.invalidateQueries(providersQueryOptions),
  })
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
