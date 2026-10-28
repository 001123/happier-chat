import * as React from 'react'
import { Menu } from '@base-ui/react/menu'
import {
  IconAlertTriangle,
  IconCode,
  IconCube,
  IconDownload,
  IconFileTypeHtml,
  IconFocusCentered,
  IconGrid4x4,
  IconLoader2,
  IconMaximize,
  IconMinimize,
  IconPhoto,
  IconPlayerPause,
  IconPlayerPlay,
  IconRefresh,
  IconTag,
  IconTagOff,
  IconTool,
} from '@tabler/icons-react'
import { cn } from 'cn'
import { Streamdown } from 'streamdown'
import { code as codePlugin } from '@streamdown/code'

import { itemClass, popupClass } from '@/components/composer-settings-menu'
import { Button } from '@/components/ui/button'
import { defineMessages, useLocale, useMessages } from '@/lib/i18n'
import type { SceneCommand, SceneMessage, ViewOptions } from '@/lib/scene-runtime'
import { SCENE_PARAMS } from '@/lib/tools'
import type { SceneInput } from '@/lib/tools'

const messages = defineMessages({
  vi: {
    scene: 'Mô hình 3D',
    writing: (lines: number) => (lines > 1 ? `Đang viết mã mô hình… ${lines} dòng` : 'Đang viết mã mô hình…'),
    loading: 'Đang dựng mô hình…',
    hint: 'Kéo để xoay · cuộn để phóng to · chuột phải để di chuyển',
    resetView: 'Về góc nhìn ban đầu',
    showCode: 'Xem mã',
    hideCode: 'Ẩn mã',
    showLabels: 'Hiện chú thích',
    hideLabels: 'Ẩn chú thích',
    showGrid: 'Hiện lưới',
    hideGrid: 'Ẩn lưới',
    pause: 'Tạm dừng chuyển động',
    play: 'Tiếp tục chuyển động',
    download: 'Tải về',
    downloadGlb: 'Mô hình .glb',
    downloadPng: 'Ảnh .png',
    downloadHtml: 'Trang .html chạy độc lập',
    fullscreen: 'Toàn màn hình',
    exitFullscreen: 'Thoát toàn màn hình',
    failed: 'Không chạy được mô hình',
    exportFailed: (message: string) => `Không xuất được file: ${message}`,
    timeout: 'Mô hình khởi động quá lâu.',
    runtimeFailed: 'Không tải được three.js, kiểm tra kết nối rồi thử lại.',
    rerun: 'Chạy lại',
    askFix: 'Nhờ sửa lỗi',
    fixRequest: (title: string, error: string) => `Mô hình 3D "${title}" bị lỗi khi chạy:\n${error}\nSửa lại giúp mình nhé.`,
  },
  en: {
    scene: '3D model',
    writing: (lines: number) => (lines > 1 ? `Writing the model code… ${lines} lines` : 'Writing the model code…'),
    loading: 'Building the model…',
    hint: 'Drag to rotate · scroll to zoom · right-drag to pan',
    resetView: 'Reset view',
    showCode: 'Show code',
    hideCode: 'Hide code',
    showLabels: 'Show labels',
    hideLabels: 'Hide labels',
    showGrid: 'Show grid',
    hideGrid: 'Hide grid',
    pause: 'Pause motion',
    play: 'Resume motion',
    download: 'Download',
    downloadGlb: '.glb model',
    downloadPng: '.png image',
    downloadHtml: 'Standalone .html page',
    fullscreen: 'Full screen',
    exitFullscreen: 'Exit full screen',
    failed: 'The model could not run',
    exportFailed: (message: string) => `Could not export the file: ${message}`,
    timeout: 'The model took too long to start.',
    runtimeFailed: 'Could not load three.js, check your connection and try again.',
    rerun: 'Run again',
    askFix: 'Ask to fix it',
    fixRequest: (title: string, error: string) => `The 3D model "${title}" fails when it runs:\n${error}\nPlease fix it.`,
  },
})

const STREAMDOWN_PLUGINS = { code: codePlugin }
const START_TIMEOUT_MS = 20_000

