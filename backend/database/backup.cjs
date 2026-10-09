// Run from backend: node database/backup.cjs
// Stop application writes first so the DB and PDF copy stay consistent.
require('dotenv').config({ quiet: true })
const fs = require('node:fs')
const path = require('node:path')
const { spawnSync } = require('node:child_process')
const stamp = new Date().toISOString().replace(/[:.]/g, '-')
const destination = path.resolve(__dirname, '../../backups', stamp)
fs.mkdirSync(destination, { recursive: true })
const executable = process.env.PG_DUMP_PATH || 'pg_dump'
const result = spawnSync(executable, [
  '--format=custom', '--no-owner', '--no-privileges',
  '--host=' + (process.env.DB_HOST || 'localhost'),
  '--port=' + (process.env.DB_PORT || '5432'),
  '--username=' + process.env.DB_USER, '--dbname=' + process.env.DB_NAME,
  '--file=database.dump',
], { cwd: destination, env: { ...process.env, PGPASSWORD: process.env.DB_PASSWORD }, encoding: 'utf8' })
if (result.error || result.status !== 0) {
  console.error(result.error?.message || result.stderr)
  process.exit(1)
}
const pdf = path.resolve(process.env.PDF_STORAGE_DIR || path.join(__dirname, '../storage/pdf'))
if (fs.existsSync(pdf)) fs.cpSync(pdf, path.join(destination, 'pdf'), { recursive: true })
fs.writeFileSync(path.join(destination, 'README.txt'),
  'Full database backup (schema + data) and PDF files. See DATABASE_SETUP.md for restore.\n' +
  'Secrets (.env) are not included. Transfer them separately and keep this backup private.\n')
console.log('Backup saved: ' + destination)
