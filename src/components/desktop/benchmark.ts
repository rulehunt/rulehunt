/**
 * Benchmark Component
 *
 * Provides in-browser head-to-head performance comparison of CPU vs GPU implementations
 * across various grid sizes to determine optimal crossover point.
 */

import {
  CategoryScale,
  Chart,
  Legend,
  LineController,
  LineElement,
  LinearScale,
  PointElement,
  Title,
  Tooltip,
} from 'chart.js'
import {
  LineWithErrorBarsController,
  PointWithErrorBar,
} from 'chartjs-chart-error-bars'
import { CellularAutomata as CellularAutomataCPU } from '../../cellular-automata-cpu'
import { GPUCellularAutomata as CellularAutomataGPU } from '../../cellular-automata-gpu'
import type { C4Ruleset } from '../../schema'
import { conwayRule, makeC4Ruleset } from '../../utils'
import { createBenchmarkChart, resetChart, updateChart } from './benchmarkChart'
import {
  createBenchmarkModal,
  hideModal,
  showModal,
  showProgressBar,
  updateProgress,
} from './benchmarkModal'
import { renderError, renderResults } from './benchmarkResults'
import { BenchmarkRunner } from './benchmarkRunner'

// Register Chart.js components
Chart.register(
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  Title,
  Tooltip,
  Legend,
  CategoryScale,
  LineWithErrorBarsController,
  PointWithErrorBar,
)

export interface BenchmarkResult {
  gridSize: string
  cells: number
  cpuSPS: number // Steps per second for CPU
  gpuSPS: number // Steps per second for GPU
  winner: 'cpu' | 'gpu'
  speedup: number
}

export interface BenchmarkConfig {
  gridSizes: Array<{ rows: number; cols: number; name: string; cells: number }>
  warmupSteps: number
  stepsPerTest: number
}

const DEFAULT_CONFIG: BenchmarkConfig = {
  gridSizes: [
    // Square grids
    { rows: 100, cols: 100, name: '100x100', cells: 10_000 },
    { rows: 200, cols: 200, name: '200x200', cells: 40_000 },
    { rows: 300, cols: 300, name: '300x300', cells: 90_000 },
    { rows: 500, cols: 500, name: '500x500', cells: 250_000 },
    { rows: 700, cols: 700, name: '700x700', cells: 490_000 },
    // Rectangular grids
    { rows: 200, cols: 300, name: '200x300', cells: 60_000 },
    { rows: 300, cols: 500, name: '300x500', cells: 150_000 },
    { rows: 500, cols: 700, name: '500x700', cells: 350_000 },
  ],
  warmupSteps: 3, // Minimal warmup to get GPU/CPU caches warm
  stepsPerTest: 10, // Single measurement per grid per round
}

// AccumulatedBenchmarkResult and calculateStdDev moved to benchmarkChart.ts

/**
 * Run a single benchmark iteration for CPU implementation
 */
function benchmarkCPU(
  canvas: HTMLCanvasElement | null,
  rows: number,
  cols: number,
  ruleset: C4Ruleset,
  warmupSteps: number,
  steps: number,
): number {
  const ca = new CellularAutomataCPU(canvas, {
    gridRows: rows,
    gridCols: cols,
    fgColor: '#000000',
    bgColor: '#ffffff',
  })

  ca.randomSeed(50) // Use consistent seed for fair comparison

  // Warmup: run steps to warm up CPU caches
  for (let i = 0; i < warmupSteps; i++) {
    ca.step(ruleset)
  }

  // Actual benchmark
  const start = performance.now()
  for (let i = 0; i < steps; i++) {
    ca.step(ruleset)
  }
  const end = performance.now()

  return end - start
}

/**
 * Run a single benchmark iteration for GPU implementation
 */
function benchmarkGPU(
  canvas: HTMLCanvasElement | null,
  rows: number,
  cols: number,
  ruleset: C4Ruleset,
  warmupSteps: number,
  steps: number,
): number {
  const ca = new CellularAutomataGPU(canvas, {
    gridRows: rows,
    gridCols: cols,
    fgColor: '#000000',
    bgColor: '#ffffff',
  })

  ca.randomSeed(50) // Use consistent seed for fair comparison

  // Warmup: run steps to warm up GPU pipeline and transfer buffers
  for (let i = 0; i < warmupSteps; i++) {
    ca.step(ruleset)
  }

  // Actual benchmark
  const start = performance.now()
  for (let i = 0; i < steps; i++) {
    ca.step(ruleset)
  }
  // Force GPU execution to complete before stopping timer
  ca.syncToHost()
  const end = performance.now()

  // Clean up GPU resources
  ca.destroy()

  return end - start
}

/**
 * Run benchmark suite comparing CPU vs GPU across different grid sizes
 */