// No network, frames, workers or fonts: the scene only draws what its own code builds.
const FRAME_CSP = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:"
// The page is transparent so the card's themed backdrop shows through; labels and the lil-gui panel take the
// theme's popover colors, which the card sends as `--scene-*` variables and updates when the theme changes.
const FRAME_STYLE = [
  ':root{--scene-panel:#fff;--scene-text:#3d3929;--scene-border:#e5e2d6;--scene-hover:#ebe9df;--scene-accent:#b4532f}',
  'html,body{margin:0;height:100%;overflow:hidden;background:transparent;color:var(--scene-text);font:13px/1.4 system-ui,sans-serif}',
  'canvas{display:block;touch-action:none}',
  '.labels{position:absolute;top:0;left:0;pointer-events:none}.labels[hidden]{display:none}',
  '.label{padding:2px 8px;border-radius:999px;border:1px solid var(--scene-border);background:color-mix(in srgb,var(--scene-panel) 88%,transparent);color:var(--scene-text);font:500 12px/1.4 system-ui,sans-serif;white-space:nowrap;box-shadow:0 1px 3px rgb(0 0 0/.15)}',
  ':root .lil-gui{--background-color:var(--scene-panel);--text-color:var(--scene-text);--title-background-color:var(--scene-hover);--title-text-color:var(--scene-text);--widget-color:var(--scene-hover);--hover-color:color-mix(in srgb,var(--scene-hover) 85%,var(--scene-text));--focus-color:color-mix(in srgb,var(--scene-hover) 75%,var(--scene-text));--number-color:var(--scene-accent);--string-color:var(--scene-accent)}',
  ':root .lil-gui.root{top:8px;right:8px;border:1px solid var(--scene-border);border-radius:8px;overflow:hidden}',
].join('')
// App theme variables behind each `--scene-*` color; read at runtime, so custom colors apply too.
const THEME_COLORS = {
  '--scene-panel': '--popover',
  '--scene-text': '--popover-foreground',
  '--scene-border': '--border',
  '--scene-hover': '--accent',
  '--scene-accent': '--primary',
} as const
// Lit from the top with a hint of the primary color, darkening toward the page background at the edges.
const STAGE_BACKGROUND =
  'radial-gradient(130% 100% at 50% 0%, color-mix(in oklab, var(--primary) 10%, var(--card)) 0%, var(--card) 45%, var(--background) 100%)'
const CODE_LINE_TOKEN = '__SCENE_CODE_LINE__'

/** Keeps a script's text from ending its <script> element early or switching the HTML parser into comment mode. */
const escapeScript = (source: string) => source.replace(/<\/(script)/gi, '<\\/$1').replace(/<!--/g, '<\\!--')

/** A self-contained page: three.js and the frame runtime, then the model's code as the body of an async function. */
function sceneDocument(runtime: string, code: string, lang: string, title: string) {
  const head = [
    '<!doctype html>',
    `<html lang="${lang}" data-code-line="${CODE_LINE_TOKEN}">`,
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width,initial-scale=1">',
    `<meta http-equiv="Content-Security-Policy" content="${FRAME_CSP}">`,
    `<title>${title.replace(/[<&"]/g, (c) => `&#${c.charCodeAt(0)};`)}</title>`,
    `<style>${FRAME_STYLE}</style>`,
    '</head>',
    '<body>',
    `<script>${escapeScript(runtime)}</script>`,
    `<script>__scene.run(async ({ ${SCENE_PARAMS.join(', ')} }) => {`,
  ].join('\n')
  const codeLine = head.split('\n').length + 1
  return `${head.replace(CODE_LINE_TOKEN, String(codeLine))}\n${escapeScript(code)}\n})</script>\n</body>\n</html>\n`
}

function readThemeColors(): Record<string, string> {
  const style = getComputedStyle(document.documentElement)
  return Object.fromEntries(Object.entries(THEME_COLORS).map(([name, source]) => [name, style.getPropertyValue(source).trim()]))
}

/** The `--scene-*` colors for the current theme; a theme switch or custom color edit restyles the root element. */
function useThemeColors() {
  const [colors, setColors] = React.useState<Record<string, string> | null>(null)
  React.useEffect(() => {
    const update = () =>
      setColors((current) => {
        const next = readThemeColors()
        return JSON.stringify(next) === JSON.stringify(current) ? current : next
      })
    update()
    const observer = new MutationObserver(update)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'style'] })
    return () => observer.disconnect()
  }, [])
  return colors
}

