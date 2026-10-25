import {
  IconCalendar,
  IconCloud,
  IconCloudRain,
  IconCloudStorm,
  IconDroplets,
  IconMapPin,
  IconSun,
  IconTemperature,
  IconWind,
} from '@tabler/icons-react'
import type { TablerIcon } from '@tabler/icons-react'
import { cn } from 'cn'

import { LOCALE_TAGS, defineMessages, useLocale, useMessages } from '@/lib/i18n'
import { weatherSchema } from '@/lib/tools'
import type { Weather, WeatherCondition } from '@/lib/tools'

const messages = defineMessages({
  vi: {
    today: 'Hôm nay',
    yesterday: 'Hôm qua',
    tomorrow: 'Ngày mai',
    now: 'Bây giờ',
    nowAt: (time: string) => `Bây giờ ${time}`,
    high: 'C',
    low: 'T',
    feelsLike: 'Cảm giác',
    humidity: 'Độ ẩm',
    wind: 'Gió',
    hourlyTitle: 'Nhiệt độ 24 giờ',
    searching: 'Đang tìm…',
    loading: 'Đang lấy dữ liệu thời tiết…',
  },
  en: {
    today: 'Today',
    yesterday: 'Yesterday',
    tomorrow: 'Tomorrow',
    now: 'Now',
    nowAt: (time: string) => `Now ${time}`,
    high: 'H',
    low: 'L',
    feelsLike: 'Feels like',
    humidity: 'Humidity',
    wind: 'Wind',
    hourlyTitle: '24-hour temperature',
    searching: 'Searching…',
    loading: 'Fetching weather data…',
  },
})

const THEME: Record<WeatherCondition, { icon: TablerIcon; bg: string; glow: string }> = {
  sunny: {
    icon: IconSun,
    bg: 'from-sky-400 via-sky-500 to-blue-600',
    glow: 'bg-amber-300/70',
  },
  cloudy: {
    icon: IconCloud,
    bg: 'from-slate-400 via-slate-500 to-slate-700',
    glow: 'bg-white/30',
  },
  rain: {
    icon: IconCloudRain,
    bg: 'from-indigo-500 via-blue-700 to-slate-800',
    glow: 'bg-sky-300/30',
  },
  storm: {
    icon: IconCloudStorm,
    bg: 'from-slate-700 via-indigo-900 to-slate-950',
    glow: 'bg-violet-400/30',
  },
  windy: {
    icon: IconWind,
    bg: 'from-teal-400 via-cyan-600 to-sky-700',
    glow: 'bg-white/30',
  },
}

export function parseWeather(output: unknown): Weather | null {
  let value = output
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value)
    } catch {
      return null
    }
  }
  const parsed = weatherSchema.safeParse(value)
  return parsed.success ? parsed.data : null
}

function parseDate(date: string) {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(y!, m! - 1, d!)
}

function dayLabel(date: Date, t: (typeof messages)['vi']) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diff = Math.round((date.getTime() - today.getTime()) / 86_400_000)
  if (diff === 0) return t.today
  if (diff === -1) return t.yesterday
  if (diff === 1) return t.tomorrow
  return null
}

const hh = (hour: number) => `${String(hour).padStart(2, '0')}:00`

