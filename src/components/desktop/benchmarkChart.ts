/**
 * Benchmark Chart Component
 *
 * Responsible for Chart.js configuration and rendering.
 * Extracted from benchmark.ts to improve maintainability and testability.
 */

import { Chart, type ChartConfiguration } from 'chart.js'
import type { BenchmarkResult } from './benchmark'

/**
 * Calculate standard deviation of an array of numbers
 */
export function calculateStdDev(values: number[]): number {
  if (values.length <= 1) return 0
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  const squaredDiffs = values.map((value) => (value - mean) ** 2)
  const variance = squaredDiffs.reduce((a, b) => a + b, 0) / values.length
  return Math.sqrt(variance)
}

export interface AccumulatedBenchmarkResult extends BenchmarkResult {
  cpuSamples: number[] // SPS samples for CPU
  gpuSamples: number[] // SPS samples for GPU
  sampleCount: number
}

/**
 * Create an empty benchmark chart with proper configuration
 */
export function createBenchmarkChart(canvas: HTMLCanvasElement): Chart | null {
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  // Detect dark mode for chart styling
  const isDarkMode = document.documentElement.classList.contains('dark')
  const textColor = isDarkMode ? '#e5e7eb' : '#374151'
  const gridColor = isDarkMode ? '#4b5563' : '#d1d5db'

  const config: ChartConfiguration = {
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
  }

  return new Chart(ctx, config)
}

/**
 * Update chart with new benchmark results
 */
export function updateChart(
  chart: Chart,
  results: BenchmarkResult[],
  accumulatedResults: Map<string, AccumulatedBenchmarkResult>,
): void {
  const sortedResults = [...results].sort((a, b) => a.cells - b.cells)

  chart.data.labels = sortedResults.map((r) => r.cells)

  // CPU data with error bars (±1 std dev)
  chart.data.datasets[0].data = sortedResults.map((r) => {
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
  chart.data.datasets[1].data = sortedResults.map((r) => {
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

  chart.update()
}

/**
 * Reset chart to empty state
 */
export function resetChart(chart: Chart): void {
  chart.data.labels = []
  chart.data.datasets[0].data = []
  chart.data.datasets[1].data = []
  chart.update()
}
