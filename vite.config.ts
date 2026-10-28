import { fileURLToPath } from 'node:url'
import { build, defineConfig } from 'vite'
import type { Plugin, Rolldown } from 'vite'
import { devtools } from '@tanstack/devtools-vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import { nitro } from 'nitro/vite'
import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import pkg from './package.json' with { type: 'json' }

const SCENE_RUNTIME = 'virtual:scene-runtime'

/**
 * `virtual:scene-runtime` exports src/lib/scene-runtime.ts bundled with three.js as one classic script, in a string.
 * The 3D scene card inlines it into an opaque-origin iframe, which cannot load modules from the app's origin.
 */
function sceneRuntime(): Plugin {
  const entry = fileURLToPath(new URL('./src/lib/scene-runtime.ts', import.meta.url))
  let source: Promise<string> | undefined
  return {
    name: 'scene-runtime',
    resolveId: (id) => (id === SCENE_RUNTIME ? `\0${SCENE_RUNTIME}` : undefined),
    async load(id) {
      if (id !== `\0${SCENE_RUNTIME}`) return
      // Only the browser runs scenes; the server bundle gets an empty stand-in instead of a second copy.
      if (this.environment.config.consumer === 'server') return 'export default ""'
      this.addWatchFile(entry)
      source ??= bundleSceneRuntime(entry)
      return `export default ${JSON.stringify(await source)}`
    },
    watchChange(id) {
      if (id === entry) source = undefined
    },
    // The runtime is not imported by anything the dev server tracks, so its edits must mark the virtual module stale.
    hotUpdate({ file }) {
      if (file !== entry || this.environment.config.consumer === 'server') return
      const module = this.environment.moduleGraph.getModuleById(`\0${SCENE_RUNTIME}`)
      if (!module) return
      this.environment.moduleGraph.invalidateModule(module)
      return [module]
    },
  }
}

async function bundleSceneRuntime(entry: string) {
  const result = await build({
    configFile: false,
    logLevel: 'warn',
    publicDir: false,
    build: {
      write: false,
      minify: true,
      lib: { entry, formats: ['iife'], name: 'sceneRuntime', fileName: 'scene-runtime' },
    },
  })
  const [output] = (Array.isArray(result) ? result : [result]) as Array<Rolldown.RolldownOutput>
  return output!.output[0].code
}

export default defineConfig({
  resolve: { tsconfigPaths: true },
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  // portless injects PORT/HOST; fall back to 3000 when run without it.
  server: {
    port: Number(process.env.PORT) || 3000,
    strictPort: Boolean(process.env.PORT),
    host: process.env.HOST,
  },
  // nitro builds the Node server that `pnpm start` runs from .output/server/index.mjs.
  plugins: [devtools(), tailwindcss(), tanstackStart(), nitro(), viteReact(), sceneRuntime()],
})