export function WeatherCard({ weather }: { weather: Weather }) {
  const t = useMessages(messages)
  const tag = LOCALE_TAGS[useLocale()]
  const theme = THEME[weather.condition]
  const Icon = theme.icon
  const date = parseDate(weather.date)
  const relative = dayLabel(date, t)
  const currentHour = relative === t.today ? new Date().getHours() : null

  return (
    <div
      className={cn(
        'relative isolate w-full max-w-md overflow-hidden rounded-3xl bg-linear-to-br p-5 text-white shadow-lg shadow-black/10 animate-in fade-in zoom-in-95 duration-200',
        theme.bg,
      )}
    >
      <div
        aria-hidden
        className={cn('absolute -top-16 -right-12 -z-10 size-48 rounded-full blur-3xl', theme.glow)}
      />

      <div className="mb-4 flex items-center justify-between gap-2 border-b border-white/20 pb-3 text-sm">
        <p className="flex min-w-0 items-center gap-1.5 font-medium">
          <IconCalendar className="size-4 shrink-0" />
          <span className="truncate first-letter:uppercase">
            {date.toLocaleDateString(tag, {
              weekday: 'long',
              day: 'numeric',
              month: 'numeric',
              year: 'numeric',
            })}
          </span>
        </p>
        {relative && (
          <span className="shrink-0 rounded-full bg-white/20 px-2 py-0.5 text-xs font-semibold">
            {relative}
          </span>
        )}
      </div>

      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="flex items-center gap-1 text-sm font-medium text-white/85">
            <IconMapPin className="size-3.5 shrink-0" />
            <span className="truncate">{weather.city}</span>
          </p>
          <p className="mt-1 text-6xl font-extralight tracking-tight tabular-nums">
            {weather.temperature}°
          </p>
          <p className="mt-1 text-base font-medium">{weather.conditionLabel}</p>
          <p className="text-sm text-white/75 tabular-nums">
            {t.high}: {weather.high}° · {t.low}: {weather.low}°
          </p>
        </div>
        <Icon
          className={cn(
            'size-20 shrink-0 drop-shadow-md',
            weather.condition === 'sunny' && 'text-amber-200 animate-[spin_30s_linear_infinite]',
          )}
          stroke={1.25}
        />
      </div>

      <div className="mt-5 grid grid-cols-3 gap-2">
        <Stat icon={IconTemperature} label={t.feelsLike} value={`${weather.feelsLike}°`} />
        <Stat icon={IconDroplets} label={t.humidity} value={`${weather.humidity}%`} />
        <Stat icon={IconWind} label={t.wind} value={`${weather.windKph} km/h`} />
      </div>

      <HourlyStrip hourly={weather.hourly} currentHour={currentHour} />
    </div>
  )
}

function HourlyStrip({
  hourly,
  currentHour,
}: {
  hourly: Weather['hourly']
  currentHour: number | null
}) {
  const t = useMessages(messages)
  const tag = LOCALE_TAGS[useLocale()]
  return (
    <div className="@container mt-3 rounded-2xl bg-white/12 p-2 backdrop-blur-sm">
      <p className="mb-1.5 flex items-center justify-between px-1.5 pt-0.5 text-[0.6875rem] font-medium tracking-wide text-white/70 uppercase">
        <span>{t.hourlyTitle}</span>
        {currentHour !== null && (
          <span className="normal-case tabular-nums">
            {t.nowAt(new Date().toLocaleTimeString(tag, { hour: '2-digit', minute: '2-digit', hour12: false }))}
          </span>
        )}
      </p>
      <div className="grid grid-cols-4 gap-0.5 @xs:grid-cols-6">
        {hourly.map((h) => {
          const HourIcon = THEME[h.condition].icon
          const isNow = h.hour === currentHour
          const isPast = currentHour !== null && h.hour < currentHour
          return (
            <div
              key={h.hour}
              aria-current={isNow ? 'time' : undefined}
              className={cn(
                'flex flex-col items-center gap-1 rounded-xl py-1.5 text-xs transition-colors',
                isNow && 'bg-white text-slate-900 shadow-md',
                isPast && 'opacity-55',
              )}
            >
              <span className={cn('tabular-nums', isNow ? 'font-semibold' : 'text-white/80')}>
                {isNow ? t.now : hh(h.hour)}
              </span>
              <HourIcon className="size-4" stroke={1.5} />
              <span className="font-semibold tabular-nums">{h.temperature}°</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function Stat({ icon: Icon, label, value }: { icon: TablerIcon; label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/12 px-3 py-2.5 backdrop-blur-sm">
      <p className="flex items-center gap-1 text-[0.6875rem] font-medium tracking-wide text-white/70 uppercase">
        <Icon className="size-3" />
        {label}
      </p>
      <p className="mt-0.5 text-sm font-semibold tabular-nums">{value}</p>
    </div>
  )
}

export function WeatherCardSkeleton({ city, progress }: { city?: string; progress?: string }) {
  const t = useMessages(messages)
  return (
    <div className="relative w-full max-w-md overflow-hidden rounded-3xl bg-linear-to-br from-sky-300/60 via-sky-400/60 to-blue-500/60 p-5 text-white">
      <div className="absolute inset-0 -translate-x-full animate-[weather-shimmer_1.6s_infinite] bg-linear-to-r from-transparent via-white/20 to-transparent" />
      <p className="flex items-center gap-1 text-sm font-medium text-white/90">
        <IconMapPin className="size-3.5" />
        {city ?? t.searching}
      </p>
      <div className="mt-3 h-14 w-24 rounded-xl bg-white/25" />
      <div className="mt-3 h-4 w-32 rounded bg-white/25" />
      <div className="mt-5 grid grid-cols-3 gap-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-14 rounded-2xl bg-white/15" />
        ))}
      </div>
      <p className="mt-3 text-xs text-white/90">{progress ?? t.loading}</p>
    </div>
  )
}
