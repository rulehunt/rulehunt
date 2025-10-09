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
)

export interface BenchmarkResult {
  gridSize: string
  cells: number
  cpuTime: number
  gpuTime: number
  winner: 'cpu' | 'gpu'
  speedup: number
}

export interface BenchmarkConfig {
  gridSizes: Array<{ rows: number; cols: number; name: string; cells: number }>
  stepsPerTest: number
  iterations: number
}

const DEFAULT_CONFIG: BenchmarkConfig = {
  gridSizes: [
    { rows: 100, cols: 100, name: '100x100', cells: 10_000 },
    { rows: 200, cols: 200, name: '200x200', cells: 40_000 },
    { rows: 500, cols: 500, name: '500x500', cells: 250_000 },
    { rows: 1000, cols: 1000, name: '1000x1000', cells: 1_000_000 },
    { rows: 2000, cols: 2000, name: '2000x2000', cells: 4_000_000 },
    // Rectangular grids to test scaling with area
    { rows: 500, cols: 1000, name: '500x1000 (rect)', cells: 500_000 },
    { rows: 1000, cols: 500, name: '1000x500 (rect)', cells: 500_000 },
    { rows: 1000, cols: 2000, name: '1000x2000 (rect)', cells: 2_000_000 },
  ],
  stepsPerTest: 50, // Reduced from 100 for faster browser testing
  iterations: 5, // Will run 5 iterations per round
}

interface AccumulatedBenchmarkResult extends BenchmarkResult {
  cpuTimes: number[]
  gpuTimes: number[]
  iterationCount: number
}

/**
 * Run a single benchmark iteration for CPU implementation
 */
