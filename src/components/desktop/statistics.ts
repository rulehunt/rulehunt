// src/components/desktop/statistics.ts

import {
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  type ChartConfiguration,
  type ChartOptions,
  LinearScale,
  PieController,
  Title,
  Tooltip,
} from 'chart.js'
import type { StatisticsData } from '../../schema'
import {
  type StatsChartElements,
  createStatsChartModal,
  showStatsChart,
} from '../shared/statsChart'

// Register Chart.js components
Chart.register(
  CategoryScale,
  LinearScale,
  BarElement,
  BarController,
  ArcElement,
  PieController,
  Title,
  Tooltip,
)

/**
 * Format large numbers with SI prefixes (K, M, B, T)
 * Removes unnecessary decimal places for whole numbers
 */
function formatLargeNumber(num: number): string {
  if (num < 1000) return num.toString()
  const format = (val: number, divisor: number, suffix: string) => {
    const result = val / divisor
    return `${result % 1 === 0 ? result : result.toFixed(1)}${suffix}`
  }
  if (num < 1_000_000) return format(num, 1000, 'K')
  if (num < 1_000_000_000) return format(num, 1_000_000, 'M')
  if (num < 1_000_000_000_000) return format(num, 1_000_000_000, 'B')
  return format(num, 1_000_000_000_000, 'T')
}

export interface StatisticsPanelElements {
  container: HTMLDivElement
  refreshButton: HTMLButtonElement
  summaryCards: HTMLDivElement
  outcomeCanvas: HTMLCanvasElement
  wolframCanvas: HTMLCanvasElement
  interestCanvas: HTMLCanvasElement
  populationCanvas: HTMLCanvasElement
  activityCanvas: HTMLCanvasElement
  entropyCanvas: HTMLCanvasElement
  chartModal?: StatsChartElements
}

export function createStatisticsPanel(): {
  root: HTMLDivElement
  elements: StatisticsPanelElements
} {
  const root = document.createElement('div')
  root.className = 'flex flex-col items-center gap-6 w-full'

  root.innerHTML = `
    <!-- Header with Refresh -->
    <div class="w-full flex justify-between items-center">
      <h2 class="text-2xl font-bold text-gray-900 dark:text-white">
        Database Statistics
      </h2>
      <button id="stats-refresh" class="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg transition-colors text-sm font-medium">
        🔄 Refresh
      </button>
    </div>

    <!-- Summary Cards -->
    <div id="summary-cards" class="w-full grid grid-cols-2 lg:grid-cols-4 gap-4">
      <!-- Cards will be populated dynamically -->
    </div>

    <!-- Charts Grid -->
    <div class="w-full grid grid-cols-1 lg:grid-cols-2 gap-6">
      <!-- Outcome Distribution (Pie) -->
      <div class="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-300 dark:border-gray-600">
        <h3 class="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Outcome Distribution</h3>
        <div style="height: 300px; position: relative;">
          <canvas id="outcome-chart"></canvas>
        </div>
      </div>

      <!-- Wolfram Classification (Pie) -->
      <div class="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-300 dark:border-gray-600">
        <h3 class="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Wolfram Classification</h3>
        <div style="height: 300px; position: relative;">
          <canvas id="wolfram-chart"></canvas>
        </div>
      </div>

      <!-- Interest Score Distribution (Bar) -->
      <div class="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-300 dark:border-gray-600">
        <h3 class="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Interest Score Distribution</h3>
        <div style="height: 300px; position: relative;">
          <canvas id="interest-chart"></canvas>
        </div>
      </div>

      <!-- Population Distribution (Bar) -->
      <div class="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-300 dark:border-gray-600">
        <h3 class="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Population Distribution</h3>
        <div style="height: 300px; position: relative;">
          <canvas id="population-chart"></canvas>
        </div>
      </div>

      <!-- Activity Distribution (Bar) -->
      <div class="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-300 dark:border-gray-600">
        <h3 class="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Activity Distribution</h3>
        <div style="height: 300px; position: relative;">
          <canvas id="activity-chart"></canvas>
        </div>
      </div>

      <!-- Entropy Distribution (Bar) -->
      <div class="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-300 dark:border-gray-600">
        <h3 class="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Entropy Distribution</h3>
        <div style="height: 300px; position: relative;">
          <canvas id="entropy-chart"></canvas>
        </div>
      </div>
    </div>
  `

  const elements: StatisticsPanelElements = {
    container: root,
    refreshButton: root.querySelector('#stats-refresh') as HTMLButtonElement,
    summaryCards: root.querySelector('#summary-cards') as HTMLDivElement,
    outcomeCanvas: root.querySelector('#outcome-chart') as HTMLCanvasElement,
    wolframCanvas: root.querySelector('#wolfram-chart') as HTMLCanvasElement,
    interestCanvas: root.querySelector('#interest-chart') as HTMLCanvasElement,
    populationCanvas: root.querySelector(
      '#population-chart',
    ) as HTMLCanvasElement,
    activityCanvas: root.querySelector('#activity-chart') as HTMLCanvasElement,
    entropyCanvas: root.querySelector('#entropy-chart') as HTMLCanvasElement,
    chartModal: createStatsChartModal(),
  }

  return { root, elements }
}

