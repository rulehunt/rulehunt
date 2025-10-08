// src/components/statsOverlay.ts

import type { RunSubmission } from '../schema.ts'

export interface StatsOverlayElements {
  overlay: HTMLDivElement
  panel: HTMLDivElement
  closeButton: HTMLButtonElement
  content: HTMLDivElement
}

export type CleanupFunction = () => void

// Helper function to copy text to clipboard
async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
    // Fallback for older browsers
    const textArea = document.createElement('textarea')
    textArea.value = text
    textArea.style.position = 'fixed'
    textArea.style.left = '-999999px'
    textArea.style.top = '-999999px'
    document.body.appendChild(textArea)
    textArea.focus()
    textArea.select()
    const success = document.execCommand('copy')
    document.body.removeChild(textArea)
    return success
  } catch (err) {
    console.error('Failed to copy:', err)
    return false
  }
}

export function createStatsOverlay(): {
  elements: StatsOverlayElements
  show: (data: RunSubmission) => void
  hide: () => void
} {
  const overlay = document.createElement('div')
  overlay.className =
    'fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm hidden items-center justify-center p-4'
  overlay.style.display = 'none'

  const panel = document.createElement('div')
  panel.className =
    'bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[85vh] overflow-hidden transform scale-95 transition-transform duration-300'

  const header = document.createElement('div')
  header.className =
    'sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between'
  header.innerHTML = `
    <h2 class="text-2xl font-bold text-gray-900 dark:text-gray-100">Run Statistics</h2>
    <button 
      id="close-stats"
      class="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
      aria-label="Close"
    >
      <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
      </svg>
    </button>
  `

  const content = document.createElement('div')
  content.className = 'px-6 py-6 overflow-y-auto max-h-[calc(85vh-5rem)]'

  const closeButton = header.querySelector('#close-stats') as HTMLButtonElement

  panel.appendChild(header)
  panel.appendChild(content)
  overlay.appendChild(panel)
  document.body.appendChild(overlay)

  const elements: StatsOverlayElements = {
    overlay,
    panel,
    closeButton,
    content,
  }

  const show = (data: RunSubmission) => {
    const jsonString = JSON.stringify(data, null, 2)

    // Safe accessors with defaults
    const gridSize = data.gridSize ?? 0
    const actualSps = data.actualSps ?? 0

    content.innerHTML = `
      <div class="space-y-4">
        <div class="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <h3 class="font-semibold text-gray-900 dark:text-gray-100 mb-2">Rule Information</h3>
          <div class="space-y-2 font-mono text-sm">
            <div>
              <span class="text-gray-500 dark:text-gray-400">Name:</span>
              <span class="ml-2 text-gray-900 dark:text-white font-semibold">${data.rulesetName}</span>
            </div>
            <div>
              <span class="text-gray-500 dark:text-gray-400">Hex:</span>
              <div class="mt-1 p-2 bg-gray-100 dark:bg-gray-900 rounded text-xs break-all text-gray-900 dark:text-white">
                ${data.rulesetHex}
              </div>
            </div>
          </div>
        </div>

        <div class="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
          <h3 class="font-semibold text-gray-900 dark:text-gray-100 mb-2">Simulation Metrics</h3>
          <div class="grid grid-cols-2 gap-x-4 gap-y-2 font-mono text-sm">
            <div>
              <div class="text-gray-500 dark:text-gray-400 text-xs">Steps</div>
              <div class="text-gray-900 dark:text-white font-semibold">${data.stepCount.toLocaleString()}</div>
            </div>
            <div>
              <div class="text-gray-500 dark:text-gray-400 text-xs">Watched Time</div>
              <div class="text-gray-900 dark:text-white font-semibold">${(data.watchedWallMs / 1000).toFixed(1)}s</div>
            </div>
            <div>
              <div class="text-gray-500 dark:text-gray-400 text-xs">Grid Size</div>
              <div class="text-gray-900 dark:text-white font-semibold">${gridSize.toLocaleString()}</div>
            </div>
            <div>
              <div class="text-gray-500 dark:text-gray-400 text-xs">Steps/Second</div>
              <div class="text-gray-900 dark:text-white font-semibold">${actualSps.toFixed(1)} / ${data.requestedSps}</div>
            </div>
            <div>
              <div class="text-gray-500 dark:text-gray-400 text-xs">Seed Type</div>
              <div class="text-gray-900 dark:text-white font-semibold">${data.seedType} (${data.seedPercentage}%)</div>
            </div>
            <div>
              <div class="text-gray-500 dark:text-gray-400 text-xs">Interest Score</div>
              <div class="text-gray-900 dark:text-white font-semibold text-lg">${data.interestScore.toFixed(4)}</div>
            </div>
          </div>
        </div>

        <div class="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
          <h3 class="font-semibold text-gray-900 dark:text-gray-100 mb-2">Pattern Analysis</h3>
          <div class="grid grid-cols-2 gap-x-4 gap-y-2 font-mono text-sm">
            <div>
              <div class="text-gray-500 dark:text-gray-400 text-xs">Population</div>
              <div class="text-gray-900 dark:text-white">${data.population.toLocaleString()}</div>
            </div>
            <div>
              <div class="text-gray-500 dark:text-gray-400 text-xs">Activity</div>
              <div class="text-gray-900 dark:text-white">${data.activity.toLocaleString()}</div>
            </div>
            <div>
              <div class="text-gray-500 dark:text-gray-400 text-xs">Pop. Change</div>
              <div class="text-gray-900 dark:text-white">${data.populationChange.toLocaleString()}</div>
            </div>
            <div>
              <div class="text-gray-500 dark:text-gray-400 text-xs">Entropy 2×2</div>
              <div class="text-gray-900 dark:text-white">${data.entropy2x2.toFixed(4)}</div>
            </div>
            <div>
              <div class="text-gray-500 dark:text-gray-400 text-xs">Entropy 4×4</div>
              <div class="text-gray-900 dark:text-white">${data.entropy4x4.toFixed(4)}</div>
            </div>
            <div>
              <div class="text-gray-500 dark:text-gray-400 text-xs">Entropy 8×8</div>
              <div class="text-gray-900 dark:text-white">${data.entropy8x8.toFixed(4)}</div>
            </div>
          </div>
        </div>

        <button 
          id="copy-json-btn"
          class="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-semibold"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/>
          </svg>
          <span>Copy JSON to Clipboard</span>
        </button>

        <div class="text-xs text-gray-500 dark:text-gray-400 text-center pt-2">
          This data is submitted to the database when you swipe to the next rule
        </div>
      </div>
    `

    // Add copy button handler
    const copyBtn = content.querySelector('#copy-json-btn') as HTMLButtonElement
    if (copyBtn) {
      copyBtn.addEventListener('click', async () => {
        const success = await copyToClipboard(jsonString)

        const originalHTML = copyBtn.innerHTML

        if (success) {
          copyBtn.innerHTML = `
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
            </svg>
            <span>Copied!</span>
          `
          copyBtn.classList.remove('bg-blue-600', 'hover:bg-blue-700')
          copyBtn.classList.add('bg-green-600', 'hover:bg-green-700')
        } else {
          copyBtn.innerHTML = `
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
            <span>Failed to Copy</span>
          `
          copyBtn.classList.remove('bg-blue-600', 'hover:bg-blue-700')
          copyBtn.classList.add('bg-red-600', 'hover:bg-red-700')
        }

        // Reset button after 2 seconds
        setTimeout(() => {
          copyBtn.innerHTML = originalHTML
          copyBtn.classList.remove(
            'bg-green-600',
            'hover:bg-green-700',
            'bg-red-600',
            'hover:bg-red-700',
          )
          copyBtn.classList.add('bg-blue-600', 'hover:bg-blue-700')
        }, 2000)
      })
    }

    overlay.style.display = 'flex'
    // Prevent body scrolling when overlay is open
    document.body.style.overflow = 'hidden'
    // Trigger animation
    requestAnimationFrame(() => {
      panel.classList.remove('scale-95')
      panel.classList.add('scale-100')
    })
  }

  const hide = () => {
    panel.classList.remove('scale-100')
    panel.classList.add('scale-95')
    setTimeout(() => {
      overlay.style.display = 'none'
      document.body.style.overflow = ''
    }, 300)
  }

  return { elements, show, hide }
}

export function setupStatsOverlay(
  elements: StatsOverlayElements,
  hideCallback: () => void,
): CleanupFunction {
  const { overlay, closeButton } = elements

  const closeHandler = () => {
    hideCallback()
  }

  const overlayClickHandler = (e: MouseEvent) => {
    if (e.target === overlay) {
      hideCallback()
    }
  }

  closeButton.addEventListener('click', closeHandler)
  overlay.addEventListener('click', overlayClickHandler)

  return () => {
    closeButton.removeEventListener('click', closeHandler)
    overlay.removeEventListener('click', overlayClickHandler)

    // Clean up overlay from DOM
    if (overlay.parentNode) {
      overlay.parentNode.removeChild(overlay)
    }

    // Restore body scroll in case it was locked
    document.body.style.overflow = ''
  }
}
