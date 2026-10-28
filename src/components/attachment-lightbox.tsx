import * as React from 'react'
import { Dialog } from '@base-ui/react/dialog'
import { HotkeysProvider, useHotkey } from '@tanstack/react-hotkeys'
import {
  IconChevronLeft,
  IconChevronRight,
  IconDownload,
  IconExternalLink,
  IconFileTypePdf,
  IconX,
  IconZoomIn,
  IconZoomOut,
} from '@tabler/icons-react'
import { cn } from 'cn'

import { defineMessages, useMessages } from '@/lib/i18n'

const messages = defineMessages({
  vi: {
    previous: 'Trước',
    next: 'Tiếp',
    openTab: 'Mở trong tab mới',
    download: 'Tải về',
    close: 'Đóng',
    zoomIn: 'Phóng to',
    zoomOut: 'Thu nhỏ',
    fit: 'Vừa màn hình',
    imageHint: 'Cuộn hoặc nhấp đúp để phóng to, kéo để di chuyển',
    file: 'File',
  },
  en: {
    previous: 'Previous',
    next: 'Next',
    openTab: 'Open in new tab',
    download: 'Download',
    close: 'Close',
    zoomIn: 'Zoom in',
    zoomOut: 'Zoom out',
    fit: 'Fit to screen',
    imageHint: 'Scroll or double-click to zoom, drag to move',
    file: 'File',
  },
})

export type LightboxFile = { kind: 'image' | 'pdf'; src: string; name: string | null }

