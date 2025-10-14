/// <reference types="@cloudflare/workers-types" />
import type { D1Database, EventContext } from '@cloudflare/workers-types'
import { z } from 'zod'

// --- Statistics Response Schema ---------------------------------------------
const StatisticsResponse = z.object({
  ok: z.literal(true),
  stats: z.object({
    total_runs: z.number().int().nonnegative(),
    total_steps: z.number().nonnegative(),
    total_starred: z.number().int().nonnegative(),
    unique_rulesets: z.number().int().nonnegative(),
    unique_users: z.number().int().nonnegative(),
    avg_runs_per_user: z.number(),
    avg_starred_per_user: z.number(),
    active_users_24h: z.number().int().nonnegative(),
    active_users_7d: z.number().int().nonnegative(),
    avg_interest_score: z.number(),
    avg_population: z.number(),
    avg_activity: z.number(),
    avg_entropy4x4: z.number(),
    outcome_distribution: z.object({
      dies_out: z.number().int().nonnegative(),
      exploding: z.number().int().nonnegative(),
      complex: z.number().int().nonnegative(),
    }),
    wolfram_classification: z.object({
      class_i: z.number().int().nonnegative(),
      class_ii: z.number().int().nonnegative(),
      class_iii: z.number().int().nonnegative(),
      class_iv: z.number().int().nonnegative(),
    }),
    interest_score_distribution: z.array(z.number().int().nonnegative()),
    population_distribution: z.array(z.number().int().nonnegative()),
    activity_distribution: z.array(z.number().int().nonnegative()),
    entropy_distribution: z.array(z.number().int().nonnegative()),
  }),
})

