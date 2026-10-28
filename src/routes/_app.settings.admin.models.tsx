import * as React from 'react'
import { useForm } from '@tanstack/react-form'
import { queryOptions, useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { IconCircleCheck, IconLoader2, IconPlus, IconRefresh, IconTrash, IconX } from '@tabler/icons-react'

import { z } from 'zod'
import { CatalogTable } from '@/components/catalog-table'
import { FieldError } from '@/components/field-error'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { defineMessages, getLocale, LOCALE_TAGS, useLocale, useMessages } from '@/lib/i18n'
import { formatPrice } from '@/lib/model-catalog'
import type { AdminCatalogRow, CatalogOverride, SyncPreview } from '@/lib/model-catalog'
import { errorMessage } from '@/lib/utils'
import {
  addCatalogModel,
  applyCatalogSync,
  deleteCatalogModel,
  deleteCatalogPrice,
  getAdminCatalog,
  previewCatalogSync,
  scheduleCatalogPrice,
  updateCatalogOverride,
} from '@/server/admin.functions'

const messages = defineMessages({
  vi: {
    title: 'Model · Quản trị · Happier Chat',
    heading: 'Danh mục model',
    introBefore: 'Thông tin model lấy từ',
    introAfter: '. Giá trị bạn sửa tay được giữ lại qua các lần đồng bộ.',
    syncTitle: 'Đồng bộ từ models.dev',
    lastSync: (date: string, count: number) => `Lần cuối ${date} · ${count} model`,
    neverSynced: 'Chưa đồng bộ lần nào',
    checkUpdates: 'Kiểm tra cập nhật',
    syncedProviders: 'Provider được đồng bộ',
    remove: (id: string) => `Bỏ ${id}`,
    addPlaceholder: 'Thêm provider id, ví dụ google',
    modelCount: (n: number) => `${n} model`,
    add: 'Thêm',
    upToDate: 'Dữ liệu đã mới nhất.',
    added: (n: number) => `+${n} mới`,
    changed: (n: number) => `${n} thay đổi`,
    removed: (n: number) => `−${n} bị xoá`,
    kindAdded: 'Mới',
    kindRemoved: 'Xoá',
    kindChanged: 'Sửa',
    apply: 'Áp dụng',
    cancel: 'Huỷ',
    fields: {
      context: 'Context (token)',
      output: 'Output tối đa (token)',
      'cost.input': 'Giá input ($/1M)',
      'cost.output': 'Giá output ($/1M)',
      'cost.cacheRead': 'Giá cache read ($/1M)',
      'cost.cacheWrite': 'Giá cache write ($/1M)',
    },
    overrideHelp: 'Để trống để dùng giá trị từ models.dev (hiện ở ô gợi ý).',
    overrideHelpManual: 'Để trống để dùng giá trị nhập lúc thêm model (hiện ở ô gợi ý).',
    displayName: 'Tên hiển thị',
    restore: 'Khôi phục gốc',
    save: 'Lưu',
    wholeNumber: 'Nhập số nguyên dương',
    nonNegative: 'Nhập số không âm',
    addModel: 'Thêm model thủ công',
    addModelHelp:
      'Cho model mà models.dev chưa có. Khi models.dev có model này dưới cùng provider, lần đồng bộ sau sẽ thay bằng dữ liệu gốc và giữ phần bạn đã sửa.',
    addModelSpeechHint: 'Giọng Gemini: provider google, model id như trong Cài đặt → Giọng nói, giá output là giá audio.',
    providerId: 'Provider id',
    modelId: 'Model id',
    required: 'Bắt buộc',
    optional: 'không bắt buộc',
    deleteModel: 'Xoá model',
    schedule: 'Lịch giá',
    scheduleHelp:
      'Giá theo lịch thay cho giá ở trên từ 0h UTC ngày hiệu lực. Chi phí của các lần gọi trước đó không đổi.',
    scheduleEmpty: 'Chưa có giá nào được lên lịch.',
    effectiveFrom: 'Áp dụng từ ngày',
    statusActive: 'Đang áp dụng',
    statusUpcoming: 'Sắp áp dụng',
    statusReplaced: 'Đã thay',
    addPrice: 'Lên lịch giá',
    deletePrice: (date: string) => `Xoá giá từ ${date}`,
    pickDate: 'Chọn ngày',
  },
  en: {
    title: 'Models · Administration · Happier Chat',
    heading: 'Model catalog',
    introBefore: 'Model info comes from',
    introAfter: '. Values you edit by hand are kept across syncs.',
    syncTitle: 'Sync from models.dev',
    lastSync: (date: string, count: number) => `Last synced ${date} · ${count} ${count === 1 ? 'model' : 'models'}`,
    neverSynced: 'Never synced',
    checkUpdates: 'Check for updates',
    syncedProviders: 'Providers to sync',
    remove: (id: string) => `Remove ${id}`,
    addPlaceholder: 'Add a provider id, e.g. google',
    modelCount: (n: number) => `${n} ${n === 1 ? 'model' : 'models'}`,
    add: 'Add',
    upToDate: 'Data is up to date.',
    added: (n: number) => `+${n} new`,
    changed: (n: number) => `${n} changed`,
    removed: (n: number) => `−${n} removed`,
    kindAdded: 'New',
    kindRemoved: 'Removed',
    kindChanged: 'Edited',
    apply: 'Apply',
    cancel: 'Cancel',
    fields: {
      context: 'Context (tokens)',
      output: 'Max output (tokens)',
      'cost.input': 'Input price ($/1M)',
      'cost.output': 'Output price ($/1M)',
      'cost.cacheRead': 'Cache read price ($/1M)',
      'cost.cacheWrite': 'Cache write price ($/1M)',
    },
    overrideHelp: 'Leave empty to use the value from models.dev (shown as the placeholder).',
    overrideHelpManual: 'Leave empty to use the value entered when the model was added (shown as the placeholder).',
    displayName: 'Display name',
    restore: 'Restore original',
    save: 'Save',
    wholeNumber: 'Enter a positive whole number',
    nonNegative: 'Enter a number that is 0 or more',
    addModel: 'Add model manually',
    addModelHelp:
      'For a model models.dev does not list yet. Once models.dev lists it under the same provider, the next sync replaces it with the original data and keeps your edits.',
    addModelSpeechHint: 'Gemini voices: provider google, the model id from Settings → Voice, and the audio price as output.',
    providerId: 'Provider id',
    modelId: 'Model id',
    required: 'Required',
    optional: 'optional',
    deleteModel: 'Delete model',
    schedule: 'Price schedule',
    scheduleHelp:
      'A scheduled price replaces the price above from 00:00 UTC on its day. Calls made before keep their cost.',
    scheduleEmpty: 'No prices scheduled.',
    effectiveFrom: 'Takes effect on',
    statusActive: 'In effect',
    statusUpcoming: 'Upcoming',
    statusReplaced: 'Replaced',
    addPrice: 'Schedule price',
    deletePrice: (date: string) => `Delete the price from ${date}`,
    pickDate: 'Pick a date',
  },
})

const adminCatalogQuery = queryOptions({ queryKey: ['admin', 'catalog'], queryFn: () => getAdminCatalog() })

export const Route = createFileRoute('/_app/settings/admin/models')({
  head: () => ({ meta: [{ title: messages[getLocale()].title }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(adminCatalogQuery),
  component: ModelsAdminPage,
})

function ModelsAdminPage() {
  const t = useMessages(messages)
  const { data: { meta, rows } } = useSuspenseQuery(adminCatalogQuery)
  const [editingKey, setEditingKey] = React.useState<string | null>(null)
  // Looked up by key, so the open sheet shows the row as refetched after a write.
  const editing = rows.find((row) => `${row.providerId}/${row.model.id}` === editingKey) ?? null
  const [adding, setAdding] = React.useState(false)
  // Manually added models may sit under a provider that is not synced.
  const providers = React.useMemo(
    () => [...new Set([...meta.providers, ...rows.map((row) => row.providerId)])],
    [meta.providers, rows],
  )

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h2 className="font-serif text-2xl tracking-tight">{t.heading}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t.introBefore}{' '}
          <a href="https://models.dev" target="_blank" rel="noreferrer" className="underline underline-offset-2">
            models.dev
          </a>
          {t.introAfter}
        </p>
      </div>

      <SyncPanel providers={meta.providers} syncedAt={meta.syncedAt} modelCount={meta.modelCount} />

      <div className="flex flex-col gap-3">
        <div className="flex justify-end">
          <Button variant="outline" onClick={() => setAdding(true)}>
            <IconPlus />
            {t.addModel}
          </Button>
        </div>
        <CatalogTable rows={rows} providers={providers} onEdit={(row) => setEditingKey(`${row.providerId}/${row.model.id}`)} />
      </div>

      <OverrideSheet row={editing} onClose={() => setEditingKey(null)} />
      <AddModelSheet open={adding} providers={providers} onClose={() => setAdding(false)} />
    </div>
  )
}

function SyncPanel({ providers, syncedAt, modelCount }: { providers: Array<string>; syncedAt: number | null; modelCount: number }) {
  const t = useMessages(messages)
  const locale = useLocale()
  const queryClient = useQueryClient()
  const [selected, setSelected] = React.useState(providers)
  const [adding, setAdding] = React.useState('')
  const [preview, setPreview] = React.useState<SyncPreview | null>(null)
  const [available, setAvailable] = React.useState<Array<{ id: string; name: string; models: number }>>([])

  const check = useMutation({
    mutationFn: () => previewCatalogSync({ data: { providers: selected } }),
    onSuccess: (result) => {
      setPreview(result)
      if (result.status === 'ready') setAvailable(result.available)
    },
  })
  const apply = useMutation({
    mutationFn: (token: string) => applyCatalogSync({ data: { token } }),
    onSuccess: async () => {
      setPreview(null)
      await queryClient.invalidateQueries(adminCatalogQuery)
    },
  })
  const busy = check.isPending ? 'preview' : apply.isPending ? 'apply' : null
  const error = check.error ?? apply.error

  function changeSelection(next: Array<string>) {
    setSelected(next)
    setPreview(null)
  }

  function addProvider() {
    const id = adding.trim()
    if (id && !selected.includes(id)) changeSelection([...selected, id])
    setAdding('')
  }

  return (
    <div className="flex flex-col gap-4 rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-sm font-medium">{t.syncTitle}</div>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {syncedAt
              ? t.lastSync(new Date(syncedAt).toLocaleString(LOCALE_TAGS[locale]), modelCount)
              : t.neverSynced}
          </p>
        </div>
        <Button variant="outline" onClick={() => check.mutate()} disabled={busy !== null || selected.length === 0}>
          {busy === 'preview' ? <IconLoader2 className="animate-spin" /> : <IconRefresh />}
          {t.checkUpdates}
        </Button>
      </div>

      <div className="flex flex-col gap-2">
        <Label>{t.syncedProviders}</Label>
        <div className="flex flex-wrap items-center gap-1.5">
          {selected.map((id) => (
            <Badge key={id} variant="secondary" className="gap-1 pr-1">
              {id}
              <button
                type="button"
                aria-label={t.remove(id)}
                className="rounded-sm opacity-60 hover:opacity-100"
                onClick={() => changeSelection(selected.filter((item) => item !== id))}
              >
                <IconX className="size-3" />
              </button>
            </Badge>
          ))}
        </div>
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            addProvider()
          }}
        >
          <Input
            value={adding}
            onChange={(event) => setAdding(event.target.value)}
            list="catalog-providers"
            placeholder={t.addPlaceholder}
            className="max-w-xs"
          />
          <datalist id="catalog-providers">
            {available
              .filter((item) => !selected.includes(item.id))
              .map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} · {t.modelCount(item.models)}
                </option>
              ))}
          </datalist>
          <Button type="submit" variant="ghost" disabled={!adding.trim()}>
            {t.add}
          </Button>
        </form>
      </div>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {errorMessage(error)}
        </p>
      )}

      {preview?.status === 'unchanged' && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <IconCircleCheck className="size-4 text-green-600" />
          {t.upToDate}
        </p>
      )}

      {preview?.status === 'ready' && (
        <div className="flex flex-col gap-3 border-t pt-4">
          <p className="text-sm">
            <span className="text-green-600">{t.added(preview.counts.added)}</span> ·{' '}
            <span className="text-amber-600">{t.changed(preview.counts.changed)}</span> ·{' '}
            <span className="text-destructive">{t.removed(preview.counts.removed)}</span>
          </p>
          {preview.changes.length > 0 && (
            <ul className="max-h-64 overflow-y-auto rounded-lg border text-xs">
              {preview.changes.map((change) => (
                <li key={`${change.kind}/${change.providerId}/${change.modelId}`} className="flex gap-2 border-b px-3 py-1.5 last:border-0">
                  <span className="w-12 shrink-0 text-muted-foreground">
                    {change.kind === 'added' ? t.kindAdded : change.kind === 'removed' ? t.kindRemoved : t.kindChanged}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-mono">
                    {change.providerId}/{change.modelId}
                  </span>
                  {change.fields.length > 0 && <span className="text-muted-foreground">{change.fields.join(', ')}</span>}
                </li>
              ))}
            </ul>
          )}
          <div className="flex gap-2">
            <Button onClick={() => apply.mutate(preview.token)} disabled={busy !== null}>
              {busy === 'apply' && <IconLoader2 className="animate-spin" />}
              {t.apply}
            </Button>
            <Button variant="ghost" onClick={() => setPreview(null)} disabled={busy !== null}>
              {t.cancel}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

const NUMBER_FIELDS = [
  { key: 'context' },
  { key: 'output' },
  { key: 'cost.input' },
  { key: 'cost.output' },
  { key: 'cost.cacheRead' },
  { key: 'cost.cacheWrite' },
] as const

type FieldKey = 'name' | (typeof NUMBER_FIELDS)[number]['key']

function readField(source: CatalogOverride | AdminCatalogRow['model'] | null, key: FieldKey) {
  if (!source) return undefined
  if (key.startsWith('cost.')) {
    const cost = source.cost as Record<string, number | null | undefined> | null | undefined
    return cost?.[key.slice(5)] ?? undefined
  }
  return (source as Record<string, unknown>)[key] as string | number | null | undefined
}

function OverrideSheet({ row, onClose }: { row: AdminCatalogRow | null; onClose: () => void }) {
  return (
    <Sheet open={row !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent>{row && <OverrideForm key={`${row.providerId}/${row.model.id}`} row={row} onClose={onClose} />}</SheetContent>
    </Sheet>
  )
}

function OverrideForm({ row, onClose }: { row: AdminCatalogRow; onClose: () => void }) {
  const t = useMessages(messages)
  const queryClient = useQueryClient()

  // Empty means "use the catalog value"; anything else must match what updateCatalogOverride accepts.
  const blank = (check: (n: number) => boolean, error: string) =>
    z.string().refine((value) => value.trim() === '' || (Number.isFinite(Number(value)) && check(Number(value))), { error })
  const tokens = blank((n) => Number.isInteger(n) && n > 0, t.wholeNumber)
  const price = blank((n) => n >= 0, t.nonNegative)
  const schema = z.object({
    name: z.string().max(200),
    context: tokens,
    output: tokens,
    cost: z.object({ input: price, output: price, cacheRead: price, cacheWrite: price }),
  })

  const save = useMutation({
    mutationFn: (override: CatalogOverride | null) =>
      updateCatalogOverride({ data: { providerId: row.providerId, modelId: row.model.id, override } }),
    onSuccess: async () => {
      await queryClient.invalidateQueries(adminCatalogQuery)
      onClose()
    },
  })

  const remove = useMutation({
    mutationFn: () => deleteCatalogModel({ data: { providerId: row.providerId, modelId: row.model.id } }),
    onSuccess: async () => {
      await queryClient.invalidateQueries(adminCatalogQuery)
      onClose()
    },
  })

  const initial = (key: FieldKey) => String(readField(row.override, key) ?? '')
  const form = useForm({
    defaultValues: {
      name: initial('name'),
      context: initial('context'),
      output: initial('output'),
      cost: {
        input: initial('cost.input'),
        output: initial('cost.output'),
        cacheRead: initial('cost.cacheRead'),
        cacheWrite: initial('cost.cacheWrite'),
      },
    },
    validators: { onChange: schema },
    onSubmit: ({ value }) => {
      const number = (text: string) => (text.trim() === '' ? undefined : Number(text))
      const cost = {
        input: number(value.cost.input),
        output: number(value.cost.output),
        cacheRead: number(value.cost.cacheRead),
        cacheWrite: number(value.cost.cacheWrite),
      }
      save.mutate({
        name: value.name.trim() || undefined,
        context: number(value.context),
        output: number(value.output),
        cost: Object.values(cost).some((entry) => entry !== undefined) ? cost : undefined,
      })
    },
  })

  return (
    <form
      noValidate
      className="flex h-full flex-col"
      onSubmit={(event) => {
        event.preventDefault()
        void form.handleSubmit()
      }}
    >
      <SheetHeader>
        <SheetTitle>{row.model.name}</SheetTitle>
        <SheetDescription className="font-mono text-xs">
          {row.providerId}/{row.model.id}
        </SheetDescription>
      </SheetHeader>

      <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4">
        <p className="text-sm text-muted-foreground">{row.manual ? t.overrideHelpManual : t.overrideHelp}</p>
        <form.Field name="name">
          {(field) => (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="override-name">{t.displayName}</Label>
              <Input
                id="override-name"
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
                placeholder={row.model.name}
              />
            </div>
          )}
        </form.Field>
        {NUMBER_FIELDS.map((spec) => (
          <form.Field key={spec.key} name={spec.key}>
            {(field) => (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`override-${spec.key}`}>{t.fields[spec.key]}</Label>
                <Input
                  id={`override-${spec.key}`}
                  type="number"
                  min={0}
                  step={spec.key.startsWith('cost.') ? 'any' : 1}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                  placeholder={String(readField(row.model, spec.key) ?? '—')}
                  aria-invalid={field.state.meta.errors.length > 0}
                />
                <FieldError errors={field.state.meta.errors} />
              </div>
            )}
          </form.Field>
        ))}
        <PriceSchedule row={row} />
        {(save.error ?? remove.error) && (
          <p role="alert" className="text-sm text-destructive">
            {errorMessage(save.error ?? remove.error)}
          </p>
        )}
      </div>

      <SheetFooter className="flex-row justify-between">
        <div className="flex gap-1">
          {row.manual && (
            <Button
              type="button"
              variant="ghost"
              className="text-destructive hover:text-destructive"
              onClick={() => remove.mutate()}
              disabled={save.isPending || remove.isPending}
            >
              {remove.isPending ? <IconLoader2 className="animate-spin" /> : <IconTrash />}
              {t.deleteModel}
            </Button>
          )}
          <Button type="button" variant="ghost" onClick={() => save.mutate(null)} disabled={save.isPending || !row.override}>
            {t.restore}
          </Button>
        </div>
        <Button type="submit" disabled={save.isPending}>
          {save.isPending && <IconLoader2 className="animate-spin" />}
          {t.save}
        </Button>
      </SheetFooter>
    </form>
  )
}

function AddModelSheet({ open, providers, onClose }: { open: boolean; providers: Array<string>; onClose: () => void }) {
  return (
    <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
      <SheetContent>{open && <AddModelForm providers={providers} onClose={onClose} />}</SheetContent>
    </Sheet>
  )
}

function AddModelForm({ providers, onClose }: { providers: Array<string>; onClose: () => void }) {
  const t = useMessages(messages)
  const queryClient = useQueryClient()

  const filled = z.string().trim().min(1, { error: t.required })
  const number = (check: (n: number) => boolean, error: string) =>
    z.string().refine((value) => Number.isFinite(Number(value)) && check(Number(value)), { error })
  const optional = (check: (n: number) => boolean, error: string) =>
    z.string().refine((value) => value.trim() === '' || (Number.isFinite(Number(value)) && check(Number(value))), { error })
  const isPrice = (n: number) => n >= 0
  const isTokens = (n: number) => Number.isInteger(n) && n > 0
  const schema = z.object({
    providerId: filled,
    modelId: filled,
    name: z.string().max(200),
    context: optional(isTokens, t.wholeNumber),
    output: optional(isTokens, t.wholeNumber),
    cost: z.object({
      input: filled.pipe(number(isPrice, t.nonNegative)),
      output: filled.pipe(number(isPrice, t.nonNegative)),
      cacheRead: optional(isPrice, t.nonNegative),
      cacheWrite: optional(isPrice, t.nonNegative),
    }),
  })

  const add = useMutation({
    mutationFn: (data: Parameters<typeof addCatalogModel>[0]['data']) => addCatalogModel({ data }),
    onSuccess: async () => {
      await queryClient.invalidateQueries(adminCatalogQuery)
      onClose()
    },
  })

  const form = useForm({
    defaultValues: {
      providerId: 'google',
      modelId: '',
      name: '',
      context: '',
      output: '',
      cost: { input: '', output: '', cacheRead: '', cacheWrite: '' },
    },
    validators: { onChange: schema, onSubmit: schema },
    onSubmit: ({ value }) => {
      const orNull = (text: string) => (text.trim() === '' ? null : Number(text))
      add.mutate({
        providerId: value.providerId.trim(),
        modelId: value.modelId.trim(),
        name: value.name.trim(),
        context: orNull(value.context),
        output: orNull(value.output),
        cost: {
          input: Number(value.cost.input),
          output: Number(value.cost.output),
          cacheRead: orNull(value.cost.cacheRead),
          cacheWrite: orNull(value.cost.cacheWrite),
        },
      })
    },
  })

  const textFields = [
    { key: 'providerId', label: t.providerId, mono: true },
    { key: 'modelId', label: t.modelId, mono: true },
    { key: 'name', label: `${t.displayName} (${t.optional})`, mono: false },
  ] as const
  const required = new Set<string>(['cost.input', 'cost.output'])

  return (
    <form
      noValidate
      className="flex h-full flex-col"
      onSubmit={(event) => {
        event.preventDefault()
        void form.handleSubmit()
      }}
    >
      <SheetHeader>
        <SheetTitle>{t.addModel}</SheetTitle>
        <SheetDescription>{t.addModelHelp}</SheetDescription>
      </SheetHeader>

      <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4">
        <p className="text-sm text-muted-foreground">{t.addModelSpeechHint}</p>
        {textFields.map((spec) => (
          <form.Field key={spec.key} name={spec.key}>
            {(field) => (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`add-${spec.key}`}>{spec.label}</Label>
                <Input
                  id={`add-${spec.key}`}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                  list={spec.key === 'providerId' ? 'add-model-providers' : undefined}
                  className={spec.mono ? 'font-mono' : undefined}
                  aria-invalid={field.state.meta.errors.length > 0}
                />
                <FieldError errors={field.state.meta.errors} />
              </div>
            )}
          </form.Field>
        ))}
        <datalist id="add-model-providers">
          {providers.map((id) => (
            <option key={id} value={id} />
          ))}
        </datalist>
        {NUMBER_FIELDS.map((spec) => (
          <form.Field key={spec.key} name={spec.key}>
            {(field) => (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`add-${spec.key}`}>
                  {t.fields[spec.key]}
                  {!required.has(spec.key) && <span className="font-normal text-muted-foreground">({t.optional})</span>}
                </Label>
                <Input
                  id={`add-${spec.key}`}
                  type="number"
                  min={0}
                  step={spec.key.startsWith('cost.') ? 'any' : 1}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                  aria-invalid={field.state.meta.errors.length > 0}
                />
                <FieldError errors={field.state.meta.errors} />
              </div>
            )}
          </form.Field>
        ))}
        {add.error && (
          <p role="alert" className="text-sm text-destructive">
            {errorMessage(add.error)}
          </p>
        )}
      </div>

      <SheetFooter className="flex-row justify-end">
        <Button type="button" variant="ghost" onClick={onClose} disabled={add.isPending}>
          {t.cancel}
        </Button>
        <Button type="submit" disabled={add.isPending}>
          {add.isPending && <IconLoader2 className="animate-spin" />}
          {t.add}
        </Button>
      </SheetFooter>
    </form>
  )
}

