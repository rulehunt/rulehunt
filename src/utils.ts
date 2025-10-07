// ---------------------------------------------------------------------------
// Cellular Automata Engine — C4 Symmetric 3×3 Binary Rules (140 bits)
// ---------------------------------------------------------------------------

// --- Constants --------------------------------------------------------------
/** Bit rotation map for a 3×3 neighborhood (90° clockwise) */
const ROT_MAP = [6, 3, 0, 7, 4, 1, 8, 5, 2]

// --- Types ------------------------------------------------------------------
export interface Rule140 {
  lo: bigint // bits 0-63
  mid: bigint // bits 64-127
  hi: bigint // bits 128-139 (only 12 bits used)
}

export interface C4Index {
  orbitId: Uint8Array
}

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

/** Compute canonical representative under C4 rotation (0,90,180,270°) */
export function canonicalC4(n: number): number {
  const r1 = rot90(n)
  const r2 = rot90(r1)
  const r3 = rot90(r2)
  return Math.min(n, r1, r2, r3)
}

/** Build orbit index for all 512 possible 3×3 binary patterns */
export function buildC4Index(): C4Index {
  const canon = new Uint16Array(512)
  for (let n = 0; n < 512; n++) canon[n] = canonicalC4(n)

  const reps = Array.from(new Set(Array.from(canon))).sort((a, b) => a - b)
  const idMap = new Map<number, number>()
  reps.forEach((v, i) => idMap.set(v, i))

  const orbitId = new Uint8Array(512)
  for (let n = 0; n < 512; n++) orbitId[n] = idMap.get(canon[n]) as number

  console.log(`C4 orbits: ${reps.length} (should be 140)`)
  return { orbitId }
}

// --- Rule Construction ------------------------------------------------------
/**
 * Build a 140-bit rule (C4 compressed) by evaluating a local rule function
 * over all 512 possible neighborhoods.
 */
export function makeRule140(
  fn: (n: number) => number,
  orbitId: Uint8Array,
): Rule140 {
  const bits = new Array(140).fill(0)
  for (let n = 0; n < 512; n++) {
    const out = fn(n)
    const oid = orbitId[n]
    bits[oid] = out
  }

  let lo = 0n
  let mid = 0n
  let hi = 0n

  for (let i = 0; i < 64; i++) if (bits[i]) lo |= 1n << BigInt(i)
  for (let i = 64; i < 128; i++) if (bits[i]) mid |= 1n << BigInt(i - 64)
  for (let i = 128; i < 140; i++) if (bits[i]) hi |= 1n << BigInt(i - 128)

  return { lo, mid, hi }
}

/** Expand a 140-bit rule to its 512-entry truth table */
export function expandRule(R: Rule140, orbitId: Uint8Array): Uint8Array {
  const T = new Uint8Array(512)
  for (let n = 0; n < 512; n++) {
    const orbit = orbitId[n]
    let bit: number

    if (orbit < 64) {
      bit = Number((R.lo >> BigInt(orbit)) & 1n)
    } else if (orbit < 128) {
      bit = Number((R.mid >> BigInt(orbit - 64)) & 1n)
    } else {
      bit = Number((R.hi >> BigInt(orbit - 128)) & 1n)
    }

    T[n] = bit
  }
  return T
}

// --- Serialization ----------------------------------------------------------
/** Convert Rule140 to 35-character hex string */
export function ruleToHex(rule: Rule140): string {
  // Pack: hi (12 bits) | mid (64 bits) | lo (64 bits) = 140 bits = 35 hex chars
  const hiHex = rule.hi.toString(16).padStart(3, '0') // 12 bits = 3 hex
  const midHex = rule.mid.toString(16).padStart(16, '0') // 64 bits = 16 hex
  const loHex = rule.lo.toString(16).padStart(16, '0') // 64 bits = 16 hex
  return hiHex + midHex + loHex // 35 chars total
}

/** Parse 35-character hex string to Rule140 */
export function hexToRule(hex: string): Rule140 {
  if (hex.length !== 35) {
    throw new Error(`Expected 35 hex characters, got ${hex.length}`)
  }

  const hiHex = hex.slice(0, 3)
  const midHex = hex.slice(3, 19)
  const loHex = hex.slice(19, 35)

  return {
    hi: BigInt(`0x${hiHex}`),
    mid: BigInt(`0x${midHex}`),
    lo: BigInt(`0x${loHex}`),
  }
}

/** Generate random 140-bit rule */
export function randomRule140(): Rule140 {
  const lo =
    (BigInt(Math.floor(Math.random() * 2 ** 32)) << 32n) |
    BigInt(Math.floor(Math.random() * 2 ** 32))
  const mid =
    (BigInt(Math.floor(Math.random() * 2 ** 32)) << 32n) |
    BigInt(Math.floor(Math.random() * 2 ** 32))
  const hi = BigInt(Math.floor(Math.random() * 4096)) // 12 bits = 0-4095

  return { lo, mid, hi }
}

/** Generate random 140-bit rule by randomly selecting orbits */
export function randomRule140ByOrbits(orbitPercentage = 50): Rule140 {
  let lo = 0n
  let mid = 0n
  let hi = 0n

  const threshold = orbitPercentage / 100

  // There are 140 orbits total (indices 0-139)
  for (let orbit = 0; orbit < 140; orbit++) {
    if (Math.random() < threshold) {
      // Turn on this orbit
      if (orbit < 64) {
        lo |= 1n << BigInt(orbit)
      } else if (orbit < 128) {
        mid |= 1n << BigInt(orbit - 64)
      } else {
        hi |= 1n << BigInt(orbit - 128)
      }
    }
  }

  return { lo, mid, hi }
}

// --- Canonical Rule Definitions ---------------------------------------------
/** Conway's Game of Life (B3/S23) */
export function conwayOutput(n: number): number {
  const center = (n >> 4) & 1
  let count = 0
  for (let i = 0; i < 9; i++) count += (n >> i) & 1
  const neighbors = count - center
  if (center === 1) return Number(neighbors === 2 || neighbors === 3)
  return Number(neighbors === 3)
}

/** Outlier rule (B135/S234) */
export function outlierOutput(n: number): number {
  const center = (n >> 4) & 1
  let count = 0
  for (let i = 0; i < 9; i++) count += (n >> i) & 1
  const neighbors = count - center
  if (center === 1) return Number([2, 3, 4].includes(neighbors))
  return Number([1, 3, 5].includes(neighbors))
}

// --- Visualization Utilities ------------------------------------------------
/**
 * Map 9-bit neighborhood index → (x,y) in a 16×32 Gray-coded grid.
 * Produces a smooth, structured imagemap layout for truth tables.
 */
export function coords16x32(n: number): { x: number; y: number } {
  const bx =
    (((n >> 7) & 1) << 3) |
    (((n >> 3) & 1) << 2) |
    (((n >> 1) & 1) << 1) |
    ((n >> 5) & 1)
  const x = bx ^ (bx >> 1) // 4-bit Gray

  const by =
    (((n >> 4) & 1) << 4) |
    (((n >> 8) & 1) << 3) |
    (((n >> 6) & 1) << 2) |
    (((n >> 0) & 1) << 1) |
    ((n >> 2) & 1)
  const y = by ^ (by >> 1) // 5-bit Gray

  return { x, y }
}
