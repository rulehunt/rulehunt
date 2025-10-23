// src/components/mobile/ruleGeneration.ts

import { formatRulesetName } from '../../api/save'
import { fetchStarredPattern } from '../../api/starred'
import {
  c4RulesetToHex,
  hexToC4Ruleset,
  mutateC4Ruleset,
  randomC4RulesetByDensity,
} from '../../utils'
import type { RuleData } from './layout'

/**
 * Force rule 0 (all-dead-stay-dead) to be OFF to avoid strobing.
 */
const FORCE_RULE_ZERO_OFF = true

/**
 * Generates a completely random C4 rule with density in range [0.2, 0.8].
 *
 * @returns Random rule data
 */
export function generateRandomRule(): RuleData {
  const density = Math.random() * 0.6 + 0.2
  const ruleset = randomC4RulesetByDensity(density, FORCE_RULE_ZERO_OFF)
  return {
    name: formatRulesetName('random', density * 100),
    hex: c4RulesetToHex(ruleset),
    ruleset,
  }
}

/**
 * Generates the next rule using an exploration/exploitation/mutation strategy:
 *
 * When auto-mutate is **enabled** (default):
 * - **20% Random** (r ∈ [0.0, 0.2]): Brand new random rule
 * - **70% Mutated Starred** (r ∈ [0.2, 0.9]): Fetch starred rule, mutate with decreasing magnitude
 *   - At r = 0.2: maximum mutation (magnitude = 1.0)
 *   - At r = 0.9: minimum mutation (magnitude → 0.0)
 * - **10% Exact Starred** (r ∈ [0.9, 1.0]): Fetch and return starred rule unmodified (with saved seed)
 *
 * When auto-mutate is **disabled**:
 * - **20% Random** (r ∈ [0.0, 0.2]): Brand new random rule
 * - **80% Exact Starred** (r ∈ [0.2, 1.0]): Fetch and return starred rule unmodified (with saved seed)
 *
 * This balances exploration (random) with exploitation (starred) and learning (mutation).
 *
 * @param autoMutateEnabled Whether to apply mutation to starred rules (default: true)
 * @returns Promise resolving to the next rule
 */
export async function generateNextRule(
  autoMutateEnabled = true,
): Promise<RuleData> {
  const r = Math.random()

  // 20% random (0.0 - 0.2)
  if (r < 0.2) {
    console.log('[generateNextRule] Strategy: Random')
    return generateRandomRule()
  }

  // Try to fetch a starred pattern for both exact and mutation cases
  try {
    const starred = await fetchStarredPattern()
    if (!starred) {
      console.warn(
        '[generateNextRule] No starred pattern returned, using random',
      )
      return generateRandomRule()
    }

    const ruleset = hexToC4Ruleset(starred.ruleset_hex)

    // If auto-mutate is disabled, always return exact starred (80% of the time after random)
    if (!autoMutateEnabled) {
      console.log(
        '[generateNextRule] Strategy: Exact starred (auto-mutate disabled) -',
        starred.ruleset_name,
        'seed:',
        starred.seed,
      )
      return {
        name: starred.ruleset_name,
        hex: starred.ruleset_hex,
        ruleset,
        seed: starred.seed, // Include saved seed for exact reproduction
      }
    }

    // Auto-mutate is enabled - use original mutation strategy
    // 10% exact starred (0.9 - 1.0)
    if (r > 0.9) {
      console.log(
        '[generateNextRule] Strategy: Exact starred -',
        starred.ruleset_name,
        'seed:',
        starred.seed,
      )
      return {
        name: starred.ruleset_name,
        hex: starred.ruleset_hex,
        ruleset,
        seed: starred.seed, // Include saved seed for exact reproduction
      }
    }

    // 70% mutated starred (0.2 - 0.9)
    // Map r in [0.2, 0.9] to normalized value in [0.0, 1.0]
    const normalized = (r - 0.2) / 0.7
    // Then invert to get mutation magnitude: 1.0 at r=0.2, decreasing to 0.0 at r=0.9
    const magnitude = 1.0 - normalized
    const mutated = mutateC4Ruleset(ruleset, magnitude, FORCE_RULE_ZERO_OFF)
    const mutatedHex = c4RulesetToHex(mutated)
    console.log(
      `[generateNextRule] Strategy: Mutated starred (magnitude=${magnitude.toFixed(2)}) - based on`,
      starred.ruleset_name,
    )
    return {
      name: `${starred.ruleset_name} (mutated)`,
      hex: mutatedHex,
      ruleset: mutated,
      // Don't include seed - let it be random for mutations
    }
  } catch (err) {
    console.warn(
      '[generateNextRule] Failed to fetch starred pattern, falling back to random:',
      err,
    )
    return generateRandomRule()
  }
}
