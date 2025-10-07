import { writeFileSync } from 'node:fs'
import type { C4Orbit, C4OrbitsData } from '../src/schema.ts'
import { canonicalC4, rot90 } from '../src/utils.ts'

// ============================================================================
// Orbit Building
// ============================================================================

/** Get all 4 rotations of a pattern (may contain duplicates if symmetric) */
function getAllRotations(n: number): number[] {
  const rotations = [n]
  let current = n
  for (let i = 0; i < 3; i++) {
    current = rot90(current)
    rotations.push(current)
  }
  return rotations
}

/** Get stabilizer subgroup based on orbit size */
function getStabilizer(size: number): 'I' | 'C2' | 'C4' {
  switch (size) {
    case 1:
      return 'C4' // 4-fold rotational symmetry
    case 2:
      return 'C2' // 180° rotational symmetry
    case 4:
      return 'I' // No rotational symmetry (identity only)
    default:
      throw new Error(`Invalid orbit size: ${size}`)
  }
}

/** Build all 140 C4 orbits from the 512 possible 3×3 patterns */
function buildC4Orbits(): Map<number, number[]> {
  const orbits: Map<number, number[]> = new Map()

  for (let n = 0; n < 512; n++) {
    const canonical = canonicalC4(n)

    if (!orbits.has(canonical)) {
      const rotations = getAllRotations(canonical)
      // Get unique patterns in this orbit, sorted
      const uniquePatterns = [...new Set(rotations)].sort((a, b) => a - b)
      orbits.set(canonical, uniquePatterns)
    }
  }

  return orbits
}

// ============================================================================
// Main Execution
// ============================================================================

console.log('Computing C4 orbits...')
const orbitsMap = buildC4Orbits()

// Convert to array format
const orbits: C4Orbit[] = []
let orbitId = 0

for (const [representative, patternValues] of orbitsMap) {
  const size = patternValues.length
  orbits.push({
    id: orbitId++,
    representative,
    size,
    stabilizer: getStabilizer(size),
    patterns: patternValues, // Patterns are just numbers now
  })
  process.stdout.write('.')
}
console.log() // New line after progress dots

// Create orbit size distribution
const orbitSizeDistribution = orbits.reduce(
  (acc, orbit) => {
    const key = orbit.size.toString()
    acc[key] = (acc[key] || 0) + 1
    return acc
  },
  {} as Record<string, number>,
)

// Create stabilizer distribution
const stabilizerDistribution = orbits.reduce(
  (acc, orbit) => {
    acc[orbit.stabilizer] = (acc[orbit.stabilizer] || 0) + 1
    return acc
  },
  {} as Record<string, number>,
)

// Create the final data structure
const result: C4OrbitsData = {
  summary: {
    totalOrbits: 140,
    orbitSizeDistribution,
    stabilizerDistribution,
    totalPatterns: 512,
  },
  orbits,
}

// Write to file
const outputPath = './resources/c4-orbits.json'
writeFileSync(outputPath, JSON.stringify(result, null, 2))

// Print summary
console.log(`✓ C4 orbit analysis written to ${outputPath}`)
console.log('\nSummary:')
console.log(`  Total orbits: ${result.summary.totalOrbits}`)
console.log('  Orbit size distribution:')
for (const [size, count] of Object.entries(orbitSizeDistribution).sort()) {
  console.log(`    Size ${size}: ${count} orbits`)
}
console.log('  Stabilizer distribution:')
for (const [stabilizer, count] of Object.entries(
  stabilizerDistribution,
).sort()) {
  console.log(`    ${stabilizer}: ${count} orbits`)
}
console.log(`  Total patterns: ${result.summary.totalPatterns}`)

// Validation
console.log('\nValidation:')
const totalPatternsCheck = orbits.reduce((sum, orbit) => sum + orbit.size, 0)
console.log(
  `  Pattern count check: ${totalPatternsCheck === 512 ? '✓' : '✗'} (${totalPatternsCheck}/512)`,
)
console.log(
  `  Orbit count check: ${orbits.length === 140 ? '✓' : '✗'} (${orbits.length}/140)`,
)
