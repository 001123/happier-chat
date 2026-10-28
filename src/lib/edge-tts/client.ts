import { randomBytes, randomUUID } from 'node:crypto'
import { Effect, Schedule, Schema } from 'effect'
import WebSocket from 'ws'

import { generateSecMsGec, TRUSTED_CLIENT_TOKEN } from './drm'
import { defineMessages, getLocale } from '@/lib/i18n'

const messages = defineMessages({
  vi: {
    voiceListFailed: (status: number) => `Edge TTS: không lấy được danh sách giọng (HTTP ${status})`,
    noAudio: 'Edge TTS: không nhận được âm thanh',
    cancelled: 'Đã huỷ',
    timeout: 'Edge TTS: hết thời gian chờ',
    connectionRefused: (status: number | undefined) => `Edge TTS: kết nối bị từ chối (HTTP ${status})`,
    connectionLost: 'Edge TTS: mất kết nối giữa chừng',
    invalidMessage: 'Edge TTS: phản hồi không hợp lệ',
    networkError: 'Edge TTS: không kết nối được tới máy chủ',
    emptyText: 'Edge TTS: văn bản trống',
  },
  en: {
    voiceListFailed: (status: number) => `Edge TTS: could not fetch the voice list (HTTP ${status})`,
    noAudio: 'Edge TTS: no audio received',
    cancelled: 'Cancelled',
    timeout: 'Edge TTS: timed out',
    connectionRefused: (status: number | undefined) => `Edge TTS: connection refused (HTTP ${status})`,
    connectionLost: 'Edge TTS: connection lost mid-stream',
    invalidMessage: 'Edge TTS: invalid response',
    networkError: 'Edge TTS: could not reach the server',
    emptyText: 'Edge TTS: text is empty',
  },
})

const BASE_URL = 'speech.platform.bing.com/consumer/speech/synthesize/readaloud'
const WSS_URL = `wss://${BASE_URL}/edge/v1?TrustedClientToken=${TRUSTED_CLIENT_TOKEN}`
const VOICE_LIST_URL = `https://${BASE_URL}/voices/list?trustedclienttoken=${TRUSTED_CLIENT_TOKEN}`
const CHROMIUM_FULL_VERSION = '143.0.3650.75'
const CHROMIUM_MAJOR = CHROMIUM_FULL_VERSION.split('.')[0]
const SEC_MS_GEC_VERSION = `2-${CHROMIUM_FULL_VERSION}`
const MAX_CHUNK_BYTES = 4096
const ATTEMPT_TIMEOUT = '30 seconds'

const BASE_HEADERS = {
  'User-Agent': `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${CHROMIUM_MAJOR}.0.0.0 Safari/537.36 Edg/${CHROMIUM_MAJOR}.0.0.0`,
  'Accept-Language': 'en-US,en;q=0.9',
}

export type EdgeVoice = {
  ShortName: string
  FriendlyName: string
  Gender: 'Female' | 'Male'
  Locale: string
}

export type WordBoundary = { text: string; start: number; end: number }

export type SynthesisResult = { audio: Buffer; words: Array<WordBoundary> }

type Messages = (typeof messages)['en']

/** Any Edge TTS failure; `retryable` marks the ones worth another connection. */
class EdgeTtsError extends Schema.TaggedError<EdgeTtsError>()('EdgeTtsError', {
  message: Schema.String,
  retryable: Schema.Boolean,
}) {}

/** Up to 4 retries with jittered backoff, only for retryable failures; the service drops about a third of connections when busy. */
const retrySchedule = Schedule.exponential('300 millis').pipe(
  Schedule.jittered,
  Schedule.upTo({ times: 4 }),
  Schedule.setInputType<EdgeTtsError>(),
  Schedule.while(({ input }) => input.retryable),
)

/** Caps one attempt at {@link ATTEMPT_TIMEOUT}, then retries it per {@link retrySchedule}. */
const withRetry = <A>(attempt: Effect.Effect<A, EdgeTtsError>, t: Messages) =>
  attempt.pipe(
    Effect.timeout(ATTEMPT_TIMEOUT),
    Effect.catchTag('TimeoutError', () => Effect.fail(new EdgeTtsError({ message: t.timeout, retryable: true }))),
    Effect.retry(retrySchedule),
  )

