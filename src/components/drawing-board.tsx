import * as React from 'react'
import {
  IconAlertTriangle,
  IconArrowBackUp,
  IconBrush,
  IconEraser,
  IconPhotoUp,
  IconSend,
  IconTrash,
} from '@tabler/icons-react'
import { cn } from 'cn'

import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { defineMessages, useMessages } from '@/lib/i18n'
import type { DrawingBoardInput } from '@/lib/tools'

/** Export size in pixels: big enough for a model to read a sketch, small enough to keep the transcript light. */
const SIZE = 512
// Warm off-white: easier on the eyes next to dark themes, still high contrast for the ink and for the model.
const PAPER = [241, 233, 220] as const
const COLORS = ['#1c1917', '#dc2626', '#ea580c', '#facc15', '#16a34a', '#2563eb', '#9333ea', '#92400e'] as const
const WIDTHS = [4, 10, 22] as const

type Point = { x: number; y: number }
type Stroke = { color: string; width: number; erase: boolean; points: Array<Point> }

const messages = defineMessages({
  vi: {
    pen: 'Bút',
    eraser: 'Tẩy',
    color: (c: string) => `Màu ${c}`,
    width: (w: number) => `Nét ${w}px`,
    undo: 'Hoàn tác',
    clear: 'Xoá hết',
    continuePrevious: 'Vẽ tiếp hình trước',
    send: 'Gửi hình',
    guess: 'Đoán xem tôi vẽ gì?',
    canvas: 'Bảng vẽ',
    closed: 'Bảng vẽ đã đóng.',
    noVision: 'Model đang chọn có thể không đọc được ảnh. Hãy chuyển sang model hỗ trợ ảnh để nó đoán được.',
    preparing: 'Đang mở bảng vẽ…',
  },
  en: {
    pen: 'Pen',
    eraser: 'Eraser',
    color: (c: string) => `Color ${c}`,
    width: (w: number) => `${w}px stroke`,
    undo: 'Undo',
    clear: 'Clear',
    continuePrevious: 'Continue last drawing',
    send: 'Send drawing',
    guess: 'Guess what I drew?',
    canvas: 'Drawing board',
    closed: 'This board is closed.',
    noVision: 'The selected model may not read images. Switch to a model with image input so it can guess.',
    preparing: 'Opening the drawing board…',
  },
})