export const onRequestGet = async (
  ctx: EventContext<{ DB: D1Database }, string, Record<string, unknown>>,
): Promise<Response> => {
  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data, null, 2), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })

  try {
    // --- Fetch all runs for statistics computation -------------------------
    const query = `
      SELECT
        population,
        activity,
        entropy4x4,
        interest_score,
        step_count,
        ruleset_hex,
        is_starred,
        user_id,
        submitted_at
      FROM runs
    `

    const { results } = await ctx.env.DB.prepare(query).all()

    // Type assertion for D1 results
    type RunRow = {
      population: number
      activity: number
      entropy4x4: number
      interest_score: number
      step_count: number
      ruleset_hex: string
      is_starred: number
      user_id: string
      submitted_at: string
    }
    const runs = results as unknown as RunRow[]

    // --- Compute statistics ------------------------------------------------
    const totalRuns = runs.length

    if (totalRuns === 0) {
      return json({
        ok: true,
        stats: {
          total_runs: 0,
          total_steps: 0,
          total_starred: 0,
          unique_rulesets: 0,
          unique_users: 0,
          avg_runs_per_user: 0,
          avg_starred_per_user: 0,
          active_users_24h: 0,
          active_users_7d: 0,
          avg_interest_score: 0,
          avg_population: 0,
          avg_activity: 0,
          avg_entropy4x4: 0,
          outcome_distribution: { dies_out: 0, exploding: 0, complex: 0 },
          wolfram_classification: {
            class_i: 0,
            class_ii: 0,
            class_iii: 0,
            class_iv: 0,
          },
          interest_score_distribution: Array(10).fill(0),
          population_distribution: Array(10).fill(0),
          activity_distribution: Array(10).fill(0),
          entropy_distribution: Array(10).fill(0),
        },
      })
    }

    // Basic stats
    const totalSteps = runs.reduce((sum, r) => sum + (r.step_count || 0), 0)
    const totalStarred = runs.filter((r) => r.is_starred === 1).length
    const uniqueRulesets = new Set(runs.map((r) => r.ruleset_hex)).size

    // User engagement metrics
    const uniqueUsers = new Set(runs.map((r) => r.user_id)).size
    const avgRunsPerUser = uniqueUsers > 0 ? totalRuns / uniqueUsers : 0

    // Calculate starred patterns per user
    const starredByUser = new Map<string, number>()
    for (const run of runs) {
      if (run.is_starred === 1) {
        starredByUser.set(
          run.user_id,
          (starredByUser.get(run.user_id) || 0) + 1,
        )
      }
    }
    const avgStarredPerUser = uniqueUsers > 0 ? totalStarred / uniqueUsers : 0

    // Active users in time windows
    const now = new Date()
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

    const activeUsers24h = new Set(
      runs
        .filter((r) => new Date(r.submitted_at) > oneDayAgo)
        .map((r) => r.user_id),
    ).size

    const activeUsers7d = new Set(
      runs
        .filter((r) => new Date(r.submitted_at) > sevenDaysAgo)
        .map((r) => r.user_id),
    ).size

    // Averages
    const avgInterestScore =
      runs.reduce((sum, r) => sum + (r.interest_score || 0), 0) / totalRuns
    const avgPopulation =
      runs.reduce((sum, r) => sum + (r.population || 0), 0) / totalRuns
    const avgActivity =
      runs.reduce((sum, r) => sum + (r.activity || 0), 0) / totalRuns
    const avgEntropy4x4 =
      runs.reduce((sum, r) => sum + (r.entropy4x4 || 0), 0) / totalRuns

    // Outcome classification
    let diesOut = 0
    let exploding = 0
    let complex = 0

    for (const run of runs) {
      const pop = run.population || 0
      if (pop < 0.05) {
        diesOut++
      } else if (pop > 0.7) {
        exploding++
      } else {
        complex++
      }
    }

    // Wolfram classification
    let classI = 0
    let classII = 0
    let classIII = 0
    let classIV = 0

    for (const run of runs) {
      const pop = run.population || 0
      const act = run.activity || 0
      const ent = run.entropy4x4 || 0
      const interest = run.interest_score || 0

      // Class I: Dies out (population < 0.05 and activity < 0.1)
      if (pop < 0.05 && act < 0.1) {
        classI++
      }
      // Class IV: Complex (high interest score)
      else if (interest > 0.6) {
        classIV++
      }
      // Class III: Chaotic (high entropy and activity)
      else if (ent > 0.7 && act > 0.5) {
        classIII++
      }
      // Class II: Stable/Periodic (everything else)
      else {
        classII++
      }
    }

    // Distribution histograms (10 bins each)
    const interestDist = Array(10).fill(0)
    const populationDist = Array(10).fill(0)
    const activityDist = Array(10).fill(0)
    const entropyDist = Array(10).fill(0)

    for (const run of runs) {
      // Interest score (0-1)
      const interestBin = Math.min(
        9,
        Math.floor((run.interest_score || 0) * 10),
      )
      interestDist[interestBin]++

      // Population (0-1)
      const popBin = Math.min(9, Math.floor((run.population || 0) * 10))
      populationDist[popBin]++

      // Activity (0-1)
      const actBin = Math.min(9, Math.floor((run.activity || 0) * 10))
      activityDist[actBin]++

      // Entropy (0-1)
      const entBin = Math.min(9, Math.floor((run.entropy4x4 || 0) * 10))
      entropyDist[entBin]++
    }

    // --- Build response ----------------------------------------------------
    const response = {
      ok: true,
      stats: {
        total_runs: totalRuns,
        total_steps: totalSteps,
        total_starred: totalStarred,
        unique_rulesets: uniqueRulesets,
        unique_users: uniqueUsers,
        avg_runs_per_user: avgRunsPerUser,
        avg_starred_per_user: avgStarredPerUser,
        active_users_24h: activeUsers24h,
        active_users_7d: activeUsers7d,
        avg_interest_score: avgInterestScore,
        avg_population: avgPopulation,
        avg_activity: avgActivity,
        avg_entropy4x4: avgEntropy4x4,
        outcome_distribution: {
          dies_out: diesOut,
          exploding: exploding,
          complex: complex,
        },
        wolfram_classification: {
          class_i: classI,
          class_ii: classII,
          class_iii: classIII,
          class_iv: classIV,
        },
        interest_score_distribution: interestDist,
        population_distribution: populationDist,
        activity_distribution: activityDist,
        entropy_distribution: entropyDist,
      },
    }

    // Validate response
    const validated = StatisticsResponse.parse(response)
    return json(validated)
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('Statistics validation error:', error.issues)
      return json(
        { ok: false, error: 'Invalid data format', details: error.issues },
        500,
      )
    }

    if (error instanceof Error && /D1|SQL|prepare|bind/i.test(error.message)) {
      console.error('Database error fetching statistics:', error)
      return json({ ok: false, error: 'Database query failed' }, 500)
    }

    console.error('Unexpected error in statistics:', error)
    return json({ ok: false, error: 'Internal server error' }, 500)
  }
}
