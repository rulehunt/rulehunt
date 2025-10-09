import { z } from 'zod'

// ============================================================================
// Primitives
// ============================================================================

/** Cell state: 0 (dead) or 1 (alive) */
export const CellState = z.union([z.literal(0), z.literal(1)])

/** 2D coordinate */
export const Coordinate = z.object({
  x: z.number().int(),
  y: z.number().int(),
})

/** Grid dimensions */
export const GridDimensions = z.object({
  width: z.number().int().positive(),
  height: z.number().int().positive(),
})

/** Grid of cell states (2D array) */
export const Grid = z.array(z.array(CellState))

/**
 * A 3×3 grid patch at a specific location.
 * Represents an actual neighborhood extracted from a grid.
 */
export const Patch = z.object({
  /** Location of the center cell */
  coordinate: Coordinate,
  /** The 3×3 neighborhood values */
  cells: z.array(z.array(CellState).length(3)).length(3),
})

// ============================================================================
// Rulesets
// ============================================================================

/**
 * An abstract 3×3 binary pattern (one of 512 possible configurations).
 * Represented as a 9-bit integer (0-511).
 *
 * Bit-to-position mapping (little-endian, row-major order):
 * ```
 *   Grid positions:        Bit indices:
 *   ┌───┬───┬───┐         ┌───┬───┬───┐
 *   │ 0 │ 1 │ 2 │         │ 0 │ 1 │ 2 │
 *   ├───┼───┼───┤         ├───┼───┼───┤
 *   │ 3 │ 4 │ 5 │   -->   │ 3 │ 4 │ 5 │  (bit 4 is center)
 *   ├───┼───┼───┤         ├───┼───┼───┤
 *   │ 6 │ 7 │ 8 │         │ 6 │ 7 │ 8 │
 *   └───┴───┴───┘         └───┴───┴───┘
 * ```
 *
 * Example: Pattern value 273 = 0b100010001
 *   Bit 0 = 1, Bit 4 = 1, Bit 8 = 1
 *   Visual: ┌───┬───┬───┐
 *           │ 1 │ 0 │ 0 │
 *           ├───┼───┼───┤
 *           │ 0 │ 1 │ 0 │  (diagonal line)
 *           ├───┼───┼───┤
 *           │ 0 │ 0 │ 1 │
 *           └───┴───┴───┘
 *
 * Endianness: Little-endian bit ordering where bit 0 (LSB) corresponds to
 * position [0][0] (top-left), and bit 8 (MSB) corresponds to position [2][2]
 * (bottom-right). Reading left-to-right, top-to-bottom through the grid
 * corresponds to ascending bit significance.
 */
export const Pattern = z.number().int().min(0).max(511)

/**
 * An orbit under C4 rotation symmetry.
 * Contains all patterns reachable by 90° rotations.
 */
export const C4Orbit = z.object({
  /** Orbit index (0-139) */
  id: z.number().int().min(0).max(139),
  /** Canonical representative (smallest pattern value in orbit) */
  representative: Pattern,
  /** Number of distinct patterns in this orbit (1, 2, or 4) */
  size: z.number().int().min(1).max(4),
  /**
   * Stabilizer subgroup of the representative pattern.
   * Indicates which rotations leave the pattern unchanged:
   * - 'I' (Identity): No rotational symmetry, all 4 rotations distinct (size = 4)
   * - 'C2': 180° rotational symmetry, 2 distinct rotations (size = 2)
   * - 'C4': 4-fold rotational symmetry, only 1 pattern (size = 1)
   */
  stabilizer: z.enum(['I', 'C2', 'C4']),
  /** All pattern values in this orbit */
  patterns: z.array(Pattern),
})

/** Complete C4 orbit data */
export const C4OrbitsData = z.object({
  /** Summary statistics */
  summary: z.object({
    totalOrbits: z.literal(140),
    orbitSizeDistribution: z.record(z.string(), z.number()),
    stabilizerDistribution: z.record(z.string(), z.number()),
    totalPatterns: z.literal(512),
  }),
  /** All 140 orbits */
  orbits: z.array(C4Orbit).length(140),
})

/**
 * Full 512-entry truth table (lookup table form).
 * Indexed by pattern ID (0-511): ruleset[patternId] = output state
 */
export const Ruleset = z.array(CellState).length(512)

/**
 * C4-symmetric ruleset (140 entries, lookup table form).
 * Indexed by orbit ID (0-139): c4Ruleset[orbitId] = output state
 */
export const C4Ruleset = z.array(CellState).length(140)

/**
 * 140-bit rule as a 35-character hex string.
 * Compact serialization format for C4-symmetric rules.
 * Format: 3 hex chars (hi) + 16 hex chars (mid) + 16 hex chars (lo) = 35 chars
 */
