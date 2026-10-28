import * as React from 'react'
import { GenerationClient, fetchServerSentEvents } from '@tanstack/ai-react'
import type { SpeechGenerateInput } from '@tanstack/ai-react'
import type { TTSResult } from '@tanstack/ai'

import { defineMessages, getLocale } from '@/lib/i18n'
import { useSpeechSettings } from '@/lib/speech-settings'
import type { SpeechSettings } from '@/lib/speech-settings'

export function toSpeakable(markdown: string) {
  return markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/^\s{0,3}(#{1,6}|>|[-*+]|\d+\.)\s+/gm, '')
    .replace(/^\s*\|?[-:| ]+\|?\s*$/gm, '')
    .replace(/[*_~|#]+/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .trim()
}

export type SpeechSegment = { text: string; element?: HTMLElement }

const BLOCKS = 'p, li, h1, h2, h3, h4, h5, h6, td, th, dt, dd, figcaption'

export function segmentsFromElement(root: HTMLElement): Array<SpeechSegment> {
  return Array.from(root.querySelectorAll<HTMLElement>(BLOCKS))
    .filter((el) => !el.closest('pre'))
    .map((element) => {
      let text = element.textContent ?? ''
      if (element.querySelector(`${BLOCKS}, pre, ul, ol, table`)) {
        const clone = element.cloneNode(true) as HTMLElement
        clone.querySelectorAll(`${BLOCKS}, pre, ul, ol, table`).forEach((n) => n.remove())
        text = clone.textContent ?? ''
      }
      return { text: text.replace(/https?:\/\/\S+/g, ' ').replace(/\s+/g, ' ').trim(), element }
    })
    .filter((s) => s.text)
}

const FIRST_CHUNK_CHARS = 120
const CHUNK_CHARS = 300
const PREFETCH = 3

function chunkText(text: string, first: boolean) {
  const sentences = Array.from(
    new Intl.Segmenter(getLocale(), { granularity: 'sentence' }).segment(text),
    (s) => s.segment,
  )
  const chunks: Array<string> = []
  let current = ''
  for (const sentence of sentences) {
    const max = first && chunks.length === 0 ? FIRST_CHUNK_CHARS : CHUNK_CHARS
    if (current && current.length + sentence.length > max) {
      chunks.push(current.trim())
      current = ''
    }
    current += sentence
  }
  if (current.trim()) chunks.push(current.trim())
  return chunks
}

function toChunks(content: string | Array<SpeechSegment>) {
  const segments: Array<SpeechSegment> =
    typeof content === 'string'
      ? toSpeakable(content)
          .split(/\n+/)
          .map((text) => ({ text: text.trim() }))
          .filter((s) => s.text)
      : content
  return segments.flatMap((segment, i) => {
    let cursor = 0
    return chunkText(segment.text, i === 0).map((text) => {
      // Where the chunk starts in its segment's text, for progress callbacks.
      const offset = Math.max(segment.text.indexOf(text, cursor), cursor)
      cursor = offset + text.length
      return { text, element: segment.element, offset }
    })
  })
}

/** Start of each aligned word in the chunk text, matched in order. */
function wordOffsets(text: string, words: Array<string>) {
  let cursor = 0
  return words.map((word) => {
    const index = text.indexOf(word.trim(), cursor)
    if (index < 0) return cursor
    cursor = index + word.trim().length
    return index
  })
}

const messages = defineMessages({
  vi: { stopped: 'Đã dừng đọc', noAudio: 'Không nhận được âm thanh', playFailed: 'Không phát được âm thanh' },
  en: { stopped: 'Reading stopped', noAudio: 'No audio received', playFailed: 'Could not play audio' },
})

const abortError = () => new DOMException(messages[getLocale()].stopped, 'AbortError')

function synthesize(input: SpeechGenerateInput, signal = new AbortController().signal) {
  return new Promise<TTSResult>((resolve, reject) => {
    if (signal.aborted) return reject(abortError())
    const client = new GenerationClient<SpeechGenerateInput, TTSResult>({
      threadId: 'speech',
      connection: fetchServerSentEvents('/api/tts'),
      onResult: resolve,
      onError: reject,
    })
    const onAbort = () => {
      client.stop()
      reject(abortError())
    }
    signal.addEventListener('abort', onAbort, { once: true })
    client
      .generate(input)
      .then(() => reject(new Error(messages[getLocale()].noAudio)), reject)
      .finally(() => {
        signal.removeEventListener('abort', onAbort)
        client.dispose()
      })
  })
}

// The voice service drops connections when one client opens several at once, and each extra one slows the others
// down, so at most this many syntheses run together. Waiting ones start in order, reads before preloads.
const MAX_SYNTHESES = 2
type Job = { start: () => void; urgent: boolean }
let running = 0
const queue: Array<Job> = []

function enqueue(job: Job) {
  if (!job.urgent) return queue.push(job)
  const firstPreload = queue.findIndex((waiting) => !waiting.urgent)
  queue.splice(firstPreload < 0 ? queue.length : firstPreload, 0, job)
}

function scheduled<T>(task: () => Promise<T>, urgent: boolean) {
  let job!: Job
  const done = new Promise<T>((resolve, reject) => {
    job = {
      urgent,
      start: () => {
        running++
        task()
          .then(resolve, reject)
          .finally(() => {
            running--
            queue.shift()?.start()
          })
      },
    }
  })
  if (running < MAX_SYNTHESES) job.start()
  else enqueue(job)
  /** Moves a preload that is still waiting ahead of the other preloads, once a read needs it. */
  const hurry = () => {
    const at = queue.indexOf(job)
    if (at < 0 || job.urgent) return
    queue.splice(at, 1)
    job.urgent = true
    enqueue(job)
  }
  return { done, hurry }
}

// Synthesized audio, newest last, so a read prepared ahead (the next slide) or read again starts without a wait.
const CACHE_SIZE = 24
const audioCache = new Map<string, ReturnType<typeof scheduled<TTSResult>>>()

/**
 * Audio for a request, from the cache or synthesized into it. A stopped read does not cancel the request, so
 * the audio is still there when the same text is read again; a failed one is dropped so the next read retries.
 * `urgent` is for a read that waits on it, as opposed to a preload.
 */
function cachedSpeech(input: SpeechGenerateInput, urgent: boolean) {
  const key = JSON.stringify([input.text, input.voice, input.speed, input.modelOptions, input.timestamps])
  let entry = audioCache.get(key)
  if (entry) {
    audioCache.delete(key)
    if (urgent) entry.hurry()
  } else {
    // The voice service drops a request now and then; one more try saves the read. When that fails too, the first
    // error says more (a quota or a bad key), so it is the one reported.
    entry = scheduled(() => synthesize(input).catch((error) => synthesize(input).catch(() => Promise.reject(error))), urgent)
    const created = entry
    created.done.catch(() => audioCache.get(key) === created && audioCache.delete(key))
  }
  audioCache.set(key, entry)
  while (audioCache.size > CACHE_SIZE) audioCache.delete(audioCache.keys().next().value!)
  return entry.done
}

/** Settles like the promise, or rejects as soon as the read it belongs to is stopped. */
function untilStopped<T>(promise: Promise<T>, signal: AbortSignal) {
  return new Promise<T>((resolve, reject) => {
    if (signal.aborted) return reject(abortError())
    const onAbort = () => reject(abortError())
    signal.addEventListener('abort', onAbort, { once: true })
    promise.then(resolve, reject).finally(() => signal.removeEventListener('abort', onAbort))
  })
}

function play(audio: HTMLAudioElement, result: TTSResult, signal: AbortSignal, rate: number) {
  return new Promise<void>((resolve, reject) => {
    audio.src = `data:${result.contentType ?? 'audio/mpeg'};base64,${result.audio}`
    // Loading a new source resets the rate to the default one.
    audio.defaultPlaybackRate = audio.playbackRate = rate
    const cleanup = () => {
      audio.onended = audio.onerror = null
      signal.removeEventListener('abort', onAbort)
    }
    const onAbort = () => {
      cleanup()
      audio.pause()
      reject(abortError())
    }
    audio.onended = () => {
      cleanup()
      resolve()
    }
    audio.onerror = () => {
      cleanup()
      reject(new Error(messages[getLocale()].playFailed))
    }
    signal.addEventListener('abort', onAbort, { once: true })
    audio.play().catch((error) => {
      cleanup()
      reject(error)
    })
  })
}

const WORD_HIGHLIGHT = 'speaking-word'
const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

function wordRanges(element: HTMLElement, words: Array<string>, cursor: { value: number }) {
  const nodes: Array<Text> = []
  const starts: Array<number> = []
  let full = ''
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT)
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    nodes.push(node as Text)
    starts.push(full.length)
    full += (node as Text).data
  }
  const locate = (index: number, end = false): [Text, number] => {
    let i = nodes.length - 1
    while (i > 0 && (end ? starts[i]! >= index : starts[i]! > index)) i--
    return [nodes[i]!, index - starts[i]!]
  }

  return words.map((word) => {
    const pattern = new RegExp(escapeRegExp(word.trim()).replace(/\s+/g, '\\s+'), 'giu')
    pattern.lastIndex = cursor.value
    const match = pattern.exec(full)
    if (!match || match.index - cursor.value > 80) return null
    cursor.value = match.index + match[0].length
    const range = document.createRange()
    range.setStart(...locate(match.index))
    range.setEnd(...locate(cursor.value, true))
    return range
  })
}

/** Without word timings, estimates the word being read from how far the audio has played; calls onOffset with its start. */
function trackEstimatedWords(audio: HTMLAudioElement, text: string, onOffset: (offset: number) => void) {
  const starts = Array.from(text.matchAll(/\S+/g), (m) => m.index)
  let frame = 0
  let current = -1
  const tick = () => {
    if (starts.length && Number.isFinite(audio.duration) && audio.duration > 0) {
      const index = Math.min(starts.length - 1, Math.floor((audio.currentTime / audio.duration) * starts.length))
      if (index !== current) {
        current = index
        onOffset(starts[index]!)
      }
    }
    frame = requestAnimationFrame(tick)
  }
  frame = requestAnimationFrame(tick)
  return () => cancelAnimationFrame(frame)
}

/** Calls onWord with the index of the word being played (-1 before the first one) each time it changes. */
function trackWords(audio: HTMLAudioElement, startSeconds: Array<number>, onWord: (index: number) => void) {
  let frame = 0
  let current = -1
  const tick = () => {
    let index = -1
    while (index + 1 < startSeconds.length && startSeconds[index + 1]! <= audio.currentTime) index++
    if (index !== current) {
      current = index
      onWord(index)
    }
    frame = requestAnimationFrame(tick)
  }
  frame = requestAnimationFrame(tick)
  return () => cancelAnimationFrame(frame)
}

/**
 * The request fields for the chosen voice service, and how much faster to play its audio: Gemini and OpenRouter
 * take no speed, so their audio is sped up or slowed down instead; their word timings are estimated by the server.
 */
function voiceRequest({ engine, geminiModel, geminiVoice, openrouterModel, openrouterVoice, voice, speed, pitch }: SpeechSettings) {
  if (engine === 'gemini') {
    return { fields: { voice: geminiVoice, modelOptions: { engine, model: geminiModel } }, rate: speed, timestamps: true }
  }
  if (engine === 'openrouter') {
    return { fields: { voice: openrouterVoice, modelOptions: { engine, model: openrouterModel } }, rate: speed, timestamps: true }
  }
  return { fields: { voice, speed, modelOptions: { pitch } }, rate: 1, timestamps: true }
}

export type SpeakOptions = {
  /** Called with the character offset reached in the current segment's text, per word when the voice gives timings. */
  onProgress?: (offset: number) => void
  /** Playback speed of the audio, applied without synthesizing again; change it mid-read with `setPlaybackRate`. */
  playbackRate?: number
  /** Loudness of the audio from 0 to 1; change it mid-read with `setVolume`. */
  volume?: number
  /** Called when the read fails, as opposed to being stopped or replaced. */
  onError?: (error: Error) => void
}

export type SpeakerStatus = 'idle' | 'loading' | 'playing'

export function useSpeaker() {
  const settings = useSpeechSettings()
  const runRef = React.useRef<AbortController | null>(null)
  const audioRef = React.useRef<HTMLAudioElement | null>(null)
  const rateRef = React.useRef(1)
  // The voice service's own rate factor, applied on top of the playback rate.
  const engineRateRef = React.useRef(1)
  const [activeId, setActiveId] = React.useState<string | null>(null)
  const [status, setStatus] = React.useState<SpeakerStatus>('idle')
  const [error, setError] = React.useState<Error | undefined>()

  const stop = React.useCallback(() => {
    runRef.current?.abort()
    runRef.current = null
    setActiveId(null)
    setStatus('idle')
  }, [])

  /** Resolves true when the content was read to the end, false when it was stopped, replaced or failed. */
  const speak = React.useCallback(
    async (
      id: string,
      content: string | Array<SpeechSegment>,
      overrides?: Partial<SpeechSettings>,
      { onProgress, playbackRate = 1, volume = 1, onError }: SpeakOptions = {},
    ) => {
      runRef.current?.abort()
      rateRef.current = playbackRate
      const run = new AbortController()
      runRef.current = run
      const { signal } = run
      const chunks = toChunks(content)
      setError(undefined)
      if (chunks.length === 0) {
        stop()
        return false
      }

      const voice = voiceRequest({ ...settings, ...overrides })
      engineRateRef.current = voice.rate
      const audio = (audioRef.current ??= new Audio())
      // The element is shared, so a read that sets no volume must not inherit the last one's; a new source keeps it.
      audio.volume = volume
      const canHighlightWords = typeof CSS !== 'undefined' && 'highlights' in CSS
      const cursors = new Map<HTMLElement, { value: number }>()
      const pending: Array<Promise<TTSResult>> = []
      const request = (i: number) => {
        pending[i] ??= untilStopped(
          cachedSpeech(
            { text: chunks[i]!.text, ...voice.fields, timestamps: voice.timestamps && (canHighlightWords || Boolean(onProgress)) },
            true,
          ),
          signal,
        )
        pending[i].catch(() => {})
      }

      setActiveId(id)
      let highlighted: HTMLElement | undefined
      let finished = false
      try {
        for (let i = 0; i < chunks.length; i++) {
          for (let j = i; j < Math.min(i + PREFETCH, chunks.length); j++) request(j)
          const { element, text, offset } = chunks[i]!
          if (element !== highlighted) {
            highlighted?.removeAttribute('data-speaking')
            element?.setAttribute('data-speaking', '')
            highlighted = element
          }
          setStatus('loading')
          const result = await pending[i]!
          setStatus('playing')
          onProgress?.(offset)
          let stopTracking: (() => void) | undefined
          let ranges: Array<Range | null> | undefined
          if (result.alignment) {
            if (element && canHighlightWords) {
              const cursor = cursors.get(element) ?? { value: 0 }
              cursors.set(element, cursor)
              ranges = wordRanges(element, result.alignment.texts, cursor)
            }
            const offsets = onProgress && wordOffsets(text, result.alignment.texts)
            if (ranges || offsets) {
              stopTracking = trackWords(audio, result.alignment.startSeconds, (index) => {
                const range = ranges?.[index]
                if (range) CSS.highlights.set(WORD_HIGHLIGHT, new Highlight(range))
                else if (ranges) CSS.highlights.delete(WORD_HIGHLIGHT)
                if (offsets && index >= 0) onProgress(offset + offsets[index]!)
              })
            }
          } else if (onProgress) {
            // Without timings progress would only move once per chunk, and everything tied to it would jump.
            stopTracking = trackEstimatedWords(audio, text, (start) => onProgress(offset + start))
          }
          try {
            await play(audio, result, signal, rateRef.current * voice.rate).catch((e: Error) => {
              // A blocked autoplay fails again until the user interacts; other failures (a source that did not
              // decode, a play interrupted by a load) usually pass on a second try.
              if (signal.aborted || e.name === 'NotAllowedError') throw e
              return play(audio, result, signal, rateRef.current * voice.rate)
            })
          } finally {
            stopTracking?.()
            if (ranges) CSS.highlights.delete(WORD_HIGHLIGHT)
          }
        }
        finished = true
      } catch (e) {
        if (!signal.aborted) {
          console.warn('speech failed', e)
          setError(e as Error)
          onError?.(e as Error)
        }
      } finally {
        highlighted?.removeAttribute('data-speaking')
        if (runRef.current === run) {
          runRef.current = null
          setActiveId(null)
          setStatus('idle')
        }
      }
      return finished
    },
    [settings, stop],
  )

  /**
   * Synthesizes the start of some content ahead of reading it, so `speak` with the same content, settings and
   * `onProgress` (or not) starts at once.
   */
  const preload = React.useCallback(
    (content: string | Array<SpeechSegment>, overrides?: Partial<SpeechSettings>, { progress = false } = {}) => {
      const voice = voiceRequest({ ...settings, ...overrides })
      const timestamps = voice.timestamps && ((typeof CSS !== 'undefined' && 'highlights' in CSS) || progress)
      for (const { text } of toChunks(content).slice(0, PREFETCH)) {
        cachedSpeech({ text, ...voice.fields, timestamps }, false).catch(() => {})
      }
    },
    [settings],
  )

  /** Changes the speed of the read in progress, including the chunk playing now. */
  const setPlaybackRate = React.useCallback((rate: number) => {
    rateRef.current = rate
    if (runRef.current && audioRef.current) audioRef.current.playbackRate = rate * engineRateRef.current
  }, [])

  /** Changes the loudness of the read in progress. */
  const setVolume = React.useCallback((volume: number) => {
    if (runRef.current && audioRef.current) audioRef.current.volume = volume
  }, [])

  React.useEffect(() => () => runRef.current?.abort(), [])

  return { speak, preload, stop, setPlaybackRate, setVolume, activeId, status, error }
}
