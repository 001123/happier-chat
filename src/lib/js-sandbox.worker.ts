/// <reference lib="webworker" />
import releaseVariant from '@jitl/quickjs-wasmfile-release-sync'
import { newQuickJSWASMModuleFromVariant, shouldInterruptAfterDeadline } from 'quickjs-emscripten-core'
import type { QuickJSContext, QuickJSHandle, QuickJSWASMModule } from 'quickjs-emscripten-core'

import type { SandboxLog, SandboxRequest, SandboxResponse } from '@/lib/js-sandbox'

const MEMORY_LIMIT = 64 * 1024 * 1024
const STACK_LIMIT = 1024 * 1024
const MAX_LOGS = 500

// vm.dump() consumes promise handles, so always dump a borrowed copy.
function dump(vm: QuickJSContext, handle: QuickJSHandle): unknown {
  const copy = handle.dup()
  try {
    return vm.dump(copy)
  } finally {
    if (copy.alive) copy.dispose()
  }
}

function format(vm: QuickJSContext, handle: QuickJSHandle) {
  const value = dump(vm, handle)
  if (typeof value === 'string') return value
  try {
    return JSON.stringify(value) ?? String(value)
  } catch {
    return String(value)
  }
}

function formatError(vm: QuickJSContext, handle: QuickJSHandle, timeoutMs: number) {
  const error = dump(vm, handle)
  if (error && typeof error === 'object' && 'message' in error) {
    const { name = 'Error', message } = error as { name?: string; message: string }
    if (name === 'InternalError' && message === 'interrupted') return `Timed out after ${timeoutMs} ms`
    return `${name}: ${message}`
  }
  return format(vm, handle)
}

let quickJS: Promise<QuickJSWASMModule> | undefined

async function run({ id, code, timeoutMs }: SandboxRequest): Promise<SandboxResponse> {
  const QuickJS = await (quickJS ??= newQuickJSWASMModuleFromVariant(releaseVariant))
  const runtime = QuickJS.newRuntime()
  runtime.setMemoryLimit(MEMORY_LIMIT)
  runtime.setMaxStackSize(STACK_LIMIT)
  runtime.setInterruptHandler(shouldInterruptAfterDeadline(Date.now() + timeoutMs))
  const vm = runtime.newContext()
  const logs: SandboxLog[] = []
  const started = performance.now()

  try {
    const consoleHandle = vm.newObject()
    for (const level of ['log', 'info', 'warn', 'error', 'debug'] as const) {
      const fn = vm.newFunction(level, (...args) => {
        if (logs.length < MAX_LOGS) logs.push({ level, text: args.map((arg) => format(vm, arg)).join(' ') })
      })
      vm.setProp(consoleHandle, level, fn)
      fn.dispose()
    }
    vm.setProp(vm.global, 'console', consoleHandle)
    consoleHandle.dispose()

    const fail = (handle: QuickJSHandle): SandboxResponse => {
      const error = formatError(vm, handle, timeoutMs)
      handle.dispose()
      return { id, ok: false, logs, error, durationMs: performance.now() - started }
    }

    const result = vm.evalCode(code, 'main.js')
    if (result.error) return fail(result.error)

    const jobs = runtime.executePendingJobs()
    if (jobs.error) {
      result.value.dispose()
      return fail(jobs.error)
    }
    const settled = vm.getPromiseState(result.value)
    if (settled.type === 'rejected') {
      result.value.dispose()
      return fail(settled.error)
    }
    const valueHandle = settled.type === 'fulfilled' ? settled.value : result.value
    const value = vm.typeof(valueHandle) === 'undefined' ? undefined : format(vm, valueHandle)
    for (const handle of new Set([valueHandle, result.value])) if (handle.alive) handle.dispose()
    return { id, ok: true, logs, value, durationMs: performance.now() - started }
  } catch (error) {
    return { id, ok: false, logs, error: String(error), durationMs: performance.now() - started }
  } finally {
    vm.dispose()
    runtime.dispose()
  }
}

self.onmessage = async (event: MessageEvent<SandboxRequest>) => {
  self.postMessage(await run(event.data))
}
