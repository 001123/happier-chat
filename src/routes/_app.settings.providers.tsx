import * as React from 'react'
import { useDebouncedValue } from '@tanstack/react-pacer'
import { useForm, useStore } from '@tanstack/react-form'
import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { IconExternalLink, IconKey, IconLoader2, IconPencil, IconPlus, IconRefresh, IconTrash } from '@tabler/icons-react'

import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { FieldError } from '@/components/field-error'
import { ProviderModelTable } from '@/components/provider-model-table'
import type { TestState } from '@/components/provider-model-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { defineMessages, getLocale, useLocale, useMessages } from '@/lib/i18n'
import type { CatalogModel } from '@/lib/model-catalog'
import { useDeleteProvider, useProviders, useSaveProvider } from '@/lib/provider-store'
import { getPreset, guessModelApi, MODEL_API_LABELS, PRESETS } from '@/lib/providers'
import type { ModelApi, ProviderModel, ProviderPreset, ProviderView } from '@/lib/providers'
import { errorMessage } from '@/lib/utils'
import { listRemoteModels, lookupModels, testModel } from '@/server/providers.functions'

const messages = defineMessages({
  vi: {
    title: 'Cấu hình AI · Cài đặt · Happier Chat',
    heading: 'Cấu hình AI',
    intro: 'Kết nối API key của bạn và chọn những model hiện trong ô soạn tin. Key được mã hoá và chỉ lưu trên server.',
    none: 'Chưa có API key nào',
    noneHelp: 'Thêm một API key để bắt đầu trò chuyện.',
    enabledCount: (n: number) => `${n} model đang bật`,
    edit: 'Sửa',
    delete: 'Xoá',
    add: 'Thêm API key',
    deleteTitle: (name?: string) => `Xoá ${name ?? 'API key'}?`,
    deleteHelp: 'API key, endpoint và danh sách model này sẽ bị xoá khỏi server.',
    cancel: 'Huỷ',
    displayName: 'Tên hiển thị',
    getKey: 'Lấy key',
    keyInUse: (hint: string) => `Đang dùng ${hint} — để trống để giữ nguyên`,
    keyPlaceholder: 'Dán API key vào đây',
    anthropicEndpoint: 'Endpoint Anthropic',
    anthropicHint: 'Không gồm /v1/messages',
    openaiEndpoint: 'Endpoint OpenAI',
    openaiHint: 'Thường kết thúc bằng /v1',
    geminiEndpoint: 'Endpoint Gemini',
    geminiHint: 'Không gồm /v1beta',
    ollamaEndpoint: 'Địa chỉ Ollama',
    ollamaHint: 'Mặc định chạy trên máy này, cổng 11434',
    keyOptionalLabel: 'tuỳ chọn',
    keyOptionalPlaceholder: 'Không cần với Ollama chạy trên máy bạn',
    modelsUrl: 'URL danh sách model',
    modelsUrlHint: 'Tuỳ chọn, mặc định là <endpoint>/models',
    editEndpoint: 'Sửa endpoint',
    models: 'Model',
    modelsEnabled: (n: number) => `${n} đang bật`,
    loadModels: 'Tải danh sách model',
    loadingModels: 'Đang tải danh sách model…',
    emptyModels: 'Nhập API key để tự tải danh sách model, hoặc thêm model id thủ công.',
    manualPlaceholder: 'Thêm model id thủ công, ví dụ glm-5.3',
    addModel: 'Thêm',
    loadError: (error: string) => `Không tải được danh sách model: ${error}`,
    save: 'Lưu',
    nameRequired: 'Cần đặt tên hiển thị',
    keyRequired: 'Cần nhập API key',
    invalidUrl: 'URL không hợp lệ',
    urlScheme: 'URL phải bắt đầu bằng http(s)://',
  },
  en: {
    title: 'Providers · Settings · Happier Chat',
    heading: 'Providers',
    intro: 'Connect your API keys and choose which models appear in the composer. Keys are encrypted and stored only on the server.',
    none: 'No providers yet',
    noneHelp: 'Add a provider to start chatting.',
    enabledCount: (n: number) => `${n} ${n === 1 ? 'model' : 'models'} enabled`,
    edit: 'Edit',
    delete: 'Delete',
    add: 'Add provider',
    deleteTitle: (name?: string) => `Delete provider ${name ?? ''}?`,
    deleteHelp: "This provider's API key and model list will be removed from the server.",
    cancel: 'Cancel',
    displayName: 'Display name',
    getKey: 'Get key',
    keyInUse: (hint: string) => `Using ${hint} — leave empty to keep it`,
    keyPlaceholder: 'Paste your API key here',
    anthropicEndpoint: 'Anthropic endpoint',
    anthropicHint: 'Without /v1/messages',
    openaiEndpoint: 'OpenAI endpoint',
    openaiHint: 'Usually ends with /v1',
    geminiEndpoint: 'Gemini endpoint',
    geminiHint: 'Without /v1beta',
    ollamaEndpoint: 'Ollama address',
    ollamaHint: 'Runs on this machine, port 11434, by default',
    keyOptionalLabel: 'optional',
    keyOptionalPlaceholder: 'Not needed for Ollama on your own machine',
    modelsUrl: 'Model list URL',
    modelsUrlHint: 'Optional, defaults to <endpoint>/models',
    editEndpoint: 'Edit endpoints',
    models: 'Models',
    modelsEnabled: (n: number) => `${n} enabled`,
    loadModels: 'Load model list',
    loadingModels: 'Loading model list…',
    emptyModels: 'Enter an API key to load the model list automatically, or add a model id manually.',
    manualPlaceholder: 'Add a model id manually, e.g. glm-5.3',
    addModel: 'Add',
    loadError: (error: string) => `Could not load the model list: ${error}`,
    save: 'Save',
    nameRequired: 'Provider name is required',
    keyRequired: 'An API key is required',
    invalidUrl: 'Invalid URL',
    urlScheme: 'URL must start with http(s)://',
  },
})