export function DrawingBoard({
  input,
  active,
  previous,
  visionSupported,
  onSend,
}: {
  input: Partial<DrawingBoardInput>
  /** Only the latest board takes drawings. */
  active: boolean
  /** The user's last drawing in this thread, as a data URL, to keep drawing on top of it. */
  previous?: string
  /** `false` when the model catalog says the model takes no image input. */
  visionSupported: boolean | null
  onSend: (text: string, pngBase64: string) => void
}) {
  const t = useMessages(messages)
  const canvasRef = React.useRef<HTMLCanvasElement>(null)
  // Strokes go on a separate ink layer so the eraser can cut back to the paper texture underneath.
  const inkRef = React.useRef<HTMLCanvasElement | null>(null)
  const strokesRef = React.useRef<Array<Stroke>>([])
  const drawingRef = React.useRef<Stroke | null>(null)
  const [base, setBase] = React.useState<HTMLImageElement | null>(null)
  const [color, setColor] = React.useState<string>(COLORS[0])
  const [width, setWidth] = React.useState<number>(WIDTHS[1])
  const [erasing, setErasing] = React.useState(false)
  const [strokeCount, setStrokeCount] = React.useState(0)

  function ink() {
    if (!inkRef.current) {
      inkRef.current = document.createElement('canvas')
      inkRef.current.width = SIZE
      inkRef.current.height = SIZE
    }
    return inkRef.current.getContext('2d')!
  }

  function compose() {
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    ctx.drawImage(paperTexture(), 0, 0)
    ctx.drawImage(ink().canvas, 0, 0)
  }

  const redraw = React.useCallback(() => {
    const layer = ink()
    layer.clearRect(0, 0, SIZE, SIZE)
    // A previous drawing already has the same paper baked in, so erasing it still shows matching paper.
    if (base) layer.drawImage(base, 0, 0, SIZE, SIZE)
    for (const stroke of strokesRef.current) drawStroke(layer, stroke)
    compose()
  }, [base])

  React.useEffect(() => {
    if (active) redraw()
  }, [active, redraw])

  if (!active) {
    return (
      <div className="flex w-full max-w-2xl items-center gap-2 text-sm text-muted-foreground">
        <IconBrush className="size-4 shrink-0" />
        <span>
          {input.prompt} <span className="opacity-70">{t.closed}</span>
        </span>
      </div>
    )
  }

  function toCanvas(event: React.PointerEvent<HTMLCanvasElement>): Point {
    const rect = event.currentTarget.getBoundingClientRect()
    return { x: ((event.clientX - rect.left) / rect.width) * SIZE, y: ((event.clientY - rect.top) / rect.height) * SIZE }
  }

  function onPointerDown(event: React.PointerEvent<HTMLCanvasElement>) {
    if (event.button !== 0) return
    event.currentTarget.setPointerCapture(event.pointerId)
    const stroke = { color, width: erasing ? width * 2 : width, erase: erasing, points: [toCanvas(event)] }
    drawingRef.current = stroke
    drawStroke(ink(), stroke)
    compose()
  }

  function onPointerMove(event: React.PointerEvent<HTMLCanvasElement>) {
    const stroke = drawingRef.current
    if (!stroke) return
    const ctx = ink()
    // Coalesced events keep fast strokes smooth on pens and touch screens.
    // The list can be empty (synthetic events), so fall back to the event itself.
    const coalesced = event.nativeEvent.getCoalescedEvents?.() ?? []
    const events = coalesced.length > 0 ? coalesced : [event.nativeEvent]
    const rect = event.currentTarget.getBoundingClientRect()
    for (const e of events) {
      const from = stroke.points.at(-1)!
      const to = { x: ((e.clientX - rect.left) / rect.width) * SIZE, y: ((e.clientY - rect.top) / rect.height) * SIZE }
      stroke.points.push(to)
      drawStroke(ctx, { ...stroke, points: [from, to] })
    }
    compose()
  }

  function onPointerUp() {
    const stroke = drawingRef.current
    if (!stroke) return
    drawingRef.current = null
    strokesRef.current.push(stroke)
    setStrokeCount(strokesRef.current.length)
  }

  function undo() {
    strokesRef.current.pop()
    setStrokeCount(strokesRef.current.length)
    redraw()
  }

  function clear() {
    strokesRef.current = []
    setStrokeCount(0)
    // Dropping the base image redraws through the effect; without one, redraw here.
    if (base) setBase(null)
    else redraw()
  }

  function continuePrevious() {
    if (!previous) return
    const image = new Image()
    image.onload = () => {
      strokesRef.current = []
      setStrokeCount(0)
      setBase(image)
    }
    image.src = previous
  }

  function send() {
    const canvas = canvasRef.current
    if (!canvas) return
    const dataUrl = canvas.toDataURL('image/png')
    onSend(t.guess, dataUrl.slice(dataUrl.indexOf(',') + 1))
  }

  const empty = strokeCount === 0 && !base

  return (
    <div className="flex w-full max-w-md flex-col gap-3 animate-in fade-in slide-in-from-bottom-1 duration-200">
      {input.prompt && <p className="font-serif text-reply leading-[1.7]">{input.prompt}</p>}

      {visionSupported === false && (
        <p className="flex items-start gap-2 rounded-2xl bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-200">
          <IconAlertTriangle className="mt-0.5 size-4 shrink-0" />
          {t.noVision}
        </p>
      )}

      <canvas
        ref={canvasRef}
        width={SIZE}
        height={SIZE}
        role="img"
        aria-label={t.canvas}
        className={cn(
          'aspect-square w-full touch-none rounded-2xl border border-border shadow-xs',
          erasing ? 'cursor-cell' : 'cursor-crosshair',
        )}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      />

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {/* Padding keeps the selected swatch's offset ring inside the message column, which clips overflow. */}
        <div className="flex items-center gap-1.5 p-1" role="radiogroup" aria-label={t.pen}>
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={!erasing && color === c}
              aria-label={t.color(c)}
              title={t.color(c)}
              onClick={() => {
                setColor(c)
                setErasing(false)
              }}
              className={cn(
                'size-6 cursor-pointer rounded-full border border-black/10 transition-transform hover:scale-110 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none',
                !erasing && color === c && 'ring-2 ring-ring ring-offset-2 ring-offset-background',
              )}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>

        <div className="flex items-center gap-0.5" role="radiogroup" aria-label={t.width(width)}>
          {WIDTHS.map((w) => (
            <button
              key={w}
              type="button"
              role="radio"
              aria-checked={width === w}
              aria-label={t.width(w)}
              title={t.width(w)}
              onClick={() => setWidth(w)}
              className={cn(
                'flex size-8 cursor-pointer items-center justify-center rounded-lg text-foreground transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none',
                width === w && 'bg-muted',
              )}
            >
              <span className="rounded-full bg-current" style={{ width: w / 2 + 3, height: w / 2 + 3 }} />
            </button>
          ))}
        </div>

        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-pressed={!erasing}
            aria-label={t.pen}
            title={t.pen}
            className="aria-pressed:bg-muted"
            onClick={() => setErasing(false)}
          >
            <IconBrush />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-pressed={erasing}
            aria-label={t.eraser}
            title={t.eraser}
            className="aria-pressed:bg-muted"
            onClick={() => setErasing(true)}
          >
            <IconEraser />
          </Button>
          <Button variant="ghost" size="icon-sm" aria-label={t.undo} title={t.undo} disabled={strokeCount === 0} onClick={undo}>
            <IconArrowBackUp />
          </Button>
          <Button variant="ghost" size="icon-sm" aria-label={t.clear} title={t.clear} disabled={empty} onClick={clear}>
            <IconTrash />
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2">
        {previous && !base && (
          <Button variant="ghost" size="sm" className="mr-auto -ml-2 text-muted-foreground" onClick={continuePrevious}>
            <IconPhotoUp />
            {t.continuePrevious}
          </Button>
        )}
        <Button size="sm" disabled={empty} onClick={send}>
          <IconSend />
          {t.send}
        </Button>
      </div>
    </div>
  )
}

