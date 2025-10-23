// src/components/shared/statsChart.ts

import {
  CategoryScale,
  Chart,
  type ChartConfiguration,
  type ChartOptions,
  Filler,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  TimeScale,
  Title,
  Tooltip,
} from 'chart.js'
import type { StatsHistoryResponse } from '../../schema'
import { getCurrentThemeColors } from './theme'

// Register Chart.js components for line charts
Chart.register(
  CategoryScale,
  LinearScale,
  TimeScale,
  PointElement,
  LineElement,
  LineController,
  Filler,
  Title,
  Tooltip,
)

export interface StatsChartElements {
  overlay: HTMLDivElement
  modal: HTMLDivElement
  canvas: HTMLCanvasElement
  closeBtn: HTMLButtonElement
  title: HTMLHeadingElement
}

/**
 * Creates a modal overlay for displaying stats history as a line chart
 */
export function createStatsChartModal(): StatsChartElements {
  const overlay = document.createElement('div')
  overlay.className =
    'fixed inset-0 bg-black/80 flex justify-center items-center z-50'
  overlay.style.display = 'none'

  overlay.innerHTML = `
    <div role="dialog" aria-labelledby="chart-title" aria-modal="true" class="bg-white dark:bg-gray-800 rounded-lg border border-gray-300 dark:border-gray-600 p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
      <!-- Header -->
      <div class="flex justify-between items-center mb-6">
        <h2 id="chart-title" class="text-2xl font-bold text-gray-900 dark:text-white">
          Loading...
        </h2>
        <button id="chart-close" aria-label="Close chart" class="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-2xl font-bold">
          ×
        </button>
      </div>

      <!-- Chart Container -->
      <div style="height: 400px; position: relative;">
        <canvas id="history-chart" aria-label="Stats history chart"></canvas>
      </div>
    </div>
  `

  document.body.appendChild(overlay)

  const modal = overlay.querySelector('div')
  if (!modal) {
    throw new Error('Failed to create stats chart modal')
  }

  const elements: StatsChartElements = {
    overlay,
    modal: modal as HTMLDivElement,
    canvas: overlay.querySelector('#history-chart') as HTMLCanvasElement,
    closeBtn: overlay.querySelector('#chart-close') as HTMLButtonElement,
    title: overlay.querySelector('#chart-title') as HTMLHeadingElement,
  }

  // Close on overlay click (but not modal click)
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      overlay.style.display = 'none'
    }
  })

  // Close on button click
  elements.closeBtn.addEventListener('click', () => {
    overlay.style.display = 'none'
  })

  // Close on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && overlay.style.display === 'flex') {
      overlay.style.display = 'none'
    }
  })

  return elements
}

/**
 * Displays stats history in the chart modal
 */
export async function showStatsChart(
  elements: StatsChartElements,
  metric: string,
  metricLabel: string,
  days = 90,
): Promise<void> {
  // Show modal with loading state
  elements.title.textContent = `${metricLabel} - Loading...`
  elements.overlay.style.display = 'flex'

  try {
    // Fetch stats history
    const response = await fetch(
      `/api/stats-history?metric=${metric}&days=${days}`,
    )

    // Check HTTP status before parsing JSON
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const result: StatsHistoryResponse = await response.json()

    if (!result.ok || !result.data) {
      throw new Error(result.error || 'Failed to fetch stats history')
    }

    // Update title
    elements.title.textContent = `${metricLabel} - Last ${days} Days`

    // Determine theme colors
    const isDark = document.documentElement.classList.contains('dark')
    const textColor = isDark ? '#f3f4f6' : '#1f2937'
    const gridColor = isDark ? '#374151' : '#e5e7eb'
    const { accentColor } = getCurrentThemeColors()
    const lineColor = accentColor
    const fillColor = isDark
      ? 'rgba(139, 92, 246, 0.1)'
      : 'rgba(139, 92, 246, 0.2)'

    // Set canvas dimensions
    elements.canvas.width = 1200
    elements.canvas.height = 400

    // Prepare chart data
    const labels = result.data.map((d) => d.date)
    const values = result.data.map((d) => d.value)

    // Create chart configuration
    const config: ChartConfiguration = {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: metricLabel,
            data: values,
            borderColor: lineColor,
            backgroundColor: fillColor,
            fill: true,
            tension: 0.3,
            pointRadius: 3,
            pointHoverRadius: 5,
          },
        ],
      },
      options: {
        responsive: false,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false,
          },
          tooltip: {
            mode: 'index',
            intersect: false,
          },
        },
        scales: {
          x: {
            ticks: {
              color: textColor,
              maxTicksLimit: 10,
            },
            grid: {
              color: gridColor,
            },
          },
          y: {
            beginAtZero: true,
            ticks: {
              color: textColor,
            },
            grid: {
              color: gridColor,
            },
          },
        },
        interaction: {
          mode: 'nearest',
          axis: 'x',
          intersect: false,
        },
      } as ChartOptions,
    }

    // Destroy existing chart if any
    const existingChart = Chart.getChart(elements.canvas)
    if (existingChart) {
      existingChart.destroy()
    }

    // Create new chart
    new Chart(elements.canvas, config)
  } catch (error) {
    console.error('Error loading stats history:', error)
    elements.title.textContent = `${metricLabel} - Error Loading Data`
  }
}
