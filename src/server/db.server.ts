import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'

export const DATA_DIR = join(process.cwd(), '.data')

const SCHEMA = `
  pragma journal_mode = wal;
  pragma foreign_keys = on;

  create table if not exists users (
    id text primary key,
    email text not null unique collate nocase,
    password_hash text not null,
    created_at integer not null
  );

  create table if not exists sessions (
    id text primary key,
    user_id text not null references users(id) on delete cascade,
    expires_at integer not null
  );
  create index if not exists sessions_user_id on sessions(user_id);

  create table if not exists providers (
    id text primary key,
    user_id text not null references users(id) on delete cascade,
    name text not null,
    preset text not null,
    anthropic_url text,
    openai_url text,
    models_url text,
    api_key_enc text not null,
    models text not null default '[]',
    created_at integer not null
  );
  create index if not exists providers_user_id on providers(user_id);

  create table if not exists model_catalog (
    provider_id text not null,
    model_id text not null,
    data text not null,
    override text,
    updated_at integer not null,
    primary key (provider_id, model_id)
  );

  create table if not exists catalog_meta (
    id integer primary key check (id = 1),
    providers text not null,
    etag text,
    synced_at integer
  );
`

/** Columns added after a table first shipped: `create table if not exists` never adds them to an existing table. */
function migrate(db: DatabaseSync) {
  const userColumns = db.prepare('pragma table_info(users)').all() as Array<{ name: string }>
  if (!userColumns.some((column) => column.name === 'role')) {
    db.exec("alter table users add column role text not null default 'user'")
  }
  if (!userColumns.some((column) => column.name === 'name')) {
    db.exec("alter table users add column name text not null default ''")
  }
}

/**
 * Development only: bootstraps the first admin from ADMIN_EMAIL. Applies only while no admin exists,
 * so roles changed later in the admin page are never overwritten. Production never promotes by email,
 * because anyone could sign up with that address first; use `scripts/create-user.mjs --admin` instead.
 */
export function promoteBootstrapAdmin() {
  if (process.env.NODE_ENV === 'production') return
  const email = process.env.ADMIN_EMAIL?.trim()
  if (!email) return
  getDb()
    .prepare("update users set role = 'admin' where email = ? and not exists (select 1 from users where role = 'admin')")
    .run(email)
}

let db: DatabaseSync | null = null

export function getDb() {
  if (db) return db
  mkdirSync(DATA_DIR, { recursive: true })
  db = new DatabaseSync(join(DATA_DIR, 'app.db'))
  db.exec(SCHEMA)
  migrate(db)
  promoteBootstrapAdmin()
  return db
}
