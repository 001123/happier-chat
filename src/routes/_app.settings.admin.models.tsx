import * as React from 'react'
import { useForm } from '@tanstack/react-form'
import { queryOptions, useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { IconCircleCheck, IconLoader2, IconRefresh, IconX } from '@tabler/icons-react'

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
import type { AdminCatalogRow, CatalogOverride, SyncPreview } from '@/lib/model-catalog'
import { errorMessage } from '@/lib/utils'
import { applyCatalogSync, getAdminCatalog, previewCatalogSync, updateCatalogOverride } from '@/server/admin.functions'

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
    displayName: 'Tên hiển thị',
    restore: 'Khôi phục gốc',
    save: 'Lưu',
    wholeNumber: 'Nhập số nguyên dương',
    nonNegative: 'Nhập số không âm',
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
    displayName: 'Display name',
    restore: 'Restore original',
    save: 'Save',
    wholeNumber: 'Enter a positive whole number',
    nonNegative: 'Enter a number that is 0 or more',
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
  const [editing, setEditing] = React.useState<AdminCatalogRow | null>(null)

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

      <CatalogTable rows={rows} providers={meta.providers} onEdit={setEditing} />

      <OverrideSheet row={editing} onClose={() => setEditing(null)} />
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
        <p className="text-sm text-muted-foreground">{t.overrideHelp}</p>
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
        {save.error && (
          <p role="alert" className="text-sm text-destructive">
            {errorMessage(save.error)}
          </p>
        )}
      </div>

      <SheetFooter className="flex-row justify-between">
        <Button type="button" variant="ghost" onClick={() => save.mutate(null)} disabled={save.isPending || !row.override}>
          {t.restore}
        </Button>
        <Button type="submit" disabled={save.isPending}>
          {save.isPending && <IconLoader2 className="animate-spin" />}
          {t.save}
        </Button>
      </SheetFooter>
    </form>
  )
}