export const Route = createFileRoute('/_app/settings/providers')({
  head: () => ({ meta: [{ title: messages[getLocale()].title }] }),
  component: ProvidersPage,
})

type Editing = { preset: ProviderPreset; provider?: ProviderView } | 'choose' | null

function ProvidersPage() {
  const t = useMessages(messages)
  const locale = useLocale()
  const { providers, loaded, error } = useProviders()
  const [editing, setEditing] = React.useState<Editing>(null)
  const [deleting, setDeleting] = React.useState<ProviderView | null>(null)

  const remove = useDeleteProvider()

  async function confirmDelete() {
    if (!deleting) return
    await remove.mutateAsync(deleting.id)
    setDeleting(null)
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h2 className="font-serif text-2xl tracking-tight">{t.heading}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t.intro}
        </p>
      </div>

      {editing && editing !== 'choose' ? (
        <ProviderForm
          key={editing.provider?.id ?? editing.preset.id}
          preset={editing.preset}
          provider={editing.provider}
          onDone={() => setEditing(null)}
        />
      ) : editing === 'choose' ? (
        <PresetChooser onChoose={(preset) => setEditing({ preset })} onCancel={() => setEditing(null)} />
      ) : (
        <>
          {!loaded ? (
            <IconLoader2 className="size-5 animate-spin text-muted-foreground" />
          ) : error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : providers.length === 0 ? (
            <div className="rounded-xl border border-dashed p-8 text-center">
              <IconKey className="mx-auto size-6 text-muted-foreground" />
              <p className="mt-3 text-sm font-medium">{t.none}</p>
              <p className="mt-1 text-sm text-muted-foreground">{t.noneHelp}</p>
            </div>
          ) : (
            <div className="divide-y rounded-xl border bg-card">
              {providers.map((provider) => {
                const enabled = provider.models.filter((m) => m.enabled).length
                return (
                  <div key={provider.id} className="flex items-center gap-4 p-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium">{provider.name}</span>
                        <Badge variant="secondary">{getPreset(provider.preset).label[locale]}</Badge>
                      </div>
                      <p className="mt-0.5 text-sm text-muted-foreground">
                        {provider.keyHint && <span className="font-mono">{provider.keyHint} · </span>}
                        {t.enabledCount(enabled)}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={t.edit}
                      onClick={() => setEditing({ preset: getPreset(provider.preset), provider })}
                    >
                      <IconPencil />
                    </Button>
                    <Button variant="ghost" size="icon-sm" aria-label={t.delete} onClick={() => setDeleting(provider)}>
                      <IconTrash />
                    </Button>
                  </div>
                )
              })}
            </div>
          )}
          <div>
            <Button onClick={() => setEditing('choose')}>
              <IconPlus />
              {t.add}
            </Button>
          </div>
        </>
      )}

      <AlertDialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogTitle>{t.deleteTitle(deleting?.name)}</AlertDialogTitle>
          <AlertDialogDescription>{t.deleteHelp}</AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogClose render={<Button variant="ghost" />}>{t.cancel}</AlertDialogClose>
            <Button className="bg-destructive text-white hover:bg-destructive/90" onClick={confirmDelete}>
              {t.delete}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function PresetChooser({ onChoose, onCancel }: { onChoose: (preset: ProviderPreset) => void; onCancel: () => void }) {
  const t = useMessages(messages)
  const locale = useLocale()
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        {PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            onClick={() => onChoose(preset)}
            className="rounded-xl border bg-card p-4 text-left transition-colors hover:border-ring hover:bg-accent"
          >
            <div className="text-sm font-medium">{preset.label[locale]}</div>
            <p className="mt-1 text-sm text-muted-foreground">{preset.description[locale]}</p>
          </button>
        ))}
      </div>
      <div>
        <Button variant="ghost" onClick={onCancel}>
          {t.cancel}
        </Button>
      </div>
    </div>
  )
}

