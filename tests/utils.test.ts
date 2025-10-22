// tests/utils.test.ts
import { describe, it, expect } from 'vitest'
import {
  rot90,
  canonicalC4,
  buildOrbitLookup,
  makeC4Ruleset,
  expandC4Ruleset,
  c4RulesetToHex,
  hexToC4Ruleset,
  randomC4Ruleset,
  randomC4RulesetByDensity,
  mutateC4Ruleset,
  conwayRule,
  coords10x14,
  coords32x16,
} from '../src/utils'
import type { C4OrbitsData, C4Ruleset } from '../src/schema'

describe('rot90', () => {
  it('should rotate empty pattern (all zeros)', () => {
    const pattern = 0b000000000
    const rotated = rot90(pattern)
    expect(rotated).toBe(0b000000000)
  })

  it('should rotate full pattern (all ones)', () => {
    const pattern = 0b111111111
    const rotated = rot90(pattern)
    expect(rotated).toBe(0b111111111)
  })

  it('should rotate center bit correctly', () => {
    const pattern = 0b000010000 // center bit only
    const rotated = rot90(pattern)
    expect(rotated).toBe(0b000010000) // center stays in place
  })

  it('should rotate corner pattern correctly', () => {
    // Top-left corner (bit 0)
    const pattern = 0b000000001
    const rotated = rot90(pattern)
    // After 90° rotation, top-left should move to top-right (bit 2)
    expect(rotated).toBe(0b000000100)
  })

  it('should rotate 4 times to get original', () => {
    const pattern = 0b101010101
    const r1 = rot90(pattern)
    const r2 = rot90(r1)
    const r3 = rot90(r2)
    const r4 = rot90(r3)
    expect(r4).toBe(pattern)
  })
})

describe('canonicalC4', () => {
  it('should return same value for symmetric pattern', () => {
    const pattern = 0b000010000 // center only
    expect(canonicalC4(pattern)).toBe(pattern)
  })

  it('should return minimum rotation', () => {
    const pattern = 0b100000000 // top-left
    const canonical = canonicalC4(pattern)
    expect(canonical).toBeLessThanOrEqual(pattern)
  })

  it('should return same canonical for all rotations of a pattern', () => {
    const pattern = 0b101010001
    const r1 = rot90(pattern)
    const r2 = rot90(r1)
    const r3 = rot90(r2)

    const canon = canonicalC4(pattern)
    expect(canonicalC4(r1)).toBe(canon)
    expect(canonicalC4(r2)).toBe(canon)
    expect(canonicalC4(r3)).toBe(canon)
  })
})

describe('buildOrbitLookup', () => {
  it('should create lookup table mapping patterns to orbit IDs', () => {
    const orbitsData: C4OrbitsData = {
      orbits: [
        { id: 0, patterns: [0, 1, 2, 3] },
        { id: 1, patterns: [4, 5, 6] },
        { id: 2, patterns: [7, 8] },
      ],
    }

    const lookup = buildOrbitLookup(orbitsData)

    expect(lookup[0]).toBe(0)
    expect(lookup[1]).toBe(0)
    expect(lookup[4]).toBe(1)
    expect(lookup[5]).toBe(1)
    expect(lookup[7]).toBe(2)
    expect(lookup[8]).toBe(2)
  })

  it('should initialize all entries to 0 by default', () => {
    const orbitsData: C4OrbitsData = { orbits: [] }
    const lookup = buildOrbitLookup(orbitsData)
    expect(lookup.length).toBe(512)
    expect(lookup.every((v) => v === 0)).toBe(true)
  })
})

describe('makeC4Ruleset', () => {
  it('should create ruleset by applying function to all patterns', () => {
    const orbitId = new Uint8Array(512)
    // Set up simple orbit mapping: pattern -> orbit ID = pattern % 140
    for (let i = 0; i < 512; i++) {
      orbitId[i] = i % 140
    }

    // Rule: output 1 if pattern has even number of bits set
    const fn = (pattern: number) => {
      const bits = pattern.toString(2).split('1').length - 1
      return (bits % 2 === 0 ? 1 : 0) as 0 | 1
    }

    const ruleset = makeC4Ruleset(fn, orbitId)
    expect(ruleset.length).toBe(140)
    expect(ruleset.every((v) => v === 0 || v === 1)).toBe(true)
  })

  it('should create all-zeros ruleset', () => {
    const orbitId = new Uint8Array(512)
    for (let i = 0; i < 512; i++) {
      orbitId[i] = i % 140
    }

    const ruleset = makeC4Ruleset(() => 0, orbitId)
    expect(ruleset.every((v) => v === 0)).toBe(true)
  })

  it('should create all-ones ruleset', () => {
    const orbitId = new Uint8Array(512)
    for (let i = 0; i < 512; i++) {
      orbitId[i] = i % 140
    }

    const ruleset = makeC4Ruleset(() => 1, orbitId)
    expect(ruleset.every((v) => v === 1)).toBe(true)
  })
})

