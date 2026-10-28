import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { dirname, join, resolve, sep } from 'node:path'

import { DATA_DIR } from './db.server'

/**
 * Where attachment bytes live, addressed by a slash-separated key such as `<userId>/<sha256>`.
 * Everything goes through this interface, so moving to an S3-compatible store means adding one implementation
 * and copying the files over under the same keys (`rclone copy .data/uploads remote:bucket`).
 */
export interface FileStore {
  put: (key: string, data: Uint8Array) => Promise<void>
  /** null when nothing is stored under the key. */
  get: (key: string) => Promise<Uint8Array<ArrayBuffer> | null>
  delete: (key: string) => Promise<void>
}

/** Files under `.data/`, next to the database, so one directory holds everything to back up. */
export function diskFileStore(root = join(DATA_DIR, 'uploads')): FileStore {
  const base = resolve(root)
  const pathOf = (key: string) => {
    const path = resolve(base, key)
    if (!path.startsWith(base + sep)) throw new Error(`Invalid file key: ${key}`)
    return path
  }
  return {
    async put(key, data) {
      const path = pathOf(key)
      await mkdir(dirname(path), { recursive: true })
      // Written aside and renamed into place, so a reader never sees half a file.
      const temp = `${path}.${crypto.randomUUID()}.tmp`
      await writeFile(temp, data)
      await rename(temp, path)
    },
    async get(key) {
      try {
        return new Uint8Array(await readFile(pathOf(key)))
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
        throw error
      }
    },
    async delete(key) {
      await rm(pathOf(key), { force: true })
    },
  }
}

let store: FileStore | null = null

export function getFileStore() {
  store ??= diskFileStore()
  return store
}