export const C4RulesetHex = z
  .string()
  .length(35)
  .regex(/^[0-9a-f]{35}$/i)

// ============================================================================
// Database schema for run submissions (Cloudflare D1)
// ============================================================================

// Shared enums reused from your metadata types
export const SeedType = z.enum(['center', 'random', 'patch'])

// Scores summarized from GridStatistics
export const Scores = z.object({
  population: z.number(),
  activity: z.number(),
  populationChange: z.number(),
  entropy2x2: z.number(),
  entropy4x4: z.number(),
  entropy8x8: z.number(),
  entityCount: z.number().optional(),
  entityChange: z.number().optional(),
  interestScore: z.number(),
})

// Optional metadata for simulation environment
export const SimulationInfo = z.object({
  rulesetName: z.string(),
  rulesetHex: z.string().regex(/^[0-9a-f]{35}$/i),
  seed: z.number().int(),
  seedType: SeedType,
  seedPercentage: z.number().optional(),
  stepCount: z.number().int().nonnegative(),
  watchedSteps: z.number().int().nonnegative(),
  watchedWallMs: z.number().int().nonnegative(),
  gridSize: z.number().int().positive().optional(),
  progress_bar_steps: z.number().int().positive().optional(),
  requestedSps: z.number().optional(),
  actualSps: z.number().optional(),
  simVersion: z.string(),
  engineCommit: z.string().optional(),
})

// User identity fields (anonymous-safe)
export const UserIdentity = z.object({
  userId: z.string().uuid().or(z.literal('anonymous')).default('anonymous'),
  userLabel: z.string().optional(),
})

const ISODateString = z
  .string()
  .regex(
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/,
    'must be a valid ISO 8601 datetime string',
  )

// Full database record as it’s inserted into D1
export const RunRecord = z
  .object({
    runId: z.string().optional(),
    submittedAt: ISODateString.optional(),
    ...UserIdentity.shape,
    ...SimulationInfo.shape,
    ...Scores.shape,
    extraScores: z.record(z.string(), z.any()).optional(),
  })
  .strict()

// When saving from the frontend, you’ll usually send this shape:
export const RunSubmission = RunRecord.omit({
  runId: true,
  submittedAt: true,
})

export const RunQuery = z.object({
  userId: z.string().uuid().or(z.literal('anonymous')).optional(),
  rulesetHex: z
    .string()
    .regex(/^[0-9a-f]{35}$/i)
    .optional(),
  limit: z.number().int().positive().max(100).default(20),
  sortBy: z
    .enum(['submittedAt', 'interestScore', 'entropy4x4'])
    .default('submittedAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
})

// ============================================================================
// Leaderboard types
// ============================================================================

export const LeaderboardEntry = z.object({
  run_id: z.string(),
  user_id: z.string(),
  user_label: z.string().nullable().optional(),
  ruleset_name: z.string(),
  ruleset_hex: z.string().regex(/^[0-9a-f]{35}$/i),
  watched_steps: z.number().int().nonnegative(),
  watched_wall_ms: z.number().int().nonnegative(),
  interest_score: z.number().nonnegative(),
  entropy4x4: z.number().nonnegative(),
  submitted_at: z.string().datetime(),
})

export const LeaderboardResponse = z.object({
  ok: z.literal(true),
  results: z.array(LeaderboardEntry),
  sort: z.enum(['recent', 'longest', 'interesting']).optional(),
})

// ============================================================================
// Type exports
// ============================================================================
export type RunSubmission = z.infer<typeof RunSubmission>
export type RunRecord = z.infer<typeof RunRecord>
export type RunInsert = {
  [K in keyof RunSubmission]: RunSubmission[K] | null
}
export type RunQuery = z.infer<typeof RunQuery>
export type Scores = z.infer<typeof Scores>
export type SimulationInfo = z.infer<typeof SimulationInfo>
export type UserIdentity = z.infer<typeof UserIdentity>
export type CellState = z.infer<typeof CellState>
export type Coordinate = z.infer<typeof Coordinate>
export type GridDimensions = z.infer<typeof GridDimensions>
export type Grid = z.infer<typeof Grid>
export type Patch = z.infer<typeof Patch>
export type Pattern = z.infer<typeof Pattern>
export type C4Orbit = z.infer<typeof C4Orbit>
export type C4OrbitsData = z.infer<typeof C4OrbitsData>
export type Ruleset = z.infer<typeof Ruleset>
export type C4Ruleset = z.infer<typeof C4Ruleset>
export type LeaderboardEntry = z.infer<typeof LeaderboardEntry>
export type LeaderboardResponse = z.infer<typeof LeaderboardResponse>
