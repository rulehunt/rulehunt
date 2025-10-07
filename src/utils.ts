// ---------------------------------------------------------------------------
// Cellular Automata Engine — C4 Symmetric 3×3 Binary Rules
// ---------------------------------------------------------------------------

import type { C4OrbitsData, C4Ruleset, Pattern, Ruleset } from './schema.ts'

// --- Constants --------------------------------------------------------------
/** Bit rotation map for a 3×3 neighborhood (90° clockwise) */
const ROT_MAP = [6, 3, 0, 7, 4, 1, 8, 5, 2]

// --- Symmetry / Orbit Functions ---------------------------------------------
/** Rotate a 9-bit neighborhood 90° clockwise */
export function rot90(n: number): number {
  let r = 0
  for (let i = 0; i < 9; i++) {
    const src = ROT_MAP[i]
    if ((n >> src) & 1) r |= 1 << i
  }
  return r
}

/** Compute canonical representative under C4 rotation (0°, 90°, 180°, 270°) */
export function canonicalC4(n: number): number {
  const r1 = rot90(n)
  const r2 = rot90(r1)
  const r3 = rot90(r2)
  return Math.min(n, r1, r2, r3)
}

/**
 * Build a fast lookup array mapping patterns to orbit IDs.
 * Returns a Uint8Array where array[pattern] = orbitId
 */
export function buildOrbitLookup(orbitsData: C4OrbitsData): Uint8Array {
  const lookup = new Uint8Array(512)

  for (const orbit of orbitsData.orbits) {
    for (const pattern of orbit.patterns) {
      lookup[pattern] = orbit.id
    }
  }

  return lookup
}

// --- Rule Construction ------------------------------------------------------
/**
 * Build a C4Ruleset by evaluating a rule function over all 512 possible
 * neighborhoods and compressing via C4 symmetry.
 */
export function makeC4Ruleset(
  fn: (pattern: Pattern) => 0 | 1,
  orbitId: Uint8Array,
): C4Ruleset {
  const ruleset = new Array(140).fill(0) as (0 | 1)[]

  for (let n = 0; n < 512; n++) {
    const output = fn(n)
    const oid = orbitId[n]
    ruleset[oid] = output
  }

  return ruleset as C4Ruleset
}

/** Expand a C4Ruleset (140 entries) to a full Ruleset (512 entries) */
export function expandC4Ruleset(
  ruleset: C4Ruleset,
  orbitId: Uint8Array,
): Ruleset {
  const expanded = new Array(512) as (0 | 1)[]

  for (let n = 0; n < 512; n++) {
    expanded[n] = ruleset[orbitId[n]]
  }

  return expanded as Ruleset
}

// --- Serialization ----------------------------------------------------------
/** Convert C4Ruleset to 35-character hex string (140 bits packed) */
export function c4RulesetToHex(ruleset: C4Ruleset): string {
  // Pack 140 bits into bigints: lo (0-63), mid (64-127), hi (128-139)
  let lo = 0n
  let mid = 0n
  let hi = 0n

  for (let i = 0; i < 64; i++) {
    if (ruleset[i]) lo |= 1n << BigInt(i)
  }
  for (let i = 64; i < 128; i++) {
    if (ruleset[i]) mid |= 1n << BigInt(i - 64)
  }
  for (let i = 128; i < 140; i++) {
    if (ruleset[i]) hi |= 1n << BigInt(i - 128)
  }

  // Convert to hex: 3 + 16 + 16 = 35 chars
  const hiHex = hi.toString(16).padStart(3, '0')
  const midHex = mid.toString(16).padStart(16, '0')
  const loHex = lo.toString(16).padStart(16, '0')

  return hiHex + midHex + loHex
}