export function DrawingBoardSkeleton() {
  const t = useMessages(messages)
  return (
    <div className="flex w-full max-w-md flex-col gap-3" aria-label={t.preparing}>
      <Skeleton className="h-4 w-48" />
      <Skeleton className="aspect-square w-full rounded-2xl" />
    </div>
  )
}

function drawStroke(ctx: CanvasRenderingContext2D, stroke: Stroke) {
  const [first, ...rest] = stroke.points
  if (!first) return
  ctx.globalCompositeOperation = stroke.erase ? 'destination-out' : 'source-over'
  ctx.strokeStyle = stroke.color
  ctx.fillStyle = stroke.color
  ctx.lineWidth = stroke.width
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  if (rest.length === 0) {
    ctx.beginPath()
    ctx.arc(first.x, first.y, stroke.width / 2, 0, Math.PI * 2)
    ctx.fill()
    return
  }
  ctx.beginPath()
  ctx.moveTo(first.x, first.y)
  for (const point of rest) ctx.lineTo(point.x, point.y)
  ctx.stroke()
}

let paper: HTMLCanvasElement | null = null

/**
 * Paper texture: soft mottling, a few fibers, fine grain and slightly darker edges. Seeded, so every board
 * and every sent drawing gets the same sheet and "continue last drawing" lines up with it.
 */
function paperTexture() {
  if (paper) return paper
  paper = document.createElement('canvas')
  paper.width = SIZE
  paper.height = SIZE
  const ctx = paper.getContext('2d')!
  const random = mulberry32(0x9a9e7)
  const [r, g, b] = PAPER
  ctx.fillStyle = `rgb(${r} ${g} ${b})`
  ctx.fillRect(0, 0, SIZE, SIZE)

  for (let i = 0; i < 36; i++) {
    const x = random() * SIZE
    const y = random() * SIZE
    const radius = 40 + random() * 120
    const blotch = ctx.createRadialGradient(x, y, 0, x, y, radius)
    const tone = random() < 0.5 ? '120 95 60' : '255 252 245'
    blotch.addColorStop(0, `rgb(${tone} / ${0.03 + random() * 0.03})`)
    blotch.addColorStop(1, `rgb(${tone} / 0)`)
    ctx.fillStyle = blotch
    ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2)
  }

  ctx.lineCap = 'round'
  for (let i = 0; i < 140; i++) {
    const x = random() * SIZE
    const y = random() * SIZE
    const angle = random() * Math.PI * 2
    const length = 6 + random() * 18
    ctx.strokeStyle = `rgb(110 85 55 / ${0.04 + random() * 0.05})`
    ctx.lineWidth = 0.6 + random() * 0.6
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.quadraticCurveTo(
      x + Math.cos(angle) * length * 0.5 + (random() - 0.5) * 6,
      y + Math.sin(angle) * length * 0.5 + (random() - 0.5) * 6,
      x + Math.cos(angle) * length,
      y + Math.sin(angle) * length,
    )
    ctx.stroke()
  }

  const image = ctx.getImageData(0, 0, SIZE, SIZE)
  for (let i = 0; i < image.data.length; i += 4) {
    const grain = (random() - 0.5) * 10
    image.data[i] += grain
    image.data[i + 1] += grain
    image.data[i + 2] += grain
  }
  ctx.putImageData(image, 0, 0)

  const edges = ctx.createRadialGradient(SIZE / 2, SIZE / 2, SIZE * 0.35, SIZE / 2, SIZE / 2, SIZE * 0.75)
  edges.addColorStop(0, 'rgb(120 90 50 / 0)')
  edges.addColorStop(1, 'rgb(120 90 50 / 0.1)')
  ctx.fillStyle = edges
  ctx.fillRect(0, 0, SIZE, SIZE)
  return paper
}

function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
