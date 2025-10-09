import { GPU } from 'gpu.js'
import { bench, describe } from 'vitest'
import { CellularAutomata } from './cellular-automata-cpu'
import { GPUCellularAutomata } from './cellular-automata-gpu'
import { conwayRule, makeC4Ruleset } from './utils'

// Test various grid sizes to find crossover point
const GRID_SIZES = [
  { rows: 100, cols: 100, cells: 10_000 },
  { rows: 200, cols: 200, cells: 40_000 },
  { rows: 300, cols: 300, cells: 90_000 },
  { rows: 400, cols: 400, cells: 160_000 },
  { rows: 500, cols: 500, cells: 250_000 },
  { rows: 600, cols: 600, cells: 360_000 },
  { rows: 800, cols: 800, cells: 640_000 },
  { rows: 1000, cols: 1000, cells: 1_000_000 },
]

const STEPS_TO_RUN = 100

// Helper to create a canvas (needed for both implementations)
function createCanvas(width: number, height: number): HTMLCanvasElement {
  // In Node.js environment, we need to mock canvas
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
    }),
  } as unknown as HTMLCanvasElement
  return canvas
}

// Load orbit data once
async function loadOrbits() {
  try {
    const fs = await import('node:fs/promises')
    const data = await fs.readFile('./resources/c4-orbits.json', 'utf-8')
    return JSON.parse(data)
  } catch {
    // Fallback for browser or missing file
    return { orbits: [] }
  }
}

describe('GPU vs CPU Performance', async () => {
  const orbitsData = await loadOrbits()
  const orbitLookup = new Uint8Array(512)

  // Build orbit lookup if data is available
  if (orbitsData.orbits && orbitsData.orbits.length > 0) {
    for (let i = 0; i < orbitsData.orbits.length; i++) {
      const orbit = orbitsData.orbits[i]
      for (const member of orbit.members) {
        orbitLookup[member] = i
      }
    }
  }

  const conwayRuleset = makeC4Ruleset(conwayRule, orbitLookup)

  for (const { rows, cols, cells } of GRID_SIZES) {
    describe(`Grid Size: ${rows}x${cols} (${cells.toLocaleString()} cells)`, () => {
      bench(
        `CPU: ${cells.toLocaleString()} cells`,
        () => {
          const canvas = createCanvas(cols, rows)
          const ca = new CellularAutomata(canvas, {
            gridRows: rows,
            gridCols: cols,
            fgColor: '#000000',
            bgColor: '#ffffff',
          })

          // Initialize with random seed
          ca.randomSeed(50)

          // Run steps
          for (let i = 0; i < STEPS_TO_RUN; i++) {
            ca.step(conwayRuleset)
          }
        },
        {
          iterations: 5,
          time: 10000, // 10 second timeout
        },
      )

      bench(
        `GPU: ${cells.toLocaleString()} cells`,
        () => {
          const canvas = createCanvas(cols, rows)

          // Check if GPU is available
          let hasGPU = false
          try {
            const testGPU = new GPU({ mode: 'gpu' })
            hasGPU = testGPU.mode === 'gpu'
            testGPU.destroy()
          } catch {
            // GPU not available
            return
          }

          if (!hasGPU) {
            // Skip GPU benchmarks if not available
            return
          }

          const ca = new GPUCellularAutomata(canvas, {
            gridRows: rows,
            gridCols: cols,
            fgColor: '#000000',
            bgColor: '#ffffff',
          })

          // Initialize with random seed
          ca.randomSeed(50)

          // Run steps
          for (let i = 0; i < STEPS_TO_RUN; i++) {
            ca.step(conwayRuleset)
          }

          // Clean up GPU resources
          ca.pause()
        },
        {
          iterations: 5,
          time: 10000, // 10 second timeout
        },
      )
    })
  }
})
