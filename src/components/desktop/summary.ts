// src/components/summary.ts

export interface SummaryPanelElements {
  metricsContainer: HTMLDivElement
  statsContainer: HTMLDivElement
  copyJsonButton: HTMLButtonElement
  exportCsvButton: HTMLButtonElement
}

export function createSummaryPanel(): {
  root: HTMLDivElement
  elements: SummaryPanelElements
} {
  const root = document.createElement('div')
  root.className =
    'w-full border flex flex-col border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-800 p-4 mt-4 w-[80vw]'

  root.innerHTML = `
    <!-- Row 1: Full width title -->
    <h3 class="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">Active Simulation</h3>

    <!-- Row 2: Two columns side by side -->
    <div class="flex gap-12 mb-4 pb-4 border-b border-gray-200 dark:border-gray-700">
      <!-- Left column: Simulation Metrics -->
      <div class="flex-1">
        <div id="metrics-container"></div>
      </div>

      <!-- Right column: Pattern Analysis -->
      <div class="flex-1">
        <div id="stats-container"></div>
      </div>
    </div>

    <!-- Row 3: Export Buttons -->
    <div class="flex gap-3 flex-col">
      <button
        id="copy-json-btn"
        class="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm font-medium"
        title="Copy all simulation data as JSON"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/>
        </svg>
        <span>Copy JSON</span>
      </button>

      <button
        id="export-csv-btn"
        class="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors text-sm font-medium"
        title="Export simulation data as CSV"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
        </svg>
        <span>Export CSV</span>
      </button>
    </div>
  `

  const metricsContainer = root.querySelector(
    '#metrics-container',
  ) as HTMLDivElement
  const statsContainer = root.querySelector(
    '#stats-container',
  ) as HTMLDivElement
  const copyJsonButton = root.querySelector(
    '#copy-json-btn',
  ) as HTMLButtonElement
  const exportCsvButton = root.querySelector(
    '#export-csv-btn',
  ) as HTMLButtonElement

  const elements: SummaryPanelElements = {
    metricsContainer,
    statsContainer,
    copyJsonButton,
    exportCsvButton,
  }

  return { root, elements }
}
