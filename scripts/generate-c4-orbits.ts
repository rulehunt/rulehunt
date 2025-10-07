import { writeFileSync } from 'node:fs'
import type {
  C4Orbit,
  C4OrbitsFile,
  C4Pattern,
} from '../src/schemas/c4-orbits.js'

// 90° clockwise rotation mapping for 3x3 grid positions
const ROT_MAP = [6, 3, 0, 7, 4, 1, 8, 5, 2]

// Rotate a 3x3 bit pattern by 90° clockwise
function rot90(n: number): number {
  let result = 0
  for (let i = 0; i < 9; i++) {
    const sourceBit = ROT_MAP[i]
    if ((n >> sourceBit) & 1) {
      result |= 1 << i
    }
  }
  return result
}

// Get all rotations of a pattern
function getAllRotations(n: number): number[] {
  const rotations = [n]
  let current = n
  for (let i = 0; i < 3; i++) {
    current = rot90(current)
    rotations.push(current)
  }
  return rotations
}

// Convert pattern number to 3x3 grid
function patternToGrid(n: number): number[][] {
  const grid: number[][] = []
  for (let row = 0; row < 3; row++) {
    grid[row] = []
    for (let col = 0; col < 3; col++) {
      const bitIndex = row * 3 + col
      grid[row][col] = (n >> bitIndex) & 1
    }
  }
  return grid
}

// Format grid as string
function gridToString(grid: number[][]): string {
  return grid.map((row) => row.join('')).join('\n')
}

// Build all C4 orbits
function buildC4Orbits() {
  const orbits: Map<number, number[]> = new Map()

  // Process all 512 patterns
  for (let n = 0; n < 512; n++) {
    const rotations = getAllRotations(n)
    const canonical = Math.min(...rotations)

    // Only process if this is a new canonical representative
    if (!orbits.has(canonical)) {
      const uniqueRotations = [...new Set(rotations)].sort((a, b) => a - b)
      orbits.set(canonical, uniqueRotations)
    }
  }

  return orbits
}

// Main execution
const orbits = buildC4Orbits()

// Convert to array format with all orbits together
const allOrbits: C4Orbit[] = []

let orbitId = 0
for (const [representative, patterns] of orbits) {
  const orbitData: C4Orbit = {
    id: orbitId++,
    representative,
    size: patterns.length,
    patterns: patterns.map((pattern) => ({
      value: pattern,
      binary: pattern.toString(2).padStart(9, '0'),
      grid: patternToGrid(pattern),
      gridString: gridToString(patternToGrid(pattern)),
    })),
  }
  allOrbits.push(orbitData)
  process.stdout.write('.')
}
console.log() // New line after dots

// Create the final JSON structure
const result: C4OrbitsFile = {
  summary: {
    totalOrbits: orbits.size,
    orbitSizeDistribution: allOrbits.reduce(
      (acc, orbit) => {
        acc[orbit.size] = (acc[orbit.size] || 0) + 1
        return acc
      },
      {} as Record<string, number>,
    ),
    totalPatterns: allOrbits.reduce((sum, orbit) => sum + orbit.size, 0),
  },
  orbits: allOrbits,
}

// Write to file
writeFileSync('./resources/c4-orbits.json', JSON.stringify(result, null, 2))

console.log('C4 orbit analysis written to resources/c4-orbits.json')
console.log('Summary:')
console.log(`  Total orbits: ${result.summary.totalOrbits}`)
console.log('  Orbit distribution:', result.summary.orbitSizeDistribution)
console.log(`  Total patterns: ${result.summary.totalPatterns}`)
