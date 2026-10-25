import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'
import { Effect, Result, Schema } from 'effect'
import type { WebResult } from '@/lib/tools'

const HEADERS = {
  'user-agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36',
  'accept-language': 'vi,en;q=0.8',
}
const REQUEST_TIMEOUT = '10 seconds'
const MAX_RESULTS = 8
const MAX_PAGE_CHARS = 8000
const MAX_REDIRECTS = 5

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
}

/** Any search or page fetch failure; the message is what the model sees. */
class WebError extends Schema.TaggedError<WebError>()('WebError', {
  message: Schema.String,
}) {}

const toWebError = (cause: unknown) =>
  cause instanceof WebError
    ? cause
    : new WebError({ message: cause instanceof Error ? cause.message : String(cause) })

const SearxngResponse = Schema.Struct({
  results: Schema.optional(
    Schema.Array(
      Schema.Struct({
        title: Schema.optional(Schema.NullOr(Schema.String)),
        url: Schema.optional(Schema.NullOr(Schema.String)),
        content: Schema.optional(Schema.NullOr(Schema.String)),
      }),
    ),
  ),
})

function decodeEntities(text: string) {
  return text.replace(/&(#x?[0-9a-f]+|\w+);/gi, (match, code: string) => {
    if (code[0] === '#') {
      const n = code[1]?.toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10)
      return Number.isFinite(n) ? String.fromCodePoint(n) : match
    }
    return ENTITIES[code.toLowerCase()] ?? match
  })
}

function stripTags(html: string) {
  return decodeEntities(html.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim()
}

/**
 * One HTTP request whose response is consumed by `read`. The timeout covers reading the body,
 * and interruption aborts the underlying fetch.
 */
const request = <A>(url: string | URL, init: RequestInit, read: (res: Response) => Promise<A>) =>
  Effect.tryPromise({
    try: async (signal) =>
      read(await fetch(url, { ...init, headers: { ...HEADERS, ...init.headers }, signal })),
    catch: toWebError,
  }).pipe(
    Effect.timeout(REQUEST_TIMEOUT),
    Effect.catchTag('TimeoutError', () =>
      Effect.fail(new WebError({ message: `Timed out waiting for ${new URL(url).host}` })),
    ),
  )

const assertOk = (res: Response, from = '') => {
  if (!res.ok) throw new WebError({ message: `HTTP ${res.status}${from}` })
  return res
}

const get = <A>(url: string | URL, init: RequestInit, read: (res: Response) => Promise<A>) =>
  request(url, init, (res) => read(assertOk(res, ` from ${new URL(url).host}`)))

const searxng = Effect.fn('searxng')(function* (base: string, query: string) {
  const url = new URL('/search', base)
  url.searchParams.set('q', query)
  url.searchParams.set('format', 'json')
  const json = yield* get(url, {}, (res) => res.json())
  const data = yield* Schema.decodeUnknownEffect(SearxngResponse)(json).pipe(
    Effect.mapError(() => new WebError({ message: 'Invalid SearXNG response' })),
  )
  return (data.results ?? []).flatMap((r): Array<WebResult> =>
    r.url ? [{ title: r.title ?? r.url, url: r.url, snippet: r.content ?? '' }] : [],
  )
})

const duckduckgo = Effect.fn('duckduckgo')(function* (query: string) {
  const html = yield* get(
    'https://html.duckduckgo.com/html/',
    {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ q: query }),
    },
    (res) => res.text(),
  )
  if (/anomaly|captcha/i.test(html) && !html.includes('result__a')) {
    return yield* new WebError({ message: 'DuckDuckGo blocked the request (bot check)' })
  }
  const results: Array<WebResult> = []
  const blocks = html.split('class="result__body"').slice(1)
  for (const block of blocks) {
    const link = block.match(/class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/)
    if (!link) continue
    const href = decodeEntities(link[1]!)
    const real = new URL(href, 'https://duckduckgo.com').searchParams.get('uddg') ?? href
    if (real.includes('duckduckgo.com/y.js')) continue
    const snippet = block.match(/class="result__snippet"[^>]*>([\s\S]*?)<\/a>/)
    results.push({ title: stripTags(link[2]!), url: real, snippet: snippet ? stripTags(snippet[1]!) : '' })
  }
  return results
})