describe('expandC4Ruleset', () => {
  it('should expand compressed ruleset to full 512 entries', () => {
    const c4Ruleset = new Array(140).fill(0) as C4Ruleset
    c4Ruleset[0] = 1
    c4Ruleset[10] = 1
    c4Ruleset[50] = 1

    const orbitId = new Uint8Array(512)
    orbitId[0] = 0
    orbitId[100] = 10
    orbitId[200] = 50

    const expanded = expandC4Ruleset(c4Ruleset, orbitId)
    expect(expanded.length).toBe(512)
    expect(expanded[0]).toBe(1)
    expect(expanded[100]).toBe(1)
    expect(expanded[200]).toBe(1)
  })
})

describe('c4RulesetToHex and hexToC4Ruleset', () => {
  it('should convert all-zeros ruleset to hex and back', () => {
    const ruleset = new Array(140).fill(0) as C4Ruleset
    const hex = c4RulesetToHex(ruleset)

    expect(hex.length).toBe(35)
    expect(hex).toBe('0'.repeat(35))

    const parsed = hexToC4Ruleset(hex)
    expect(parsed).toEqual(ruleset)
  })

  it('should convert all-ones ruleset to hex and back', () => {
    const ruleset = new Array(140).fill(1) as C4Ruleset
    const hex = c4RulesetToHex(ruleset)

    expect(hex.length).toBe(35)

    const parsed = hexToC4Ruleset(hex)
    expect(parsed).toEqual(ruleset)
  })

  it('should be reversible for arbitrary ruleset', () => {
    const ruleset = new Array(140) as C4Ruleset
    for (let i = 0; i < 140; i++) {
      ruleset[i] = i % 2 === 0 ? 1 : 0
    }

    const hex = c4RulesetToHex(ruleset)
    const parsed = hexToC4Ruleset(hex)

    expect(parsed).toEqual(ruleset)
  })

  it('should handle specific test vector', () => {
    const testHex = 'e6b83b0acaf6aa4326fc24869458b22a710'
    const ruleset = hexToC4Ruleset(testHex)

    expect(ruleset.length).toBe(140)
    expect(ruleset.every((v) => v === 0 || v === 1)).toBe(true)

    // Round-trip should produce same hex
    const hexBack = c4RulesetToHex(ruleset)
    expect(hexBack).toBe(testHex)
  })

  it('should throw error for invalid hex length', () => {
    expect(() => hexToC4Ruleset('abc')).toThrow('Expected 35 hex characters')
    expect(() => hexToC4Ruleset('a'.repeat(40))).toThrow(
      'Expected 35 hex characters',
    )
  })
})

describe('randomC4Ruleset', () => {
  it('should generate valid ruleset', () => {
    const ruleset = randomC4Ruleset()

    expect(ruleset.length).toBe(140)
    expect(ruleset.every((v) => v === 0 || v === 1)).toBe(true)
  })

  it('should generate different rulesets on multiple calls', () => {
    const r1 = randomC4Ruleset()
    const r2 = randomC4Ruleset()

    // Statistically should be different
    expect(r1).not.toEqual(r2)
  })
})

describe('randomC4RulesetByDensity', () => {
  it('should generate valid ruleset with default density', () => {
    const ruleset = randomC4RulesetByDensity()

    expect(ruleset.length).toBe(140)
    expect(ruleset.every((v) => v === 0 || v === 1)).toBe(true)
  })

  it('should generate mostly ones with high density', () => {
    const ruleset = randomC4RulesetByDensity(0.9)

    const onesCount = ruleset.filter((v) => v === 1).length
    // With 90% density, expect most bits to be 1
    expect(onesCount).toBeGreaterThan(100) // roughly 126 expected
  })

  it('should generate mostly zeros with low density', () => {
    const ruleset = randomC4RulesetByDensity(0.1)

    const onesCount = ruleset.filter((v) => v === 1).length
    // With 10% density, expect few bits to be 1
    expect(onesCount).toBeLessThan(40) // roughly 14 expected
  })

  it('should force rule zero off when requested', () => {
    const ruleset = randomC4RulesetByDensity(0.9, true)

    expect(ruleset[0]).toBe(0)
  })
})

