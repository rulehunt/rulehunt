/**
 * Benchmark Results Renderer
 *
 * Responsible for rendering benchmark results table and insights.
 * Extracted from benchmark.ts to improve maintainability and testability.
 */

import type { BenchmarkResult } from './benchmark'
import type { AccumulatedBenchmarkResult } from './benchmarkChart'

/**
 * Render benchmark results table
 */
export function renderResults(
  resultsArea: HTMLElement,
  results: BenchmarkResult[],
  roundNumber: number,
  accumulatedResults: Map<string, AccumulatedBenchmarkResult>,
): void {
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

/**
 * Render error message
 */
export function renderError(resultsArea: HTMLElement, error: Error): void {
  resultsArea.innerHTML = `
		<div class="text-red-700 dark:text-red-400 p-3 bg-red-50 dark:bg-red-900/30 rounded">
			<strong>Error:</strong> ${error.message}
		</div>
	`
}