export async function runBenchmarkSuite(
  orbitLookup: Uint8Array,
  config: BenchmarkConfig = DEFAULT_CONFIG,
  onProgress?: (current: number, total: number, currentTest: string) => void,
): Promise<BenchmarkResult[]> {
  const results: BenchmarkResult[] = []
  const ruleset = makeC4Ruleset(conwayRule, orbitLookup)

  const totalTests = config.gridSizes.length * 2 // CPU + GPU for each size
  let currentTest = 0

  for (const { rows, cols, name, cells } of config.gridSizes) {
    // Run CPU test (headless - no canvas)
    onProgress?.(currentTest++, totalTests, `CPU ${name}`)
    const cpuTime = benchmarkCPU(
      null,
      rows,
      cols,
      ruleset,
      config.warmupSteps,
      config.stepsPerTest,
    )

    // Small delay to prevent blocking UI
    await new Promise((resolve) => setTimeout(resolve, 10))

    // Run GPU test (headless - no canvas)
    onProgress?.(currentTest++, totalTests, `GPU ${name}`)
    const gpuTime = benchmarkGPU(
      null,
      rows,
      cols,
      ruleset,
      config.warmupSteps,
      config.stepsPerTest,
    )

    // Small delay to prevent blocking UI
    await new Promise((resolve) => setTimeout(resolve, 10))

    // Convert milliseconds to steps per second
    // Handle edge case where time might be 0 or very small
    const cpuSPS =
      cpuTime > 0
        ? (config.stepsPerTest / cpuTime) * 1000
        : Number.MAX_SAFE_INTEGER
    const gpuSPS =
      gpuTime > 0
        ? (config.stepsPerTest / gpuTime) * 1000
        : Number.MAX_SAFE_INTEGER

    // Determine winner and speedup (higher SPS is better)
    const winner = cpuSPS > gpuSPS ? 'cpu' : 'gpu'
    const speedup =
      winner === 'gpu' && cpuSPS > 0
        ? gpuSPS / cpuSPS
        : cpuSPS > 0 && gpuSPS > 0
          ? cpuSPS / gpuSPS
          : 1

    results.push({
      gridSize: name,
      cells,
      cpuSPS,
      gpuSPS,
      winner,
      speedup,
    })
  }

  return results
}

/**
 * Create and show benchmark modal
 *
 * This function has been refactored to use extracted modules for better maintainability.
 * - benchmarkModal.ts: DOM structure creation
 * - benchmarkChart.ts: Chart configuration and rendering
 * - benchmarkRunner.ts: Benchmark execution and result accumulation
 * - benchmarkResults.ts: Results table rendering
 */
export function setupBenchmarkModal(orbitLookup: Uint8Array): {
  show: () => void
  cleanup: () => void
} {
  // Create modal structure
  const elements = createBenchmarkModal()
  document.body.appendChild(elements.overlay)

  // Create chart
  const performanceChart = createBenchmarkChart(elements.chartCanvas)

  // Create benchmark runner
  const runner = new BenchmarkRunner()

  // Setup close button
  elements.closeBtn.onclick = () => {
    runner.stop()
    hideModal(elements)
  }

  // Setup click outside to close
  elements.overlay.onclick = (e) => {
    if (e.target === elements.overlay) {
      runner.stop()
      hideModal(elements)
    }
  }

  // Setup clear button
  elements.clearBtn.onclick = () => {
    if (confirm('Clear all benchmark data? This cannot be undone.')) {
      runner.clearResults()
      elements.resultsArea.innerHTML = ''

      // Reset chart to empty state
      if (performanceChart) {
        resetChart(performanceChart)
      }

      elements.progressText.textContent =
        'Data cleared. Reopen modal to start fresh.'
    }
  }

  return {
    show: () => {
      showModal(elements)

      // Render existing data if available
      const accumulatedResults = runner.getAccumulatedResults()
      if (accumulatedResults.size > 0) {
        const displayResults = Array.from(accumulatedResults.values()).sort(
          (a, b) => a.cells - b.cells,
        )
        renderResults(
          elements.resultsArea,
          displayResults,
          runner.getRoundCount(),
          accumulatedResults,
        )

        // Update chart with existing data
        if (performanceChart) {
          updateChart(performanceChart, displayResults, accumulatedResults)
        }
      }

      // Start benchmarks
      showProgressBar(elements)
      runner
        .run(
          orbitLookup,
          DEFAULT_CONFIG,
          (progress) => {
            const percent = (progress.current / progress.total) * 100
            updateProgress(elements, percent, progress.status)
          },
          (results, roundNumber) => {
            renderResults(
              elements.resultsArea,
              results,
              roundNumber,
              runner.getAccumulatedResults(),
            )

            // Update chart
            if (performanceChart) {
              updateChart(
                performanceChart,
                results,
                runner.getAccumulatedResults(),
              )
            }

            updateProgress(elements, 100, `Round ${roundNumber} complete!`)
          },
        )
        .catch((error) => {
          renderError(elements.resultsArea, error as Error)
        })
    },
    cleanup: () => {
      runner.stop()
      performanceChart?.destroy()
      elements.overlay.remove()
    },
  }
}
