declare const __APP_VERSION__: string

declare module 'virtual:scene-runtime' {
  /** three.js and src/lib/scene-runtime.ts as one classic script; empty on the server. */
  const source: string
  export default source
}
