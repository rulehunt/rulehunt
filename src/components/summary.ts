// src/components/summary.ts

// import { generateSimulationMetricsHTML } from './shared/simulationInfo.ts'
// import { generateStatsHTML } from './shared/stats.ts'

export interface SummaryPanelElements {
  metricsContainer: HTMLDivElement
  statsContainer: HTMLDivElement
}

export function createSummaryPanel(): {
  root: HTMLDivElement
  elements: SummaryPanelElements
} {
  const root = document.createElement('div')
  root.className =
    'w-full border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-800 p-4 mt-4'

  root.innerHTML = `
    <h3 class="text-lg font-semibold mb-3 text-gray-900 dark:text-gray-100">Simulation Summary</h3>
    
    <!-- Simulation Metrics -->
    <div class="mb-4 pb-4 border-b border-gray-200 dark:border-gray-700">
      <h4 class="text-sm font-semibold mb-2 text-gray-900 dark:text-gray-100">Simulation Metrics</h4>
      <div id="metrics-container"></div>
    </div>
    
    <!-- Grid Statistics -->
    <div>
      <h4 class="text-sm font-semibold mb-2 text-gray-900 dark:text-gray-100">Pattern Analysis</h4>
      <div id="stats-container"></div>
    </div>
  `

  const metricsContainer = root.querySelector(
    '#metrics-container',
  ) as HTMLDivElement
  const statsContainer = root.querySelector(
    '#stats-container',
  ) as HTMLDivElement

  const elements: SummaryPanelElements = {
    metricsContainer,
    statsContainer,
  }

  return { root, elements }
}