export function renderStatistics(
  elements: StatisticsPanelElements,
  data: StatisticsData,
): { destroy: () => void } {
  const charts: Chart[] = []
  const isDark = document.documentElement.classList.contains('dark')

  // Color schemes
  const textColor = isDark ? '#f3f4f6' : '#1f2937'
  const gridColor = isDark ? '#374151' : '#e5e7eb'

  // Set explicit canvas dimensions to fill 300px containers
  const canvases = [
    elements.outcomeCanvas,
    elements.wolframCanvas,
    elements.interestCanvas,
    elements.populationCanvas,
    elements.activityCanvas,
    elements.entropyCanvas,
  ]
  for (const canvas of canvases) {
    canvas.width = 600
    canvas.height = 300
  }

  // Render summary cards - Automata stats first, then engagement stats
  // Add data-metric attribute and cursor-pointer for clickable cards
  elements.summaryCards.innerHTML = `
    <!-- Automata Statistics -->
    <div data-metric="total_runs" class="bg-violet-50 dark:bg-violet-900/20 p-4 rounded-lg border border-violet-200 dark:border-violet-800 cursor-pointer hover:shadow-lg transition-shadow">
      <div class="text-sm text-violet-600 dark:text-violet-400 font-medium">Total Runs</div>
      <div class="text-2xl font-bold text-violet-900 dark:text-violet-100">${data.total_runs.toLocaleString()}</div>
    </div>
    <div data-metric="total_steps" class="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800 cursor-pointer hover:shadow-lg transition-shadow">
      <div class="text-sm text-blue-600 dark:text-blue-400 font-medium">Total Steps</div>
      <div class="text-2xl font-bold text-blue-900 dark:text-blue-100">${data.total_steps.toLocaleString()}</div>
    </div>
    <div data-metric="total_processing_power" class="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg border border-purple-200 dark:border-purple-800 cursor-pointer hover:shadow-lg transition-shadow">
      <div class="text-sm text-purple-600 dark:text-purple-400 font-medium">Processing Power</div>
      <div class="text-2xl font-bold text-purple-900 dark:text-purple-100">${formatLargeNumber(data.total_processing_power)} cells</div>
    </div>
    <div data-metric="total_starred" class="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg border border-yellow-200 dark:border-yellow-800 cursor-pointer hover:shadow-lg transition-shadow">
      <div class="text-sm text-yellow-600 dark:text-yellow-400 font-medium">Starred</div>
      <div class="text-2xl font-bold text-yellow-900 dark:text-yellow-100">${data.total_starred.toLocaleString()}</div>
    </div>
    <div data-metric="unique_rulesets" class="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-200 dark:border-green-800 cursor-pointer hover:shadow-lg transition-shadow">
      <div class="text-sm text-green-600 dark:text-green-400 font-medium">Unique Rulesets</div>
      <div class="text-2xl font-bold text-green-900 dark:text-green-100">${data.unique_rulesets.toLocaleString()}</div>
    </div>
    <!-- User Engagement Statistics -->
    <div data-metric="unique_users" class="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-lg border border-indigo-200 dark:border-indigo-800 cursor-pointer hover:shadow-lg transition-shadow">
      <div class="text-sm text-indigo-600 dark:text-indigo-400 font-medium">Unique Users</div>
      <div class="text-2xl font-bold text-indigo-900 dark:text-indigo-100">${data.unique_users.toLocaleString()}</div>
    </div>
    <div class="bg-cyan-50 dark:bg-cyan-900/20 p-4 rounded-lg border border-cyan-200 dark:border-cyan-800 opacity-60">
      <div class="text-sm text-cyan-600 dark:text-cyan-400 font-medium">Avg Runs/User</div>
      <div class="text-2xl font-bold text-cyan-900 dark:text-cyan-100">${data.avg_runs_per_user.toFixed(1)}</div>
    </div>
    <div data-metric="active_users_24h" class="bg-pink-50 dark:bg-pink-900/20 p-4 rounded-lg border border-pink-200 dark:border-pink-800 cursor-pointer hover:shadow-lg transition-shadow">
      <div class="text-sm text-pink-600 dark:text-pink-400 font-medium">Active (24h)</div>
      <div class="text-2xl font-bold text-pink-900 dark:text-pink-100">${data.active_users_24h.toLocaleString()}</div>
    </div>
    <div data-metric="active_users_7d" class="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-lg border border-orange-200 dark:border-orange-800 cursor-pointer hover:shadow-lg transition-shadow">
      <div class="text-sm text-orange-600 dark:text-orange-400 font-medium">Active (7d)</div>
      <div class="text-2xl font-bold text-orange-900 dark:text-orange-100">${data.active_users_7d.toLocaleString()}</div>
    </div>
  `

  // Add click handlers to stat cards
  const statCards = elements.summaryCards.querySelectorAll('[data-metric]')
  for (const card of statCards) {
    card.addEventListener('click', () => {
      const metric = card.getAttribute('data-metric')
      const label =
        card.querySelector('.font-medium')?.textContent || metric || ''
      if (metric && elements.chartModal) {
        showStatsChart(elements.chartModal, metric, label)
      }
    })
  }

  // Common chart options (for bar charts)
  const commonOptions: Partial<ChartOptions> = {
    responsive: false,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false, // Hide legend for histograms
      },
    },
    scales: {
      x: {
        ticks: { color: textColor },
        grid: { color: gridColor },
      },
      y: {
        ticks: { color: textColor },
        grid: { color: gridColor },
      },
    },
  }

  // Outcome Distribution (Pie)
  const outcomeConfig: ChartConfiguration = {
    type: 'pie',
    data: {
      labels: ['Dies Out', 'Exploding', 'Complex/Stable'],
      datasets: [
        {
          data: [
            data.outcome_distribution.dies_out,
            data.outcome_distribution.exploding,
            data.outcome_distribution.complex,
          ],
          backgroundColor: ['#ef4444', '#f59e0b', '#10b981'],
        },
      ],
    },
    options: {
      responsive: false,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: { color: textColor },
        },
      },
    },
  }
  charts.push(new Chart(elements.outcomeCanvas, outcomeConfig))

  // Wolfram Classification (Pie)
  const wolframConfig: ChartConfiguration = {
    type: 'pie',
    data: {
      labels: [
        'Class I (Dies)',
        'Class II (Stable)',
        'Class III (Chaotic)',
        'Class IV (Complex)',
      ],
      datasets: [
        {
          data: [
            data.wolfram_classification.class_i,
            data.wolfram_classification.class_ii,
            data.wolfram_classification.class_iii,
            data.wolfram_classification.class_iv,
          ],
          backgroundColor: ['#94a3b8', '#60a5fa', '#f59e0b', '#8b5cf6'],
        },
      ],
    },
    options: {
      responsive: false,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: { color: textColor },
        },
      },
    },
  }
  charts.push(new Chart(elements.wolframCanvas, wolframConfig))

  // Interest Score Distribution (Bar)
  const interestConfig: ChartConfiguration = {
    type: 'bar',
    data: {
      labels: [
        '0-0.1',
        '0.1-0.2',
        '0.2-0.3',
        '0.3-0.4',
        '0.4-0.5',
        '0.5-0.6',
        '0.6-0.7',
        '0.7-0.8',
        '0.8-0.9',
        '0.9-1.0',
      ],
      datasets: [
        {
          label: 'Runs',
          data: data.interest_score_distribution,
          backgroundColor: '#8b5cf6',
        },
      ],
    },
    options: commonOptions as ChartOptions,
  }
  charts.push(new Chart(elements.interestCanvas, interestConfig))

  // Population Distribution (Bar)
  const populationConfig: ChartConfiguration = {
    type: 'bar',
    data: {
      labels: [
        '0-10%',
        '10-20%',
        '20-30%',
        '30-40%',
        '40-50%',
        '50-60%',
        '60-70%',
        '70-80%',
        '80-90%',
        '90-100%',
      ],
      datasets: [
        {
          label: 'Runs',
          data: data.population_distribution,
          backgroundColor: '#10b981',
        },
      ],
    },
    options: commonOptions as ChartOptions,
  }
  charts.push(new Chart(elements.populationCanvas, populationConfig))

  // Activity Distribution (Bar)
  const activityConfig: ChartConfiguration = {
    type: 'bar',
    data: {
      labels: [
        '0-10%',
        '10-20%',
        '20-30%',
        '30-40%',
        '40-50%',
        '50-60%',
        '60-70%',
        '70-80%',
        '80-90%',
        '90-100%',
      ],
      datasets: [
        {
          label: 'Runs',
          data: data.activity_distribution,
          backgroundColor: '#3b82f6',
        },
      ],
    },
    options: commonOptions as ChartOptions,
  }
  charts.push(new Chart(elements.activityCanvas, activityConfig))

  // Entropy Distribution (Bar)
  const entropyConfig: ChartConfiguration = {
    type: 'bar',
    data: {
      labels: [
        '0-0.1',
        '0.1-0.2',
        '0.2-0.3',
        '0.3-0.4',
        '0.4-0.5',
        '0.5-0.6',
        '0.6-0.7',
        '0.7-0.8',
        '0.8-0.9',
        '0.9-1.0',
      ],
      datasets: [
        {
          label: 'Runs',
          data: data.entropy_distribution,
          backgroundColor: '#f59e0b',
        },
      ],
    },
    options: commonOptions as ChartOptions,
  }
  charts.push(new Chart(elements.entropyCanvas, entropyConfig))

  // Return cleanup function
  return {
    destroy: () => {
      for (const chart of charts) {
        chart.destroy()
      }
    },
  }
}
