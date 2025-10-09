#!/usr/bin/env node
import { execSync } from 'node:child_process'
import fs from 'node:fs'

const QUERY = 'SELECT * FROM runs;'
const OUTPUT = 'd1-dump.csv'

console.log('⏬ Exporting D1 database to', OUTPUT)

const raw = execSync(
  `npx wrangler d1 execute rulehunt-db --remote --command "${QUERY}" --json`,
  { encoding: 'utf8' },
)

// Try parsing even if there’s trailing commas or bad records
let data
try {
  data = JSON.parse(raw)
} catch {
  console.warn('⚠️ Strict JSON parse failed; cleaning input...')
  data = JSON.parse(raw.replace(/,(\s*[}\]])/g, '$1'))
}

// Flatten any result arrays
const rows = data
  .flatMap((b) => (Array.isArray(b.results) ? b.results : []))
  .filter((r) => typeof r === 'object' && r !== null)

if (!rows.length) {
  console.log('⚠️ No rows found.')
  process.exit(0)
}

const headers = Object.keys(rows[0])
const lines = [headers.join(',')]
for (const r of rows) {
  lines.push(headers.map((h) => JSON.stringify(r[h] ?? '')).join(','))
}

fs.writeFileSync(OUTPUT, lines.join('\n'))
console.log('✅ Done:', OUTPUT)
