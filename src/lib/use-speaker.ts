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

function synthesize(input: SpeechGenerateInput, signal: AbortSignal) {
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

function play(audio: HTMLAudioElement, result: TTSResult, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    audio.src = `data:${result.contentType ?? 'audio/mpeg'};base64,${result.audio}`
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

export type SpeakOptions = {
  /** Called with the character offset reached in the current segment's text, per word when the voice gives timings. */
  onProgress?: (offset: number) => void
}

export type SpeakerStatus = 'idle' | 'loading' | 'playing'

export function useSpeaker() {
  const settings = useSpeechSettings()
  const runRef = React.useRef<AbortController | null>(null)
  const audioRef = React.useRef<HTMLAudioElement | null>(null)
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
      { onProgress }: SpeakOptions = {},
    ) => {
      runRef.current?.abort()
      const run = new AbortController()
      runRef.current = run
      const { signal } = run
      const chunks = toChunks(content)
      setError(undefined)
      if (chunks.length === 0) {
        stop()
        return false
      }

      const { voice, speed, pitch } = { ...settings, ...overrides }
      const audio = (audioRef.current ??= new Audio())
      const canHighlightWords = typeof CSS !== 'undefined' && 'highlights' in CSS
      const cursors = new Map<HTMLElement, { value: number }>()
      const pending: Array<Promise<TTSResult>> = []
      const request = (i: number) => {
        pending[i] ??= synthesize(
          { text: chunks[i]!.text, voice, speed, modelOptions: { pitch }, timestamps: canHighlightWords || Boolean(onProgress) },
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
          }
          try {
            await play(audio, result, signal)
          } finally {
            stopTracking?.()
            if (ranges) CSS.highlights.delete(WORD_HIGHLIGHT)
          }
        }
        finished = true
      } catch (e) {
        if (!signal.aborted) setError(e as Error)
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

  React.useEffect(() => () => runRef.current?.abort(), [])

  return { speak, stop, activeId, status, error }
}
