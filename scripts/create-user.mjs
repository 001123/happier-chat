// Usage: node scripts/create-user.mjs [--admin] <email> [password]
// Creates a user in .data/app.db with the same scrypt format as src/server/crypto.server.ts.
// With --admin the user gets the admin role; an existing user with that email is promoted instead.
// This is the only way to create the first admin in production.
import { randomBytes, randomUUID, scryptSync } from 'node:crypto'
import { mkdirSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'

const args = process.argv.slice(2)
const admin = args.includes('--admin')
const [email, password = randomBytes(9).toString('base64url')] = args.filter((arg) => arg !== '--admin')
if (!email) {
  console.error('Usage: node scripts/create-user.mjs [--admin] <email> [password]')
  process.exit(1)
}

mkdirSync('.data', { recursive: true })
const db = new DatabaseSync('.data/app.db')
db.exec(`create table if not exists users (
  id text primary key,
  email text not null unique collate nocase,
  password_hash text not null,
  created_at integer not null
)`)
const columns = db.prepare('pragma table_info(users)').all()
if (!columns.some((column) => column.name === 'role')) {
  db.exec("alter table users add column role text not null default 'user'")
}

const normalized = email.trim().toLowerCase()
const role = admin ? 'admin' : 'user'
const salt = randomBytes(16)
const hash = scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 })
const passwordHash = `scrypt$${salt.toString('base64url')}$${hash.toString('base64url')}`
const result = db
  .prepare('insert into users (id, email, password_hash, created_at, role) values (?, ?, ?, ?, ?) on conflict(email) do nothing')
  .run(randomUUID(), normalized, passwordHash, Date.now(), role)

if (result.changes === 0) {
  if (!admin) {
    console.error(`${email} already exists`)
    process.exit(1)
  }
  db.prepare("update users set role = 'admin' where email = ?").run(normalized)
  console.log(`${email} already exists and is now an admin (password unchanged)`)
  process.exit(0)
}
console.log(`email:    ${email}\npassword: ${password}\nrole:     ${role}`)
