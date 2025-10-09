import { bench, describe } from 'vitest'
import { CellularAutomata } from '../src/cellular-automata-cpu'
import type { C4OrbitsData } from '../src/schema'
import { buildOrbitLookup, conwayRule, makeC4Ruleset } from '../src/utils'

// Test various grid sizes to find performance characteristics
const GRID_SIZES = [
  { rows: 100, cols: 100, cells: 10_000, name: '100x100' },
  { rows: 200, cols: 200, cells: 40_000, name: '200x200' },
  { rows: 300, cols: 300, cells: 90_000, name: '300x300' },
  { rows: 400, cols: 400, cells: 160_000, name: '400x400' },
  { rows: 500, cols: 500, cells: 250_000, name: '500x500' },
  { rows: 600, cols: 600, cells: 360_000, name: '600x600' },
  { rows: 800, cols: 800, cells: 640_000, name: '800x800' },
  { rows: 1000, cols: 1000, cells: 1_000_000, name: '1000x1000' },
]

const STEPS_TO_RUN = 100

// Helper to create a mock canvas for CPU testing
function createMockCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = {
    width,
    height,
    getContext: () => ({
      fillStyle: '',
      fillRect: () => {},
      clearRect: () => {},
      save: () => {},
      restore: () => {},
      scale: () => {},
      translate: () => {},
      setTransform: () => {},
      drawImage: () => {},
    }),
  } as unknown as HTMLCanvasElement
  return canvas
}

// Load orbit data
async function loadOrbits() {
  try {
    const fs = await import('node:fs/promises')
    const data = await fs.readFile('./resources/c4-orbits.json', 'utf-8')
    return JSON.parse(data)
  } catch (error) {
    console.warn('Could not load orbits data:', error)
    return { orbits: [] }
  }
}

describe("CPU Performance - Conway's Game of Life", async () => {
  const orbitsData = await loadOrbits()
  const orbitLookup = buildOrbitLookup(orbitsData as C4OrbitsData)
  const conwayRuleset = makeC4Ruleset(conwayRule, orbitLookup)

  for (const { rows, cols, cells, name } of GRID_SIZES) {
    bench(
      `CPU: ${name} (${cells.toLocaleString()} cells) - ${STEPS_TO_RUN} steps`,
      () => {
        const canvas = createMockCanvas(cols, rows)
        const ca = new CellularAutomata(canvas, {
          gridRows: rows,
          gridCols: cols,
          fgColor: '#000000',
          bgColor: '#ffffff',
        })

        // Initialize with random seed for realistic performance
        ca.randomSeed(50)

        // Run steps
        for (let i = 0; i < STEPS_TO_RUN; i++) {
          ca.step(conwayRuleset)
        }
      },
      {
        iterations: 5,
        time: 30000, // 30 second timeout per benchmark
      },
    )
  }
})

describe('CPU Performance - Single Step Analysis', async () => {
  const orbitsData = await loadOrbits()
  const orbitLookup = buildOrbitLookup(orbitsData as C4OrbitsData)
  const conwayRuleset = makeC4Ruleset(conwayRule, orbitLookup)

  // Test single step performance at key grid sizes
  const KEY_SIZES = [
    { rows: 400, cols: 400, cells: 160_000, name: '400x400' },
    { rows: 600, cols: 600, cells: 360_000, name: '600x600' },
    { rows: 1000, cols: 1000, cells: 1_000_000, name: '1000x1000' },
  ]

  for (const { rows, cols, cells, name } of KEY_SIZES) {
    bench(
      `CPU Single Step: ${name} (${cells.toLocaleString()} cells)`,
      () => {
        const canvas = createMockCanvas(cols, rows)
        const ca = new CellularAutomata(canvas, {
          gridRows: rows,
          gridCols: cols,
          fgColor: '#000000',
          bgColor: '#ffffff',
        })

        ca.randomSeed(50)
        ca.step(conwayRuleset)
      },
      {
        iterations: 20,
        time: 30000,
      },
    )
  }
})
