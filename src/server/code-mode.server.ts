import { createCodeMode } from '@tanstack/ai-code-mode'
import { createQuickJSIsolateDriver } from '@tanstack/ai-isolate-quickjs'

type CodeModeTools = Parameters<typeof createCodeMode>[0]['tools']

// QuickJS compiled to WASM: the model's program runs inside this server process but in its own heap, with
// no network, filesystem, process or module access. The only way out is the `external_*` functions made
// from the tools passed below, so list there exactly what generated code may do.
const SANDBOX_TIMEOUT_MS = 30_000
const SANDBOX_MEMORY_MB = 64

const driver = createQuickJSIsolateDriver({ timeout: SANDBOX_TIMEOUT_MS, memoryLimit: SANDBOX_MEMORY_MB })

export function createSandboxCodeMode(tools: CodeModeTools) {
  return createCodeMode({ driver, tools, timeout: SANDBOX_TIMEOUT_MS, memoryLimit: SANDBOX_MEMORY_MB })
}
