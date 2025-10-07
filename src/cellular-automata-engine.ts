// ---------------------------------------------------------------------------
// Cellular Automata Engine — C4 Symmetric 3×3 Binary Rules
// ---------------------------------------------------------------------------

// --- Constants --------------------------------------------------------------
/** Bit rotation map for a 3×3 neighborhood (90° clockwise) */
const ROT_MAP = [6, 3, 0, 7, 4, 1, 8, 5, 2];

// --- Types ------------------------------------------------------------------
export interface Rule128 {
  lo: bigint;
  hi: bigint;
}

export interface C4Index {
  orbitId: Uint8Array;
}

// --- Symmetry / Orbit Functions ---------------------------------------------
/** Rotate a 9-bit neighborhood 90° clockwise */
export function rot90(n: number): number {
  let r = 0;
  for (let i = 0; i < 9; i++) {
    const src = ROT_MAP[i];
    if ((n >> src) & 1) r |= 1 << i;
  }
  return r;
}

/** Compute canonical representative under C4 rotation (0,90,180,270°) */
export function canonicalC4(n: number): number {
  const r1 = rot90(n);
  const r2 = rot90(r1);
  const r3 = rot90(r2);
  return Math.min(n, r1, r2, r3);
}

/** Build orbit index for all 512 possible 3×3 binary patterns */
export function buildC4Index(): C4Index {
  const canon = new Uint16Array(512);
  for (let n = 0; n < 512; n++) canon[n] = canonicalC4(n);

  const reps = Array.from(new Set(Array.from(canon))).sort((a, b) => a - b);
  const idMap = new Map<number, number>();
  reps.forEach((v, i) => idMap.set(v, i));

  const orbitId = new Uint8Array(512);
  for (let n = 0; n < 512; n++) orbitId[n] = idMap.get(canon[n])!;
  return { orbitId };
}

// --- Rule Construction ------------------------------------------------------
/**
 * Build a 128-bit rule (C4 compressed) by evaluating a local rule function
 * over all 512 possible neighborhoods.
 */
export function makeRule128(
  fn: (n: number) => number,
  orbitId: Uint8Array
): Rule128 {
  const bits = new Array(128).fill(0);
  for (let n = 0; n < 512; n++) {
    const out = fn(n);
    const oid = orbitId[n];
    bits[oid] = out;
  }

  let lo = 0n;
  let hi = 0n;
  for (let i = 0; i < 64; i++) if (bits[i]) lo |= 1n << BigInt(i);
  for (let i = 64; i < 128; i++) if (bits[i]) hi |= 1n << BigInt(i - 64);
  return { lo, hi };
}

/** Expand a 128-bit rule to its 512-entry truth table */
export function expandRule(R: Rule128, orbitId: Uint8Array): Uint8Array {
  const T = new Uint8Array(512);
  for (let n = 0; n < 512; n++) {
    const orbit = orbitId[n];
    const bit =
      orbit < 64
        ? Number((R.lo >> BigInt(orbit)) & 1n)
        : Number((R.hi >> BigInt(orbit - 64)) & 1n);
    T[n] = bit;
  }
  return T;
}

// --- Canonical Rule Definitions ---------------------------------------------
/** Conway’s Game of Life (B3/S23) */
export function conwayOutput(n: number): number {
  const center = (n >> 4) & 1;
  let count = 0;
  for (let i = 0; i < 9; i++) count += (n >> i) & 1;
  const neighbors = count - center;
  if (center === 1) return Number(neighbors === 2 || neighbors === 3);
  return Number(neighbors === 3);
}

/** Outlier rule (B135/S234) */
export function outlierOutput(n: number): number {
  const center = (n >> 4) & 1;
  let count = 0;
  for (let i = 0; i < 9; i++) count += (n >> i) & 1;
  const neighbors = count - center;
  if (center === 1) return Number([2, 3, 4].includes(neighbors));
  return Number([1, 3, 5].includes(neighbors));
}

// --- Visualization Utilities -----------------------------------------------
/**
 * Map 9-bit neighborhood index → (x,y) in a 16×32 Gray-coded grid.
 * Produces a smooth, structured imagemap layout for truth tables.
 */
export function coords16x32(n: number): { x: number; y: number } {
  const bx =
    ((n >> 7) & 1) << 3 |
    ((n >> 3) & 1) << 2 |
    ((n >> 1) & 1) << 1 |
    ((n >> 5) & 1);
  const x = bx ^ (bx >> 1);

  const by =
    ((n >> 4) & 1) << 4 |
    ((n >> 8) & 1) << 3 |
    ((n >> 6) & 1) << 2 |
    ((n >> 0) & 1) << 1 |
    ((n >> 2) & 1);
  const y = by ^ (by >> 1);

// --- ruleset serialization utilities -------------------------------------
export function rulesetToBinary(ruleset: Ruleset): bigint {
  let result = 0n;
  for (let i = 0; i < 512; i++) {
    if (ruleset[i] === 1) {
      result |= 1n << BigInt(i);
    }
  }
  return result;
}

export function rulesetToString(ruleset: Ruleset): string {
  const binary = rulesetToBinary(ruleset);
  return binary.toString(16).padStart(128, '0');
}

export function rulesetFromBinary(binary: bigint): Ruleset {
  const ruleset: CellState[] = new Array(512);
  for (let i = 0; i < 512; i++) {
    ruleset[i] = (binary >> BigInt(i)) & 1n ? 1 : 0;
  }
  return ruleset as Ruleset;
}

export function rulesetFromString(hex: string): Ruleset {
  const binary = BigInt('0x' + hex);
  return rulesetFromBinary(binary);
}

// --- visualization mapping (16×32 grid) ----------------------------------
export function coords16x32(n: number) {
  const bx = ((n >> 7) & 1) << 3 | ((n >> 3) & 1) << 2 | ((n >> 1) & 1) << 1 | ((n >> 5) & 1);
  const x = bx ^ (bx >> 1); // 4-bit Gray
  const by = ((n >> 4) & 1) << 4 | ((n >> 8) & 1) << 3 | ((n >> 6) & 1) << 2 | ((n >> 0) & 1) << 1 | ((n >> 2) & 1);
  const y = by ^ (by >> 1); // 5-bit Gray
  return { x, y };
}
