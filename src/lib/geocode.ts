import type { MapLocation } from '@/lib/tools'
import { getLocale } from '@/lib/i18n'

const NOMINATIM = 'https://nominatim.openstreetmap.org/search'
const UA = 'lab-tanstack-ai/1.0 (demo)'

type NominatimPlace = {
  lat: string
  lon: string
  name?: string
  display_name: string
  addresstype?: string
}

const ZOOM_BY_TYPE: Record<string, number> = {
  country: 5,
  state: 8,
  province: 8,
  region: 8,
  city: 11,
  town: 13,
  municipality: 12,
  county: 11,
  suburb: 14,
  quarter: 15,
  neighbourhood: 15,
  village: 14,
  road: 16,
}

export async function geocode(query: string, zoom?: number): Promise<MapLocation> {
  const fallback: MapLocation = { query, name: query, address: '', lat: null, lng: null, zoom: zoom ?? 13 }
  try {
    const url = `${NOMINATIM}?${new URLSearchParams({ q: query, format: 'jsonv2', limit: '1', 'accept-language': getLocale() })}`
    const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(6000) })
    if (!res.ok) return fallback
    const [place] = (await res.json()) as NominatimPlace[]
    if (!place) return fallback
    return {
      query,
      name: place.name || place.display_name.split(',')[0]!.trim(),
      address: place.display_name,
      lat: Number(place.lat),
      lng: Number(place.lon),
      zoom: zoom ?? ZOOM_BY_TYPE[place.addresstype ?? ''] ?? 17,
    }
  } catch {
    return fallback
  }
}
