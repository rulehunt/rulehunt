// src/urlState.ts
// URL state management for shareable links

import type { C4Ruleset } from './schema.ts'
import { hexToC4Ruleset } from './utils.ts'

export type URLState = {
  rulesetHex?: string
  seed?: number
  seedType?: 'center' | 'random' | 'patch'
  seedPercentage?: number
  generation?: number
}

/**
 * Parse URL query parameters into structured state.
 * Returns empty object if no valid parameters found.
 */
export function parseURLState(): URLState {
  const params = new URLSearchParams(window.location.search)
  const state: URLState = {}

  // Parse rulesetHex (35-char hex string)
  const rulesetHex = params.get('rulesetHex')
  if (rulesetHex && /^[0-9a-f]{35}$/i.test(rulesetHex)) {
    state.rulesetHex = rulesetHex.toLowerCase()
  }

  // Parse seed (integer)
  const seedStr = params.get('seed')
  if (seedStr) {
    const seed = Number.parseInt(seedStr, 10)
    if (!Number.isNaN(seed)) {
      state.seed = seed
    }
  }

  // Parse seedType
  const seedType = params.get('seedType')
  if (seedType === 'center' || seedType === 'random' || seedType === 'patch') {
    state.seedType = seedType
  }

  // Parse seedPercentage (0-100)
  const seedPercentageStr = params.get('seedPercentage')
  if (seedPercentageStr) {
    const seedPercentage = Number.parseInt(seedPercentageStr, 10)
    if (
      !Number.isNaN(seedPercentage) &&
      seedPercentage >= 0 &&
      seedPercentage <= 100
    ) {
      state.seedPercentage = seedPercentage
    }
  }

  // Parse generation (non-negative integer)
  const generationStr = params.get('generation')
  if (generationStr) {
    const generation = Number.parseInt(generationStr, 10)
    if (!Number.isNaN(generation) && generation >= 0) {
      state.generation = generation
    }
  }

  return state
}

/**
 * Parse URL state and convert rulesetHex to C4Ruleset if present.
 * Returns null if rulesetHex is invalid.
 */
export function parseURLRuleset(): {
  ruleset: C4Ruleset
  hex: string
} | null {
  const state = parseURLState()
  if (!state.rulesetHex) return null

  try {
    const ruleset = hexToC4Ruleset(state.rulesetHex)
    return { ruleset, hex: state.rulesetHex }
  } catch (e) {
    console.warn('[urlState] Invalid rulesetHex in URL:', e)
    return null
  }
}

/**
 * Build a shareable URL from current state.
 * Returns full absolute URL.
 */
export function buildShareURL(state: URLState): string {
  const params = new URLSearchParams()

  if (state.rulesetHex) {
    params.set('rulesetHex', state.rulesetHex)
  }

  if (state.seed !== undefined) {
    params.set('seed', state.seed.toString())
  }

  if (state.seedType && state.seedType !== 'patch') {
    // Only include if non-default
    params.set('seedType', state.seedType)
  }

  if (state.seedPercentage !== undefined && state.seedPercentage !== 50) {
    // Only include if non-default
    params.set('seedPercentage', state.seedPercentage.toString())
  }

  if (state.generation !== undefined && state.generation > 0) {
    // Only include if non-zero (0 is initial state)
    params.set('generation', state.generation.toString())
  }

  const url = new URL(window.location.href)
  url.search = params.toString()
  return url.toString()
}

/**
 * Update browser URL bar without reloading page.
 * Uses history.replaceState to avoid adding history entry.
 */
export function updateURLWithoutReload(state: URLState): void {
  const url = buildShareURL(state)
  window.history.replaceState({}, '', url)
}
