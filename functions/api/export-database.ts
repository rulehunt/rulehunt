/// <reference types="@cloudflare/workers-types" />
import type { D1Database, EventContext } from '@cloudflare/workers-types'

export const onRequestGet = async (
  ctx: EventContext<{ DB: D1Database }, string, Record<string, unknown>>,
): Promise<Response> => {
  try {
    const db = ctx.env.DB

    // Fetch all runs
    const stmt = db.prepare('SELECT * FROM runs ORDER BY submitted_at DESC')
    const result = await stmt.all()

    // Convert to CSV
    const rows = result.results as Record<string, unknown>[]
    if (rows.length === 0) {
      return new Response('No data available', { status: 404 })
    }

    // Generate CSV header
    const headers = Object.keys(rows[0])
    const csvHeader = headers.join(',')

    // Generate CSV rows with proper escaping
    const csvRows = rows.map((row) =>
      headers
        .map((header) => {
          const value = row[header]
          const str = String(value ?? '')
          return str.includes(',') || str.includes('"') || str.includes('\n')
            ? `"${str.replace(/"/g, '""')}"`
            : str
        })
        .join(','),
    )

    const csv = [csvHeader, ...csvRows].join('\n')

    // Return as downloadable file
    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="rulehunt-export-${new Date().toISOString().split('T')[0]}.csv"`,
        'Cache-Control': 'public, max-age=86400',
      },
    })
  } catch (err) {
    console.error('[export-database] Error:', err)
    return new Response('Export failed', { status: 500 })
  }
}