/**
 * Runs at the Promise boundary. Messages are resolved up front because the locale is read from
 * the request; an abort rejects with the signal's reason, like a plain fetch would.
 */
async function run<A>(program: (t: Messages) => Effect.Effect<A, EdgeTtsError>, signal?: AbortSignal) {
  try {
    return await Effect.runPromise(program(messages[getLocale()]), { signal })
  } catch (error) {
    if (signal?.aborted) throw signal.reason ?? new Error(messages[getLocale()].cancelled)
    throw error
  }
}

const BYTES_PER_SECOND = 6000
const TICKS_PER_SECOND = 10_000_000

const unescapeXml = (text: string) =>
  text.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')

export type ProsodyOptions = {
  rate?: string
  pitch?: string
  volume?: string
}

let clockSkewSeconds = 0
const now = () => Date.now() / 1000 + clockSkewSeconds

function adjustClockSkew(serverDate: string | undefined) {
  const parsed = serverDate ? Date.parse(serverDate) : NaN
  if (Number.isNaN(parsed)) return false
  clockSkewSeconds += parsed / 1000 - now()
  return true
}

const muidCookie = () => `muid=${randomBytes(16).toString('hex').toUpperCase()};`
const connectId = () => randomUUID().replaceAll('-', '')
const dateString = () =>
  new Date().toUTCString().replace(/^(\w+), (\d+) (\w+) (\d+) (.+) GMT$/, '$1 $3 $2 $4 $5') +
  ' GMT+0000 (Coordinated Universal Time)'

const fetchVoices = (t: Messages) =>
  withRetry(
    Effect.tryPromise({
      try: async (signal) => {
        const res = await fetch(
          `${VOICE_LIST_URL}&Sec-MS-GEC=${generateSecMsGec(now())}&Sec-MS-GEC-Version=${SEC_MS_GEC_VERSION}`,
          { headers: { ...BASE_HEADERS, Cookie: muidCookie() }, signal },
        )
        if (!res.ok) {
          const retryable = res.status === 429 || res.status >= 500
          throw new EdgeTtsError({ message: t.voiceListFailed(res.status), retryable })
        }
        return (await res.json()) as Array<EdgeVoice>
      },
      catch: (cause) =>
        cause instanceof EdgeTtsError
          ? cause
          : new EdgeTtsError({
              message: cause instanceof SyntaxError ? t.invalidMessage : t.networkError,
              retryable: !(cause instanceof SyntaxError),
            }),
    }),
    t,
  )

export function listVoices(): Promise<Array<EdgeVoice>> {
  return run(fetchVoices)
}

function escapeXml(text: string) {
  return text
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, ' ')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function splitText(text: string) {
  const encoder = new TextEncoder()
  const chunks: Array<string> = []
  let rest = text
  while (encoder.encode(rest).length > MAX_CHUNK_BYTES) {
    let end = rest.length
    while (encoder.encode(rest.slice(0, end)).length > MAX_CHUNK_BYTES) end = Math.floor(end * 0.9)
    const space = rest.lastIndexOf(' ', end)
    let cut = space > end / 2 ? space : end
    const amp = rest.lastIndexOf('&', cut)
    if (amp > -1 && rest.indexOf(';', amp) >= cut) cut = amp
    chunks.push(rest.slice(0, cut).trim())
    rest = rest.slice(cut)
  }
  if (rest.trim()) chunks.push(rest.trim())
  return chunks.filter(Boolean)
}

/**
 * One WebSocket synthesis of an already escaped chunk. The socket is terminated on every exit,
 * including interruption. A 403 that corrects the clock skew is retryable, as is a connection
 * that closes before `turn.end`, since its audio would be cut short.
 */
