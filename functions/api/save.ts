/// <reference types="@cloudflare/workers-types" />
import type { D1Database, EventContext } from '@cloudflare/workers-types'
import { z } from 'zod'
import { RunSubmission } from '../../src/schema'

export const onRequestPost = async (
  ctx: EventContext<{ DB: D1Database }, string, Record<string, unknown>>,
): Promise<Response> => {
  // --- Helper: standardized JSON response ---
  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data, null, 2), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })

  try {
    // --- Parse request body safely ---
    let body: unknown
    try {
      body = await ctx.request.json()
    } catch {
      return json({ ok: false, error: 'Invalid JSON in request body' }, 400)
    }

    // --- Validate input against schema ---
    const data = RunSubmission.parse(body)

    // --- Compute deterministic run hash ---
    const hashInput = `${data.rulesetHex}:${data.seed}:${data.simVersion}:${data.userId}`
    const digest = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(hashInput),
    )
    const runHash = Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')

    // --- Insert into D1 (deduplicated) ---
    const stmt = ctx.env.DB.prepare(`
      INSERT OR IGNORE INTO runs (
        run_hash,
        user_id,
        user_label,
        ruleset_name,
        ruleset_hex,
        seed,
        seed_type,
        seed_percentage,
        step_count,
        watched_steps,
        watched_wall_ms,
        grid_size,
        progress_bar_steps,
        requested_sps,
        actual_sps,
        population,
        activity,
        population_change,
        entropy2x2,
        entropy4x4,
        entropy8x8,
        interest_score,
        sim_version,
        engine_commit,
        extra_scores
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    await stmt
      .bind(
        runHash,
        data.userId,
        data.userLabel ?? null,
        data.rulesetName,
        data.rulesetHex,
        data.seed,
        data.seedType,
        data.seedPercentage ?? null,
        data.stepCount,
        data.watchedSteps,
        data.watchedWallMs,
        data.gridSize ?? null,
        data.progress_bar_steps ?? null,
        data.requestedSps ?? null,
        data.actualSps ?? null,
        data.population,
        data.activity,
        data.populationChange,
        data.entropy2x2,
        data.entropy4x4,
        data.entropy8x8,
        data.interestScore,
        data.simVersion,
        data.engineCommit ?? null,
        data.extraScores ? JSON.stringify(data.extraScores) : null,
      )
      .run()

    // --- Return success ---
    return json({ ok: true, runHash })
  } catch (error) {
    // --- Zod validation errors ---
    if (error instanceof z.ZodError) {
      console.warn('Run submission validation error:', error.issues)
      // NOTE: Consider removing 'details' in production to avoid leaking schema info
      return json(
        {
          ok: false,
          error: 'Invalid run data format',
          details: error.issues,
        },
        400,
      )
    }

    // --- D1 or SQL-related errors ---
    if (error instanceof Error && /D1|SQL|prepare|bind/i.test(error.message)) {
      console.error('Database error saving run:', error)
      return json({ ok: false, error: 'Failed to save run to database' }, 500)
    }

    // --- Unknown unexpected errors ---
    console.error('Unexpected error saving run:', error)
    return json({ ok: false, error: 'Internal server error' }, 500)
  }
}