/** The page as downloaded: today's theme colors and backdrop baked in, since nothing sends them there. */
function standalonePage(page: string, colors: Record<string, string> | null, stage: HTMLElement | null) {
  const vars = Object.entries(colors ?? {})
    .map(([name, value]) => `${name}:${value}`)
    .join(';')
  const backdrop = stage ? getComputedStyle(stage) : null
  const background = backdrop ? `background-color:${backdrop.backgroundColor};background-image:${backdrop.backgroundImage}` : ''
  return page.replace('</head>', `<style>:root{${vars}}html{${background}}</style>\n</head>`)
}

// Loaded on first use and shared by every card: three.js is too big for the main bundle.
let runtimeSource: Promise<string> | undefined

function loadRuntime() {
  runtimeSource ??= import('virtual:scene-runtime').then(
    (module) => module.default,
    (error: unknown) => {
      runtimeSource = undefined
      throw error
    },
  )
  return runtimeSource
}

function useIsFullscreen(ref: React.RefObject<HTMLElement | null>) {
  const [fullscreen, setFullscreen] = React.useState(false)
  React.useEffect(() => {
    const update = () => setFullscreen(document.fullscreenElement !== null && document.fullscreenElement === ref.current)
    document.addEventListener('fullscreenchange', update)
    return () => document.removeEventListener('fullscreenchange', update)
  }, [ref])
  return fullscreen
}

/**
 * Whether the element is on or near the screen; offscreen scenes give their WebGL context back. A new `recheck`
 * value observes it afresh, so the decision is taken from where the element is at that moment.
 */
function useNearViewport(ref: React.RefObject<HTMLElement | null>, recheck: unknown) {
  const [near, setNear] = React.useState(false)
  React.useEffect(() => {
    const element = ref.current
    if (!element) return
    // While the chat streams, several changes can arrive in one callback, oldest first: only the last one is current.
    const observer = new IntersectionObserver((entries) => setNear(entries.at(-1)!.isIntersecting), { rootMargin: '50% 0px' })
    observer.observe(element)
    return () => observer.disconnect()
  }, [ref, recheck])
  return near
}

