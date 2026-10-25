export type SandboxLog = { level: 'log' | 'info' | 'warn' | 'error' | 'debug'; text: string }

export type SandboxRequest = { id: number; code: string; timeoutMs: number }

export type SandboxResponse = {
  id: number
  ok: boolean
  logs: SandboxLog[]
  value?: string
  error?: string
  durationMs: number
}

const DEFAULT_TIMEOUT_MS = 3000
// QuickJS interrupts itself at the deadline; this backstop also covers the first WASM download.
const HARD_KILL_GRACE_MS = 10_000

let worker: Worker | null = null
let nextId = 0

function getWorker() {
  worker ??= new Worker(new URL('./js-sandbox.worker.ts', import.meta.url), { type: 'module' })
  return worker
}

function killWorker() {
  worker?.terminate()
  worker = null
}

/** Runs untrusted JS inside QuickJS (WASM) in a Web Worker: no DOM, no network, bounded time and memory. */
export function runJavaScript(code: string, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<SandboxResponse> {
  const id = ++nextId
  const target = getWorker()
  return new Promise((resolve) => {
    const cleanup = () => {
      clearTimeout(timer)
      target.removeEventListener('message', onMessage)
      target.removeEventListener('error', onError)
    }
    const onMessage = (event: MessageEvent<SandboxResponse>) => {
      if (event.data.id !== id) return
      cleanup()
      resolve(event.data)
    }
    const onError = (event: ErrorEvent) => {
      cleanup()
      killWorker()
      resolve({ id, ok: false, logs: [], error: event.message || 'Sandbox failed to load', durationMs: 0 })
    }
    const timer = setTimeout(() => {
      cleanup()
      killWorker()
      resolve({ id, ok: false, logs: [], error: 'Timed out', durationMs: timeoutMs })
    }, timeoutMs + HARD_KILL_GRACE_MS)
    target.addEventListener('message', onMessage)
    target.addEventListener('error', onError)
    target.postMessage({ id, code, timeoutMs } satisfies SandboxRequest)
  })
}
