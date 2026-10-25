import * as React from 'react'
import { createFileRoute, useRouter } from '@tanstack/react-router'
import { IconCircleCheck, IconLoader2, IconRefresh, IconX } from '@tabler/icons-react'

import { CatalogTable } from '@/components/catalog-table'
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
  },
})

export const Route = createFileRoute('/_app/settings/admin/models')({
  head: () => ({ meta: [{ title: messages[getLocale()].title }] }),
  loader: () => getAdminCatalog(),
  component: ModelsAdminPage,
})

function ModelsAdminPage() {
  const t = useMessages(messages)
  const { meta, rows } = Route.useLoaderData()
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
  const router = useRouter()
  const [selected, setSelected] = React.useState(providers)
  const [adding, setAdding] = React.useState('')
  const [preview, setPreview] = React.useState<SyncPreview | null>(null)
  const [available, setAvailable] = React.useState<Array<{ id: string; name: string; models: number }>>([])
  const [busy, setBusy] = React.useState<'preview' | 'apply' | null>(null)
  const [error, setError] = React.useState('')

  function changeSelection(next: Array<string>) {
    setSelected(next)
    setPreview(null)
  }

  function addProvider() {
    const id = adding.trim()
    if (id && !selected.includes(id)) changeSelection([...selected, id])
    setAdding('')
  }

  async function check() {
    setBusy('preview')
    setError('')
    try {
      const result = await previewCatalogSync({ data: { providers: selected } })
      setPreview(result)
      if (result.status === 'ready') setAvailable(result.available)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(null)
    }
  }

  async function apply() {
    if (preview?.status !== 'ready') return
    setBusy('apply')
    setError('')
    try {
      await applyCatalogSync({ data: { token: preview.token } })
      setPreview(null)
      await router.invalidate()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(null)
    }
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
        <Button variant="outline" onClick={check} disabled={busy !== null || selected.length === 0}>
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
          {error}
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
            <Button onClick={apply} disabled={busy !== null}>
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
  const router = useRouter()
  const fields: Array<FieldKey> = ['name', ...NUMBER_FIELDS.map((field) => field.key)]
  const [values, setValues] = React.useState<Record<FieldKey, string>>(
    () => Object.fromEntries(fields.map((key) => [key, String(readField(row.override, key) ?? '')])) as Record<FieldKey, string>,
  )
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState('')

  async function save(override: CatalogOverride | null) {
    setSaving(true)
    setError('')
    try {
      await updateCatalogOverride({ data: { providerId: row.providerId, modelId: row.model.id, override } })
      await router.invalidate()
      onClose()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  function buildOverride(): CatalogOverride {
    const number = (key: FieldKey) => (values[key].trim() === '' ? undefined : Number(values[key]))
    const cost = {
      input: number('cost.input'),
      output: number('cost.output'),
      cacheRead: number('cost.cacheRead'),
      cacheWrite: number('cost.cacheWrite'),
    }
    return {
      name: values.name.trim() || undefined,
      context: number('context'),
      output: number('output'),
      cost: Object.values(cost).some((value) => value !== undefined) ? cost : undefined,
    }
  }

  return (
    <form
      className="flex h-full flex-col"
      onSubmit={(event) => {
        event.preventDefault()
        save(buildOverride())
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
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="override-name">{t.displayName}</Label>
          <Input
            id="override-name"
            value={values.name}
            onChange={(event) => setValues({ ...values, name: event.target.value })}
            placeholder={row.model.name}
          />
        </div>
        {NUMBER_FIELDS.map((field) => (
          <div key={field.key} className="flex flex-col gap-1.5">
            <Label htmlFor={`override-${field.key}`}>{t.fields[field.key]}</Label>
            <Input
              id={`override-${field.key}`}
              type="number"
              min={0}
              step={field.key.startsWith('cost.') ? 'any' : 1}
              value={values[field.key]}
              onChange={(event) => setValues({ ...values, [field.key]: event.target.value })}
              placeholder={String(readField(row.model, field.key) ?? '—')}
            />
          </div>
        ))}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </div>

      <SheetFooter className="flex-row justify-between">
        <Button type="button" variant="ghost" onClick={() => save(null)} disabled={saving || !row.override}>
          {t.restore}
        </Button>
        <Button type="submit" disabled={saving}>
          {saving && <IconLoader2 className="animate-spin" />}
          {t.save}
        </Button>
      </SheetFooter>
    </form>
  )
}
