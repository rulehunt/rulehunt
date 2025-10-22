// tests/urlState.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  parseURLState,
  parseURLRuleset,
  buildShareURL,
  updateURLWithoutReload,
} from '../src/urlState'

describe('parseURLState', () => {
  beforeEach(() => {
    // Reset window.location.search before each test
    delete (window as { location?: unknown }).location
    ;(window as { location: { search: string } }).location = { search: '' }
  })

  it('should parse valid rulesetHex parameter', () => {
    window.location.search = '?rulesetHex=e6b83b0acaf6aa4326fc24869458b22a710'
    const state = parseURLState()
    expect(state.rulesetHex).toBe('e6b83b0acaf6aa4326fc24869458b22a710')
  })

  it('should normalize rulesetHex to lowercase', () => {
    window.location.search = '?rulesetHex=E6B83B0ACAF6AA4326FC24869458B22A710'
    const state = parseURLState()
    expect(state.rulesetHex).toBe('e6b83b0acaf6aa4326fc24869458b22a710')
  })

  it('should reject rulesetHex with invalid length', () => {
    window.location.search = '?rulesetHex=abc123' // too short
    const state = parseURLState()
    expect(state.rulesetHex).toBeUndefined()
  })

  it('should reject rulesetHex with non-hex characters', () => {
    window.location.search = '?rulesetHex=e6b83b0acaf6aa4326fc24869458b22g710' // 'g' is not hex
    const state = parseURLState()
    expect(state.rulesetHex).toBeUndefined()
  })

  it('should parse valid seed parameter', () => {
    window.location.search = '?seed=3205800350'
    const state = parseURLState()
    expect(state.seed).toBe(3205800350)
  })

  it('should reject non-numeric seed', () => {
    window.location.search = '?seed=abc'
    const state = parseURLState()
    expect(state.seed).toBeUndefined()
  })

  it('should parse valid seedType parameter', () => {
    window.location.search = '?seedType=center'
    const state = parseURLState()
    expect(state.seedType).toBe('center')

    window.location.search = '?seedType=random'
    expect(parseURLState().seedType).toBe('random')

    window.location.search = '?seedType=patch'
    expect(parseURLState().seedType).toBe('patch')
  })

  it('should reject invalid seedType values', () => {
    window.location.search = '?seedType=invalid'
    const state = parseURLState()
    expect(state.seedType).toBeUndefined()
  })

  it('should parse valid seedPercentage parameter', () => {
    window.location.search = '?seedPercentage=75'
    const state = parseURLState()
    expect(state.seedPercentage).toBe(75)
  })

  it('should reject seedPercentage out of range', () => {
    window.location.search = '?seedPercentage=150' // > 100
    let state = parseURLState()
    expect(state.seedPercentage).toBeUndefined()

    window.location.search = '?seedPercentage=-5' // < 0
    state = parseURLState()
    expect(state.seedPercentage).toBeUndefined()
  })

  it('should parse all parameters together', () => {
    window.location.search =
      '?rulesetHex=e6b83b0acaf6aa4326fc24869458b22a710&seed=123&seedType=center&seedPercentage=75'
    const state = parseURLState()
    expect(state).toEqual({
      rulesetHex: 'e6b83b0acaf6aa4326fc24869458b22a710',
      seed: 123,
      seedType: 'center',
      seedPercentage: 75,
    })
  })

  it('should handle empty query string', () => {
    window.location.search = ''
    const state = parseURLState()
    expect(state).toEqual({})
  })

  it('should handle partial valid parameters', () => {
    window.location.search = '?rulesetHex=invalid&seed=123'
    const state = parseURLState()
    expect(state).toEqual({
      seed: 123,
      // rulesetHex should be omitted due to validation failure
    })
  })
})

