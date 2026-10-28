import type { AnyTTSAdapter, TTSAlignment } from '@tanstack/ai'

type Pcm = { samples: Int16Array; rate: number; channels: number }

/** The 16-bit PCM inside a WAV file, or null for any other audio. */
function decodeWav(audio: Buffer): Pcm | null {
  if (audio.length < 44 || audio.toString('ascii', 0, 4) !== 'RIFF' || audio.toString('ascii', 8, 12) !== 'WAVE') return null
  let rate = 0
  let channels = 0
  let bits = 0
  for (let offset = 12; offset + 8 <= audio.length; ) {
    const id = audio.toString('ascii', offset, offset + 4)
    // Streamed WAVs may leave the data size at 0 or 0xFFFFFFFF; the data then runs to the end.
    const declared = audio.readUInt32LE(offset + 4)
    const start = offset + 8
    if (id === 'fmt ') {
      channels = audio.readUInt16LE(start + 2)
      rate = audio.readUInt32LE(start + 4)
      bits = audio.readUInt16LE(start + 14)
    } else if (id === 'data') {
      if (bits !== 16 || !rate || !channels) return null
      const end = declared && start + declared <= audio.length ? start + declared : audio.length
      const bytes = audio.subarray(start, end - ((end - start) % 2))
      const samples = new Int16Array(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length))
      return { samples, rate, channels }
    }
    offset = start + declared + (declared % 2)
  }
  return null
}

const FRAME_SECONDS = 0.01
/** Shorter silences are the gaps between words, not the pause after a comma or a full stop. */
const MIN_PAUSE_SECONDS = 0.12

/** Loudness of every 10 ms of audio, mixed down to mono. */
function frameLoudness({ samples, rate, channels }: Pcm) {
  const frameSize = Math.max(1, Math.round(rate * FRAME_SECONDS)) * channels
  const frames = new Float64Array(Math.ceil(samples.length / frameSize))
  for (let f = 0; f < frames.length; f++) {
    let sum = 0
    const end = Math.min(samples.length, (f + 1) * frameSize)
    for (let i = f * frameSize; i < end; i++) sum += samples[i]! * samples[i]!
    frames[f] = Math.sqrt(sum / Math.max(1, end - f * frameSize))
  }
  return frames
}

/** Where speech starts and ends, and the pauses inside it, in seconds. */
function findPauses(pcm: Pcm) {
  const frames = frameLoudness(pcm)
  const sorted = Array.from(frames).sort((a, b) => a - b)
  const loud = sorted[Math.floor(sorted.length * 0.9)] ?? 0
  // Relative to the loud end of this clip, so quiet and loud voices both split cleanly.
  const threshold = Math.max(200, loud * 0.08)
  const voiced = Array.from(frames, (value) => value >= threshold)
  const first = voiced.indexOf(true)
  const last = voiced.lastIndexOf(true)
  const duration = pcm.samples.length / pcm.channels / pcm.rate
  if (first < 0) return { start: 0, end: duration, pauses: [] }

  const pauses: Array<{ start: number; end: number }> = []
  let silentFrom = -1
  for (let f = first; f <= last; f++) {
    if (!voiced[f]) {
      if (silentFrom < 0) silentFrom = f
    } else if (silentFrom >= 0) {
      if ((f - silentFrom) * FRAME_SECONDS >= MIN_PAUSE_SECONDS) {
        pauses.push({ start: silentFrom * FRAME_SECONDS, end: f * FRAME_SECONDS })
      }
      silentFrom = -1
    }
  }
  return { start: first * FRAME_SECONDS, end: Math.min(duration, (last + 1) * FRAME_SECONDS), pauses }
}

// Letters with their combining marks (Vietnamese tones) and digits; "e-mail" and "it's" stay one word.
const WORD = /[\p{L}\p{N}\p{M}]+(?:['’.\-][\p{L}\p{N}\p{M}]+)*/gu
// Where a voice pauses: punctuation that ends a clause, or a line break.
const CLAUSE_END = /[.,;:!?…)\]—–]|\n/

type Word = { text: string; from: number; to: number; endsClause: boolean }

/** Words on a character axis (gaps count as one), each marked when a pause usually follows it. */
function splitWords(text: string): Array<Word> {
  const matches = Array.from(text.matchAll(WORD))
  let axis = 0
  return matches.map((match, i) => {
    const next = matches[i + 1]?.index ?? text.length
    const between = text.slice(match.index + match[0].length, next)
    const word = { text: match[0], from: axis, to: axis + match[0].length, endsClause: CLAUSE_END.test(between) }
    axis = word.to + 1
    return word
  })
}

