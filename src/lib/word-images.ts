import type { WordImage } from '@/lib/tools'
import { defineMessages, getLocale } from '@/lib/i18n'

const messages = defineMessages({
  vi: { httpError: (status: number) => `HTTP ${status} từ Wikimedia` },
  en: { httpError: (status: number) => `HTTP ${status} from Wikimedia` },
})

const API = 'https://commons.wikimedia.org/w/api.php'
const UA = 'lab-tanstack-ai/1.0 (learn_word demo)'

type Page = {
  index: number
  title: string
  imageinfo?: Array<{ thumburl?: string; descriptionurl?: string }>
}

async function search(query: string, limit: number): Promise<Array<WordImage>> {
  const url = new URL(API)
  url.search = new URLSearchParams({
    action: 'query',
    format: 'json',
    generator: 'search',
    gsrsearch: `filetype:bitmap ${query}`,
    gsrnamespace: '6',
    gsrlimit: String(limit),
    prop: 'imageinfo',
    iiprop: 'url',
    iiurlwidth: '480',
  }).toString()
  const res = await fetch(url, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(10_000) })
  if (!res.ok) throw new Error(messages[getLocale()].httpError(res.status))
  const data = (await res.json()) as { query?: { pages?: Record<string, Page> } }
  return Object.values(data.query?.pages ?? {})
    .sort((a, b) => a.index - b.index)
    .flatMap((page) => {
      const info = page.imageinfo?.[0]
      if (!info?.thumburl || !info.descriptionurl) return []
      const title = page.title.replace(/^File:/, '').replace(/\.\w+$/, '')
      return [{ title, thumbUrl: info.thumburl, pageUrl: info.descriptionurl }]
    })
}

export async function findWordImages(word: string, queries: Array<string>, count = 3) {
  const images = new Map<string, WordImage>()
  const results = await Promise.all(queries.map((q) => search(q, 4).catch(() => [])))
  for (const list of results) {
    const image = list.find((i) => !images.has(i.thumbUrl))
    if (image) images.set(image.thumbUrl, image)
  }
  if (images.size < count) {
    for (const image of await search(word, count * 2).catch(() => [])) {
      if (images.size >= count) break
      images.set(image.thumbUrl, image)
    }
  }
  return [...images.values()].slice(0, count)
}
