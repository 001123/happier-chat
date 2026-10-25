import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import { nitro } from 'nitro/vite'
import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import pkg from './package.json' with { type: 'json' }

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
  plugins: [devtools(), tailwindcss(), tanstackStart(), nitro(), viteReact()],
})
