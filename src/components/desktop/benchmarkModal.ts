/**
 * Benchmark Modal Component
 *
 * Responsible for creating and managing the modal DOM structure.
 * Extracted from benchmark.ts to improve maintainability and testability.
 */

export interface BenchmarkModalElements {
  overlay: HTMLDivElement
  modal: HTMLDivElement
  header: HTMLDivElement
  title: HTMLHeadingElement
  closeBtn: HTMLButtonElement
  content: HTMLDivElement
  buttonContainer: HTMLDivElement
  clearBtn: HTMLButtonElement
  infoText: HTMLDivElement
  progressArea: HTMLDivElement
  progressBar: HTMLDivElement
  progressFill: HTMLDivElement
  progressText: HTMLDivElement
  chartContainer: HTMLDivElement
  chartCanvas: HTMLCanvasElement
  resultsArea: HTMLDivElement
}

/**
 * Create all DOM elements for the benchmark modal
 */
export function createBenchmarkModal(): BenchmarkModalElements {
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

  // Assemble the content
  content.appendChild(buttonContainer)
  content.appendChild(progressArea)
  content.appendChild(chartContainer)
  content.appendChild(resultsArea)

  // Assemble the modal
  modal.appendChild(header)
  modal.appendChild(content)
  overlay.appendChild(modal)

  return {
    overlay,
    modal,
    header,
    title,
    closeBtn,
    content,
    buttonContainer,
    clearBtn,
    infoText,
    progressArea,
    progressBar,
    progressFill,
    progressText,
    chartContainer,
    chartCanvas,
    resultsArea,
  }
}

/**
 * Show the benchmark modal
 */
export function showModal(elements: BenchmarkModalElements): void {
  elements.overlay.style.display = 'flex'
}

/**
 * Hide the benchmark modal
 */
export function hideModal(elements: BenchmarkModalElements): void {
  elements.overlay.style.display = 'none'
}

/**
 * Show the progress bar
 */
export function showProgressBar(elements: BenchmarkModalElements): void {
  elements.progressBar.style.display = 'block'
}

/**
 * Hide the progress bar
 */
export function hideProgressBar(elements: BenchmarkModalElements): void {
  elements.progressBar.style.display = 'none'
}

/**
 * Update progress bar and text
 */
export function updateProgress(
  elements: BenchmarkModalElements,
  percent: number,
  text: string,
): void {
  elements.progressFill.style.width = `${percent}%`
  elements.progressText.textContent = text
}