/**
 * Matches clause ends to detected pauses in order, by how close each pause is to where the clause end would fall
 * at an even reading pace. Either side may go unmatched: a voice skips some commas and breathes mid-clause.
 */
function matchPauses(expected: Array<number>, pauses: Array<{ start: number; end: number }>, span: number) {
  const tolerance = Math.max(1, span * 0.2)
  const skipBoundary = tolerance * 0.6
  const skipPause = (p: { start: number; end: number }) => 0.15 + (p.end - p.start)
  const n = expected.length
  const m = pauses.length
  const cost = Array.from({ length: n + 1 }, () => new Float64Array(m + 1).fill(Infinity))
  const step = Array.from({ length: n + 1 }, () => new Int8Array(m + 1))
  cost[0]![0] = 0
  for (let i = 0; i <= n; i++) {
    for (let j = 0; j <= m; j++) {
      const here = cost[i]![j]!
      if (here === Infinity) continue
      if (i < n && here + skipBoundary < cost[i + 1]![j]!) {
        cost[i + 1]![j] = here + skipBoundary
        step[i + 1]![j] = 1
      }
      if (j < m && here + skipPause(pauses[j]!) < cost[i]![j + 1]!) {
        cost[i]![j + 1] = here + skipPause(pauses[j]!)
        step[i]![j + 1] = 2
      }
      if (i < n && j < m) {
        const mid = (pauses[j]!.start + pauses[j]!.end) / 2
        const distance = Math.abs(expected[i]! - mid)
        if (distance <= tolerance && here + distance < cost[i + 1]![j + 1]!) {
          cost[i + 1]![j + 1] = here + distance
          step[i + 1]![j + 1] = 3
        }
      }
    }
  }
  const matched = new Array<{ start: number; end: number } | null>(n).fill(null)
  for (let i = n, j = m; i > 0 || j > 0; ) {
    const s = step[i]![j]
    if (s === 3) matched[--i] = pauses[--j]!
    else if (s === 1) i--
    else j--
  }
  return matched
}

/** Piecewise-linear time at a point of the character axis, between anchors sorted by position. */
function timeAt(anchors: Array<[number, number]>, position: number) {
  for (let k = 1; k < anchors.length; k++) {
    const [p1, t1] = anchors[k]!
    if (position <= p1) {
      const [p0, t0] = anchors[k - 1]!
      return p1 === p0 ? t1 : t0 + ((position - p0) / (p1 - p0)) * (t1 - t0)
    }
  }
  return anchors.at(-1)![1]
}

/**
 * Word timings estimated from the audio itself, for voices that return none: pauses in the audio are matched to
 * the clause ends of the text, and each clause's words share its time by length. Errors stay inside one clause.
 */
export function estimateAlignment(text: string, pcm: Pcm): TTSAlignment | null {
  const words = splitWords(text)
  if (!words.length) return null
  const { start, end, pauses } = findPauses(pcm)
  const total = words.at(-1)!.to
  const clauseEnds = words.slice(0, -1).flatMap((word, i) => (word.endsClause ? [i] : []))
  const expected = clauseEnds.map((i) => start + (words[i]!.to / total) * (end - start))
  const matched = matchPauses(expected, pauses, end - start)

  const anchors: Array<[number, number]> = [[0, start]]
  clauseEnds.forEach((i, k) => {
    const pause = matched[k]
    if (!pause) return
    anchors.push([words[i]!.to, pause.start], [words[i + 1]!.from, pause.end])
  })
  anchors.push([total, end])

  return {
    unit: 'word',
    texts: words.map((word) => word.text),
    startSeconds: words.map((word) => timeAt(anchors, word.from)),
    endSeconds: words.map((word) => timeAt(anchors, word.to)),
  }
}

/**
 * Lets a voice that returns WAV but no timings answer `timestamps: true`, with timings estimated from its audio.
 * Audio that is not 16-bit WAV comes back without them.
 */
export function withEstimatedTimestamps<TAdapter extends AnyTTSAdapter>(adapter: TAdapter): TAdapter {
  const generate = adapter.generateSpeech.bind(adapter)
  Object.defineProperty(adapter, 'capabilities', { value: { ...adapter.capabilities, timestamps: true } })
  adapter.generateSpeech = async (options) => {
    const result = await generate({ ...options, timestamps: false })
    if (!options.timestamps) return result
    const pcm = decodeWav(Buffer.from(result.audio, 'base64'))
    const alignment = pcm && estimateAlignment(options.text, pcm)
    if (!pcm || !alignment) return result
    return { ...result, duration: result.duration ?? pcm.samples.length / pcm.channels / pcm.rate, alignment }
  }
  return adapter
}