const synthesizeChunk = (ssmlText: string, voice: string, prosody: Required<ProsodyOptions>, t: Messages) =>
  Effect.callback<SynthesisResult, EdgeTtsError>((resume) => {
    const url = `${WSS_URL}&ConnectionId=${connectId()}&Sec-MS-GEC=${generateSecMsGec(now())}&Sec-MS-GEC-Version=${SEC_MS_GEC_VERSION}`
    const ws = new WebSocket(url, {
      headers: {
        ...BASE_HEADERS,
        Pragma: 'no-cache',
        'Cache-Control': 'no-cache',
        Origin: 'chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold',
        Cookie: muidCookie(),
      },
    })
    const audio: Array<Buffer> = []
    const words: Array<WordBoundary> = []
    let settled = false

    const settle = (result: Effect.Effect<SynthesisResult, EdgeTtsError>) => {
      if (settled) return
      settled = true
      ws.terminate()
      resume(result)
    }
    const fail = (message: string, retryable: boolean) => settle(Effect.fail(new EdgeTtsError({ message, retryable })))
    const done = () =>
      audio.length === 0 ? fail(t.noAudio, false) : settle(Effect.succeed({ audio: Buffer.concat(audio), words }))

    ws.on('unexpected-response', (_req, res) => {
      const status = res.statusCode
      const skewFixed = status === 403 && adjustClockSkew(res.headers.date)
      fail(t.connectionRefused(status), skewFixed || status === 429 || (status ?? 0) >= 500)
    })
    ws.on('error', () => fail(t.networkError, true))
    ws.on('close', () => fail(t.connectionLost, true))

    ws.on('open', () => {
      ws.send(
        `X-Timestamp:${dateString()}\r\nContent-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n` +
          '{"context":{"synthesis":{"audio":{"metadataoptions":{"sentenceBoundaryEnabled":"false","wordBoundaryEnabled":"true"},"outputFormat":"audio-24khz-48kbitrate-mono-mp3"}}}}\r\n',
      )
      const ssml =
        "<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='en-US'>" +
        `<voice name='${voice}'><prosody pitch='${prosody.pitch}' rate='${prosody.rate}' volume='${prosody.volume}'>` +
        `${ssmlText}</prosody></voice></speak>`
      ws.send(
        `X-RequestId:${connectId()}\r\nContent-Type:application/ssml+xml\r\nX-Timestamp:${dateString()}Z\r\nPath:ssml\r\n\r\n${ssml}`,
      )
    })

    ws.on('message', (data: Buffer, isBinary) => {
      try {
        if (!isBinary) {
          const message = data.toString()
          const split = message.indexOf('\r\n\r\n')
          const headers = message.slice(0, split)
          if (headers.includes('Path:turn.end')) done()
          else if (headers.includes('Path:audio.metadata')) {
            const { Metadata } = JSON.parse(message.slice(split + 4)) as {
              Metadata: Array<{ Type: string; Data: { Offset: number; Duration: number; text: { Text: string } } }>
            }
            for (const { Type, Data } of Metadata) {
              if (Type !== 'WordBoundary') continue
              words.push({
                text: unescapeXml(Data.text.Text),
                start: Data.Offset / TICKS_PER_SECOND,
                end: (Data.Offset + Data.Duration) / TICKS_PER_SECOND,
              })
            }
          }
          return
        }
        const headerLength = data.readUInt16BE(0)
        const headers = data.subarray(2, headerLength + 2).toString()
        if (headers.includes('Path:audio') && headers.includes('Content-Type:audio/mpeg')) {
          audio.push(data.subarray(headerLength + 2))
        }
      } catch {
        fail(t.invalidMessage, false)
      }
    })

    return Effect.sync(() => {
      settled = true
      ws.terminate()
    })
  })

/** Chunks are synthesized in order so word timestamps can be offset by the audio before them. */
const synthesizeText = Effect.fn('synthesizeText')(function* (
  text: string,
  voice: string,
  prosody: Required<ProsodyOptions>,
  t: Messages,
): Effect.fn.Return<SynthesisResult, EdgeTtsError> {
  const buffers: Array<Buffer> = []
  const words: Array<WordBoundary> = []
  let offset = 0
  for (const chunk of splitText(escapeXml(text))) {
    const result = yield* withRetry(synthesizeChunk(chunk, voice, prosody, t), t)
    for (const w of result.words) words.push({ ...w, start: w.start + offset, end: w.end + offset })
    offset += result.audio.length / BYTES_PER_SECOND
    buffers.push(result.audio)
  }
  if (buffers.length === 0) return yield* new EdgeTtsError({ message: t.emptyText, retryable: false })
  return { audio: Buffer.concat(buffers), words }
})

export function synthesize(
  text: string,
  voice: string,
  prosody: ProsodyOptions = {},
  signal?: AbortSignal,
): Promise<SynthesisResult> {
  const options = { rate: '+0%', pitch: '+0Hz', volume: '+0%', ...prosody }
  return run((t) => synthesizeText(text, voice, options, t), signal)
}
