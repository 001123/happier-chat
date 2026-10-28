import * as React from 'react'

import { markDrawable } from '@/lib/draw-in'
import type { Visual } from '@/lib/tools'

type Step = Visual['steps'][number]
type Span = { from: number; to: number }

/** What a visual slide shows after some of its steps: positions hold item ids, so a swap moves the item itself. */
type Scene = {
  order: Array<number>
  values: Array<string>
  marks: Array<{ name: string; at: number }>
  highlight: Array<number>
  window: Span | null
  arrow: Span | null
  note: string
  done: Set<number>
}

const isIndex = (value: unknown, size: number): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0 && value < size

/**
 * Plays the first `count` steps over the items. Focus (highlight, window, arrow) lasts for its own step; marks,
 * values, order, note and finished positions carry on. Indexes outside the items are skipped, since a streaming
 * or slightly wrong step should not break the slide.
 */
function sceneAt(items: Array<string>, steps: Array<Partial<Step>>, count: number): Scene {
  const size = items.length
  const scene: Scene = {
    order: items.map((_, i) => i),
    values: [...items],
    marks: [],
    highlight: [],
    window: null,
    arrow: null,
    note: '',
    done: new Set(),
  }
  for (const step of steps.slice(0, count)) {
    scene.highlight = (step.highlight ?? []).filter((i) => isIndex(i, size))
    scene.window = step.window && isIndex(step.window.from, size) && isIndex(step.window.to, size) ? step.window : null
    scene.arrow = step.arrow && isIndex(step.arrow.from, size) && isIndex(step.arrow.to, size) ? step.arrow : null
    const [a, b] = step.swap ?? []
    if (isIndex(a, size) && isIndex(b, size)) [scene.order[a], scene.order[b]] = [scene.order[b]!, scene.order[a]!]
    for (const change of step.set ?? []) {
      if (change && isIndex(change.at, size) && typeof change.value === 'string') scene.values[scene.order[change.at]!] = change.value
    }
    for (const mark of step.marks ?? []) {
      if (!mark?.name || !isIndex(mark.at, size)) continue
      const known = scene.marks.find((m) => m.name === mark.name)
      if (known) known.at = mark.at
      else scene.marks.push({ name: mark.name, at: mark.at })
    }
    for (const i of step.done ?? []) if (isIndex(i, size)) scene.done.add(i)
    if (typeof step.note === 'string') scene.note = step.note
  }
  return scene
}

const WIDTH = 640
const HEIGHT = 360
const SIDE = 40
const BASELINE = 250
const BAR_MAX = 130
const CELL_Y = 160
const MARK_GAP = 46
const CELL_FONT = { max: 26, min: 13 }
// Average glyph width in em, to size cells and text before they render.
const GLYPH_EM = 0.58
// Room between a cell's text and its edges.
const CELL_PAD = 16
// A value that would be drawn smaller than this on one line is split over two.
const WRAP_FONT = 18
const LINE_HEIGHT = 1.2

