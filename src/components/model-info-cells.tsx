import { IconBraces, IconBrain, IconFileText, IconLetterT, IconPhoto, IconTemperature, IconTool, IconVideo, IconVolume } from '@tabler/icons-react'
import type { TablerIcon } from '@tabler/icons-react'
import { cn } from 'cn'

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { defineMessages, LOCALE_TAGS, useLocale, useMessages } from '@/lib/i18n'
import type { Locale } from '@/lib/i18n'
import { formatPrice } from '@/lib/model-catalog'
import type { CatalogModel } from '@/lib/model-catalog'

/** Cells shared by the provider model table and the admin catalog table, so both read the same. */

const messages = defineMessages({
  vi: {
    released: 'Phát hành',
    updated: 'Cập nhật',
    input: 'Đầu vào',
    capabilities: 'Khả năng',
    weights: 'Weights',
    openWeights: 'Open',
    closedWeights: 'Closed',
    cacheRead: (price: string) => `cache ${price}`,
    cacheReadTitle: 'Giá đọc cache $/1M',
    modality: { text: 'Văn bản', image: 'Hình ảnh', audio: 'Âm thanh', video: 'Video', pdf: 'PDF' },
    capability: {
      reasoning: 'Reasoning: suy luận trước khi trả lời',
      toolCall: 'Tools: gọi tool (function calling)',
      structuredOutput: 'Structured output: trả JSON theo schema',
      temperature: 'Chỉnh được temperature',
    },
    supported: 'có',
    unsupported: 'không',
    unknown: 'chưa rõ',
  },
  en: {
    released: 'Released',
    updated: 'Updated',
    input: 'Input',
    capabilities: 'Capabilities',
    weights: 'Weights',
    openWeights: 'Open',
    closedWeights: 'Closed',
    cacheRead: (price: string) => `cache ${price}`,
    cacheReadTitle: 'Cache read $/1M',
    modality: { text: 'Text', image: 'Image', audio: 'Audio', video: 'Video', pdf: 'PDF' },
    capability: {
      reasoning: 'Reasoning: thinks before answering',
      toolCall: 'Tools: supports tool (function) calling',
      structuredOutput: 'Structured output: returns JSON matching a schema',
      temperature: 'Temperature is adjustable',
    },
    supported: 'yes',
    unsupported: 'no',
    unknown: 'unknown',
  },
})

/** Header text for the shared columns; lets module-scope column headers follow the locale. */
export function ColumnLabel({ k }: { k: 'released' | 'updated' | 'input' | 'capabilities' | 'weights' }) {
  return useMessages(messages)[k]
}

/** `2026-10-05` → `05/10/2026`; models.dev sometimes gives only `2026-10`, shown as `10/2026`. */
const formatRelease = (date: string) => date.split('-').reverse().join('/')

/** How long ago a model came out, in the largest unit that fits: `3 tuần trước`. */
function releaseAge(date: string, locale: Locale) {
  const relativeTime = new Intl.RelativeTimeFormat(LOCALE_TAGS[locale], { numeric: 'auto' })
  const days = Math.round((Date.parse(date) - Date.now()) / 86_400_000)
  if (Number.isNaN(days)) return null
  if (Math.abs(days) < 7) return relativeTime.format(days, 'day')
  if (Math.abs(days) < 30) return relativeTime.format(Math.round(days / 7), 'week')
  if (Math.abs(days) < 365) return relativeTime.format(Math.round(days / 30), 'month')
  return relativeTime.format(Math.round(days / 365), 'year')
}

export function ReleaseCell({ date }: { date: string | undefined }) {
  const locale = useLocale()
  if (!date) return <span className="text-muted-foreground">—</span>
  return (
    <div className="flex flex-col items-end whitespace-nowrap">
      <span>{formatRelease(date)}</span>
      <span className="text-xs text-muted-foreground">{releaseAge(date, locale)}</span>
    </div>
  )
}

/** A fixed row of icons, lit when supported and faded otherwise, so the column scans like a grid. */
function IconSlots({ slots }: { slots: Array<{ key: string; icon: TablerIcon; label: string; on: boolean | null | undefined }> }) {
  const t = useMessages(messages)
  return (
    <div className="flex justify-end gap-1.5 [&_svg]:size-3.5">
      {slots.map(({ key, icon: Icon, label, on }) => {
        const state = on ? t.supported : on === false ? t.unsupported : t.unknown
        return (
          <Tooltip key={key}>
            <TooltipTrigger
              render={<span className={cn('inline-flex cursor-help', on ? 'text-foreground' : 'text-muted-foreground/30')} />}
            >
              <Icon aria-label={`${label}: ${state}`} />
            </TooltipTrigger>
            <TooltipContent>
              {label}: {state}
            </TooltipContent>
          </Tooltip>
        )
      })}
    </div>
  )
}

const MODALITIES = [
  { key: 'text', icon: IconLetterT },
  { key: 'image', icon: IconPhoto },
  { key: 'audio', icon: IconVolume },
  { key: 'video', icon: IconVideo },
  { key: 'pdf', icon: IconFileText },
] as const

export function InputCell({ info }: { info: CatalogModel | null | undefined }) {
  const t = useMessages(messages)
  if (!info) return <span className="text-muted-foreground">—</span>
  return (
    <IconSlots
      slots={MODALITIES.map(({ key, icon }) => ({ key, icon, label: t.modality[key], on: info.input.includes(key) }))}
    />
  )
}

const CAPABILITIES = [
  { key: 'reasoning', icon: IconBrain },
  { key: 'toolCall', icon: IconTool },
  { key: 'structuredOutput', icon: IconBraces },
  { key: 'temperature', icon: IconTemperature },
] as const

export function CapabilitiesCell({ info }: { info: CatalogModel | null | undefined }) {
  const t = useMessages(messages)
  if (!info) return <span className="text-muted-foreground">—</span>
  return (
    <IconSlots slots={CAPABILITIES.map(({ key, icon }) => ({ key, icon, label: t.capability[key], on: info[key] }))} />
  )
}

export function WeightsCell({ info }: { info: CatalogModel | null | undefined }) {
  const t = useMessages(messages)
  if (!info) return <span className="text-muted-foreground">—</span>
  return info.openWeights ? (
    <span className="text-xs">{t.openWeights}</span>
  ) : (
    <span className="text-xs text-muted-foreground">{t.closedWeights}</span>
  )
}


export function Price({ value, cacheRead }: { value: number | undefined; cacheRead?: number | null }) {
  const t = useMessages(messages)
  if (value === undefined) return <span className="text-muted-foreground">—</span>
  return (
    <div className="flex flex-col items-end">
      <span className={cn(value === 0 && 'text-green-600 dark:text-green-400')}>{formatPrice(value)}</span>
      {cacheRead != null && cacheRead !== value && (
        <span className="text-xs text-muted-foreground" title={t.cacheReadTitle}>
          {t.cacheRead(formatPrice(cacheRead))}
        </span>
      )}
    </div>
  )
}


/** Pinned cells need an opaque fill that follows the row's hover and selected tints. */
export const pinnedBody =
  'z-[5] bg-card group-hover/row:bg-[color-mix(in_oklab,var(--color-muted)_50%,var(--color-card))] group-data-[state=selected]/row:bg-muted'