describe('buildShareURL', () => {
  beforeEach(() => {
    // Mock window.location.href
    delete (window as { location?: unknown }).location
    ;(window as { location: { href: string } }).location = {
      href: 'https://rulehunt.org/',
    }
  })

  it('should build URL with rulesetHex only', () => {
    const url = buildShareURL({
      rulesetHex: 'e6b83b0acaf6aa4326fc24869458b22a710',
    })
    expect(url).toBe(
      'https://rulehunt.org/?rulesetHex=e6b83b0acaf6aa4326fc24869458b22a710',
    )
  })

  it('should build URL with rulesetHex and seed', () => {
    const url = buildShareURL({
      rulesetHex: 'e6b83b0acaf6aa4326fc24869458b22a710',
      seed: 3205800350,
    })
    expect(url).toBe(
      'https://rulehunt.org/?rulesetHex=e6b83b0acaf6aa4326fc24869458b22a710&seed=3205800350',
    )
  })

  it('should include seedType when not patch (non-default)', () => {
    const url = buildShareURL({
      rulesetHex: 'e6b83b0acaf6aa4326fc24869458b22a710',
      seedType: 'center',
    })
    expect(url).toContain('seedType=center')
  })

  it('should omit seedType when patch (default)', () => {
    const url = buildShareURL({
      rulesetHex: 'e6b83b0acaf6aa4326fc24869458b22a710',
      seedType: 'patch',
    })
    expect(url).not.toContain('seedType')
  })

  it('should include seedPercentage when not 50 (non-default)', () => {
    const url = buildShareURL({
      rulesetHex: 'e6b83b0acaf6aa4326fc24869458b22a710',
      seedPercentage: 75,
    })
    expect(url).toContain('seedPercentage=75')
  })

  it('should omit seedPercentage when 50 (default)', () => {
    const url = buildShareURL({
      rulesetHex: 'e6b83b0acaf6aa4326fc24869458b22a710',
      seedPercentage: 50,
    })
    expect(url).not.toContain('seedPercentage')
  })

  it('should build complete URL with all parameters', () => {
    const url = buildShareURL({
      rulesetHex: 'e6b83b0acaf6aa4326fc24869458b22a710',
      seed: 123,
      seedType: 'random',
      seedPercentage: 75,
    })
    expect(url).toBe(
      'https://rulehunt.org/?rulesetHex=e6b83b0acaf6aa4326fc24869458b22a710&seed=123&seedType=random&seedPercentage=75',
    )
  })

  it('should handle empty state object', () => {
    const url = buildShareURL({})
    expect(url).toBe('https://rulehunt.org/')
  })

  it('should preserve existing URL path', () => {
    ;(window as { location: { href: string } }).location = {
      href: 'https://rulehunt.org/path/to/page',
    }
    const url = buildShareURL({
      rulesetHex: 'e6b83b0acaf6aa4326fc24869458b22a710',
    })
    expect(url).toBe(
      'https://rulehunt.org/path/to/page?rulesetHex=e6b83b0acaf6aa4326fc24869458b22a710',
    )
  })
})

describe('parseURLRuleset', () => {
  beforeEach(() => {
    delete (window as { location?: unknown }).location
    ;(window as { location: { search: string } }).location = { search: '' }
  })

  it('should return null when no rulesetHex in URL', () => {
    window.location.search = ''
    const result = parseURLRuleset()
    expect(result).toBeNull()
  })

  it('should return null for invalid rulesetHex', () => {
    window.location.search = '?rulesetHex=invalid'
    const result = parseURLRuleset()
    expect(result).toBeNull()
  })

  it('should parse valid rulesetHex and return ruleset object', () => {
    window.location.search = '?rulesetHex=e6b83b0acaf6aa4326fc24869458b22a710'
    const result = parseURLRuleset()

    expect(result).not.toBeNull()
    expect(result?.hex).toBe('e6b83b0acaf6aa4326fc24869458b22a710')
    expect(result?.ruleset).toBeDefined()
    expect(result?.ruleset.length).toBe(140)
  })

  it('should handle all-zeros ruleset', () => {
    const allZerosHex = '0'.repeat(35)
    window.location.search = `?rulesetHex=${allZerosHex}`
    const result = parseURLRuleset()

    expect(result).not.toBeNull()
    expect(result?.ruleset.every((v) => v === 0)).toBe(true)
  })
})

describe('updateURLWithoutReload', () => {
  beforeEach(() => {
    delete (window as { location?: unknown }).location
    delete (window as { history?: unknown }).history

    // Mock window.location.href
    ;(window as { location: { href: string; search: string } }).location = {
      href: 'https://rulehunt.org/',
      search: '',
    }

    // Mock window.history.replaceState
    const mockReplaceState = vi.fn()
    ;(window as { history: { replaceState: typeof mockReplaceState } }).history =
      {
        replaceState: mockReplaceState,
      }
  })

  it('should call history.replaceState with built URL', () => {
    const state = {
      rulesetHex: 'e6b83b0acaf6aa4326fc24869458b22a710',
      seed: 123,
    }

    updateURLWithoutReload(state)

    expect(window.history.replaceState).toHaveBeenCalledWith(
      {},
      '',
      'https://rulehunt.org/?rulesetHex=e6b83b0acaf6aa4326fc24869458b22a710&seed=123',
    )
  })

  it('should update URL with empty state', () => {
    updateURLWithoutReload({})

    expect(window.history.replaceState).toHaveBeenCalledWith(
      {},
      '',
      'https://rulehunt.org/',
    )
  })

  it('should update URL with all parameters', () => {
    const state = {
      rulesetHex: 'e6b83b0acaf6aa4326fc24869458b22a710',
      seed: 456,
      seedType: 'center' as const,
      seedPercentage: 75,
    }

    updateURLWithoutReload(state)

    expect(window.history.replaceState).toHaveBeenCalledWith(
      {},
      '',
      'https://rulehunt.org/?rulesetHex=e6b83b0acaf6aa4326fc24869458b22a710&seed=456&seedType=center&seedPercentage=75',
    )
  })
})