/** Full-screen preview of a message's images and PDFs, with arrow keys to step through them. */
export function AttachmentLightbox({
  files,
  index,
  onIndexChange,
}: {
  files: ReadonlyArray<LightboxFile>
  /** The file shown, or null when closed. */
  index: number | null
  onIndexChange: (index: number | null) => void
}) {
  const open = index !== null && files[index] !== undefined
  return (
    <Dialog.Root open={open} onOpenChange={(next) => !next && onIndexChange(null)}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/85 transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0 supports-backdrop-filter:backdrop-blur-sm" />
        <Dialog.Popup className="fixed inset-0 z-50 flex flex-col text-white outline-hidden transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0">
          {/* Only the lightbox's own hotkeys fire while it is open. */}
          <HotkeysProvider scope="attachment-lightbox" exclusive>
            {open && <LightboxBody files={files} index={index} onIndexChange={onIndexChange} />}
          </HotkeysProvider>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

type View = { scale: number; x: number; y: number; smooth?: boolean }

const FIT: View = { scale: 1, x: 0, y: 0 }
const MAX_SCALE = 8
const STEP = 1.5

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

/**
 * Zoom and pan for an image that is laid out to fit its stage: scale 1 is the fitted size, the offset is the
 * image center's distance from where the layout put it. Wheel and trackpad pinch zoom around the pointer, a
 * drag (one finger on touch) pans, two fingers pinch. The offset is clamped so the image never leaves the stage.
 */
function usePanZoom(enabled: boolean) {
  const enabledRef = React.useRef(enabled)
  enabledRef.current = enabled
  const stageRef = React.useRef<HTMLDivElement>(null)
  const imageRef = React.useRef<HTMLImageElement>(null)
  const [view, setView] = React.useState<View>(FIT)
  const viewRef = React.useRef(view)
  viewRef.current = view
  const pointers = React.useRef(new Map<number, { x: number; y: number }>())
  const gestureStart = React.useRef({ x: 0, y: 0 })
  // A drag or pinch is not a click: it must not close the lightbox when it ends on the empty area.
  const moved = React.useRef(false)

  const bounded = (next: View): View => {
    const stage = stageRef.current
    const image = imageRef.current
    const scale = clamp(next.scale, 1, MAX_SCALE)
    if (!stage || !image) return { ...next, scale }
    const maxX = Math.max(0, (image.offsetWidth * scale - stage.clientWidth) / 2)
    const maxY = Math.max(0, (image.offsetHeight * scale - stage.clientHeight) / 2)
    return { scale, x: clamp(next.x, -maxX, maxX), y: clamp(next.y, -maxY, maxY), smooth: next.smooth }
  }

  /** The point's offset from the image's untransformed center, which is the origin of its transform. */
  const fromCenter = (clientX: number, clientY: number) => {
    const stage = stageRef.current
    const image = imageRef.current
    if (!stage || !image) return { x: 0, y: 0 }
    const rect = stage.getBoundingClientRect()
    return {
      x: clientX - (rect.left + image.offsetLeft + image.offsetWidth / 2),
      y: clientY - (rect.top + image.offsetTop + image.offsetHeight / 2),
    }
  }

  /** Scales by `factor`, keeping the image point under `at` (an offset from the center) where it is. */
  const zoomAround = (current: View, factor: number, at: { x: number; y: number }, smooth = false) => {
    const scale = clamp(current.scale * factor, 1, MAX_SCALE)
    const ratio = scale / current.scale
    return bounded({ scale, x: at.x - (at.x - current.x) * ratio, y: at.y - (at.y - current.y) * ratio, smooth })
  }

  const zoomAt = (clientX: number, clientY: number, factor: number, smooth = false) =>
    setView((current) => zoomAround(current, factor, fromCenter(clientX, clientY), smooth))

  /** Toolbar and keys: around the middle of the stage. */
  const zoomBy = (factor: number) => {
    const rect = stageRef.current?.getBoundingClientRect()
    if (rect) zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, factor, true)
  }

  const reset = (smooth = false) => setView({ ...FIT, smooth })

  // React registers wheel listeners as passive, and a passive one cannot stop Ctrl+wheel (a trackpad pinch)
  // from zooming the whole page.
  React.useEffect(() => {
    const stage = stageRef.current
    if (!stage) return
    const onWheel = (event: WheelEvent) => {
      if (!enabledRef.current) return
      event.preventDefault()
      const lines = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? stage.clientHeight : 1
      // A sideways trackpad scroll on a zoomed image pans; everything else (a mouse wheel, a pinch) zooms.
      if (!event.ctrlKey && event.deltaX !== 0 && viewRef.current.scale > 1) {
        setView((current) => bounded({ scale: current.scale, x: current.x - event.deltaX * lines, y: current.y - event.deltaY * lines }))
        return
      }
      // A pinch sends small deltas, so it gets a stronger factor than a wheel notch (about 100px).
      const factor = Math.exp(-event.deltaY * lines * (event.ctrlKey ? 0.01 : 0.0025))
      zoomAt(event.clientX, event.clientY, factor)
    }
    stage.addEventListener('wheel', onWheel, { passive: false })
    return () => stage.removeEventListener('wheel', onWheel)
  }, [])

  // Keeps the image inside the stage when the window is resized.
  React.useEffect(() => {
    const stage = stageRef.current
    if (!stage) return
    const observer = new ResizeObserver(() => setView((current) => bounded(current)))
    observer.observe(stage)
    return () => observer.disconnect()
  }, [])

  const stageHandlers = {
    onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
      if (!enabledRef.current || (event.pointerType === 'mouse' && event.button !== 0)) return
      // Buttons on the stage (previous / next) keep their own clicks.
      if ((event.target as HTMLElement).closest('button')) return
      if (pointers.current.size === 0) {
        moved.current = false
        gestureStart.current = { x: event.clientX, y: event.clientY }
      }
      pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    },
    onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
      const previous = pointers.current.get(event.pointerId)
      if (!previous) return
      const point = { x: event.clientX, y: event.clientY }
      pointers.current.set(event.pointerId, point)
      if (!moved.current) {
        const distance = Math.hypot(point.x - gestureStart.current.x, point.y - gestureStart.current.y)
        if (distance < 4 && pointers.current.size === 1) return
        // Captured only once it is a drag: a capture at pointerdown would send the click (and double-click) to the
        // stage instead of the image, and a click on the image would close the lightbox.
        moved.current = true
        for (const id of pointers.current.keys()) event.currentTarget.setPointerCapture(id)
      }
      if (pointers.current.size === 1) {
        const dx = point.x - previous.x
        const dy = point.y - previous.y
        if (viewRef.current.scale > 1) setView((current) => bounded({ scale: current.scale, x: current.x + dx, y: current.y + dy }))
      } else if (pointers.current.size === 2) {
        const other = [...pointers.current.entries()].find(([id]) => id !== event.pointerId)![1]
        const before = Math.hypot(previous.x - other.x, previous.y - other.y)
        const after = Math.hypot(point.x - other.x, point.y - other.y)
        const midBefore = { x: (previous.x + other.x) / 2, y: (previous.y + other.y) / 2 }
        const midAfter = { x: (point.x + other.x) / 2, y: (point.y + other.y) / 2 }
        setView((current) => {
          const zoomed = zoomAround(current, before > 0 ? after / before : 1, fromCenter(midAfter.x, midAfter.y))
          return bounded({ scale: zoomed.scale, x: zoomed.x + midAfter.x - midBefore.x, y: zoomed.y + midAfter.y - midBefore.y })
        })
      }
    },
    onPointerUp(event: React.PointerEvent<HTMLDivElement>) {
      pointers.current.delete(event.pointerId)
    },
    onPointerCancel(event: React.PointerEvent<HTMLDivElement>) {
      pointers.current.delete(event.pointerId)
    },
  }

  return { stageRef, imageRef, view, zoomAt, zoomBy, reset, moved, stageHandlers }
}

