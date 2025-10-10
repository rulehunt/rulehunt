/**
 * Benchmark Component
 *
 * Provides in-browser head-to-head performance comparison of CPU vs GPU implementations
 * across various grid sizes to determine optimal crossover point.
 */

import {
  CategoryScale,
  Chart,
  type ChartConfiguration,
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
import { CellularAutomata as CellularAutomataCPU } from '../cellular-automata-cpu'
import { GPUCellularAutomata as CellularAutomataGPU } from '../cellular-automata-gpu'
import type { C4Ruleset } from '../schema'
import { conwayRule, makeC4Ruleset } from '../utils'

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

interface AccumulatedBenchmarkResult extends BenchmarkResult {
  cpuSamples: number[] // SPS samples for CPU
  gpuSamples: number[] // SPS samples for GPU
  sampleCount: number
}

/**
 * Calculate standard deviation of an array of numbers
 */
function calculateStdDev(values: number[]): number {
  if (values.length <= 1) return 0
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  const squaredDiffs = values.map((value) => (value - mean) ** 2)
  const variance = squaredDiffs.reduce((a, b) => a + b, 0) / values.length
  return Math.sqrt(variance)
}

/**
 * Run a single benchmark iteration for CPU implementation
 */
function benchmarkCPU(
  canvas: HTMLCanvasElement,
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
  canvas: HTMLCanvasElement,
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

  // Create offscreen canvas for testing
  const canvas = document.createElement('canvas')

  const totalTests = config.gridSizes.length * 2 // CPU + GPU for each size
  let currentTest = 0

  for (const { rows, cols, name, cells } of config.gridSizes) {
    canvas.width = cols
    canvas.height = rows

    // Run CPU test
    onProgress?.(currentTest++, totalTests, `CPU ${name}`)
    const cpuTime = benchmarkCPU(
      canvas,
      rows,
      cols,
      ruleset,
      config.warmupSteps,
      config.stepsPerTest,
    )

    // Small delay to prevent blocking UI
    await new Promise((resolve) => setTimeout(resolve, 10))

    // Run GPU test
    onProgress?.(currentTest++, totalTests, `GPU ${name}`)
    const gpuTime = benchmarkGPU(
      canvas,
      rows,
      cols,
      ruleset,
      config.warmupSteps,
      config.stepsPerTest,
    )

    // Small delay to prevent blocking UI
    await new Promise((resolve) => setTimeout(resolve, 10))

    // Convert milliseconds to steps per second
    const cpuSPS = (config.stepsPerTest / cpuTime) * 1000
    const gpuSPS = (config.stepsPerTest / gpuTime) * 1000

    // Determine winner and speedup (higher SPS is better)
    const winner = cpuSPS > gpuSPS ? 'cpu' : 'gpu'
    const speedup = winner === 'gpu' ? gpuSPS / cpuSPS : cpuSPS / gpuSPS

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
 */
export function setupBenchmarkModal(orbitLookup: Uint8Array): {
  show: () => void
  cleanup: () => void
} {
  // Create modal overlay
  const overlay = document.createElement('div')
  overlay.className =
    'fixed inset-0 bg-black/80 flex justify-center items-center z-[10000]'
  overlay.style.display = 'none' // Use inline style for dynamic show/hide

  // Create modal content
  const modal = document.createElement('div')
  modal.className =
    'bg-white dark:bg-gray-800 rounded-lg p-6 max-w-[800px] max-h-[80vh] overflow-y-auto shadow-2xl'

  // Modal header
  const header = document.createElement('div')
  header.className = 'flex justify-between items-center mb-4'

  const title = document.createElement('h2')
  title.textContent = 'GPU vs CPU Benchmark'
  title.className = 'm-0 text-2xl text-gray-900 dark:text-gray-100'

  const closeBtn = document.createElement('button')
  closeBtn.textContent = '×'
  closeBtn.className =
    'border-none bg-transparent text-4xl cursor-pointer p-0 w-8 h-8 leading-8 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100'

  // Will set this later after runBenchmark is defined
  let stopBenchmarks: (() => void) | null = null
  closeBtn.onclick = () => {
    stopBenchmarks?.()
    overlay.style.display = 'none'
  }

  header.appendChild(title)
  header.appendChild(closeBtn)

  // Content area
  const content = document.createElement('div')
  content.className = 'benchmark-content'

  // Button container
  const buttonContainer = document.createElement('div')
  buttonContainer.className = 'flex gap-3 mb-4 items-center'

  // Clear data button
  const clearBtn = document.createElement('button')
  clearBtn.textContent = 'Clear Data'
  clearBtn.className =
    'bg-orange-600 hover:bg-orange-700 text-white border-none px-6 py-3 text-base rounded cursor-pointer'

  // Info text
  const infoText = document.createElement('div')
  infoText.className = 'text-sm text-gray-600 dark:text-gray-400'
  infoText.textContent =
    'Benchmarks run continuously while modal is open. Data saved to localStorage.'

  buttonContainer.appendChild(clearBtn)
  buttonContainer.appendChild(infoText)

  // Progress area
  const progressArea = document.createElement('div')
  progressArea.className = 'mb-4'

  const progressBar = document.createElement('div')
  progressBar.className =
    'w-full h-6 bg-gray-200 dark:bg-gray-700 rounded overflow-hidden mb-2'
  progressBar.style.display = 'none' // Use inline style for dynamic show/hide

  const progressFill = document.createElement('div')
  progressFill.className = 'h-full bg-green-600 transition-all duration-300'
  progressFill.style.width = '0%'
  progressBar.appendChild(progressFill)

  const progressText = document.createElement('div')
  progressText.className = 'text-sm text-gray-600 dark:text-gray-400'

  progressArea.appendChild(progressBar)
  progressArea.appendChild(progressText)

  // Chart area - always visible
  const chartContainer = document.createElement('div')
  chartContainer.className = 'mb-6 border-4 border-blue-500 p-4 rounded'
  const chartCanvas = document.createElement('canvas')
  chartCanvas.id = 'benchmark-chart'
  chartCanvas.className = 'max-h-[400px]'
  chartContainer.appendChild(chartCanvas)

  // Results area
  const resultsArea = document.createElement('div')
  resultsArea.className = 'benchmark-results'

  content.appendChild(buttonContainer)
  content.appendChild(progressArea)
  content.appendChild(chartContainer)
  content.appendChild(resultsArea)

  modal.appendChild(header)
  modal.appendChild(content)
  overlay.appendChild(modal)
  document.body.appendChild(overlay)

  // Click outside to close
  overlay.onclick = (e) => {
    if (e.target === overlay) {
      stopBenchmarks?.()
      overlay.style.display = 'none'
    }
  }

  // localStorage key for persistent results
  const STORAGE_KEY = 'rulehunt-benchmark-results'

  // Load accumulated results from localStorage
  function loadFromStorage(): {
    results: Map<string, AccumulatedBenchmarkResult>
    roundCount: number
  } {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const data = JSON.parse(stored)
        const resultsMap = new Map<string, AccumulatedBenchmarkResult>()
        for (const [key, value] of Object.entries(data.results)) {
          resultsMap.set(key, value as AccumulatedBenchmarkResult)
        }
        return {
          results: resultsMap,
          roundCount: data.roundCount || 0,
        }
      }
    } catch (error) {
      console.error(
        'Failed to load benchmark results from localStorage:',
        error,
      )
    }
    return { results: new Map(), roundCount: 0 }
  }

  // Save accumulated results to localStorage
  function saveToStorage(
    results: Map<string, AccumulatedBenchmarkResult>,
    roundCount: number,
  ) {
    try {
      const data = {
        results: Object.fromEntries(results),
        roundCount,
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    } catch (error) {
      console.error('Failed to save benchmark results to localStorage:', error)
    }
  }

  // Clear stored results
  function clearStorage() {
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch (error) {
      console.error(
        'Failed to clear benchmark results from localStorage:',
        error,
      )
    }
  }

  // State for continuous benchmarking
  let shouldStop = false
  const { results: storedResults, roundCount: storedRoundCount } =
    loadFromStorage()
  const accumulatedResults: Map<string, AccumulatedBenchmarkResult> =
    storedResults
  let roundCount = storedRoundCount
  let performanceChart: Chart | null = null

  // Initialize empty chart immediately
  const ctx = chartCanvas.getContext('2d')
  if (ctx) {
    const isDarkMode = document.documentElement.classList.contains('dark')
    const textColor = isDarkMode ? '#e5e7eb' : '#374151'
    const gridColor = isDarkMode ? '#4b5563' : '#d1d5db'

    performanceChart = new Chart(ctx, {
      type: 'lineWithErrorBars',
      data: {
        labels: [],
        datasets: [
          {
            label: 'CPU (SPS)',
            data: [],
            borderColor: '#2196F3',
            backgroundColor: 'rgba(33, 150, 243, 0.1)',
            tension: 0.1,
            showLine: true,
            pointRadius: 4,
            errorBarLineWidth: 1.5,
            errorBarColor: '#2196F3',
            errorBarWhiskerLineWidth: 1,
            errorBarWhiskerColor: '#2196F3',
            errorBarWhiskerSize: 6,
          },
          {
            label: 'GPU (SPS)',
            data: [],
            borderColor: '#4CAF50',
            backgroundColor: 'rgba(76, 175, 80, 0.1)',
            tension: 0.1,
            showLine: true,
            pointRadius: 4,
            errorBarLineWidth: 1.5,
            errorBarColor: '#4CAF50',
            errorBarWhiskerLineWidth: 1,
            errorBarWhiskerColor: '#4CAF50',
            errorBarWhiskerSize: 6,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          title: {
            display: true,
            text: 'CPU vs GPU Performance Scaling',
            color: textColor,
          },
          tooltip: {
            mode: 'index',
            intersect: false,
          },
          legend: {
            display: true,
            position: 'top',
            labels: {
              color: textColor,
            },
          },
        },
        scales: {
          x: {
            type: 'linear',
            display: true,
            title: {
              display: true,
              text: 'Grid Area (cells)',
              color: textColor,
            },
            ticks: {
              color: textColor,
            },
            grid: {
              color: gridColor,
            },
          },
          y: {
            display: true,
            title: {
              display: true,
              text: 'Steps per Second',
              color: textColor,
            },
            ticks: {
              color: textColor,
            },
            grid: {
              color: gridColor,
            },
            beginAtZero: true,
          },
        },
      },
    })
  }

  // Helper to render results table
  function renderResults(results: BenchmarkResult[], roundNumber: number) {
    resultsArea.innerHTML = ''

    // Round info
    const roundInfo = document.createElement('div')
    roundInfo.className = 'mb-3 text-sm text-gray-600 dark:text-gray-400'
    roundInfo.textContent = `Round ${roundNumber} complete`
    resultsArea.appendChild(roundInfo)

    const table = document.createElement('table')
    table.className = 'w-full border-collapse mt-2'

    table.innerHTML = `
			<thead>
				<tr class="border-b-2 border-gray-300 dark:border-gray-600">
					<th class="p-2 text-left text-gray-900 dark:text-gray-100">Grid Size</th>
					<th class="p-2 text-right text-gray-900 dark:text-gray-100">Cells</th>
					<th class="p-2 text-right text-gray-900 dark:text-gray-100">CPU (SPS)</th>
					<th class="p-2 text-right text-gray-900 dark:text-gray-100">GPU (SPS)</th>
					<th class="p-2 text-center text-gray-900 dark:text-gray-100">Winner</th>
					<th class="p-2 text-right text-gray-900 dark:text-gray-100">Speedup</th>
					<th class="p-2 text-right text-gray-900 dark:text-gray-100">Samples</th>
				</tr>
			</thead>
			<tbody>
				${results
          .map((r) => {
            const accResult = accumulatedResults.get(r.gridSize) as
              | AccumulatedBenchmarkResult
              | undefined
            const sampleCell = accResult
              ? `<td class="p-2 text-right text-gray-700 dark:text-gray-300">${accResult.sampleCount}</td>`
              : '<td class="p-2 text-right text-gray-700 dark:text-gray-300">-</td>'

            const cpuWinnerClass =
              r.winner === 'cpu'
                ? 'font-bold text-green-600 dark:text-green-500'
                : 'text-gray-700 dark:text-gray-300'
            const gpuWinnerClass =
              r.winner === 'gpu'
                ? 'font-bold text-green-600 dark:text-green-500'
                : 'text-gray-700 dark:text-gray-300'

            return `
							<tr class="border-b border-gray-200 dark:border-gray-700">
								<td class="p-2 text-gray-700 dark:text-gray-300">${r.gridSize}</td>
								<td class="p-2 text-right text-gray-700 dark:text-gray-300">${r.cells.toLocaleString()}</td>
								<td class="p-2 text-right ${cpuWinnerClass}">${r.cpuSPS.toFixed(2)}</td>
								<td class="p-2 text-right ${gpuWinnerClass}">${r.gpuSPS.toFixed(2)}</td>
								<td class="p-2 text-center uppercase font-bold text-gray-900 dark:text-gray-100">${r.winner}</td>
								<td class="p-2 text-right text-gray-700 dark:text-gray-300">${r.speedup.toFixed(2)}x</td>
								${sampleCell}
							</tr>
						`
          })
          .join('')}
			</tbody>
		`

    resultsArea.appendChild(table)

    // Create or update performance chart
    const sortedResults = [...results].sort((a, b) => a.cells - b.cells)

    if (performanceChart) {
      // Update existing chart with error bars
      performanceChart.data.labels = sortedResults.map((r) => r.cells)

      // CPU data with error bars (±1 std dev)
      performanceChart.data.datasets[0].data = sortedResults.map((r) => {
        const accResult = accumulatedResults.get(r.gridSize)
        if (!accResult || accResult.sampleCount <= 1) {
          return { x: r.cells, y: r.cpuSPS, yMin: r.cpuSPS, yMax: r.cpuSPS }
        }
        const stdDev = calculateStdDev(accResult.cpuSamples)
        return {
          x: r.cells,
          y: r.cpuSPS,
          yMin: Math.max(0, r.cpuSPS - stdDev),
          yMax: r.cpuSPS + stdDev,
        }
      })

      // GPU data with error bars (±1 std dev)
      performanceChart.data.datasets[1].data = sortedResults.map((r) => {
        const accResult = accumulatedResults.get(r.gridSize)
        if (!accResult || accResult.sampleCount <= 1) {
          return { x: r.cells, y: r.gpuSPS, yMin: r.gpuSPS, yMax: r.gpuSPS }
        }
        const stdDev = calculateStdDev(accResult.gpuSamples)
        return {
          x: r.cells,
          y: r.gpuSPS,
          yMin: Math.max(0, r.gpuSPS - stdDev),
          yMax: r.gpuSPS + stdDev,
        }
      })

      performanceChart.update()
    } else {
      // Create new chart
      const ctx = chartCanvas.getContext('2d')
      if (ctx) {
        // Detect dark mode for chart styling
        const isDarkMode = document.documentElement.classList.contains('dark')
        const textColor = isDarkMode ? '#e5e7eb' : '#374151'
        const gridColor = isDarkMode ? '#4b5563' : '#d1d5db'

        const config: ChartConfiguration = {
          type: 'lineWithErrorBars',
          data: {
            labels: sortedResults.map((r) => r.cells),
            datasets: [
              {
                label: 'CPU (SPS)',
                data: sortedResults.map((r) => {
                  const accResult = accumulatedResults.get(r.gridSize)
                  if (!accResult || accResult.sampleCount <= 1) {
                    return {
                      x: r.cells,
                      y: r.cpuSPS,
                      yMin: r.cpuSPS,
                      yMax: r.cpuSPS,
                    }
                  }
                  const stdDev = calculateStdDev(accResult.cpuSamples)
                  return {
                    x: r.cells,
                    y: r.cpuSPS,
                    yMin: Math.max(0, r.cpuSPS - stdDev),
                    yMax: r.cpuSPS + stdDev,
                  }
                }),
                borderColor: '#2196F3',
                backgroundColor: 'rgba(33, 150, 243, 0.1)',
                tension: 0.1,
                showLine: true,
                pointRadius: 4,
                errorBarLineWidth: 1.5,
                errorBarColor: '#2196F3',
                errorBarWhiskerLineWidth: 1,
                errorBarWhiskerColor: '#2196F3',
                errorBarWhiskerSize: 6,
              },
              {
                label: 'GPU (SPS)',
                data: sortedResults.map((r) => {
                  const accResult = accumulatedResults.get(r.gridSize)
                  if (!accResult || accResult.sampleCount <= 1) {
                    return {
                      x: r.cells,
                      y: r.gpuSPS,
                      yMin: r.gpuSPS,
                      yMax: r.gpuSPS,
                    }
                  }
                  const stdDev = calculateStdDev(accResult.gpuSamples)
                  return {
                    x: r.cells,
                    y: r.gpuSPS,
                    yMin: Math.max(0, r.gpuSPS - stdDev),
                    yMax: r.gpuSPS + stdDev,
                  }
                }),
                borderColor: '#4CAF50',
                backgroundColor: 'rgba(76, 175, 80, 0.1)',
                tension: 0.1,
                showLine: true,
                pointRadius: 4,
                errorBarLineWidth: 1.5,
                errorBarColor: '#4CAF50',
                errorBarWhiskerLineWidth: 1,
                errorBarWhiskerColor: '#4CAF50',
                errorBarWhiskerSize: 6,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
              title: {
                display: true,
                text: 'CPU vs GPU Performance Scaling',
                color: textColor,
              },
              tooltip: {
                mode: 'index',
                intersect: false,
              },
              legend: {
                display: true,
                position: 'top',
                labels: {
                  color: textColor,
                },
              },
            },
            scales: {
              x: {
                type: 'linear',
                display: true,
                title: {
                  display: true,
                  text: 'Grid Area (cells)',
                  color: textColor,
                },
                ticks: {
                  color: textColor,
                },
                grid: {
                  color: gridColor,
                },
              },
              y: {
                display: true,
                title: {
                  display: true,
                  text: 'Steps per Second',
                  color: textColor,
                },
                ticks: {
                  color: textColor,
                },
                grid: {
                  color: gridColor,
                },
                beginAtZero: true,
              },
            },
          },
        }
        performanceChart = new Chart(ctx, config)
      }
    }

    // Find crossover point
    const crossoverIndex = results.findIndex((r) => r.winner === 'gpu')
    if (crossoverIndex > 0) {
      const crossoverInfo = document.createElement('div')
      crossoverInfo.className =
        'mt-4 p-3 bg-blue-50 dark:bg-blue-900/30 border-l-4 border-blue-500 rounded text-gray-900 dark:text-gray-100'
      crossoverInfo.innerHTML = `
				<strong>Crossover Point:</strong> GPU becomes faster at approximately
				<strong>${results[crossoverIndex].gridSize}</strong>
				(${results[crossoverIndex].cells.toLocaleString()} cells)
			`
      resultsArea.appendChild(crossoverInfo)
    } else if (results[results.length - 1].winner === 'cpu') {
      const noGpuInfo = document.createElement('div')
      noGpuInfo.className =
        'mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/30 border-l-4 border-yellow-500 rounded text-gray-900 dark:text-gray-100'
      noGpuInfo.innerHTML = `
				<strong>Note:</strong> CPU outperformed GPU across all tested grid sizes on your hardware.
				GPU acceleration may provide benefits at larger grid sizes (>800x800).
			`
      resultsArea.appendChild(noGpuInfo)
    }
  }

  // Main benchmark runner - runs continuously until stopped
  async function runBenchmark() {
    shouldStop = false
    progressBar.style.display = 'block'

    try {
      do {
        roundCount++
        progressText.textContent = `Starting round ${roundCount}...`

        const roundResults = await runBenchmarkSuite(
          orbitLookup,
          DEFAULT_CONFIG,
          (current, total, testName) => {
            const percent = (current / total) * 100
            progressFill.style.width = `${percent}%`
            progressText.textContent = `Round ${roundCount}: ${testName} (${current}/${total})`
          },
        )

        // Accumulate results
        for (const result of roundResults) {
          const existing = accumulatedResults.get(result.gridSize)
          if (existing) {
            // Add new SPS samples to existing arrays
            existing.cpuSamples.push(result.cpuSPS)
            existing.gpuSamples.push(result.gpuSPS)
            existing.sampleCount = existing.cpuSamples.length

            // Recalculate averages
            const cpuAvg =
              existing.cpuSamples.reduce((a, b) => a + b, 0) /
              existing.cpuSamples.length
            const gpuAvg =
              existing.gpuSamples.reduce((a, b) => a + b, 0) /
              existing.gpuSamples.length
            existing.cpuSPS = cpuAvg
            existing.gpuSPS = gpuAvg
            existing.winner = cpuAvg > gpuAvg ? 'cpu' : 'gpu' // Higher SPS is better
            existing.speedup =
              existing.winner === 'gpu' ? gpuAvg / cpuAvg : cpuAvg / gpuAvg
          } else {
            // First time seeing this grid size
            accumulatedResults.set(result.gridSize, {
              ...result,
              cpuSamples: [result.cpuSPS],
              gpuSamples: [result.gpuSPS],
              sampleCount: 1,
            })
          }
        }

        // Save to localStorage after each round
        saveToStorage(accumulatedResults, roundCount)

        // Render accumulated results
        const displayResults = Array.from(accumulatedResults.values()).sort(
          (a, b) => a.cells - b.cells,
        )
        renderResults(displayResults, roundCount)

        progressText.textContent = `Round ${roundCount} complete!`

        // Small delay before next round
        if (!shouldStop) {
          await new Promise((resolve) => setTimeout(resolve, 1000))
        }
      } while (!shouldStop)
    } catch (error) {
      resultsArea.innerHTML = `
				<div class="text-red-700 dark:text-red-400 p-3 bg-red-50 dark:bg-red-900/30 rounded">
					<strong>Error:</strong> ${error instanceof Error ? error.message : 'Unknown error occurred'}
				</div>
			`
    }
  }

  // Stop benchmarks function
  stopBenchmarks = () => {
    shouldStop = true
  }

  // Clear data button handler
  clearBtn.onclick = () => {
    if (confirm('Clear all benchmark data? This cannot be undone.')) {
      accumulatedResults.clear()
      roundCount = 0
      clearStorage()
      resultsArea.innerHTML = ''

      // Reset chart to empty state instead of hiding it
      if (performanceChart) {
        performanceChart.data.labels = []
        performanceChart.data.datasets[0].data = []
        performanceChart.data.datasets[1].data = []
        performanceChart.update()
      }

      progressText.textContent = 'Data cleared. Reopen modal to start fresh.'
      shouldStop = true
    }
  }

  return {
    show: () => {
      overlay.style.display = 'flex'

      // Render existing data if available
      if (accumulatedResults.size > 0) {
        const displayResults = Array.from(accumulatedResults.values()).sort(
          (a, b) => a.cells - b.cells,
        )
        renderResults(displayResults, roundCount)
      }

      // Auto-start benchmarks
      runBenchmark()
    },
    cleanup: () => {
      shouldStop = true
      overlay.remove()
    },
  }
}
