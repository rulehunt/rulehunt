import type { CellState, Ruleset } from './cellular-automata'

export function rulesetToBinary(ruleset: Ruleset): bigint {
  let result = 0n
  for (let i = 0; i < 512; i++) {
    if (ruleset[i] === 1) {
      result |= 1n << BigInt(i)
    }
  }
  return result
}

export function rulesetToString(ruleset: Ruleset): string {
  const binary = rulesetToBinary(ruleset)
  return binary.toString(16).padStart(128, '0')
}

export function rulesetFromBinary(binary: bigint): Ruleset {
  const ruleset: CellState[] = new Array(512)
  for (let i = 0; i < 512; i++) {
    ruleset[i] = (binary >> BigInt(i)) & 1n ? 1 : 0
  }
  return ruleset as Ruleset
}

export function rulesetFromString(hex: string): Ruleset {
  const binary = BigInt(`0x${hex}`)
  return rulesetFromBinary(binary)
}
