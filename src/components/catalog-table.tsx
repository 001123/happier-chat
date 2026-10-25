import * as React from 'react'
import {
  columnFilteringFeature,
  createColumnHelper,
  createFilteredRowModel,
  createPaginatedRowModel,
  createSortedRowModel,
  filterFn_equals,
  filterFn_includesString,
  globalFilteringFeature,
  rowPaginationFeature,
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
  IconChevronLeft,
  IconChevronRight,
  IconPencil,
} from '@tabler/icons-react'

import { CapabilitiesCell, ColumnLabel, InputCell, pinnedBody, Price, ReleaseCell, WeightsCell } from '@/components/model-info-cells'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { applyOverride, formatTokens } from '@/lib/model-catalog'
import type { AdminCatalogRow, CatalogModel } from '@/lib/model-catalog'
import { cn } from '@/lib/utils'
import { defineMessages, useMessages } from '@/lib/i18n'

const messages = defineMessages({
  vi: {
    edited: 'Đã sửa',
    edit: 'Sửa',
    allProviders: 'Tất cả provider',
    searchPlaceholder: 'Tìm model…',
    empty: 'Chưa có dữ liệu. Bấm “Kiểm tra cập nhật” để tải từ models.dev.',
    noMatch: 'Không có model nào khớp.',
    page: (page: number, total: number) => `Trang ${page} / ${total}`,
    prevPage: 'Trang trước',
    nextPage: 'Trang sau',
  },
  en: {
    edited: 'Edited',
    edit: 'Edit',
    allProviders: 'All providers',
    searchPlaceholder: 'Search models…',
    empty: 'No data yet. Click “Check for updates” to load from models.dev.',
    noMatch: 'No matching models.',
    page: (page: number, total: number) => `Page ${page} / ${total}`,
    prevPage: 'Previous page',
    nextPage: 'Next page',
  },
})

/** Renders a plain-string message; lets module-scope column headers follow the locale. */
function Msg({ k }: { k: 'edited' | 'edit' }) {
  return useMessages(messages)[k]
}

/** One flat row per catalog model, with overrides applied, so every column sorts on a plain value. */
type Row = {
  providerId: string
  id: string
  name: string
  release: string | undefined
  updated: string | undefined
  context: number | undefined
  output: number | undefined
  inputPrice: number | undefined
  outputPrice: number | undefined
  /** The model with overrides applied, for the icon and weights cells. */
  model: CatalogModel
  source: AdminCatalogRow
}

const features = tableFeatures({
  columnFilteringFeature,
  globalFilteringFeature,
  rowSortingFeature,
  rowPaginationFeature,
  filteredRowModel: createFilteredRowModel(),
  sortedRowModel: createSortedRowModel(),
  paginatedRowModel: createPaginatedRowModel(),
  filterFns: { equals: filterFn_equals, includesString: filterFn_includesString },
  sortFns: { alphanumeric: sortFn_alphanumeric, text: sortFn_text },
})

const helper = createColumnHelper<typeof features, Row>()

/** Edit handler for the actions column, so `columns` can stay at module scope. */
const EditContext = React.createContext<(row: AdminCatalogRow) => void>(() => {})

const numeric = { sortUndefined: 'last' } as const
const NUMERIC_COLUMNS = new Set(['release', 'updated', 'context', 'output', 'inputPrice', 'outputPrice'])
const RIGHT_COLUMNS = new Set([...NUMERIC_COLUMNS, 'input', 'capabilities', 'weights'])

const columns = helper.columns([
  helper.accessor('name', {
    header: 'Model',
    sortFn: 'alphanumeric',
    cell: ({ row }) => (
      <div className="max-w-72 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="truncate font-medium" title={row.original.name}>
            {row.original.name}
          </span>
          {row.original.source.override && (
            <Badge variant="outline" className="shrink-0 text-[10px]">
              <Msg k="edited" />
            </Badge>
          )}
        </div>
        <div className="truncate font-mono text-xs text-muted-foreground" title={row.original.id}>
          {row.original.id}
        </div>
      </div>
    ),
  }),
  helper.accessor('providerId', {
    header: 'Provider',
    sortFn: 'alphanumeric',
    filterFn: 'equals',
    cell: ({ getValue }) => <Badge variant="secondary">{getValue()}</Badge>,
  }),
  helper.accessor('release', {
    ...numeric,
    header: () => <ColumnLabel k="released" />,
    sortFn: 'text',
    cell: ({ getValue }) => <ReleaseCell date={getValue()} />,
  }),
  helper.accessor('context', { ...numeric, header: 'Context', cell: ({ getValue }) => formatTokens(getValue() ?? null) }),
  helper.accessor('output', { ...numeric, header: 'Output', cell: ({ getValue }) => formatTokens(getValue() ?? null) }),
  helper.accessor('inputPrice', {
    ...numeric,
    header: 'In $/1M',
    cell: ({ row, getValue }) => <Price value={getValue()} cacheRead={row.original.model.cost?.cacheRead} />,
  }),
  helper.accessor('outputPrice', { ...numeric, header: 'Out $/1M', cell: ({ getValue }) => <Price value={getValue()} /> }),
  helper.display({
    id: 'input',
    header: () => <ColumnLabel k="input" />,
    cell: ({ row }) => <InputCell info={row.original.model} />,
  }),
  helper.display({
    id: 'capabilities',
    header: () => <ColumnLabel k="capabilities" />,
    cell: ({ row }) => <CapabilitiesCell info={row.original.model} />,
  }),
  helper.display({
    id: 'weights',
    header: () => <ColumnLabel k="weights" />,
    cell: ({ row }) => <WeightsCell info={row.original.model} />,
  }),
  helper.accessor('updated', {
    ...numeric,
    header: () => <ColumnLabel k="updated" />,
    sortFn: 'text',
    cell: ({ getValue }) => <ReleaseCell date={getValue()} />,
  }),
  helper.display({
    id: 'actions',
    header: () => (
      <span className="sr-only">
        <Msg k="edit" />
      </span>
    ),
    cell: ({ row }) => <EditButton row={row.original.source} />,
  }),
])

