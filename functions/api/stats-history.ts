/// <reference types="@cloudflare/workers-types" />
import type { D1Database, EventContext } from '@cloudflare/workers-types'
import { z } from 'zod'
import { StatsHistoryResponse } from '../../src/schema'

export const onRequestGet = async (
  ctx: EventContext<{ DB: D1Database }, string, Record<string, unknown>>,
): Promise<Response> => {
  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data, null, 2), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })

  try {
    // Parse query parameters
    const url = new URL(ctx.request.url)
    const metric = url.searchParams.get('metric')
    const days = Number.parseInt(url.searchParams.get('days') || '90', 10)

    // Validate metric parameter
    const validMetrics = [
      'total_runs',
      'total_steps',
      'total_starred',
      'unique_rulesets',
      'unique_users',
      'active_users_24h',
      'active_users_7d',
    ]

    if (!metric || !validMetrics.includes(metric)) {
      return json(
        {
          ok: false,
          error: `Invalid metric. Must be one of: ${validMetrics.join(', ')}`,
        },
        400,
      )
    }

    if (days < 1 || days > 365) {
      return json({ ok: false, error: 'Days must be between 1 and 365' }, 400)
    }

    // Build query based on metric type
    let query = ''

    switch (metric) {
      case 'total_runs':
        query = `
          SELECT DATE(submitted_at) as date, COUNT(*) as value
          FROM runs
          WHERE DATE(submitted_at) >= DATE('now', ? || ' days')
          GROUP BY DATE(submitted_at)
          ORDER BY date ASC
        `
        break

      case 'total_steps':
        query = `
          SELECT DATE(submitted_at) as date, SUM(step_count) as value
          FROM runs
          WHERE DATE(submitted_at) >= DATE('now', ? || ' days')
          GROUP BY DATE(submitted_at)
          ORDER BY date ASC
        `
        break

      case 'total_starred':
        query = `
          SELECT DATE(submitted_at) as date, COUNT(*) as value
          FROM runs
          WHERE is_starred = 1
            AND DATE(submitted_at) >= DATE('now', ? || ' days')
          GROUP BY DATE(submitted_at)
          ORDER BY date ASC
        `
        break

      case 'unique_rulesets':
        query = `
          SELECT DATE(submitted_at) as date, COUNT(DISTINCT ruleset_hex) as value
          FROM runs
          WHERE DATE(submitted_at) >= DATE('now', ? || ' days')
          GROUP BY DATE(submitted_at)
          ORDER BY date ASC
        `
        break

      case 'unique_users':
        query = `
          SELECT DATE(submitted_at) as date, COUNT(DISTINCT user_id) as value
          FROM runs
          WHERE DATE(submitted_at) >= DATE('now', ? || ' days')
          GROUP BY DATE(submitted_at)
          ORDER BY date ASC
        `
        break

      case 'active_users_24h':
        // Count distinct users per day (simplified - no rolling window for v1)
        query = `
          SELECT DATE(submitted_at) as date, COUNT(DISTINCT user_id) as value
          FROM runs
          WHERE DATE(submitted_at) >= DATE('now', ? || ' days')
          GROUP BY DATE(submitted_at)
          ORDER BY date ASC
        `
        break

      case 'active_users_7d':
        // Count distinct users per day (simplified - no rolling window for v1)
        query = `
          SELECT DATE(submitted_at) as date, COUNT(DISTINCT user_id) as value
          FROM runs
          WHERE DATE(submitted_at) >= DATE('now', ? || ' days')
          GROUP BY DATE(submitted_at)
          ORDER BY date ASC
        `
        break

      default:
        return json({ ok: false, error: 'Unsupported metric' }, 400)
    }

    // Execute query with parameterized binding (prevents SQL injection)
    const { results } = await ctx.env.DB.prepare(query).bind(-days).all()

    // Type assertion for D1 results
    type HistoryRow = {
      date: string
      value: number
    }
    const rows = results as unknown as HistoryRow[]

    // Build response (validated against schema.ts)
    const response = {
      ok: true as const,
      metric,
      data: rows.map((row) => ({
        date: row.date,
        value: Number(row.value) || 0,
      })),
    }

    // Validate response against shared schema
    const validated = StatsHistoryResponse.parse(response)
    return json(validated)
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('Stats history validation error:', error.issues)
      return json(
        { ok: false, error: 'Invalid data format', details: error.issues },
        500,
      )
    }

    if (error instanceof Error && /D1|SQL|prepare|bind/i.test(error.message)) {
      console.error('Database error fetching stats history:', error)
      return json({ ok: false, error: 'Database query failed' }, 500)
    }

    console.error('Unexpected error in stats history:', error)
    return json({ ok: false, error: 'Internal server error' }, 500)
  }
}