function benchmarkCPU(
  canvas: HTMLCanvasElement,
  rows: number,
  cols: number,
  ruleset: C4Ruleset,
  steps: number,
): number {
  const ca = new CellularAutomataCPU(canvas, {
    gridRows: rows,
    gridCols: cols,
    fgColor: '#000000',
    bgColor: '#ffffff',
  })

  ca.randomSeed(50) // Use consistent seed for fair comparison

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
  steps: number,
): number {
  const ca = new CellularAutomataGPU(canvas, {
    gridRows: rows,
    gridCols: cols,
    fgColor: '#000000',
    bgColor: '#ffffff',
  })

  ca.randomSeed(50) // Use consistent seed for fair comparison

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

    // Run CPU benchmark
    onProgress?.(currentTest++, totalTests, `CPU ${name}`)
    const cpuTimes: number[] = []
    for (let i = 0; i < config.iterations; i++) {
      const time = benchmarkCPU(
        canvas,
        rows,
        cols,
        ruleset,
        config.stepsPerTest,
      )
      cpuTimes.push(time)
      // Small delay to prevent blocking UI
      await new Promise((resolve) => setTimeout(resolve, 10))
    }
    const cpuAvg = cpuTimes.reduce((a, b) => a + b, 0) / cpuTimes.length

    // Run GPU benchmark
    onProgress?.(currentTest++, totalTests, `GPU ${name}`)
    const gpuTimes: number[] = []
    for (let i = 0; i < config.iterations; i++) {
      const time = benchmarkGPU(
        canvas,
        rows,
        cols,
        ruleset,
        config.stepsPerTest,
      )
      gpuTimes.push(time)
      // Small delay to prevent blocking UI
      await new Promise((resolve) => setTimeout(resolve, 10))
    }
    const gpuAvg = gpuTimes.reduce((a, b) => a + b, 0) / gpuTimes.length

    // Determine winner and speedup
    const winner = cpuAvg < gpuAvg ? 'cpu' : 'gpu'
    const speedup = winner === 'gpu' ? cpuAvg / gpuAvg : gpuAvg / cpuAvg

    results.push({
      gridSize: name,
      cells,
      cpuTime: cpuAvg,
      gpuTime: gpuAvg,
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
  overlay.className = 'benchmark-modal-overlay'
  overlay.style.cssText = `
		position: fixed;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		background: rgba(0, 0, 0, 0.8);
		display: none;
		justify-content: center;
		align-items: center;
		z-index: 10000;
	`

  // Create modal content
  const modal = document.createElement('div')
  modal.className = 'benchmark-modal'
  modal.style.cssText = `
		background: white;
		border-radius: 8px;
		padding: 24px;
		max-width: 800px;
		max-height: 80vh;
		overflow-y: auto;
		box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
	`

  // Modal header
  const header = document.createElement('div')
  header.style.cssText = `
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 16px;
	`

  const title = document.createElement('h2')
  title.textContent = 'GPU vs CPU Benchmark'
  title.style.cssText = 'margin: 0; font-size: 24px;'

  const closeBtn = document.createElement('button')
  closeBtn.textContent = '×'
  closeBtn.style.cssText = `
		border: none;
		background: none;
		font-size: 32px;
		cursor: pointer;
		padding: 0;
		width: 32px;
		height: 32px;
		line-height: 32px;
	`
  closeBtn.onclick = () => {
    overlay.style.display = 'none'
  }

  header.appendChild(title)
  header.appendChild(closeBtn)

  // Content area
  const content = document.createElement('div')
  content.className = 'benchmark-content'

  // Button container
  const buttonContainer = document.createElement('div')
  buttonContainer.style.cssText =
    'display: flex; gap: 12px; margin-bottom: 16px;'

  // Start button
  const startBtn = document.createElement('button')
  startBtn.textContent = 'Run Benchmark'
  startBtn.style.cssText = `
		background: #4CAF50;
		color: white;
		border: none;
		padding: 12px 24px;
		font-size: 16px;
		border-radius: 4px;
		cursor: pointer;
	`

  // Stop button
  const stopBtn = document.createElement('button')
  stopBtn.textContent = 'Stop'
  stopBtn.style.cssText = `
		background: #f44336;
		color: white;
		border: none;
		padding: 12px 24px;
		font-size: 16px;
		border-radius: 4px;
		cursor: pointer;
		display: none;
	`

  // Continuous mode checkbox
  const continuousLabel = document.createElement('label')
  continuousLabel.style.cssText =
    'display: flex; align-items: center; gap: 8px; font-size: 14px;'
  const continuousCheckbox = document.createElement('input')
  continuousCheckbox.type = 'checkbox'
  continuousCheckbox.id = 'continuous-mode'
  const continuousText = document.createElement('span')
  continuousText.textContent = 'Continuous mode (accumulate statistics)'
  continuousLabel.appendChild(continuousCheckbox)
  continuousLabel.appendChild(continuousText)

  buttonContainer.appendChild(startBtn)
  buttonContainer.appendChild(stopBtn)
  buttonContainer.appendChild(continuousLabel)

  // Progress area
  const progressArea = document.createElement('div')
  progressArea.style.cssText = 'margin-bottom: 16px;'

  const progressBar = document.createElement('div')
  progressBar.style.cssText = `
		width: 100%;
		height: 24px;
		background: #f0f0f0;
		border-radius: 4px;
		overflow: hidden;
		margin-bottom: 8px;
		display: none;
	`

  const progressFill = document.createElement('div')
  progressFill.style.cssText = `
		height: 100%;
		background: #4CAF50;
		width: 0%;
		transition: width 0.3s;
	`
  progressBar.appendChild(progressFill)

  const progressText = document.createElement('div')
  progressText.style.cssText = 'font-size: 14px; color: #666;'

  progressArea.appendChild(progressBar)
  progressArea.appendChild(progressText)

  // Chart area
  const chartContainer = document.createElement('div')
  chartContainer.style.cssText = 'margin-bottom: 24px; display: none;'
  const chartCanvas = document.createElement('canvas')
  chartCanvas.id = 'benchmark-chart'
  chartCanvas.style.cssText = 'max-height: 400px;'
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
      overlay.style.display = 'none'
    }
  }

  // State for continuous benchmarking
  let shouldStop = false
  const accumulatedResults: Map<string, AccumulatedBenchmarkResult> = new Map()
  let roundCount = 0
  let performanceChart: Chart | null = null

  // Helper to render results table
  function renderResults(results: BenchmarkResult[], roundNumber: number) {
    resultsArea.innerHTML = ''
    chartContainer.style.display = 'block'

    // Round info
    const roundInfo = document.createElement('div')
    roundInfo.style.cssText =
      'margin-bottom: 12px; font-size: 14px; color: #666;'
    roundInfo.textContent = `Round ${roundNumber} complete${continuousCheckbox.checked ? ' (continuous mode active)' : ''}`
    resultsArea.appendChild(roundInfo)

    const table = document.createElement('table')
    table.style.cssText = `
			width: 100%;
			border-collapse: collapse;
			margin-top: 8px;
		`

    // Add iteration count column for accumulated results
    const showIterations = continuousCheckbox.checked && roundNumber > 1
    const iterationHeader = showIterations
      ? '<th style="padding: 8px; text-align: right;">Iterations</th>'
      : ''

    table.innerHTML = `
			<thead>
				<tr style="border-bottom: 2px solid #ddd;">
					<th style="padding: 8px; text-align: left;">Grid Size</th>
					<th style="padding: 8px; text-align: right;">Cells</th>
					<th style="padding: 8px; text-align: right;">CPU (ms)</th>
					<th style="padding: 8px; text-align: right;">GPU (ms)</th>
					<th style="padding: 8px; text-align: center;">Winner</th>
					<th style="padding: 8px; text-align: right;">Speedup</th>
					${iterationHeader}
				</tr>
			</thead>
			<tbody>
				${results
          .map((r) => {
            const accResult = accumulatedResults.get(r.gridSize) as
              | AccumulatedBenchmarkResult
              | undefined
            const iterationCell =
              showIterations && accResult
                ? `<td style="padding: 8px; text-align: right;">${accResult.iterationCount}</td>`
                : ''

            return `
							<tr style="border-bottom: 1px solid #eee;">
								<td style="padding: 8px;">${r.gridSize}</td>
								<td style="padding: 8px; text-align: right;">${r.cells.toLocaleString()}</td>
								<td style="padding: 8px; text-align: right; ${r.winner === 'cpu' ? 'font-weight: bold; color: #4CAF50;' : ''}">${r.cpuTime.toFixed(2)}</td>
								<td style="padding: 8px; text-align: right; ${r.winner === 'gpu' ? 'font-weight: bold; color: #4CAF50;' : ''}">${r.gpuTime.toFixed(2)}</td>
								<td style="padding: 8px; text-align: center; text-transform: uppercase; font-weight: bold;">${r.winner}</td>
								<td style="padding: 8px; text-align: right;">${r.speedup.toFixed(2)}x</td>
								${iterationCell}
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
      // Update existing chart
      performanceChart.data.labels = sortedResults.map((r) => r.gridSize)
      performanceChart.data.datasets[0].data = sortedResults.map(
        (r) => r.cpuTime,
      )
      performanceChart.data.datasets[1].data = sortedResults.map(
        (r) => r.gpuTime,
      )
      performanceChart.update()
    } else {
      // Create new chart
      const ctx = chartCanvas.getContext('2d')
      if (ctx) {
        const config: ChartConfiguration = {
          type: 'line',
          data: {
            labels: sortedResults.map((r) => r.gridSize),
            datasets: [
              {
                label: 'CPU Time (ms)',
                data: sortedResults.map((r) => r.cpuTime),
                borderColor: '#2196F3',
                backgroundColor: 'rgba(33, 150, 243, 0.1)',
                tension: 0.1,
              },
              {
                label: 'GPU Time (ms)',
                data: sortedResults.map((r) => r.gpuTime),
                borderColor: '#4CAF50',
                backgroundColor: 'rgba(76, 175, 80, 0.1)',
                tension: 0.1,
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
              },
              tooltip: {
                mode: 'index',
                intersect: false,
              },
              legend: {
                display: true,
                position: 'top',
              },
            },
            scales: {
              x: {
                display: true,
                title: {
                  display: true,
                  text: 'Grid Size',
                },
              },
              y: {
                display: true,
                title: {
                  display: true,
                  text: 'Time (ms) for 50 steps',
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
      crossoverInfo.style.cssText = `
				margin-top: 16px;
				padding: 12px;
				background: #f0f8ff;
				border-left: 4px solid #2196F3;
				border-radius: 4px;
			`
      crossoverInfo.innerHTML = `
				<strong>Crossover Point:</strong> GPU becomes faster at approximately
				<strong>${results[crossoverIndex].gridSize}</strong>
				(${results[crossoverIndex].cells.toLocaleString()} cells)
			`
      resultsArea.appendChild(crossoverInfo)
    } else if (results[results.length - 1].winner === 'cpu') {
      const noGpuInfo = document.createElement('div')
      noGpuInfo.style.cssText = `
				margin-top: 16px;
				padding: 12px;
				background: #fff3cd;
				border-left: 4px solid #ffc107;
				border-radius: 4px;
			`
      noGpuInfo.innerHTML = `
				<strong>Note:</strong> CPU outperformed GPU across all tested grid sizes on your hardware.
				GPU acceleration may provide benefits at larger grid sizes (>800x800).
			`
      resultsArea.appendChild(noGpuInfo)
    }
  }

  // Main benchmark runner
  async function runBenchmark() {
    shouldStop = false
    startBtn.style.display = 'none'
    stopBtn.style.display = 'block'
    progressBar.style.display = 'block'
    continuousCheckbox.disabled = true

    const isContinuous = continuousCheckbox.checked

    if (!isContinuous) {
      // Reset accumulated results for single run
      accumulatedResults.clear()
      roundCount = 0
    }

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
            // Add new times to existing arrays
            existing.cpuTimes.push(result.cpuTime)
            existing.gpuTimes.push(result.gpuTime)
            existing.iterationCount = existing.cpuTimes.length

            // Recalculate averages
            const cpuAvg =
              existing.cpuTimes.reduce((a, b) => a + b, 0) /
              existing.cpuTimes.length
            const gpuAvg =
              existing.gpuTimes.reduce((a, b) => a + b, 0) /
              existing.gpuTimes.length
            existing.cpuTime = cpuAvg
            existing.gpuTime = gpuAvg
            existing.winner = cpuAvg < gpuAvg ? 'cpu' : 'gpu'
            existing.speedup =
              existing.winner === 'gpu' ? cpuAvg / gpuAvg : gpuAvg / cpuAvg
          } else {
            // First time seeing this grid size
            accumulatedResults.set(result.gridSize, {
              ...result,
              cpuTimes: [result.cpuTime],
              gpuTimes: [result.gpuTime],
              iterationCount: 1,
            })
          }
        }

        // Render accumulated results
        const displayResults = Array.from(accumulatedResults.values()).sort(
          (a, b) => a.cells - b.cells,
        )
        renderResults(displayResults, roundCount)

        progressText.textContent = `Round ${roundCount} complete!`

        // Small delay before next round in continuous mode
        if (isContinuous && !shouldStop) {
          await new Promise((resolve) => setTimeout(resolve, 1000))
        }
      } while (isContinuous && !shouldStop)
    } catch (error) {
      resultsArea.innerHTML = `
				<div style="color: #d32f2f; padding: 12px; background: #ffebee; border-radius: 4px;">
					<strong>Error:</strong> ${error instanceof Error ? error.message : 'Unknown error occurred'}
				</div>
			`
    } finally {
      startBtn.style.display = 'block'
      stopBtn.style.display = 'none'
      continuousCheckbox.disabled = false
    }
  }

  // Start benchmark
  startBtn.onclick = () => {
    runBenchmark()
  }

  // Stop benchmark
  stopBtn.onclick = () => {
    shouldStop = true
    progressText.textContent = 'Stopping after current round...'
  }

  return {
    show: () => {
      overlay.style.display = 'flex'
    },
    cleanup: () => {
      overlay.remove()
    },
  }
}
