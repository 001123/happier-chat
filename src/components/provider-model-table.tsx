import * as React from 'react'
import {
  createColumnHelper,
  createSortedRowModel,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_text,
  tableFeatures,
  useTable,
} from '@tanstack/react-table'
import {
  IconArrowDown,
  IconArrowUp,
  IconArrowsSort,
  IconBrain,
  IconCheck,
  IconCircleCheck,
  IconCircleX,
  IconEye,
  IconGift,
  IconLoader2,
  IconTool,
  IconX,
} from '@tabler/icons-react'
import type { TablerIcon } from '@tabler/icons-react'
import { cn } from 'cn'

import { CapabilitiesCell, ColumnLabel, InputCell, pinnedBody, Price, ReleaseCell, WeightsCell } from '@/components/model-info-cells'
import { useVirtualRows } from '@/hooks/use-virtual-rows'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { defineMessages, useMessages } from '@/lib/i18n'
import { formatTokens } from '@/lib/model-catalog'
import type { CatalogModel } from '@/lib/model-catalog'
import { MODEL_API_LABELS, MODEL_API_SHORT_LABELS } from '@/lib/providers'
import type { ModelApi, ProviderModel } from '@/lib/providers'

const messages = defineMessages({
  vi: {
    enabled: 'Đang bật',
    free: 'Miễn phí',
    reasoning: 'Reasoning',
    vision: 'Vision',
    tools: 'Tools',
    enable: 'Bật',
    test: 'Thử',
    inputPrice: 'Vào $/1M',
    outputPrice: 'Ra $/1M',
    allApis: 'Mọi API',
    disable: (name: string) => `Tắt ${name}`,
    enableModel: (name: string) => `Bật ${name}`,
    clearAll: 'Bỏ chọn tất cả',
    searchPlaceholder: 'Tìm theo tên hoặc id…',
    count: (shown: number, total: number) => `${shown} / ${total} model`,
    enableShown: (count: number) => `Bật ${count} model đang hiện`,
    noMatch: 'Không có model nào khớp bộ lọc.',
    notInCatalog: 'Chưa có trong catalog, chưa rõ giá',
    error: 'Lỗi',
  },
  en: {
    enabled: 'Enabled',
    free: 'Free',
    reasoning: 'Reasoning',
    vision: 'Vision',
    tools: 'Tools',
    enable: 'Enable',
    test: 'Test',
    inputPrice: 'In $/1M',
    outputPrice: 'Out $/1M',
    allApis: 'All APIs',
    disable: (name: string) => `Disable ${name}`,
    enableModel: (name: string) => `Enable ${name}`,
    clearAll: 'Clear all',
    searchPlaceholder: 'Search by name or id…',
    count: (shown: number, total: number) => `${shown} / ${total} models`,
    enableShown: (count: number) => `Enable ${count} shown ${count === 1 ? 'model' : 'models'}`,
    noMatch: 'No models match the filters.',
    notInCatalog: 'Not in the catalog, price unknown',
    error: 'Error',
  },
})

/** Renders a plain-string message; lets module-scope column headers follow the locale. */
function Msg({ k }: { k: 'enable' | 'test' | 'inputPrice' | 'outputPrice' }) {
  return useMessages(messages)[k]
}

export type TestState = { status: 'pending' } | { status: 'ok'; ms: number } | { status: 'error'; message: string }

const isFree = (info: CatalogModel | null | undefined) => info?.cost?.input === 0 && info.cost.output === 0

const displayName = (model: ProviderModel) => model.info?.name ?? model.id

type ModelFilter = 'enabled' | 'free' | 'reasoning' | 'vision' | 'tools'