describe('mutateC4Ruleset', () => {
  it('should return different ruleset', () => {
    const original = new Array(140).fill(0) as C4Ruleset
    const mutated = mutateC4Ruleset(original, 0.1)

    expect(mutated).not.toEqual(original)
  })

  it('should flip approximately correct number of bits', () => {
    const original = new Array(140).fill(0) as C4Ruleset
    const magnitude = 0.1 // 10% = 14 bits
    const mutated = mutateC4Ruleset(original, magnitude)

    const flippedCount = mutated.filter((v) => v === 1).length
    expect(flippedCount).toBe(Math.floor(magnitude * 140))
  })

  it('should force rule zero off when requested', () => {
    const original = new Array(140).fill(1) as C4Ruleset
    const mutated = mutateC4Ruleset(original, 0.5, true)

    expect(mutated[0]).toBe(0)
  })

  it('should not mutate original ruleset', () => {
    const original = new Array(140).fill(0) as C4Ruleset
    const originalCopy = [...original]
    mutateC4Ruleset(original, 0.1)

    expect(original).toEqual(originalCopy)
  })
})

describe('conwayRule', () => {
  it('should implement birth rule (B3)', () => {
    // Pattern with 3 neighbors, center dead
    const pattern = 0b000000111 // 3 neighbors, center (bit 4) dead
    expect(conwayRule(pattern)).toBe(1)
  })

  it('should implement survival rule (S2)', () => {
    // Pattern with 2 neighbors, center alive
    const pattern = 0b000010011 // center alive (bit 4), 2 other neighbors
    expect(conwayRule(pattern)).toBe(1)
  })

  it('should implement survival rule (S3)', () => {
    // Pattern with 3 neighbors, center alive
    const pattern = 0b000010111 // center alive (bit 4), 3 other neighbors
    expect(conwayRule(pattern)).toBe(1)
  })

  it('should kill cell with 0 neighbors', () => {
    const pattern = 0b000010000 // only center alive
    expect(conwayRule(pattern)).toBe(0)
  })

  it('should kill cell with 1 neighbor', () => {
    const pattern = 0b000010001 // center + 1 neighbor
    expect(conwayRule(pattern)).toBe(0)
  })

  it('should kill cell with 4+ neighbors (overpopulation)', () => {
    const pattern = 0b000011111 // center + 4 neighbors
    expect(conwayRule(pattern)).toBe(0)
  })

  it('should leave dead cell dead with wrong neighbor count', () => {
    const pattern = 0b000000011 // 2 neighbors, center dead
    expect(conwayRule(pattern)).toBe(0)
  })
})

describe('coords10x14', () => {
  it('should map orbit 0 to (0, 0)', () => {
    expect(coords10x14(0)).toEqual({ x: 0, y: 0 })
  })

  it('should map orbit 9 to (9, 0) - end of first row', () => {
    expect(coords10x14(9)).toEqual({ x: 9, y: 0 })
  })

  it('should map orbit 10 to (0, 1) - start of second row', () => {
    expect(coords10x14(10)).toEqual({ x: 0, y: 1 })
  })

  it('should map orbit 139 to (9, 13) - last orbit', () => {
    expect(coords10x14(139)).toEqual({ x: 9, y: 13 })
  })

  it('should map middle orbit correctly', () => {
    const orbit = 75 // row 7, col 5
    expect(coords10x14(orbit)).toEqual({ x: 5, y: 7 })
  })
})

describe('coords32x16', () => {
  it('should map pattern 0 to valid coordinates', () => {
    const coords = coords32x16(0)
    expect(coords.x).toBeGreaterThanOrEqual(0)
    expect(coords.x).toBeLessThan(32)
    expect(coords.y).toBeGreaterThanOrEqual(0)
    expect(coords.y).toBeLessThan(16)
  })

  it('should map pattern 511 to valid coordinates', () => {
    const coords = coords32x16(511)
    expect(coords.x).toBeGreaterThanOrEqual(0)
    expect(coords.x).toBeLessThan(32)
    expect(coords.y).toBeGreaterThanOrEqual(0)
    expect(coords.y).toBeLessThan(16)
  })

  it('should map all 512 patterns to unique coordinates', () => {
    const coordsSet = new Set<string>()

    for (let i = 0; i < 512; i++) {
      const { x, y } = coords32x16(i)
      const key = `${x},${y}`
      coordsSet.add(key)
    }

    // Should have 512 unique coordinates (32 * 16 = 512)
    expect(coordsSet.size).toBe(512)
  })

  it('should place consecutive patterns near each other (Gray code property)', () => {
    const c0 = coords32x16(0)
    const c1 = coords32x16(1)

    // Gray code ensures consecutive patterns differ by 1 bit
    // So they should be adjacent in the grid
    const xDiff = Math.abs(c0.x - c1.x)
    const yDiff = Math.abs(c0.y - c1.y)

    expect(xDiff + yDiff).toBeLessThanOrEqual(2)
  })
})
