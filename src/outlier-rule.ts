// ---------------------------------------------------------------------------
// “Outlier” rule (Bo Yang 2023) — Self-replicating CA on 3×3 Moore neighborhood
// 55 canonical base patterns + 3 rotations = 220 alive states out of 512.
// ---------------------------------------------------------------------------

import type { Pattern } from './schema.ts'
import { rot90 } from './utils.ts'

/** 55 canonical base 9-bit patterns (see Fig. 2 of Yang 2023) */
const BASE_PATTERNS: number[] = [
  7, 11, 13, 14, 19, 21, 22, 23, 25, 26, 27, 28, 29, 30, 33, 35, 37, 39, 42, 43,
  44, 45, 46, 47, 49, 50, 51, 53, 54, 55, 57, 58, 59, 60, 61, 62, 63, 69, 70,
  71, 73, 74, 75, 77, 78, 79, 81, 83, 84, 85, 86, 87, 91, 93, 95, 97, 99,
]

/** Build lookup set of all “alive” 9-bit neighborhoods (including rotations) */
export const OUTLIER_LIVE_PATTERNS = (() => {
  const s = new Set<number>()
  for (const base of BASE_PATTERNS) {
    let p = base
    for (let i = 0; i < 4; i++) {
      s.add(p)
      p = rot90(p)
    }
  }
  return s
})()

/**
 * Outlier rule transition function.
 * @param pattern 9-bit integer encoding of 3×3 neighborhood (0–511)
 * @returns 1 if the center cell becomes/stays alive, else 0
 */
export function outlierRule(pattern: Pattern): 0 | 1 {
  // pattern *is already* the 9-bit integer “n” we want.
  return OUTLIER_LIVE_PATTERNS.has(pattern) ? 1 : 0
}