const FILTERS: Array<{ id: ModelFilter; label: 'enabled' | 'free' | 'reasoning' | 'vision' | 'tools'; icon: TablerIcon; match: (model: ProviderModel) => boolean }> = [
  { id: 'enabled', label: 'enabled', icon: IconCheck, match: (m) => m.enabled },
  { id: 'free', label: 'free', icon: IconGift, match: (m) => isFree(m.info) },
  { id: 'reasoning', label: 'reasoning', icon: IconBrain, match: (m) => Boolean(m.info?.reasoning) },
  { id: 'vision', label: 'vision', icon: IconEye, match: (m) => Boolean(m.info?.input.includes('image')) },
  { id: 'tools', label: 'tools', icon: IconTool, match: (m) => Boolean(m.info?.toolCall) },
]

const ALL_APIS = '__all__'

const features = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns: { alphanumeric: sortFn_alphanumeric, text: sortFn_text },
})

const helper = createColumnHelper<typeof features, ProviderModel>()

type RowActions = {
  apis: Array<ModelApi>
  tests: Record<string, TestState>
  canTest: boolean
  onEnable: (ids: Array<string>, enabled: boolean) => void
  onApiChange: (id: string, api: ModelApi) => void
  onTest: (model: ProviderModel) => void
}

/** Row callbacks and test state for the cells, so `columns` can stay at module scope. */
const RowActionsContext = React.createContext<RowActions | null>(null)

const useRowActions = () => React.useContext(RowActionsContext)!

/** Numbers sort largest first on the first click and unknown values always go last. */
const numeric = { sortUndefined: 'last', sortDescFirst: true } as const
const NUMERIC_COLUMNS = new Set(['release', 'updated', 'context', 'output', 'inputPrice', 'outputPrice'])
const RIGHT_COLUMNS = new Set([...NUMERIC_COLUMNS, 'input', 'capabilities', 'weights', 'api', 'test'])

const columns = helper.columns([
  helper.display({
    id: 'enabled',
    header: () => (
      <span className="sr-only">
        <Msg k="enable" />
      </span>
    ),
    cell: ({ row }) => <EnabledCell model={row.original} />,
  }),
  helper.accessor(displayName, {
    id: 'name',
    header: 'Model',
    sortFn: 'alphanumeric',
    cell: ({ row }) => <NameCell model={row.original} />,
  }),
  helper.accessor((m) => m.info?.releaseDate ?? undefined, {
    ...numeric,
    id: 'release',
    header: () => <ColumnLabel k="released" />,
    sortFn: 'text',
    cell: ({ getValue }) => <ReleaseCell date={getValue()} />,
  }),
  helper.accessor((m) => m.info?.context ?? undefined, {
    ...numeric,
    id: 'context',
    header: 'Context',
    cell: ({ getValue }) => formatTokens(getValue() ?? null),
  }),
  helper.accessor((m) => m.info?.output ?? undefined, {
    ...numeric,
    id: 'output',
    header: 'Output',
    cell: ({ getValue }) => formatTokens(getValue() ?? null),
  }),
  helper.accessor((m) => m.info?.cost?.input ?? undefined, {
    ...numeric,
    id: 'inputPrice',
    sortDescFirst: false,
    header: () => <Msg k="inputPrice" />,
    cell: ({ row, getValue }) => <Price value={getValue()} cacheRead={row.original.info?.cost?.cacheRead} />,
  }),
  helper.accessor((m) => m.info?.cost?.output ?? undefined, {
    ...numeric,
    id: 'outputPrice',
    sortDescFirst: false,
    header: () => <Msg k="outputPrice" />,
    cell: ({ getValue }) => <Price value={getValue()} />,
  }),
  helper.display({
    id: 'input',
    header: () => <ColumnLabel k="input" />,
    cell: ({ row }) => <InputCell info={row.original.info} />,
  }),
  helper.display({
    id: 'capabilities',
    header: () => <ColumnLabel k="capabilities" />,
    cell: ({ row }) => <CapabilitiesCell info={row.original.info} />,
  }),
  helper.display({
    id: 'weights',
    header: () => <ColumnLabel k="weights" />,
    cell: ({ row }) => <WeightsCell info={row.original.info} />,
  }),
  helper.accessor((m) => m.info?.lastUpdated ?? undefined, {
    ...numeric,
    id: 'updated',
    header: () => <ColumnLabel k="updated" />,
    sortFn: 'text',
    cell: ({ getValue }) => <ReleaseCell date={getValue()} />,
  }),
  helper.accessor('api', {
    header: 'API',
    sortFn: 'alphanumeric',
    cell: ({ row }) => <ApiCell model={row.original} />,
  }),
  helper.display({
    id: 'test',
    header: () => (
      <span className="sr-only">
        <Msg k="test" />
      </span>
    ),
    cell: ({ row }) => <TestCell model={row.original} />,
  }),
])

