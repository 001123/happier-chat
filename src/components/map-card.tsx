import { IconExternalLink, IconMapPin, IconNavigation } from '@tabler/icons-react'

import { defineMessages, getLocale, useMessages } from '@/lib/i18n'
import { mapLocationSchema } from '@/lib/tools'
import type { MapLocation } from '@/lib/tools'

const messages = defineMessages({
  vi: {
    mapTitle: (name: string) => `Bản đồ ${name}`,
    openMaps: 'Mở Google Maps',
    directions: 'Chỉ đường',
    searching: 'Đang tìm…',
    locating: 'Đang tìm vị trí trên bản đồ…',
  },
  en: {
    mapTitle: (name: string) => `Map of ${name}`,
    openMaps: 'Open Google Maps',
    directions: 'Directions',
    searching: 'Searching…',
    locating: 'Locating on the map…',
  },
})

export function parseMapLocation(output: unknown): MapLocation | null {
  let value = output
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value)
    } catch {
      return null
    }
  }
  const parsed = mapLocationSchema.safeParse(value)
  return parsed.success ? parsed.data : null
}

function target(location: MapLocation) {
  return location.lat !== null && location.lng !== null ? `${location.lat},${location.lng}` : location.query
}

function embedUrl(location: MapLocation) {
  const params = new URLSearchParams({ q: target(location), z: String(location.zoom), hl: getLocale(), output: 'embed' })
  return `https://maps.google.com/maps?${params}`
}

function placeUrl(location: MapLocation) {
  return `https://www.google.com/maps/search/?${new URLSearchParams({ api: '1', query: target(location) })}`
}

function directionsUrl(location: MapLocation) {
  return `https://www.google.com/maps/dir/?${new URLSearchParams({ api: '1', destination: target(location) })}`
}

export function MapCard({ location }: { location: MapLocation }) {
  const t = useMessages(messages)
  return (
    <div className="w-full max-w-xl overflow-hidden rounded-3xl border border-border bg-card text-card-foreground shadow-lg shadow-black/5 animate-in fade-in zoom-in-95 duration-200">
      <div className="flex items-start gap-3 p-4">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-red-500/10 text-red-500">
          <IconMapPin className="size-4.5" />
        </div>
        <div className="min-w-0">
          <p className="truncate font-semibold">{location.name}</p>
          {location.address && (
            <p className="line-clamp-2 text-sm text-muted-foreground">{location.address}</p>
          )}
          {location.lat !== null && location.lng !== null && (
            <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
              {location.lat.toFixed(5)}, {location.lng.toFixed(5)}
            </p>
          )}
        </div>
      </div>

      <iframe
        title={t.mapTitle(location.name)}
        src={embedUrl(location)}
        className="aspect-4/3 w-full border-y border-border bg-muted sm:aspect-video"
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        allowFullScreen
      />

      <div className="flex gap-2 p-3">
        <a
          href={placeUrl(location)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full bg-secondary px-3 py-2 text-sm font-medium text-secondary-foreground transition-colors hover:bg-secondary/80"
        >
          <IconExternalLink className="size-4" />
          {t.openMaps}
        </a>
        <a
          href={directionsUrl(location)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <IconNavigation className="size-4" />
          {t.directions}
        </a>
      </div>
    </div>
  )
}

export function MapCardSkeleton({ query }: { query?: string }) {
  const t = useMessages(messages)
  return (
    <div className="w-full max-w-xl overflow-hidden rounded-3xl border border-border bg-card">
      <div className="flex items-center gap-3 p-4">
        <div className="flex size-9 items-center justify-center rounded-full bg-muted">
          <IconMapPin className="size-4.5 animate-bounce text-muted-foreground" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{query ?? t.searching}</p>
          <p className="text-sm text-muted-foreground">{t.locating}</p>
        </div>
      </div>
      <div className="aspect-4/3 w-full animate-pulse bg-muted sm:aspect-video" />
    </div>
  )
}