const bing = Effect.fn('bing')(function* (query: string) {
  const url = new URL('https://www.bing.com/search')
  url.searchParams.set('format', 'rss')
  url.searchParams.set('q', query)
  const xml = yield* get(url, {}, (res) => res.text())
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map(([, item]): WebResult => {
    const tag = (name: string) => stripTags(item!.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`))?.[1] ?? '')
    return { title: tag('title'), url: tag('link'), snippet: tag('description') }
  })
})

/** Tries each engine in order and returns the first non-empty result; fails with every engine's error. */
const search = Effect.fn('searchWeb')(function* (query: string) {
  const engines: Array<[string, Effect.Effect<Array<WebResult>, WebError>]> = []
  const searx = process.env.SEARXNG_URL
  if (searx) engines.push(['searxng', searxng(searx, query)])
  engines.push(['duckduckgo', duckduckgo(query)], ['bing', bing(query)])

  const errors: Array<string> = []
  for (const [engine, run] of engines) {
    const result = yield* Effect.result(Effect.mapError(run, toWebError))
    if (Result.isFailure(result)) {
      errors.push(`${engine}: ${result.failure.message}`)
      continue
    }
    const results = result.success.filter((r) => /^https?:\/\//.test(r.url))
    if (results.length > 0) return { engine, results: results.slice(0, MAX_RESULTS) }
    errors.push(`${engine}: no results`)
  }
  return yield* new WebError({ message: `Search failed: ${errors.join('; ')}` })
})

function isPrivateAddress(ip: string) {
  if (ip.startsWith('::ffff:')) ip = ip.slice(7)
  if (isIP(ip) === 4) {
    const [a, b] = ip.split('.').map(Number) as [number, number]
    return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127)
  }
  const lower = ip.toLowerCase()
  return lower === '::1' || lower === '::' || lower.startsWith('fc') || lower.startsWith('fd') || lower.startsWith('fe80')
}

const assertPublicUrl = Effect.fn('assertPublicUrl')(function* (raw: string) {
  const url = yield* Effect.try({ try: () => new URL(raw), catch: toWebError })
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return yield* new WebError({ message: 'Only http(s) is supported' })
  }
  const host = url.hostname.replace(/^\[|\]$/g, '')
  const addresses = isIP(host)
    ? [host]
    : yield* Effect.tryPromise({
        try: async () => (await lookup(host, { all: true })).map((a) => a.address),
        catch: toWebError,
      })
  if (addresses.some(isPrivateAddress)) {
    return yield* new WebError({ message: 'Access to internal addresses is not allowed' })
  }
  return url
})

type Hop = { redirect: string } | { type: string; body: string }

/** Follows redirects by hand so every hop is checked against internal addresses. */
const readPage = Effect.fn('fetchPage')(function* (raw: string) {
  let url = yield* assertPublicUrl(raw)
  let hop: Hop
  for (let hops = 0; ; hops++) {
    hop = yield* request(url, { redirect: 'manual' }, async (res): Promise<Hop> => {
      const location = res.headers.get('location')
      if (res.status >= 300 && res.status < 400 && location) return { redirect: location }
      assertOk(res)
      return { type: res.headers.get('content-type') ?? '', body: await res.text() }
    })
    if (!('redirect' in hop)) break
    if (hops >= MAX_REDIRECTS) return yield* new WebError({ message: 'Too many redirects' })
    url = yield* assertPublicUrl(new URL(hop.redirect, url).href)
  }

  const { type, body } = hop
  let title = url.hostname
  let content = body
  if (type.includes('html') || /^\s*</.test(body)) {
    title = stripTags(body.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '') || title
    const main = body.match(/<(article|main)[^>]*>([\s\S]*?)<\/\1>/i)?.[2] ?? body
    content = stripTags(
      main.replace(/<(script|style|noscript|svg|nav|header|footer|aside|form)[^>]*>[\s\S]*?<\/\1>/gi, ' '),
    )
  } else if (!type.startsWith('text/') && !type.includes('json')) {
    return yield* new WebError({ message: `Cannot read content of type ${type || 'unknown'}` })
  }
  return {
    url: url.href,
    title,
    content: content.slice(0, MAX_PAGE_CHARS),
    truncated: content.length > MAX_PAGE_CHARS,
  }
})

/** Runs at the Promise boundary; an abort rejects with the signal's reason, like a plain fetch would. */
async function run<A>(program: Effect.Effect<A, WebError>, signal?: AbortSignal) {
  try {
    return await Effect.runPromise(program, { signal })
  } catch (error) {
    if (signal?.aborted) throw signal.reason ?? new Error('Cancelled')
    throw error
  }
}

export function searchWeb(query: string, signal?: AbortSignal) {
  return run(search(query), signal)
}

export function fetchPage(url: string, signal?: AbortSignal) {
  return run(readPage(url), signal)
}
