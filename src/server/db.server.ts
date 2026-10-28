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
    gemini_url text,
    ollama_url text,
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
    -- Added by an admin for a model models.dev lacks; a sync never removes it.
    manual integer not null default 0,
    primary key (provider_id, model_id)
  );

  -- Chat state is keyed by (user_id, id) everywhere: ids come from the client, so they never identify a row alone.
  create table if not exists chat_threads (
    user_id text not null references users(id) on delete cascade,
    id text not null,
    title text not null,
    updated_at integer not null,
    project_id text,
    renamed integer not null default 0,
    archived integer not null default 0,
    mode text,
    explain_style text,
    primary key (user_id, id)
  );

  create table if not exists chat_projects (
    user_id text not null references users(id) on delete cascade,
    id text not null,
    name text not null,
    created_at integer not null,
    collapsed integer not null default 0,
    instructions text,
    primary key (user_id, id)
  );

  create table if not exists chat_messages (
    user_id text not null references users(id) on delete cascade,
    thread_id text not null,
    messages text not null,
    updated_at integer not null,
    primary key (user_id, thread_id)
  );

  create table if not exists chat_runs (
    user_id text not null references users(id) on delete cascade,
    run_id text not null,
    thread_id text not null,
    status text not null,
    started_at integer not null,
    data text not null,
    primary key (user_id, run_id)
  );
  create index if not exists chat_runs_thread on chat_runs(user_id, thread_id, started_at);

  create table if not exists chat_interrupts (
    user_id text not null references users(id) on delete cascade,
    interrupt_id text not null,
    run_id text not null,
    thread_id text not null,
    status text not null,
    requested_at integer not null,
    data text not null,
    primary key (user_id, interrupt_id)
  );
  create index if not exists chat_interrupts_thread on chat_interrupts(user_id, thread_id, requested_at);
  create index if not exists chat_interrupts_run on chat_interrupts(user_id, run_id, requested_at);

  -- A user's own Gemini API key for speech; without one the server's key is used.
  create table if not exists speech_keys (
    user_id text primary key references users(id) on delete cascade,
    gemini_key_enc text not null,
    updated_at integer not null
  );

  -- One row per billed model call (a chat agent-loop step or a speech request), priced when it happened.
  create table if not exists usage_events (
    id integer primary key,
    user_id text not null references users(id) on delete cascade,
    kind text not null,
    provider text not null,
    model text not null,
    thread_id text,
    run_id text,
    input_tokens integer not null default 0,
    output_tokens integer not null default 0,
    cache_read_tokens integer not null default 0,
    cache_write_tokens integer not null default 0,
    chars integer,
    cost_usd real,
    created_at integer not null
  );
  create index if not exists usage_events_user on usage_events(user_id, created_at);

  -- Prices an admin schedules ahead (a provider's announced price change); the latest one in effect wins.
  create table if not exists model_price_schedule (
    provider_id text not null,
    model_id text not null,
    effective_from integer not null,
    cost text not null,
    primary key (provider_id, model_id, effective_from)
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
  const providerColumns = db.prepare('pragma table_info(providers)').all() as Array<{ name: string }>
  for (const column of ['gemini_url', 'ollama_url']) {
    if (!providerColumns.some((existing) => existing.name === column)) db.exec(`alter table providers add column ${column} text`)
  }
  const userColumns = db.prepare('pragma table_info(users)').all() as Array<{ name: string }>
  if (!userColumns.some((column) => column.name === 'role')) {
    db.exec("alter table users add column role text not null default 'user'")
  }
  if (!userColumns.some((column) => column.name === 'name')) {
    db.exec("alter table users add column name text not null default ''")
  }
  const catalogColumns = db.prepare('pragma table_info(model_catalog)').all() as Array<{ name: string }>
  if (!catalogColumns.some((column) => column.name === 'manual')) {
    db.exec('alter table model_catalog add column manual integer not null default 0')
  }
  const threadColumns = db.prepare('pragma table_info(chat_threads)').all() as Array<{ name: string }>
  if (!threadColumns.some((column) => column.name === 'explain_style')) {
    db.exec('alter table chat_threads add column explain_style text')
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