/** Prices that take effect on a later day; lives inside the override form, so it submits with buttons, not a form. */
function PriceSchedule({ row }: { row: AdminCatalogRow }) {
  const t = useMessages(messages)
  const locale = useLocale()
  const queryClient = useQueryClient()
  const [draft, setDraft] = React.useState({ day: '', input: '', output: '', cacheRead: '', cacheWrite: '' })
  const [invalid, setInvalid] = React.useState<string | null>(null)
  const key = { providerId: row.providerId, modelId: row.model.id }

  const refresh = () => queryClient.invalidateQueries(adminCatalogQuery)
  const add = useMutation({
    mutationFn: (data: Parameters<typeof scheduleCatalogPrice>[0]['data']) => scheduleCatalogPrice({ data }),
    onSuccess: async () => {
      setDraft({ day: '', input: '', output: '', cacheRead: '', cacheWrite: '' })
      await refresh()
    },
  })
  const remove = useMutation({
    mutationFn: (effectiveFrom: number) => deleteCatalogPrice({ data: { ...key, effectiveFrom } }),
    onSuccess: refresh,
  })

  const now = Date.now()
  const active = row.schedule.filter((entry) => entry.effectiveFrom <= now).at(-1)
  const formatDay = (time: number) => new Date(time).toLocaleDateString(LOCALE_TAGS[locale], { timeZone: 'UTC' })

  function submit() {
    const price = (text: string) => (text.trim() === '' ? null : Number(text))
    const cost = { input: price(draft.input), output: price(draft.output), cacheRead: price(draft.cacheRead), cacheWrite: price(draft.cacheWrite) }
    if (!draft.day) return setInvalid(t.pickDate)
    if (cost.input === null || cost.output === null) return setInvalid(t.required)
    if (Object.values(cost).some((value) => value !== null && !(Number.isFinite(value) && value >= 0))) return setInvalid(t.nonNegative)
    setInvalid(null)
    add.mutate({ ...key, effectiveFrom: draft.day, cost: { ...cost, input: cost.input, output: cost.output } })
  }

  const priceFields = [
    { key: 'input', label: t.fields['cost.input'] },
    { key: 'output', label: t.fields['cost.output'] },
    { key: 'cacheRead', label: `${t.fields['cost.cacheRead']} (${t.optional})` },
    { key: 'cacheWrite', label: `${t.fields['cost.cacheWrite']} (${t.optional})` },
  ] as const
  const error = invalid ?? (add.error ? errorMessage(add.error) : remove.error ? errorMessage(remove.error) : null)

  return (
    <section className="mt-2 flex flex-col gap-3 border-t pt-4">
      <div>
        <div className="text-sm font-medium">{t.schedule}</div>
        <p className="mt-0.5 text-sm text-muted-foreground">{t.scheduleHelp}</p>
      </div>

      {row.schedule.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t.scheduleEmpty}</p>
      ) : (
        <ul className="divide-y rounded-lg border text-sm">
          {row.schedule.map((entry) => {
            const status =
              entry.effectiveFrom > now ? t.statusUpcoming : entry === active ? t.statusActive : t.statusReplaced
            return (
              <li key={entry.effectiveFrom} className="flex items-center gap-2 px-3 py-2">
                <span className="w-24 shrink-0 tabular-nums">{formatDay(entry.effectiveFrom)}</span>
                <span className="min-w-0 flex-1 tabular-nums">
                  {formatPrice(entry.cost.input)} / {formatPrice(entry.cost.output)}
                </span>
                <Badge variant={entry.effectiveFrom > now ? 'outline' : 'secondary'} className="text-[10px]">
                  {status}
                </Badge>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t.deletePrice(formatDay(entry.effectiveFrom))}
                  onClick={() => remove.mutate(entry.effectiveFrom)}
                  disabled={remove.isPending}
                >
                  <IconTrash />
                </Button>
              </li>
            )
          })}
        </ul>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2 flex flex-col gap-1.5">
          <Label htmlFor="schedule-day">{t.effectiveFrom}</Label>
          <Input
            id="schedule-day"
            type="date"
            value={draft.day}
            onChange={(event) => setDraft({ ...draft, day: event.target.value })}
          />
        </div>
        {priceFields.map((field) => (
          <div key={field.key} className="flex flex-col gap-1.5">
            <Label htmlFor={`schedule-${field.key}`} className="text-xs">
              {field.label}
            </Label>
            <Input
              id={`schedule-${field.key}`}
              type="number"
              min={0}
              step="any"
              value={draft[field.key]}
              onChange={(event) => setDraft({ ...draft, [field.key]: event.target.value })}
              // Enter would submit the surrounding override form.
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  submit()
                }
              }}
            />
          </div>
        ))}
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button type="button" variant="outline" onClick={submit} disabled={add.isPending} className="self-start">
        {add.isPending ? <IconLoader2 className="animate-spin" /> : <IconPlus />}
        {t.addPrice}
      </Button>
    </section>
  )
}