function LightboxBody({
  files,
  index,
  onIndexChange,
}: {
  files: ReadonlyArray<LightboxFile>
  index: number
  onIndexChange: (index: number | null) => void
}) {
  const t = useMessages(messages)
  const file = files[index]!
  const name = file.name ?? (file.kind === 'pdf' ? 'document.pdf' : t.file)
  const many = files.length > 1
  const isImage = file.kind === 'image'
  const zoom = usePanZoom(isImage)
  const { view } = zoom
  const go = (step: number) => {
    zoom.reset()
    onIndexChange((index + step + files.length) % files.length)
  }
  useHotkey('ArrowLeft', () => go(-1), { enabled: many })
  useHotkey('ArrowRight', () => go(1), { enabled: many })
  useHotkey('=', () => zoom.zoomBy(STEP), { enabled: isImage })
  useHotkey('-', () => zoom.zoomBy(1 / STEP), { enabled: isImage })
  useHotkey('0', () => zoom.reset(true), { enabled: isImage })

  const iconButton =
    'flex size-9 shrink-0 items-center justify-center rounded-full text-white/80 transition-colors hover:bg-white/15 hover:text-white disabled:pointer-events-none disabled:opacity-40'

  return (
    <>
      <header className="flex h-14 shrink-0 items-center gap-1 px-3 sm:gap-2 sm:px-4">
        {file.kind === 'pdf' && <IconFileTypePdf className="size-5 shrink-0 text-red-400" />}
        <Dialog.Title className="min-w-0 truncate text-sm font-medium">{name}</Dialog.Title>
        {many && (
          <span className="shrink-0 text-sm text-white/60 tabular-nums">
            {index + 1} / {files.length}
          </span>
        )}
        <span className="ml-auto" />
        {isImage && (
          <div className="mr-1 flex items-center rounded-full bg-white/10 sm:mr-2">
            <button type="button" aria-label={t.zoomOut} title={t.zoomOut} disabled={view.scale <= 1} onClick={() => zoom.zoomBy(1 / STEP)} className={iconButton}>
              <IconZoomOut className="size-5" />
            </button>
            <button
              type="button"
              title={t.fit}
              aria-label={t.fit}
              onClick={() => zoom.reset(true)}
              className="w-12 text-center text-xs text-white/80 tabular-nums hover:text-white"
            >
              {Math.round(view.scale * 100)}%
            </button>
            <button type="button" aria-label={t.zoomIn} title={t.zoomIn} disabled={view.scale >= MAX_SCALE} onClick={() => zoom.zoomBy(STEP)} className={iconButton}>
              <IconZoomIn className="size-5" />
            </button>
          </div>
        )}
        <a href={file.src} target="_blank" rel="noreferrer" aria-label={t.openTab} title={t.openTab} className={iconButton}>
          <IconExternalLink className="size-5" />
        </a>
        <a href={file.src} download={name} aria-label={t.download} title={t.download} className={iconButton}>
          <IconDownload className="size-5" />
        </a>
        <Dialog.Close aria-label={t.close} title={t.close} className={iconButton}>
          <IconX className="size-5" />
        </Dialog.Close>
      </header>

      <div
        ref={zoom.stageRef}
        {...zoom.stageHandlers}
        className={cn(
          'relative flex min-h-0 flex-1 items-center justify-center overflow-hidden',
          isImage ? 'touch-none p-3 select-none sm:px-16 sm:pb-6' : 'px-3 pb-3 sm:px-16 sm:pb-6',
          isImage && view.scale > 1 && 'cursor-grab active:cursor-grabbing',
        )}
        // A click on the empty area around the file closes, like on the backdrop of any dialog; the end of a drag does not.
        onClick={(event) => {
          if (event.target === event.currentTarget && !zoom.moved.current) onIndexChange(null)
        }}
      >
        {isImage ? (
          <img
            key={file.src}
            ref={zoom.imageRef}
            src={file.src}
            alt={name}
            draggable={false}
            title={view.scale === 1 ? t.imageHint : undefined}
            onDoubleClick={(event) => (view.scale > 1 ? zoom.reset(true) : zoom.zoomAt(event.clientX, event.clientY, 2.5, true))}
            style={{
              transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
              transition: view.smooth ? 'transform 180ms ease-out' : undefined,
            }}
            className={cn(
              'max-h-full max-w-full rounded-md object-contain shadow-2xl will-change-transform animate-in fade-in duration-150',
              view.scale === 1 && 'cursor-zoom-in',
            )}
          />
        ) : (
          <iframe key={file.src} src={file.src} title={name} className="size-full max-w-5xl rounded-md bg-white shadow-2xl" />
        )}

        {many && (
          <>
            <button
              type="button"
              aria-label={t.previous}
              onClick={() => go(-1)}
              className={cn(iconButton, 'absolute top-1/2 left-2 -translate-y-1/2 bg-black/40 sm:left-4')}
            >
              <IconChevronLeft className="size-6" />
            </button>
            <button
              type="button"
              aria-label={t.next}
              onClick={() => go(1)}
              className={cn(iconButton, 'absolute top-1/2 right-2 -translate-y-1/2 bg-black/40 sm:right-4')}
            >
              <IconChevronRight className="size-6" />
            </button>
          </>
        )}
      </div>
    </>
  )
}
