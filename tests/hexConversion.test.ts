import { describe, expect, it } from 'vitest'
import { c4RulesetToHex, hexToC4Ruleset } from '../src/utils'

describe('Hex Conversion', () => {
	it('should round-trip correctly (hex -> ruleset -> hex)', () => {
		const testHex = 'e6b83b0acaf6aa4326fc24869458b22a710'
		const ruleset = hexToC4Ruleset(testHex)
		const resultHex = c4RulesetToHex(ruleset)
		expect(resultHex).toBe(testHex)
	})

	it('should correctly preserve bit patterns', () => {
		// Test with a known pattern (exactly 35 hex chars)
		const testHex = '00000000000000100204100000000100100'
		const ruleset = hexToC4Ruleset(testHex)
		const resultHex = c4RulesetToHex(ruleset)

		expect(resultHex).toBe(testHex)
		expect(ruleset.length).toBe(140)
	})

	it('should handle all zeros', () => {
		const allZerosHex = '0'.repeat(35)
		const ruleset = hexToC4Ruleset(allZerosHex)
		expect(ruleset.every((val) => val === 0)).toBe(true)
	})

	it('should handle all ones (in hex representation)', () => {
		// All 140 bits set = all f's except the top 3 hex chars
		// 140 bits = 0x0FFF (top 12 bits) + 0xFFFF_FFFF_FFFF_FFFF (mid 64) + 0xFFFF_FFFF_FFFF_FFFF (lo 64)
		const allOnesHex = 'fff' + 'f'.repeat(32)
		const ruleset = hexToC4Ruleset(allOnesHex)
		expect(ruleset.every((val) => val === 1)).toBe(true)
	})

	it('should throw error for invalid hex length', () => {
		expect(() => hexToC4Ruleset('abc')).toThrow('Expected 35 hex characters')
		expect(() => hexToC4Ruleset('a'.repeat(34))).toThrow('Expected 35 hex characters')
		expect(() => hexToC4Ruleset('a'.repeat(36))).toThrow('Expected 35 hex characters')
	})

	it('should validate length strictly', () => {
		// Hex must be exactly 35 characters
		const validHex = '0'.repeat(35)
		expect(() => hexToC4Ruleset(validHex)).not.toThrow()

		// Should reject shorter or longer
		expect(() => hexToC4Ruleset('0'.repeat(34))).toThrow()
		expect(() => hexToC4Ruleset('0'.repeat(36))).toThrow()
	})
})
