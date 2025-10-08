/// <reference types="@cloudflare/workers-types" />

import type { D1Database } from '@cloudflare/workers-types'
import { RunSubmission } from '../../src/schema'

export const onRequestPost = async (
  ctx: EventContext<{ DB: D1Database }, string, Record<string, unknown>>,
) => {
  // Parse and validate input against your Zod schema
  const body = await ctx.request.json()
  const data = RunSubmission.parse(body)

  // Compute a stable hash for deduplication
  const hashInput = `${data.rulesetHex}:${data.seed}:${data.simVersion}:${data.userId}`
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(hashInput),
  )
  const runHash = [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')

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

  return Response.json({ ok: true, runHash })
}