/** The name and edit button stay pinned while the wide table scrolls sideways. */
const PINNED: Record<string, string> = {
  name: 'sticky left-0 shadow-[inset_-1px_0_var(--color-border)]',
  actions: 'sticky right-0 shadow-[inset_1px_0_var(--color-border)]',
}

/** The model column is capped so free width on wide screens spreads over the data columns instead. */
function columnClass(columnId: string) {
  if (columnId === 'name') return 'w-72 min-w-56'
  if (columnId === 'actions') return 'w-px'
  return cn(RIGHT_COLUMNS.has(columnId) && 'text-right')
}

function EditButton({ row }: { row: AdminCatalogRow }) {
  const onEdit = React.useContext(EditContext)
  const t = useMessages(messages)
  return (
    <Button variant="ghost" size="icon-sm" aria-label={t.edit} onClick={() => onEdit(row)}>
      <IconPencil />
    </Button>
  )
}

function toRow(source: AdminCatalogRow): Row {
  const model = applyOverride(source.model, source.override)
  return {
    providerId: source.providerId,
    id: model.id,
    name: model.name,
    release: model.releaseDate ?? undefined,
    updated: model.lastUpdated ?? undefined,
    context: model.context ?? undefined,
    output: model.output ?? undefined,
    inputPrice: model.cost?.input ?? undefined,
    outputPrice: model.cost?.output ?? undefined,
    model,
    source,
  }
}

const ALL = '__all__'

export function CatalogTable({
  rows,
  providers,
  onEdit,
}: {
  rows: Array<AdminCatalogRow>
  providers: Array<string>
  onEdit: (row: AdminCatalogRow) => void
}) {
  const t = useMessages(messages)
  const data = React.useMemo(() => rows.map(toRow), [rows])
  const table = useTable({
    features,
    columns,
    data,
    getRowId: (row) => `${row.providerId}/${row.id}`,
    globalFilterFn: 'includesString',
    // Search matches the model name or id; the id lives in the name column's cell, not its own column.
    getColumnCanGlobalFilter: (column) => column.id === 'name' || column.id === 'providerId',
    initialState: { pagination: { pageIndex: 0, pageSize: 50 }, sorting: [] },
  })

  const providerColumn = table.getColumn('providerId')
  const providerFilter = (providerColumn?.getFilterValue() as string | undefined) ?? ALL
  const providerItems = { [ALL]: t.allProviders, ...Object.fromEntries(providers.map((id) => [id, id])) }
  const filteredCount = table.getFilteredRowModel().rows.length
  const { pageIndex } = table.state.pagination

  return (
    <EditContext value={onEdit}>
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Select
            items={providerItems}
            value={providerFilter}
            onValueChange={(value: string | null) => providerColumn?.setFilterValue(!value || value === ALL ? undefined : value)}
          >
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(providerItems).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            value={(table.state.globalFilter as string | undefined) ?? ''}
            onChange={(event) => table.setGlobalFilter(event.target.value)}
            placeholder={t.searchPlaceholder}
            className="max-w-xs flex-1"
          />
          <span className="text-sm text-muted-foreground tabular-nums">{filteredCount} model</span>
        </div>

        <div className="overflow-hidden rounded-xl border bg-card">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((group) => (
                <TableRow key={group.id}>
                  {group.headers.map((header) => {
                    const sorted = header.column.getIsSorted()
                    return (
                      <TableHead
                        key={header.id}
                        className={cn(columnClass(header.column.id), PINNED[header.column.id] && cn(PINNED[header.column.id], 'z-10 bg-card'))}
                      >
                        {header.column.getCanSort() ? (
                          <button
                            type="button"
                            onClick={header.column.getToggleSortingHandler()}
                            className="inline-flex items-center gap-1 hover:text-foreground [&_svg]:size-3"
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
              {table.getRowModel().rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={columns.length} className="py-8 text-center text-muted-foreground">
                    {rows.length === 0
                      ? t.empty
                      : t.noMatch}
                  </TableCell>
                </TableRow>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id} className="group/row">
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
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {table.getPageCount() > 1 && (
          <div className="flex items-center justify-end gap-2 text-sm text-muted-foreground tabular-nums">
            <span>
              {t.page(pageIndex + 1, table.getPageCount())}
            </span>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={t.prevPage}
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              <IconChevronLeft />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={t.nextPage}
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              <IconChevronRight />
            </Button>
          </div>
        )}
      </div>
    </EditContext>
  )
}