function ProviderForm({
  preset,
  provider,
  onDone,
}: {
  preset: ProviderPreset
  provider?: ProviderView
  onDone: () => void
}) {
  const t = useMessages(messages)
  const locale = useLocale()
  const optionalUrl = z
    .string()
    .trim()
    .refine((value) => !value || URL.canParse(value), { error: t.invalidUrl })
    .refine((value) => !value || /^https?:\/\//.test(value), { error: t.urlScheme })
  const schema = z.object({
    name: z.string().trim().min(1, { error: t.nameRequired }).max(60),
    apiKey: provider || preset.keyOptional ? z.string() : z.string().trim().min(1, { error: t.keyRequired }),
    anthropicUrl: optionalUrl,
    openaiUrl: optionalUrl,
    geminiUrl: optionalUrl,
    ollamaUrl: optionalUrl,
    modelsUrl: optionalUrl,
  })
  const save = useSaveProvider()
  const form = useForm({
    defaultValues: {
      name: provider?.name ?? preset.label[locale],
      apiKey: '',
      anthropicUrl: provider?.anthropicUrl ?? preset.anthropicUrl ?? '',
      openaiUrl: provider?.openaiUrl ?? preset.openaiUrl ?? '',
      geminiUrl: provider?.geminiUrl ?? preset.geminiUrl ?? '',
      ollamaUrl: provider?.ollamaUrl ?? preset.ollamaUrl ?? '',
      modelsUrl: provider?.modelsUrl ?? preset.modelsUrl ?? '',
    },
    validators: { onSubmit: schema },
    onSubmit: async ({ value }) => {
      // A failed save is shown from the mutation state, and keeps the form open.
      const saved = await save.mutateAsync({
        id: provider?.id,
        name: value.name,
        preset: preset.id,
        anthropicUrl: value.anthropicUrl.trim() || null,
        openaiUrl: value.openaiUrl.trim() || null,
        geminiUrl: value.geminiUrl.trim() || null,
        ollamaUrl: value.ollamaUrl.trim() || null,
        modelsUrl: value.modelsUrl.trim() || null,
        apiKey: value.apiKey.trim() || undefined,
        models: models.map(({ id, api, enabled }) => ({ id, api, enabled })),
      }).then(() => true, () => false)
      if (saved) onDone()
    },
  })
  const { apiKey, anthropicUrl, openaiUrl, geminiUrl, ollamaUrl, modelsUrl } = useStore(form.store, (state) => state.values)
  const [models, setModels] = React.useState<Array<ProviderModel>>(provider?.models ?? [])
  const [manualId, setManualId] = React.useState('')
  const [tests, setTests] = React.useState<Record<string, TestState>>({})
  const [loadingModels, setLoadingModels] = React.useState(false)
  const [error, setError] = React.useState('')
  const [showAdvanced, setShowAdvanced] = React.useState(preset.id === 'custom' || preset.id === 'ollama')

  const urls = { anthropicUrl: anthropicUrl.trim() || null, openaiUrl: openaiUrl.trim() || null }
  const nativeUrls = { geminiUrl: geminiUrl.trim() || null, ollamaUrl: ollamaUrl.trim() || null }
  const endpoints = {
    providerId: provider?.id,
    ...urls,
    ...nativeUrls,
    modelsUrl: modelsUrl.trim() || null,
    apiKey: apiKey.trim() || undefined,
  }
  const endpointFor: Record<ModelApi, string | null> = {
    anthropic: urls.anthropicUrl,
    chat: urls.openaiUrl,
    responses: urls.openaiUrl,
    gemini: nativeUrls.geminiUrl,
    ollama: nativeUrls.ollamaUrl,
  }
  const apis = (Object.keys(MODEL_API_LABELS) as Array<ModelApi>).filter((api) => endpointFor[api])
  const canReach = Boolean(apiKey.trim() || provider || preset.keyOptional) && apis.length > 0

  /** Adds new ids and fills in catalog details for known ones that have none yet. */
  function addModels(entries: Array<{ id: string; info: CatalogModel | null }>, enabled: boolean) {
    setModels((current) => {
      const infos = new Map(entries.map((entry) => [entry.id, entry.info]))
      const known = new Set(current.map((m) => m.id))
      const updated = current.map((m) => (!m.info && infos.get(m.id) ? { ...m, info: infos.get(m.id) } : m))
      const added = entries.flatMap(({ id, info }) => {
        const api = guessModelApi(preset, urls, id)
        return known.has(id) || !api ? [] : [{ id, api, enabled, info }]
      })
      return [...updated, ...added]
    })
  }

  async function addManual() {
    const id = manualId.trim()
    if (!id) return
    setManualId('')
    addModels([{ id, info: null }], true)
    try {
      addModels(await lookupModels({ data: { preset: preset.id, ids: [id] } }), true)
    } catch {
      // Catalog details are optional; the model is already added without them.
    }
  }

  const loadRequest = React.useRef(0)

  async function loadModels() {
    const request = ++loadRequest.current
    setError('')
    setLoadingModels(true)
    try {
      const entries = await listRemoteModels({ data: { ...endpoints, preset: preset.id } })
      if (request === loadRequest.current) addModels(entries, false)
    } catch (err) {
      if (request === loadRequest.current) setError(t.loadError(errorMessage(err)))
    } finally {
      if (request === loadRequest.current) setLoadingModels(false)
    }
  }

  // Load the model list as soon as there is a key to try: debounced while typing, and again when the
  // key or an endpoint changes. A saved provider that already has models is not reloaded on open.
  const autoLoadKey = canReach ? [apiKey.trim(), anthropicUrl, openaiUrl, geminiUrl, ollamaUrl, modelsUrl].join('|') : null
  const [debouncedLoadKey] = useDebouncedValue(autoLoadKey, { wait: 600 })
  const autoLoaded = React.useRef(provider && provider.models.length > 0 ? autoLoadKey : null)
  React.useEffect(() => {
    // Skip while the debounced key lags behind what is currently typed.
    if (!debouncedLoadKey || debouncedLoadKey !== autoLoadKey || debouncedLoadKey === autoLoaded.current) return
    if (apiKey.trim() && apiKey.trim().length < 8) return
    autoLoaded.current = debouncedLoadKey
    void loadModels()
  }, [debouncedLoadKey])

  async function runTest(model: ProviderModel) {
    setTests((t) => ({ ...t, [model.id]: { status: 'pending' } }))
    try {
      const { ms } = await testModel({ data: { ...endpoints, preset: preset.id, modelId: model.id, api: model.api } })
      setTests((t) => ({ ...t, [model.id]: { status: 'ok', ms } }))
    } catch (err) {
      setTests((t) => ({ ...t, [model.id]: { status: 'error', message: errorMessage(err) } }))
    }
  }

  function updateModel(id: string, patch: Partial<ProviderModel>) {
    setModels((current) => current.map((m) => (m.id === id ? { ...m, ...patch } : m)))
  }

  function setEnabled(ids: Array<string>, enabled: boolean) {
    const targets = new Set(ids)
    setModels((current) => current.map((m) => (targets.has(m.id) ? { ...m, enabled } : m)))
  }

  const enabledCount = models.filter((m) => m.enabled).length

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        void form.handleSubmit()
      }}
      className="flex flex-col gap-6"
    >
      <div className="flex flex-col gap-4 rounded-xl border bg-card p-4">
        <form.Field name="name">
          {(field) => (
            <div className="flex flex-col gap-2">
              <Label htmlFor="provider-name">{t.displayName}</Label>
              <Input
                id="provider-name"
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                required
                maxLength={60}
                aria-invalid={field.state.meta.errors.length > 0}
              />
              <FieldError errors={field.state.meta.errors} />
            </div>
          )}
        </form.Field>
        <form.Field name="apiKey">
          {(field) => (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="provider-key">
                  API key
                  {preset.keyOptional && <span className="font-normal text-muted-foreground"> · {t.keyOptionalLabel}</span>}
                </Label>
                {preset.keyUrl && (
                  <a
                    href={preset.keyUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                  >
                    {t.getKey} <IconExternalLink className="size-3" />
                  </a>
                )}
              </div>
              <Input
                id="provider-key"
                type="password"
                autoComplete="off"
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                placeholder={
                  provider?.keyHint ? t.keyInUse(provider.keyHint) : preset.keyOptional ? t.keyOptionalPlaceholder : t.keyPlaceholder
                }
                required={!provider && !preset.keyOptional}
                aria-invalid={field.state.meta.errors.length > 0}
              />
              <FieldError errors={field.state.meta.errors} />
            </div>
          )}
        </form.Field>

        {showAdvanced ? (
          <>
            {preset.geminiUrl && (
              <form.Field name="geminiUrl">
                {(field) => (
                  <UrlField
                    id="gemini-url"
                    label={t.geminiEndpoint}
                    hint={t.geminiHint}
                    value={field.state.value}
                    onChange={field.handleChange}
                    onBlur={field.handleBlur}
                    errors={field.state.meta.errors}
                    placeholder="https://generativelanguage.googleapis.com"
                  />
                )}
              </form.Field>
            )}
            {preset.ollamaUrl && (
              <form.Field name="ollamaUrl">
                {(field) => (
                  <UrlField
                    id="ollama-url"
                    label={t.ollamaEndpoint}
                    hint={t.ollamaHint}
                    value={field.state.value}
                    onChange={field.handleChange}
                    onBlur={field.handleBlur}
                    errors={field.state.meta.errors}
                    placeholder="http://localhost:11434"
                  />
                )}
              </form.Field>
            )}
            {!preset.geminiUrl && !preset.ollamaUrl && (
              <>
              <form.Field name="anthropicUrl">
                {(field) => (
                  <UrlField
                    id="anthropic-url"
                    label={t.anthropicEndpoint}
                    hint={t.anthropicHint}
                    value={field.state.value}
                    onChange={field.handleChange}
                    onBlur={field.handleBlur}
                    errors={field.state.meta.errors}
                    placeholder="https://api.anthropic.com"
                  />
                )}
              </form.Field>
              <form.Field name="openaiUrl">
                {(field) => (
                  <UrlField
                    id="openai-url"
                    label={t.openaiEndpoint}
                    hint={t.openaiHint}
                    value={field.state.value}
                    onChange={field.handleChange}
                    onBlur={field.handleBlur}
                    errors={field.state.meta.errors}
                    placeholder="https://api.example.com/v1"
                  />
                )}
              </form.Field>
              <form.Field name="modelsUrl">
                {(field) => (
                  <UrlField
                    id="models-url"
                    label={t.modelsUrl}
                    hint={t.modelsUrlHint}
                    value={field.state.value}
                    onChange={field.handleChange}
                    onBlur={field.handleBlur}
                    errors={field.state.meta.errors}
                  />
                )}
              </form.Field>
              </>
            )}
          </>
        ) : (
          <button
            type="button"
            onClick={() => setShowAdvanced(true)}
            className="self-start text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            {t.editEndpoint}
          </button>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="mr-auto text-sm font-medium">
            {t.models}{' '}
            <span className="text-muted-foreground">
              ({t.modelsEnabled(enabledCount)}{models.length > 0 && ` / ${models.length}`})
            </span>
          </h3>
          <Button type="button" variant="outline" size="sm" onClick={loadModels} disabled={!canReach || loadingModels}>
            {loadingModels ? <IconLoader2 className="animate-spin" /> : <IconRefresh />}
            {t.loadModels}
          </Button>
        </div>

        {models.length === 0 && loadingModels ? (
          <p className="flex items-center justify-center gap-2 rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
            <IconLoader2 className="size-4 animate-spin" />
            {t.loadingModels}
          </p>
        ) : models.length === 0 ? (
          <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
            {t.emptyModels}
          </p>
        ) : (
          <ProviderModelTable
            models={models}
            apis={preset.apiFor ? [] : apis}
            tests={tests}
            canTest={canReach}
            onEnable={setEnabled}
            onApiChange={(id, api) => updateModel(id, { api })}
            onTest={runTest}
          />
        )}

        <div className="flex gap-2">
          <Input
            value={manualId}
            onChange={(e) => setManualId(e.target.value)}
            placeholder={t.manualPlaceholder}
            className="font-mono text-sm"
            onKeyDown={(e) => {
              if (e.key !== 'Enter') return
              e.preventDefault()
              void addManual()
            }}
          />
          <Button type="button" variant="outline" onClick={addManual} disabled={!manualId.trim()}>
            <IconPlus />
            {t.addModel}
          </Button>
        </div>
      </div>

      {(error || save.error) && (
        <p role="alert" className="text-sm text-destructive">
          {error || errorMessage(save.error)}
        </p>
      )}

      <div className="flex gap-2">
        <Button type="submit" disabled={save.isPending}>
          {save.isPending && <IconLoader2 className="animate-spin" />}
          {t.save}
        </Button>
        <Button type="button" variant="ghost" onClick={onDone}>
          {t.cancel}
        </Button>
      </div>
    </form>
  )
}

function UrlField({
  id,
  label,
  hint,
  value,
  onChange,
  onBlur,
  errors,
  placeholder,
}: {
  id: string
  label: string
  hint: string
  value: string
  onChange: (value: string) => void
  onBlur: () => void
  errors: ReadonlyArray<unknown>
  placeholder?: string
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>
        {label} <span className="font-normal text-muted-foreground">· {hint}</span>
      </Label>
      <Input
        id={id}
        type="url"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder={placeholder}
        aria-invalid={errors.length > 0}
      />
      <FieldError errors={errors} />
    </div>
  )
}