/** Parse 35-character hex string to C4Ruleset */
export function hexToC4Ruleset(hex: string): C4Ruleset {
  if (hex.length !== 35) {
    throw new Error(`Expected 35 hex characters, got ${hex.length}`)
  }

  // Parse hex into bigints
  const hi = BigInt(`0x${hex.slice(0, 3)}`)
  const mid = BigInt(`0x${hex.slice(3, 19)}`)
  const lo = BigInt(`0x${hex.slice(19, 35)}`)

  // Unpack bits into array
  const ruleset = new Array(140) as (0 | 1)[]

  for (let i = 0; i < 64; i++) {
    ruleset[i] = Number((lo >> BigInt(i)) & 1n) as 0 | 1
  }
  for (let i = 64; i < 128; i++) {
    ruleset[i] = Number((mid >> BigInt(i - 64)) & 1n) as 0 | 1
  }
  for (let i = 128; i < 140; i++) {
    ruleset[i] = Number((hi >> BigInt(i - 128)) & 1n) as 0 | 1
  }

  return ruleset as C4Ruleset
}

// --- Random Generation ------------------------------------------------------
/** Generate random C4Ruleset */
export function randomC4Ruleset(): C4Ruleset {
  const ruleset = new Array(140) as (0 | 1)[]
  for (let i = 0; i < 140; i++) {
    ruleset[i] = Math.random() < 0.5 ? 1 : 0
  }
  return ruleset as C4Ruleset
}

/** Generate random C4Ruleset by setting each orbit with given probability */
export function randomC4RulesetByDensity(density = 0.5): C4Ruleset {
  const ruleset = new Array(140) as (0 | 1)[]
  for (let i = 0; i < 140; i++) {
    ruleset[i] = Math.random() < density ? 1 : 0
  }
  return ruleset as C4Ruleset
}

// --- Canonical Rule Definitions ---------------------------------------------
/** Conway's Game of Life (B3/S23) */
export function conwayRule(pattern: Pattern): 0 | 1 {
  const center = (pattern >> 4) & 1
  let count = 0
  for (let i = 0; i < 9; i++) count += (pattern >> i) & 1
  const neighbors = count - center
  if (center === 1) return neighbors === 2 || neighbors === 3 ? 1 : 0
  return neighbors === 3 ? 1 : 0
}

/** Outlier rule (B135/S234) */
export function outlierRule(pattern: Pattern): 0 | 1 {
  const center = (pattern >> 4) & 1
  let count = 0
  for (let i = 0; i < 9; i++) count += (pattern >> i) & 1
  const neighbors = count - center
  if (center === 1) return [2, 3, 4].includes(neighbors) ? 1 : 0
  return [1, 3, 5].includes(neighbors) ? 1 : 0
}

// --- Visualization Utilities ------------------------------------------------
/**
 * Map orbit index (0-139) to (x,y) in a 10×14 grid.
 * Reading left-to-right, top-to-bottom.
 */
export function coords10x14(orbitIndex: number): { x: number; y: number } {
  const x = orbitIndex % 10
  const y = Math.floor(orbitIndex / 10)
  return { x, y }
}

/**
 * Map pattern index (0-511) to (x,y) in a 32×16 Gray-coded grid.
 * Uses Gray coding to place similar patterns near each other visually.
 *
 * Grid layout: 32 columns × 16 rows = 512 cells
 */
export function coords32x16(pattern: Pattern): { x: number; y: number } {
  // x gets 5 bits: bits 7,5,3,1,0 -> 32 columns
  const bx =
    (((pattern >> 7) & 1) << 4) |
    (((pattern >> 5) & 1) << 3) |
    (((pattern >> 3) & 1) << 2) |
    (((pattern >> 1) & 1) << 1) |
    ((pattern >> 0) & 1)
  const x = bx ^ (bx >> 1) // Gray code

  // y gets 4 bits: bits 8,6,4,2 -> 16 rows
  const by =
    (((pattern >> 8) & 1) << 3) |
    (((pattern >> 6) & 1) << 2) |
    (((pattern >> 4) & 1) << 1) |
    ((pattern >> 2) & 1)
  const y = by ^ (by >> 1) // Gray code

  return { x, y }
}
