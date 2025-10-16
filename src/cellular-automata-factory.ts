/**
 * Cellular Automata Factory
 *
 * Dynamically selects between CPU and GPU implementations based on:
 * 1. GPU availability (feature detection)
 * 2. Grid size (CPU faster for small grids due to sync overhead)
 * 3. Canvas presence (headless mode always uses CPU for now)
 *
 * Crossover point (where GPU becomes faster than CPU) varies by hardware,
 * but typical ranges are:
 * - < 200x200 (40K cells): CPU usually faster
 * - 200x200 - 500x500 (40K-250K cells): Depends on hardware
 * - > 500x500 (250K+ cells): GPU usually faster
 *
 * The factory provides a conservative default of 250K cells (500x500)
 * but can be overridden via options.
 */

import { GPU } from 'gpu.js'
import { CellularAutomata as CPUCellularAutomata } from './cellular-automata-cpu'
import { GPUCellularAutomata } from './cellular-automata-gpu'
import type {
  CellularAutomataOptions,
  ICellularAutomata,
} from './cellular-automata-interface'

export interface CAFactoryOptions extends CellularAutomataOptions {
  /**
   * Minimum grid size (in cells) to use GPU acceleration.
   * Default: 250000 (500x500)
   *
   * Set to 0 to always prefer GPU when available.
   * Set to Infinity to always use CPU.
   */
  gpuThreshold?: number

  /**
   * Force a specific implementation.
   * - 'auto': Use dynamic selection (default)
   * - 'cpu': Always use CPU
   * - 'gpu': Always use GPU (will throw if GPU unavailable)
   */
  forceImplementation?: 'auto' | 'cpu' | 'gpu'
}

// Global GPU availability cache (test once per session)
let gpuAvailable: boolean | null = null

/**
 * Test if GPU.js is available and working.
 * Caches result to avoid repeated GPU context creation.
 */
function testGPUAvailability(): boolean {
  if (gpuAvailable !== null) {
    return gpuAvailable
  }

  try {
    const testGPU = new GPU({ mode: 'gpu' })
    gpuAvailable = testGPU.mode === 'gpu'
    testGPU.destroy()
    return gpuAvailable
  } catch (e) {
    console.warn('[CA Factory] GPU not available:', e)
    gpuAvailable = false
    return false
  }
}

/**
 * Create a cellular automata instance with automatic CPU/GPU selection.
 *
 * @param canvas - Canvas element for rendering (null for headless mode)
 * @param options - Configuration options including grid size and GPU threshold
 * @returns ICellularAutomata instance (either CPU or GPU implementation)
 */
export function createCellularAutomata(
  canvas: HTMLCanvasElement | null,
  options: CAFactoryOptions,
): ICellularAutomata {
  const {
    gridRows,
    gridCols,
    gpuThreshold = 250_000,
    forceImplementation = 'auto',
    ...caOptions
  } = options

  const gridSize = gridRows * gridCols

  // Handle forced implementation
  if (forceImplementation === 'cpu') {
    console.log(
      `[CA Factory] Using CPU (forced) - ${gridCols}x${gridRows} = ${gridSize.toLocaleString()} cells`,
    )
    return new CPUCellularAutomata(canvas, {
      gridRows,
      gridCols,
      ...caOptions,
    })
  }

  if (forceImplementation === 'gpu') {
    if (!testGPUAvailability()) {
      throw new Error(
        '[CA Factory] GPU implementation forced but GPU is not available',
      )
    }
    console.log(
      `[CA Factory] Using GPU (forced) - ${gridCols}x${gridRows} = ${gridSize.toLocaleString()} cells`,
    )
    return new GPUCellularAutomata(canvas, {
      gridRows,
      gridCols,
      ...caOptions,
    })
  }

  // Auto selection logic

  // For headless mode (no canvas), currently always use CPU
  // GPU.js sync overhead makes it slower for data collection workflows
  if (canvas === null) {
    console.log(
      `[CA Factory] Using CPU (headless) - ${gridCols}x${gridRows} = ${gridSize.toLocaleString()} cells`,
    )
    return new CPUCellularAutomata(null, {
      gridRows,
      gridCols,
      ...caOptions,
    })
  }

  // Test GPU availability
  const hasGPU = testGPUAvailability()

  if (!hasGPU) {
    console.log(
      `[CA Factory] Using CPU (GPU unavailable) - ${gridCols}x${gridRows} = ${gridSize.toLocaleString()} cells`,
    )
    return new CPUCellularAutomata(canvas, {
      gridRows,
      gridCols,
      ...caOptions,
    })
  }

  // Compare grid size against threshold
  if (gridSize >= gpuThreshold) {
    console.log(
      `[CA Factory] Using GPU (${gridSize.toLocaleString()} cells >= ${gpuThreshold.toLocaleString()} threshold) - ${gridCols}x${gridRows}`,
    )
    return new GPUCellularAutomata(canvas, {
      gridRows,
      gridCols,
      ...caOptions,
    })
  }

  console.log(
    `[CA Factory] Using CPU (${gridSize.toLocaleString()} cells < ${gpuThreshold.toLocaleString()} threshold) - ${gridCols}x${gridRows}`,
  )
  return new CPUCellularAutomata(canvas, {
    gridRows,
    gridCols,
    ...caOptions,
  })
}

/**
 * Helper to determine which implementation would be selected without creating an instance.
 * Useful for UI hints or debugging.
 */
export function predictImplementation(
  gridRows: number,
  gridCols: number,
  options: {
    hasCanvas?: boolean
    gpuThreshold?: number
    forceImplementation?: 'auto' | 'cpu' | 'gpu'
  } = {},
): 'cpu' | 'gpu' {
  const {
    hasCanvas = true,
    gpuThreshold = 250_000,
    forceImplementation = 'auto',
  } = options

  if (forceImplementation !== 'auto') {
    return forceImplementation
  }

  if (!hasCanvas) {
    return 'cpu'
  }

  if (!testGPUAvailability()) {
    return 'cpu'
  }

  const gridSize = gridRows * gridCols
  return gridSize >= gpuThreshold ? 'gpu' : 'cpu'
}