/** Splits a value in two where it reads naturally: before a call or property, after a comma or space. */
function wrap(value: string): Array<string> {
  let best = -1
  for (let i = 1; i < value.length - 1; i++) {
    if (/[\s(.,]/.test(value[i]!) && (best < 0 || Math.abs(i - value.length / 2) < Math.abs(best - value.length / 2))) best = i
  }
  if (best < 0) return [value]
  const at = /[\s,]/.test(value[best]!) ? best + 1 : best
  return [value.slice(0, at).trim(), value.slice(at).trim()]
}
// Arrows start above what sits on an item: a bar's value, a cell's index.
const ARROW_CLEARANCE = { bars: 48, cells: 34 }
// The arrow's curve stays below the note.
const ARROW_CEILING = 72
// Marks take the hues the items do not: rose, green and amber, like the buy and sell of a price chart.
const MARK_TONES = ['var(--viz-4)', 'var(--viz-3)', 'var(--viz-2)']

/**
 * A row of values for an algorithm or data that changes with the narration: bars for numbers, cells for anything.
 * Items slide when they swap, marks slide to their new place, arrows draw in and the note pops in.
 */
export function SlideVisual({ visual, step }: { visual: Partial<Visual>; step: number }) {
  const items = (visual.items ?? []).filter((item): item is string => typeof item === 'string')
  const steps: Array<Partial<Step>> = (visual.steps ?? []).filter(Boolean)
  const scene = sceneAt(items, steps, step)
  const ref = React.useRef<SVGSVGElement>(null)
  React.useLayoutEffect(() => {
    ref.current?.querySelectorAll('.viz-draw').forEach(markDrawable)
  })
  if (items.length === 0) return null

  const numbers = scene.values.map(Number)
  const bars = visual.kind === 'bars' && numbers.every(Number.isFinite)
  const slot = (WIDTH - SIDE * 2) / items.length
  const x = (position: number) => SIDE + slot * (position + 0.5)
  // Cells widen into pills for longer values, up to their slot; values too long for one line split over two, and
  // the text shrinks to fit what is left.
  const cell = Math.min(slot * 0.82, 64)
  const widest = (values: Array<string>) => Math.max(1, ...values.map((value) => value.length))
  const cellWidth = Math.min(slot - 8, Math.max(cell, widest(scene.values) * GLYPH_EM * CELL_FONT.max + CELL_PAD))
  const fontFor = (chars: number) => Math.min(CELL_FONT.max, cell * 0.42, (cellWidth - CELL_PAD) / (chars * GLYPH_EM))
  const wrapped = fontFor(widest(scene.values)) < WRAP_FONT
  const linesOf = (value: string) => (wrapped ? wrap(value) : [value])
  const cellFont = Math.max(CELL_FONT.min, fontFor(widest(scene.values.flatMap(linesOf))))
  const cellHeight = wrapped ? Math.max(cell, 2 * cellFont * LINE_HEIGHT + CELL_PAD) : cell
  // Whatever still does not fit is squeezed to the cell, never drawn over its neighbours.
  const fit = (line: string) =>
    line.length * GLYPH_EM * cellFont > cellWidth - CELL_PAD
      ? { textLength: cellWidth - CELL_PAD, lengthAdjust: 'spacingAndGlyphs' as const }
      : {}
  const barWidth = Math.min(slot * 0.62, 72)
  const peak = Math.max(...numbers.map(Math.abs), 1)
  const heightOf = (id: number) => Math.max(4, (Math.abs(numbers[id]!) / peak) * BAR_MAX)
  // Where the top of the item at a position is, for arrows and the window.
  const topOf = (position: number) => (bars ? BASELINE - heightOf(scene.order[position]!) : CELL_Y - cellHeight / 2)
  const bottom = bars ? BASELINE : CELL_Y + cellHeight / 2
  const focus = new Set(scene.highlight)
  const tone = (name: string) => MARK_TONES[scene.marks.findIndex((m) => m.name === name) % MARK_TONES.length]

  return (
    <svg ref={ref} viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="slide-visual mx-auto h-auto max-h-[22rem] w-full" role="img">
      {scene.window && (
        <rect
          className="viz-move"
          x={x(scene.window.from) - slot / 2 + 4}
          y={Math.min(...range(scene.window).map(topOf)) - 34}
          width={slot * (scene.window.to - scene.window.from + 1) - 8}
          height={bottom - Math.min(...range(scene.window).map(topOf)) + 46}
          rx={14}
          fill="var(--viz-5)"
          fillOpacity={0.12}
          stroke="var(--viz-5)"
          strokeWidth={2}
        />
      )}

      {scene.order.map((id, position) => {
        const dim = focus.size > 0 && !focus.has(position)
        const color = scene.done.has(position) ? 'var(--viz-3)' : 'var(--viz-1)'
        const h = heightOf(id)
        return (
          <g
            key={id}
            className="viz-move"
            style={{ transform: `translateX(${x(position)}px)`, opacity: dim ? 0.35 : 1 }}
            data-point
          >
            {bars ? (
              <>
                <rect
                  className="viz-grow"
                  x={-barWidth / 2}
                  y={BASELINE - h}
                  width={barWidth}
                  height={h}
                  rx={10}
                  fill={color}
                  fillOpacity={0.85}
                  stroke={color}
                  strokeWidth={focus.has(position) ? 4 : 2}
                />
                <text key={scene.values[id]} className="viz-fade" y={BASELINE - h - 14} textAnchor="middle" fontSize={26} fill="currentColor">
                  {scene.values[id]}
                </text>
              </>
            ) : (
              <>
                <rect
                  x={-cellWidth / 2}
                  y={CELL_Y - cellHeight / 2}
                  width={cellWidth}
                  height={cellHeight}
                  rx={10}
                  fill={color}
                  fillOpacity={0.14}
                  stroke={color}
                  strokeWidth={focus.has(position) ? 4 : 2.5}
                />
                <text key={scene.values[id]} className="viz-fade" textAnchor="middle" fontSize={cellFont} fill="currentColor">
                  {linesOf(scene.values[id]!).map((line, i, lines) => (
                    <tspan
                      key={i}
                      x={0}
                      // Lines sit around the cell's middle; 0.32em drops a line's middle onto its baseline.
                      y={CELL_Y + cellFont * (0.32 + LINE_HEIGHT * (i - (lines.length - 1) / 2))}
                      {...fit(line)}
                    >
                      {line}
                    </tspan>
                  ))}
                </text>
              </>
            )}
          </g>
        )
      })}

      {!bars &&
        items.map((_, position) => (
          <text key={position} x={x(position)} y={CELL_Y - cellHeight / 2 - 10} textAnchor="middle" fontSize={14} fill="var(--muted-foreground)">
            {position}
          </text>
        ))}

      {scene.arrow && (
        <g key={`${scene.arrow.from}-${scene.arrow.to}`} stroke="var(--viz-2)" fill="none" strokeWidth={4} strokeLinecap="round">
          <ArrowPath
            from={{ x: x(scene.arrow.from), y: topOf(scene.arrow.from) - ARROW_CLEARANCE[bars ? 'bars' : 'cells'] }}
            to={{ x: x(scene.arrow.to), y: topOf(scene.arrow.to) - ARROW_CLEARANCE[bars ? 'bars' : 'cells'] }}
          />
        </g>
      )}

      {scene.marks.map((mark) => {
        const stacked = scene.marks.filter((m) => m.at === mark.at).indexOf(mark)
        return (
          <g
            key={mark.name}
            className="viz-move"
            style={{ transform: `translate(${x(mark.at)}px, ${bottom + 14 + stacked * MARK_GAP}px)` }}
            fill={tone(mark.name)}
            stroke={tone(mark.name)}
          >
            <line y1={4} y2={22} strokeWidth={3} strokeLinecap="round" />
            <path d="M-7 10 L0 0 L7 10 Z" stroke="none" />
            <text y={42} textAnchor="middle" fontSize={20} stroke="none">
              {mark.name}
            </text>
          </g>
        )
      })}

      {scene.note && (
        <text key={scene.note} className="viz-pop" x={WIDTH / 2} y={44} textAnchor="middle" fontSize={34} fontWeight={600} fill="var(--viz-2)">
          {scene.note}
        </text>
      )}
    </svg>
  )
}

const range = ({ from, to }: Span) => Array.from({ length: to - from + 1 }, (_, i) => from + i)

/** A curved arrow over the items, from one top to another: its line draws in, then its head appears. */
function ArrowPath({ from, to }: { from: { x: number; y: number }; to: { x: number; y: number } }) {
  const lift = Math.max(ARROW_CEILING, Math.min(from.y, to.y) - 30 - Math.abs(to.x - from.x) * 0.12)
  const mid = { x: (from.x + to.x) / 2, y: lift }
  // The head points along the curve's last stretch, from the control point to the end.
  const angle = Math.atan2(to.y - mid.y, to.x - mid.x)
  const head = [-0.45, 0.45].map((turn) => `${to.x - 14 * Math.cos(angle + turn)},${to.y - 14 * Math.sin(angle + turn)}`)
  return (
    <>
      <path className="viz-draw" d={`M${from.x},${from.y} Q${mid.x},${mid.y} ${to.x},${to.y}`} />
      <path className="viz-head" d={`M${head[0]} L${to.x},${to.y} L${head[1]}`} />
    </>
  )
}