/** The checkbox, name and test button stay pinned while the wide table scrolls sideways; `left-10` matches the checkbox width. */
const PINNED: Record<string, string> = {
  enabled: 'sticky left-0',
  name: 'sticky left-10 shadow-[inset_-1px_0_var(--color-border)]',
  test: 'sticky right-0 shadow-[inset_1px_0_var(--color-border)]',
}

function columnClass(columnId: string) {
  if (columnId === 'name') return 'w-full max-w-0 min-w-56'
  if (columnId === 'enabled') return 'w-10 min-w-10 pr-0'
  return cn('w-px', RIGHT_COLUMNS.has(columnId) && 'text-right')
}

export function ProviderModelTable({
  models,
  apis,
  tests,
  canTest,
  onEnable,
  onApiChange,
  onTest,
}: {
  models: Array<ProviderModel>
  /** Wire formats to choose from; with fewer than two the format is shown, not editable. */
  apis: Array<ModelApi>
  tests: Record<string, TestState>
  canTest: boolean
  onEnable: (ids: Array<string>, enabled: boolean) => void
  onApiChange: (id: string, api: ModelApi) => void
  onTest: (model: ProviderModel) => void
}) {
  const t = useMessages(messages)
  const [query, setQuery] = React.useState('')
  const [filters, setFilters] = React.useState<Array<ModelFilter>>([])
  const [apiFilter, setApiFilter] = React.useState<string>(ALL_APIS)

  const enabled = models.filter((m) => m.enabled)
  const available = FILTERS.filter((filter) => filter.id === 'enabled' || models.some(filter.match))
  const active = FILTERS.filter((filter) => filters.includes(filter.id))
  const usedApis = (Object.keys(MODEL_API_LABELS) as Array<ModelApi>).filter((api) => models.some((m) => m.api === api))
  const apiItems = { [ALL_APIS]: t.allApis, ...Object.fromEntries(usedApis.map((api) => [api, MODEL_API_LABELS[api]])) }
  const needle = query.trim().toLowerCase()
  const data = models.filter(
    (m) =>
      (!needle || m.id.toLowerCase().includes(needle) || m.info?.name.toLowerCase().includes(needle)) &&
      (apiFilter === ALL_APIS || m.api === apiFilter) &&
      active.every((filter) => filter.match(m)),
  )
  const hiddenOff = data.filter((m) => !m.enabled)
  const narrowed = Boolean(needle) || active.length > 0 || apiFilter !== ALL_APIS

  const table = useTable({
    features,
    columns,
    data,
    getRowId: (row) => row.id,
    enableSortingRemoval: false,
    initialState: { sorting: [{ id: 'release', desc: true }] },
  })
  const rows = table.getRowModel().rows
  const scrollRef = React.useRef<HTMLDivElement>(null)
  const virtualRows = useVirtualRows({ count: rows.length, scrollRef })

  return (
    <RowActionsContext value={{ apis, tests, canTest, onEnable, onApiChange, onTest }}>
      <div className="flex flex-col gap-3">
        {enabled.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            {enabled.map((model) => (
              <Badge key={model.id} variant="secondary" className="h-6 gap-1 pr-1 pl-2">
                {displayName(model)}
                <button
                  type="button"
                  aria-label={t.disable(displayName(model))}
                  className="rounded-full p-0.5 hover:bg-foreground/10"
                  onClick={() => onEnable([model.id], false)}
                >
                  <IconX className="size-3" />
                </button>
              </Badge>
            ))}
            {enabled.length > 1 && (
              <button
                type="button"
                className="px-1 text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                onClick={() => onEnable(enabled.map((m) => m.id), false)}
              >
                {t.clearAll}
              </button>
            )}
          </div>
        )}

        <div className="flex gap-2">
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t.searchPlaceholder} />
          {usedApis.length > 1 && (
            <Select items={apiItems} value={apiFilter} onValueChange={(value: string | null) => setApiFilter(value ?? ALL_APIS)}>
              <SelectTrigger className="w-52 shrink-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(apiItems).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <ToggleGroup
            multiple
            variant="outline"
            size="sm"
            spacing={1}
            className="flex-wrap"
            value={filters}
            onValueChange={(next: Array<string>) => setFilters(next as Array<ModelFilter>)}
          >
            {available.map((filter) => (
              <ToggleGroupItem key={filter.id} value={filter.id} className="rounded-full text-xs">
                <filter.icon />
                {t[filter.label]}
                <span className="text-muted-foreground tabular-nums">{models.filter(filter.match).length}</span>
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <span className="ml-auto text-xs text-muted-foreground tabular-nums">
            {t.count(data.length, models.length)}
          </span>
          {hiddenOff.length > 0 && narrowed && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-xs"
              onClick={() => onEnable(hiddenOff.map((m) => m.id), true)}
            >
              {t.enableShown(hiddenOff.length)}
            </Button>
          )}
        </div>

        {/* A plain scroll box instead of <Table>, whose own overflow wrapper would unstick the header. */}
        <div ref={scrollRef} className="max-h-[32rem] overflow-auto rounded-xl border bg-card">
          <table className="w-full caption-bottom text-sm">
            <TableHeader className="[&_tr]:border-b-0">
              {table.getHeaderGroups().map((group) => (
                <TableRow key={group.id} className="hover:bg-transparent">
                  {group.headers.map((header) => {
                    const sorted = header.column.getIsSorted()
                    return (
                      <TableHead
                        key={header.id}
                        className={cn(
                          columnClass(header.column.id),
                          'sticky top-0 z-10 bg-card shadow-[inset_0_-1px_0_var(--color-border)]',
                          PINNED[header.column.id],
                          PINNED[header.column.id] && 'z-20',
                        )}
                        aria-sort={sorted === 'asc' ? 'ascending' : sorted === 'desc' ? 'descending' : undefined}
                      >
                        {header.column.getCanSort() ? (
                          <button
                            type="button"
                            onClick={header.column.getToggleSortingHandler()}
                            className={cn(
                              'inline-flex items-center gap-1 hover:text-foreground [&_svg]:size-3',
                              sorted && 'text-foreground',
                            )}
                          >
                            <table.FlexRender header={header} />
                            {sorted === 'asc' ? (
                              <IconArrowUp />
                            ) : sorted === 'desc' ? (
                              <IconArrowDown />
                            ) : (
                              <IconArrowsSort className="opacity-40" />
                            )}
                          </button>
                        ) : (
                          <table.FlexRender header={header} />
                        )}
                      </TableHead>
                    )
                  })}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={columns.length} className="py-8 text-center text-muted-foreground">
                    {t.noMatch}
                  </TableCell>
                </TableRow>
              ) : (
                <>
                  <SpacerRow height={virtualRows.paddingTop} />
                  {virtualRows.items.map((item) => {
                    const row = rows[item.index]
                    return (
                    <TableRow
                      key={row.id}
                      data-index={item.index}
                      ref={virtualRows.measureElement}
                      data-state={row.original.enabled ? 'selected' : undefined}
                      className="group/row cursor-pointer"
                      onClick={(event) => {
                        // Clicking anywhere on the row toggles it, except on its own controls.
                        if ((event.target as HTMLElement).closest('button, [role="checkbox"], [role="combobox"], a, input')) return
                        onEnable([row.original.id], !row.original.enabled)
                      }}
                    >
                      {row.getAllCells().map((cell) => (
                        <TableCell
                          key={cell.id}
                          className={cn(
                            columnClass(cell.column.id),
                            NUMERIC_COLUMNS.has(cell.column.id) && 'tabular-nums',
                            PINNED[cell.column.id] && cn(PINNED[cell.column.id], pinnedBody),
                          )}
                        >
                          <table.FlexRender cell={cell} />
                        </TableCell>
                      ))}
                    </TableRow>
                    )
                  })}
                  <SpacerRow height={virtualRows.paddingBottom} />
                </>
              )}
            </TableBody>
          </table>
        </div>
      </div>
    </RowActionsContext>
  )
}

function SpacerRow({ height }: { height: number }) {
  return height > 0 ? (
    <tr aria-hidden>
      <td style={{ height, padding: 0 }} />
    </tr>
  ) : null
}

function EnabledCell({ model }: { model: ProviderModel }) {
  const t = useMessages(messages)
  const { onEnable } = useRowActions()
  return (
    <Checkbox
      checked={model.enabled}
      aria-label={t.enableModel(displayName(model))}
      onCheckedChange={(next) => onEnable([model.id], next)}
    />
  )
}

function NameCell({ model }: { model: ProviderModel }) {
  const t = useMessages(messages)
  const { tests } = useRowActions()
  const { info } = model
  const test = tests[model.id]
  return (
    <div className="min-w-0">
      <div className="truncate font-medium" title={displayName(model)}>
        {displayName(model)}
      </div>
      <div className="truncate text-xs text-muted-foreground">
        {info ? (
          <span className="font-mono" title={model.id}>
            {model.id}
          </span>
        ) : (
          t.notInCatalog
        )}
      </div>
      {test?.status === 'error' && <p className="truncate text-xs text-destructive">{test.message}</p>}
    </div>
  )
}

function ApiCell({ model }: { model: ProviderModel }) {
  const { apis, onApiChange } = useRowActions()
  if (apis.length < 2) {
    return (
      <span className="text-xs text-muted-foreground" title={MODEL_API_LABELS[model.api]}>
        {MODEL_API_SHORT_LABELS[model.api]}
      </span>
    )
  }
  return (
    <Select
      items={MODEL_API_SHORT_LABELS}
      value={model.api}
      onValueChange={(api: ModelApi | null) => api && onApiChange(model.id, api)}
    >
      <SelectTrigger size="sm" className="ml-auto w-28 text-xs" title={MODEL_API_LABELS[model.api]}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {apis.map((api) => (
          <SelectItem key={api} value={api}>
            {MODEL_API_LABELS[api]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function TestCell({ model }: { model: ProviderModel }) {
  const t = useMessages(messages)
  const { tests, canTest, onTest } = useRowActions()
  const test = tests[model.id]
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={cn(
        'w-18 justify-end px-2 text-xs',
        test?.status === 'ok' && 'text-green-600 dark:text-green-400',
        test?.status === 'error' && 'text-destructive',
      )}
      disabled={!canTest || test?.status === 'pending'}
      onClick={() => onTest(model)}
    >
      {test?.status === 'pending' ? (
        <IconLoader2 className="animate-spin" />
      ) : test?.status === 'ok' ? (
        <>
          <IconCircleCheck />
          {test.ms}ms
        </>
      ) : test?.status === 'error' ? (
        <>
          <IconCircleX />
          {t.error}
        </>
      ) : (
        t.test
      )}
    </Button>
  )
}
