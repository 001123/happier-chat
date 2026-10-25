import type { SandboxLog, SandboxResponse } from '@/lib/js-sandbox'

const PYODIDE_INDEX_URL = 'https://cdn.jsdelivr.net/pyodide/v314.0.7/full/'
const DEFAULT_TIMEOUT_MS = 5000
// Covers downloading Pyodide itself and any packages imported by the snippet.
const LOAD_TIMEOUT_MS = 60_000
const MAX_LOGS = 500

type FrameMessage =
  | { type: 'ready' }
  | { type: 'error'; error: string }
  | { type: 'started'; id: number }
  | { type: 'log'; id: number; log: SandboxLog }
  | { type: 'result'; id: number; ok: boolean; value?: string; error?: string; durationMs: number }

// Runs inside a module Worker spawned by the sandboxed iframe. Plain JS shipped as a data: URL, not bundled:
// Pyodide only supports module workers, and opaque-origin documents cannot start module workers from blob: URLs.
const WORKER_SOURCE = `
const ready = import(${JSON.stringify(`${PYODIDE_INDEX_URL}pyodide.mjs`)})
  .then(({ loadPyodide }) => loadPyodide({ indexURL: ${JSON.stringify(PYODIDE_INDEX_URL)} }))
  .then((py) => {
    py.setStdin({ stdin: () => null })
    return py
  })
ready.then(
  () => postMessage({ type: 'ready' }),
  (error) => postMessage({ type: 'error', error: String(error) }),
)

function cleanTraceback(message) {
  const lines = message.split('\\n')
  const out = []
  for (let i = 0; i < lines.length; i++) {
    if (/^\\s*File "\\/lib\\//.test(lines[i])) {
      while (i + 1 < lines.length && /^\\s{4,}/.test(lines[i + 1]) && !/^\\s*File /.test(lines[i + 1])) i++
      continue
    }
    out.push(lines[i])
  }
  return out.join('\\n').trim()
}

onmessage = async ({ data: { id, code } }) => {
  const py = await ready
  const emit = (level) => (text) => postMessage({ type: 'log', id, log: { level, text } })
  py.setStdout({ batched: emit('log') })
  py.setStderr({ batched: emit('error') })
  const globals = py.globals.get('dict')()
  let started = performance.now()
  try {
    await py.loadPackagesFromImports(code, { messageCallback: () => {} })
    postMessage({ type: 'started', id })
    started = performance.now()
    const result = await py.runPythonAsync(code, { globals })
    const value = result === undefined ? undefined : py.globals.get('repr')(result)
    result?.destroy?.()
    postMessage({ type: 'result', id, ok: true, value, durationMs: performance.now() - started })
  } catch (error) {
    const message = error && error.type ? cleanTraceback(error.message) : String(error)
    postMessage({ type: 'result', id, ok: false, error: message, durationMs: performance.now() - started })
  } finally {
    globals.destroy()
  }
}
`

// The iframe has an opaque origin (sandbox without allow-same-origin), so Python code reaching
// for the `js` module only sees an isolated worker: no app cookies, storage, DOM or same-origin APIs.
const FRAME_SOURCE = `<!doctype html><script>
const worker = new Worker(${JSON.stringify(`data:text/javascript;charset=utf-8,${encodeURIComponent(WORKER_SOURCE)}`)}, { type: 'module' })
worker.onmessage = (event) => parent.postMessage(event.data, '*')
worker.onerror = (event) => parent.postMessage({ type: 'error', error: event.message || 'Python worker failed' }, '*')
addEventListener('message', (event) => { if (event.source === parent) worker.postMessage(event.data) })
</script>`

type Frame = {
  element: HTMLIFrameElement
  listeners: Set<(message: FrameMessage) => void>
  ready: Promise<void>
  loaded: boolean
  dispose: () => void
}

let frame: Frame | null = null
let nextId = 0
let queue: Promise<unknown> = Promise.resolve()

function createFrame(): Frame {
  const element = document.createElement('iframe')
  element.sandbox.add('allow-scripts')
  element.hidden = true
  element.srcdoc = FRAME_SOURCE
  const listeners = new Set<(message: FrameMessage) => void>()
  const onMessage = (event: MessageEvent<FrameMessage>) => {
    if (event.source !== element.contentWindow) return
    for (const listener of listeners) listener(event.data)
  }
  window.addEventListener('message', onMessage)
  document.body.append(element)

  const created: Frame = {
    element,
    listeners,
    loaded: false,
    ready: new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => settle(new Error('Timed out loading Pyodide')), LOAD_TIMEOUT_MS)
      const settle = (error?: Error) => {
        clearTimeout(timer)
        listeners.delete(listener)
        if (error) return reject(error)
        created.loaded = true
        resolve()
      }
      const listener = (message: FrameMessage) => {
        if (message.type === 'ready') settle()
        else if (message.type === 'error') settle(new Error(message.error))
      }
      listeners.add(listener)
    }),
    dispose: () => {
      window.removeEventListener('message', onMessage)
      listeners.clear()
      element.remove()
    },
  }
  return created
}

function killFrame() {
  frame?.dispose()
  frame = null
}

export function isPythonLoaded() {
  return frame?.loaded ?? false
}

async function execute(code: string, timeoutMs: number): Promise<SandboxResponse> {
  const id = ++nextId
  const current = (frame ??= createFrame())
  try {
    await current.ready
  } catch (error) {
    killFrame()
    return { id, ok: false, logs: [], error: `Pyodide failed to load: ${(error as Error).message}`, durationMs: 0 }
  }

  return new Promise((resolve) => {
    const logs: SandboxLog[] = []
    let timer = setTimeout(() => timeout(`Timed out loading packages`), LOAD_TIMEOUT_MS)
    const finish = (response: SandboxResponse) => {
      clearTimeout(timer)
      current.listeners.delete(listener)
      resolve(response)
    }
    // A runaway snippet cannot be interrupted without SharedArrayBuffer, so drop the whole iframe.
    const timeout = (error: string) => {
      killFrame()
      finish({ id, ok: false, logs, error, durationMs: timeoutMs })
    }
    const listener = (message: FrameMessage) => {
      if (message.type === 'error') return timeout(message.error)
      if (!('id' in message) || message.id !== id) return
      if (message.type === 'started') {
        clearTimeout(timer)
        timer = setTimeout(() => timeout(`Timed out after ${timeoutMs} ms`), timeoutMs)
      } else if (message.type === 'log') {
        if (logs.length < MAX_LOGS) logs.push(message.log)
      } else if (message.type === 'result') {
        finish({ ...message, logs })
      }
    }
    current.listeners.add(listener)
    current.element.contentWindow?.postMessage({ id, code }, '*')
  })
}

/** Runs Python with Pyodide (WASM) in a Worker inside an opaque-origin iframe; runs are serialized. */
export function runPython(code: string, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<SandboxResponse> {
  const run = queue.then(() => execute(code, timeoutMs))
  queue = run.catch(() => {})
  return run
}