function download(data: Blob, name: string) {
  const url = URL.createObjectURL(data)
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

const fileName = (title: string) =>
  title
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .replace(/[^\w]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase() || 'scene'

type Status = { kind: 'loading' } | { kind: 'ready' } | { kind: 'error'; message: string }

const NO_FEATURES: ViewOptions = { labels: false, grid: false, motion: false }

export function SceneCard({
  input,
  streaming,
  onAsk,
}: {
  input: Partial<SceneInput>
  /** The tool call is still streaming in, so the code is not complete yet. */
  streaming: boolean
  onAsk?: (text: string) => void
}) {
  const t = useMessages(messages)
  const locale = useLocale()
  const cardRef = React.useRef<HTMLDivElement>(null)
  const frameRef = React.useRef<HTMLIFrameElement>(null)
  const stageRef = React.useRef<HTMLDivElement>(null)
  const themeColors = useThemeColors()
  const fullscreen = useIsFullscreen(cardRef)
  // Checked again once the code is complete, which is when the scene can start.
  const near = useNearViewport(cardRef, streaming)
  const title = input.title?.trim() || t.scene
  const code = input.code ?? ''
  const active = !streaming && code.trim() !== '' && (near || fullscreen)

  const [runtime, setRuntime] = React.useState<string | null>(null)
  const [status, setStatus] = React.useState<Status>({ kind: 'loading' })
  const [run, setRun] = React.useState(0)
  const [showCode, setShowCode] = React.useState(false)
  // What this run's scene has to turn on and off; the choices themselves carry over to later runs.
  const [features, setFeatures] = React.useState(NO_FEATURES)
  const [view, setView] = React.useState<ViewOptions>({ labels: true, grid: false, motion: true })
  const toggle = (option: keyof ViewOptions) => setView((v) => ({ ...v, [option]: !v[option] }))
  const [notice, setNotice] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!notice) return
    const timer = setTimeout(() => setNotice(null), 6000)
    return () => clearTimeout(timer)
  }, [notice])

  React.useEffect(() => {
    if (!active || runtime !== null) return
    let live = true
    loadRuntime().then(
      (source) => live && setRuntime(source),
      () => live && setStatus({ kind: 'error', message: t.runtimeFailed }),
    )
    return () => {
      live = false
    }
  }, [active, runtime, run, t.runtimeFailed])

  const page = React.useMemo(
    () => (runtime && !streaming && code.trim() ? sceneDocument(runtime, code, locale, title) : null),
    [runtime, streaming, code, locale, title],
  )
  const mounted = active && page !== null

  // Every mount runs the code from the start, so it starts out loading again.
  React.useEffect(() => {
    if (!mounted) return
    setStatus({ kind: 'loading' })
    setFeatures(NO_FEATURES)
    const timer = setTimeout(() => setStatus((s) => (s.kind === 'loading' ? { kind: 'error', message: t.timeout } : s)), START_TIMEOUT_MS)
    return () => clearTimeout(timer)
  }, [mounted, page, run, t.timeout])

  React.useEffect(() => {
    const onMessage = (event: MessageEvent<SceneMessage>) => {
      if (!frameRef.current || event.source !== frameRef.current.contentWindow) return
      const message = event.data
      if (message.type === 'ready') {
        setStatus((s) => (s.kind === 'error' ? s : { kind: 'ready' }))
        setFeatures((f) => ({ ...f, grid: message.grid }))
      } else if (message.type === 'uses') setFeatures((f) => ({ ...f, [message.feature]: true }))
      else if (message.type === 'error') setStatus({ kind: 'error', message: message.message })
      else if (message.type === 'export') download(message.data, `${fileName(title)}.${message.format}`)
      else if (message.type === 'export-error') setNotice(t.exportFailed(message.message))
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [title, t])

  const send = (command: SceneCommand) => frameRef.current?.contentWindow?.postMessage(command, '*')

  // Restyled in place on a theme switch, without running the scene again.
  React.useEffect(() => {
    if (status.kind === 'ready' && themeColors) send({ type: 'theme', colors: themeColors })
  }, [status.kind, themeColors])
  React.useEffect(() => {
    if (status.kind === 'ready') send({ type: 'view', options: view })
  }, [status.kind, view])
  const rerun = () => {
    setStatus({ kind: 'loading' })
    setRun((n) => n + 1)
  }
  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen()
    else void cardRef.current?.requestFullscreen()
  }

  const ready = status.kind === 'ready'
  const lines = code ? code.split('\n').length : 0
  // Longer than any run of backticks in the code, so the code cannot close its own fence.
  const fence = '`'.repeat(Math.max(3, ...[...code.matchAll(/`+/g)].map(([ticks]) => ticks.length + 1)))

  return (
    <div
      ref={cardRef}
      className={cn(
        'flex w-full flex-col overflow-hidden bg-card text-card-foreground animate-in fade-in slide-in-from-bottom-1 duration-200',
        fullscreen ? 'h-full' : 'max-w-2xl rounded-2xl border border-border shadow-xs',
      )}
    >
      <div className="flex items-center gap-2 border-b border-border px-4 py-2 text-sm">
        <IconCube className="size-4 shrink-0 text-primary" />
        <span className="min-w-0 flex-1 truncate font-medium">{title}</span>
        {!streaming && (
          <div className="-my-1 flex shrink-0 items-center gap-0.5 text-muted-foreground">
            <Button variant="ghost" size="icon-sm" aria-label={t.resetView} title={t.resetView} disabled={!ready} onClick={() => send({ type: 'reset' })}>
              <IconFocusCentered />
            </Button>
            {features.grid && (
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={view.grid ? t.hideGrid : t.showGrid}
                title={view.grid ? t.hideGrid : t.showGrid}
                aria-pressed={view.grid}
                disabled={!ready}
                onClick={() => toggle('grid')}
                className="aria-pressed:text-primary"
              >
                <IconGrid4x4 />
              </Button>
            )}
            {features.labels && (
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={view.labels ? t.hideLabels : t.showLabels}
                title={view.labels ? t.hideLabels : t.showLabels}
                aria-pressed={view.labels}
                disabled={!ready}
                onClick={() => toggle('labels')}
                className="aria-pressed:text-primary"
              >
                {view.labels ? <IconTag /> : <IconTagOff />}
              </Button>
            )}
            {features.motion && (
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={view.motion ? t.pause : t.play}
                title={view.motion ? t.pause : t.play}
                disabled={!ready}
                onClick={() => toggle('motion')}
              >
                {view.motion ? <IconPlayerPause /> : <IconPlayerPlay />}
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={showCode ? t.hideCode : t.showCode}
              title={showCode ? t.hideCode : t.showCode}
              aria-pressed={showCode}
              onClick={() => setShowCode((s) => !s)}
              className="aria-pressed:text-primary"
            >
              <IconCode />
            </Button>
            <Menu.Root>
              <Menu.Trigger
                render={<Button variant="ghost" size="icon-sm" aria-label={t.download} title={t.download} />}
                className="data-popup-open:bg-muted data-popup-open:text-foreground"
              >
                <IconDownload />
              </Menu.Trigger>
              {/* In full screen only the card is shown, so the menu has to open inside it. */}
              <Menu.Portal container={fullscreen ? cardRef : undefined}>
                <Menu.Positioner side="bottom" align="end" sideOffset={6} collisionPadding={8} className="z-50">
                  <Menu.Popup className={popupClass}>
                    <Menu.Item className={itemClass} disabled={!ready} onClick={() => send({ type: 'export', format: 'glb' })}>
                      <IconCube />
                      {t.downloadGlb}
                    </Menu.Item>
                    <Menu.Item className={itemClass} disabled={!ready} onClick={() => send({ type: 'export', format: 'png' })}>
                      <IconPhoto />
                      {t.downloadPng}
                    </Menu.Item>
                    <Menu.Item
                      className={itemClass}
                      disabled={!page}
                      onClick={() =>
                        page &&
                        download(
                          new Blob([standalonePage(page, themeColors, stageRef.current)], { type: 'text/html' }),
                          `${fileName(title)}.html`,
                        )
                      }
                    >
                      <IconFileTypeHtml />
                      {t.downloadHtml}
                    </Menu.Item>
                  </Menu.Popup>
                </Menu.Positioner>
              </Menu.Portal>
            </Menu.Root>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={fullscreen ? t.exitFullscreen : t.fullscreen}
              title={fullscreen ? t.exitFullscreen : t.fullscreen}
              onClick={toggleFullscreen}
            >
              {fullscreen ? <IconMinimize /> : <IconMaximize />}
            </Button>
          </div>
        )}
      </div>

      <div ref={stageRef} style={{ background: STAGE_BACKGROUND }} className={cn('relative', fullscreen ? 'min-h-0 flex-1' : 'aspect-[16/10]')}>
        {mounted && (
          <iframe
            // A new frame per run, so running again starts from a clean page.
            key={run}
            ref={frameRef}
            title={title}
            // Scripts only, without allow-same-origin: the model's code gets an opaque origin, so it cannot reach
            // the app's cookies, storage or DOM, and cannot open popups or navigate the app.
            sandbox="allow-scripts"
            srcDoc={page}
            // Matching the page's color scheme keeps the browser from painting an opaque backdrop behind it.
            style={{ colorScheme: 'normal' }}
            // Always visible: the page is transparent until it draws, and a hidden frame may not get animation frames.
            className="absolute inset-0 size-full border-0"
          />
        )}
        {status.kind === 'error' ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-card/90 p-6 text-center text-card-foreground">
            <IconAlertTriangle className="size-6 text-amber-500" />
            <p className="font-medium">{t.failed}</p>
            <p className="max-h-24 max-w-full overflow-y-auto font-mono text-xs break-words text-muted-foreground">{status.message}</p>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={rerun}>
                <IconRefresh />
                {t.rerun}
              </Button>
              {onAsk && (
                <Button size="sm" onClick={() => onAsk(t.fixRequest(title, status.message))}>
                  <IconTool />
                  {t.askFix}
                </Button>
              )}
            </div>
          </div>
        ) : (
          !ready && (
            <div className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <IconLoader2 className="size-4 animate-spin" />
              {streaming ? t.writing(lines) : t.loading}
            </div>
          )
        )}
        {ready && (
          <span
            role={notice ? 'status' : undefined}
            className={cn(
              'pointer-events-none absolute bottom-2 left-3 text-[11px] select-none',
              notice ? 'text-amber-600 dark:text-amber-300' : 'text-muted-foreground/80',
            )}
          >
            {notice ?? t.hint}
          </span>
        )}
      </div>

      {showCode && !streaming && (
        <div className={cn('overflow-y-auto border-t border-border px-3 text-sm', fullscreen ? 'max-h-[40vh]' : 'max-h-96')}>
          <Streamdown plugins={STREAMDOWN_PLUGINS}>{`${fence}js\n${code}\n${fence}`}</Streamdown>
        </div>
      )}
    </div>
  )
}
