import * as React from 'react'
import { keepPreviousData, queryOptions, useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { IconTrendingUp } from '@tabler/icons-react'
import { cn } from 'cn'

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { defineMessages, getLocale, LOCALE_TAGS, useLocale, useMessages } from '@/lib/i18n'
import { formatTokens } from '@/lib/model-catalog'
import { USAGE_PERIODS } from '@/lib/usage'
import type { UsageKind, UsagePeriod, UsageSummary } from '@/lib/usage'
import { errorMessage } from '@/lib/utils'
import { getUsageSummary } from '@/server/usage.functions'

const messages = defineMessages({
  vi: {
    title: 'Thống kê sử dụng · Cài đặt · Happier Chat',
    heading: 'Thống kê sử dụng',
    intro: 'Token và chi phí ước tính của chat và giọng đọc, tính theo giá danh mục model lúc gọi.',
    period: (days: number) => (days ? `${days} ngày` : 'Tất cả'),
    totalTokens: 'Tổng token',
    totalCost: 'Tổng chi phí',
    chat: 'Chat',
    tts: 'Giọng đọc',
    calls: (n: string) => `${n} lần gọi`,
    chars: (n: string) => `${n} ký tự`,
    unpriced: (n: string) => `thiếu giá ${n} lần gọi`,
    dailyCost: 'Chi phí theo ngày',
    byModel: 'Theo model',
    model: 'Model',
    kind: 'Loại',
    input: 'Input',
    output: 'Output',
    cache: 'Cache đọc / ghi',
    cost: 'Chi phí',
    callsHeader: 'Lần gọi',
    free: 'Miễn phí',
    empty: 'Chưa có lần gọi nào trong khoảng này.',
    priceChange: (name: string, date: string) => `${name} đổi giá từ ${date}.`,
    priceProjection: (now: string, next: string) =>
      `Nếu dùng như 30 ngày qua: khoảng ${next}/tháng (hiện ${now}/tháng).`,
    note: 'Chi phí là ước tính. Lần gọi chưa có giá trong danh mục không được tính vào tổng; admin có thể thêm giá trong Quản trị → Model.',
  },
  en: {
    title: 'Usage · Settings · Happier Chat',
    heading: 'Usage',
    intro: 'Tokens and estimated cost of chat and speech, priced from the model catalog at the time of each call.',
    period: (days: number) => (days ? `${days} days` : 'All time'),
    totalTokens: 'Total tokens',
    totalCost: 'Total cost',
    chat: 'Chat',
    tts: 'Speech',
    calls: (n: string) => `${n} calls`,
    chars: (n: string) => `${n} characters`,
    unpriced: (n: string) => `${n} calls missing price`,
    dailyCost: 'Cost per day',
    byModel: 'By model',
    model: 'Model',
    kind: 'Kind',
    input: 'Input',
    output: 'Output',
    cache: 'Cache read / write',
    cost: 'Cost',
    callsHeader: 'Calls',
    free: 'Free',
    empty: 'No calls in this period yet.',
    priceChange: (name: string, date: string) => `${name} changes price on ${date}.`,
    priceProjection: (now: string, next: string) =>
      `At your last 30 days of use: about ${next}/month (now ${now}/month).`,
    note: 'Costs are estimates. Calls without a catalog price are left out of the totals; an admin can add prices in Administration → Models.',
  },
})

const usageQuery = (days: UsagePeriod) =>
  queryOptions({ queryKey: ['usage', days], queryFn: () => getUsageSummary({ data: { days } }), placeholderData: keepPreviousData })

export const Route = createFileRoute('/_app/settings/usage')({
  head: () => ({ meta: [{ title: messages[getLocale()].title }] }),
  component: UsagePage,
})

const KINDS: Array<UsageKind> = ['chat', 'tts']

// Validated as a categorical pair against the light (#fcfcfb) and dark (#30302e) surfaces.
const KIND_COLOR: Record<UsageKind, string> = {
  chat: 'bg-[#b4532f] dark:bg-[#d0623b]',
  tts: 'bg-[#9c87f5] dark:bg-[#8f78ec]',
}

const usd = (n: number | null | undefined) =>
  n == null ? '—' : `$${n.toLocaleString('en-US', { maximumFractionDigits: n === 0 ? 0 : n < 0.01 ? 5 : n < 1 ? 4 : 2 })}`

function UsagePage() {
  const t = useMessages(messages)
  const locale = useLocale()
  const num = (n: number) => n.toLocaleString(LOCALE_TAGS[locale])
  const [days, setDays] = React.useState<UsagePeriod>(30)
  const { data, error, isPending } = useQuery(usageQuery(days))

  const totals = React.useMemo(() => {
    const byKind = { chat: emptyTotal(), tts: emptyTotal() }
    for (const row of data?.models ?? []) {
      const total = byKind[row.kind]
      total.tokens += row.inputTokens + row.outputTokens
      total.cost += row.cost ?? 0
      total.calls += row.calls
      total.unpriced += row.unpriced
      total.chars += row.chars
    }
    return byKind
  }, [data])
  const all = {
    tokens: totals.chat.tokens + totals.tts.tokens,
    cost: totals.chat.cost + totals.tts.cost,
    unpriced: totals.chat.unpriced + totals.tts.unpriced,
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-serif text-2xl tracking-tight">{t.heading}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t.intro}</p>
        </div>
        <ToggleGroup
          variant="outline"
          size="sm"
          spacing={1}
          value={[String(days)]}
          onValueChange={(next: Array<string>) => next[0] && setDays(Number(next[0]) as UsagePeriod)}
        >
          {USAGE_PERIODS.map((period) => (
            <ToggleGroupItem key={period} value={String(period)} className="rounded-full text-xs">
              {t.period(period)}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {errorMessage(error)}
        </p>
      )}

      <div className={cn('grid grid-cols-2 gap-3 transition-opacity md:grid-cols-4', isPending && 'opacity-50')}>
        <Stat label={t.totalTokens} value={formatTokens(all.tokens)} hint={num(all.tokens)} />
        <Stat label={t.totalCost} value={usd(all.cost)} hint={all.unpriced ? t.unpriced(num(all.unpriced)) : undefined} />
        <Stat
          label={t.chat}
          kind="chat"
          value={usd(totals.chat.cost)}
          hint={`${formatTokens(totals.chat.tokens)} token · ${t.calls(num(totals.chat.calls))}`}
        />
        <Stat
          label={t.tts}
          kind="tts"
          value={usd(totals.tts.cost)}
          hint={`${formatTokens(totals.tts.tokens)} token · ${t.chars(num(totals.tts.chars))}`}
        />
      </div>

      {data?.upcoming.map((change) => (
        <div key={`${change.kind}:${change.model}`} role="status" className="flex gap-3 rounded-xl border bg-card p-4 text-sm">
          <IconTrendingUp className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <div>
            <div className="font-medium">
              {t.priceChange(
                change.name,
                new Date(change.effectiveFrom).toLocaleDateString(LOCALE_TAGS[locale], { timeZone: 'UTC' }),
              )}
            </div>
            <div className="mt-0.5 text-muted-foreground">
              {t.priceProjection(usd(change.currentMonthly), usd(change.nextMonthly))}
            </div>
          </div>
        </div>
      ))}

      {data && data.models.length === 0 ? (
        <p className="rounded-xl border bg-card p-6 text-center text-sm text-muted-foreground">{t.empty}</p>
      ) : (
        data && (
          <>
            <section className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-4">
                <h3 className="text-sm font-medium">{t.dailyCost}</h3>
                <div className="flex gap-4 text-xs text-muted-foreground">
                  {KINDS.map((kind) => (
                    <span key={kind} className="flex items-center gap-1.5">
                      <span className={cn('size-2.5 rounded-sm', KIND_COLOR[kind])} />
                      {t[kind]}
                    </span>
                  ))}
                </div>
              </div>
              <DailyChart daily={data.daily} days={days} labels={{ chat: t.chat, tts: t.tts }} />
            </section>

            <section className="flex flex-col gap-3">
              <h3 className="text-sm font-medium">{t.byModel}</h3>
              <div className="rounded-xl border bg-card">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t.model}</TableHead>
                      <TableHead>{t.kind}</TableHead>
                      <TableHead className="text-right">{t.callsHeader}</TableHead>
                      <TableHead className="text-right">{t.input}</TableHead>
                      <TableHead className="text-right">{t.output}</TableHead>
                      <TableHead className="text-right">{t.cache}</TableHead>
                      <TableHead className="text-right">{t.cost}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.models.map((row) => (
                      <TableRow key={`${row.kind}:${row.provider}:${row.model}`}>
                        <TableCell>
                          <div className="font-mono text-xs">{row.model}</div>
                          <div className="text-xs text-muted-foreground">{row.provider}</div>
                        </TableCell>
                        <TableCell>
                          <span className="flex items-center gap-1.5 text-xs">
                            <span className={cn('size-2 rounded-sm', KIND_COLOR[row.kind])} />
                            {t[row.kind]}
                          </span>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{num(row.calls)}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {row.inputTokens === 0 && row.chars > 0 ? t.chars(num(row.chars)) : num(row.inputTokens)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{num(row.outputTokens)}</TableCell>
                        <TableCell className="text-right text-muted-foreground tabular-nums">
                          {row.cacheReadTokens || row.cacheWriteTokens
                            ? `${formatTokens(row.cacheReadTokens)} / ${formatTokens(row.cacheWriteTokens)}`
                            : '—'}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {row.kind === 'tts' && row.cost === 0 ? t.free : usd(row.cost)}
                          {row.unpriced > 0 && (
                            <div className="text-xs text-muted-foreground">{t.unpriced(num(row.unpriced))}</div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <p className="text-xs text-muted-foreground">{t.note}</p>
            </section>
          </>
        )
      )}
    </div>
  )
}

function emptyTotal() {
  return { tokens: 0, cost: 0, calls: 0, unpriced: 0, chars: 0 }
}

function Stat({ label, value, hint, kind }: { label: string; value: React.ReactNode; hint?: string; kind?: UsageKind }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {kind && <span className={cn('size-2 rounded-sm', KIND_COLOR[kind])} />}
        {label}
      </div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
      {hint && <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div>}
    </div>
  )
}

const DAY = 24 * 60 * 60 * 1000

/** `YYYY-MM-DD` in local time, matching the server's `date(..., 'localtime')`. */
function dayKey(time: number) {
  const date = new Date(time)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

/** Every day of the period, empty ones included, so gaps in use read as gaps on the axis. */
function dayRange(daily: UsageSummary['daily'], days: UsagePeriod) {
  const first = days ? Date.now() - (days - 1) * DAY : daily[0] ? new Date(`${daily[0].day}T00:00`).getTime() : Date.now()
  const keys: Array<string> = []
  for (let time = first; dayKey(time) <= dayKey(Date.now()); time += DAY) keys.push(dayKey(time))
  return keys
}

/** Rounds a maximum up to a clean axis top: 1, 2 or 5 times a power of ten. */
function niceMax(value: number) {
  if (value <= 0) return 1
  const power = 10 ** Math.floor(Math.log10(value))
  return ([1, 2, 5, 10].find((step) => step * power >= value) ?? 10) * power
}

function DailyChart({
  daily,
  days,
  labels,
}: {
  daily: UsageSummary['daily']
  days: UsagePeriod
  labels: Record<UsageKind, string>
}) {
  const locale = useLocale()
  const bars = React.useMemo(() => {
    const byDay = new Map<string, Record<UsageKind, { cost: number; tokens: number }>>()
    for (const entry of daily) {
      const day = byDay.get(entry.day) ?? { chat: { cost: 0, tokens: 0 }, tts: { cost: 0, tokens: 0 } }
      day[entry.kind] = { cost: entry.cost, tokens: entry.tokens }
      byDay.set(entry.day, day)
    }
    return dayRange(daily, days).map((day) => ({ day, values: byDay.get(day) ?? null }))
  }, [daily, days])
  const top = niceMax(Math.max(...bars.map((bar) => (bar.values ? bar.values.chat.cost + bar.values.tts.cost : 0))))
  const formatDay = (day: string) =>
    new Date(`${day}T00:00`).toLocaleDateString(LOCALE_TAGS[locale], { day: 'numeric', month: 'short' })
  const ticks = [top, top / 2, 0]

  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex gap-3">
        <div className="flex h-40 flex-col justify-between text-right text-[11px] text-muted-foreground tabular-nums">
          {ticks.map((tick) => (
            <span key={tick} className="-my-1.5">
              {usd(tick)}
            </span>
          ))}
        </div>
        <div className="relative h-40 flex-1">
          {ticks.map((tick, i) => (
            <div key={tick} className="absolute inset-x-0 border-t border-border" style={{ top: `${(i / 2) * 100}%` }} />
          ))}
          <div className="absolute inset-0 flex items-end">
            {bars.map(({ day, values }) => {
              const segments = KINDS.filter((kind) => values && values[kind].cost > 0)
              return (
                <Tooltip key={day}>
                  <TooltipTrigger
                    render={<div className="flex h-full min-w-0 flex-1 flex-col items-center justify-end hover:bg-muted/50" />}
                  >
                    {/* Top segment first: a column stacks down from the cap to the baseline. */}
                    {[...segments].reverse().map((kind, i) => (
                      <div
                        key={kind}
                        className={cn('w-full max-w-6', KIND_COLOR[kind], i === 0 && 'rounded-t', i > 0 && 'mt-0.5')}
                        style={{ height: `${(values![kind].cost / top) * 100}%` }}
                      />
                    ))}
                  </TooltipTrigger>
                  <TooltipContent className="flex-col items-stretch gap-1 py-2">
                    <div className="mb-0.5 opacity-70">{formatDay(day)}</div>
                    {KINDS.map((kind) => (
                      <div key={kind} className="flex items-center justify-between gap-6">
                        <span className="flex items-center gap-1.5 opacity-70">
                          <span className={cn('size-2 rounded-sm', KIND_COLOR[kind])} />
                          {labels[kind]}
                        </span>
                        <span className="tabular-nums">
                          {usd(values?.[kind].cost ?? 0)} · {formatTokens(values?.[kind].tokens ?? 0)}
                        </span>
                      </div>
                    ))}
                  </TooltipContent>
                </Tooltip>
              )
            })}
          </div>
        </div>
      </div>
      <div className="mt-2 flex justify-between pl-14 text-[11px] text-muted-foreground">
        <span>{bars[0] && formatDay(bars[0].day)}</span>
        <span>{bars.length > 2 && formatDay(bars[Math.floor(bars.length / 2)]!.day)}</span>
        <span>{bars.length > 1 && formatDay(bars[bars.length - 1]!.day)}</span>
      </div>
    </div>
  )
}
