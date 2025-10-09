// src/components/statsOverlay.ts

import type { RunSubmission } from '../schema.ts'
import {
  copyToClipboard,
  generateStatsHTML,
  updateStatsFields,
} from './shared/stats.ts'
import {
  generateSimulationMetricsHTML,
  updateSimulationMetricsFields,
} from './shared/simulationInfo.ts'

export interface StatsOverlayElements {
  overlay: HTMLDivElement
  panel: HTMLDivElement
  closeButton: HTMLButtonElement
  content: HTMLDivElement
}

export type CleanupFunction = () => void

export function createStatsOverlay(): {
  elements: StatsOverlayElements
  show: (data: RunSubmission) => void
  hide: () => void
  update: (data: RunSubmission) => void
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
    'sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-end'
  header.innerHTML = `

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
    // const gridSize = data.gridSize ?? 0
    // const actualSps = data.actualSps ?? 0

    content.innerHTML = `
      <div class="space-y-4">
        <div class="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
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
          ${generateSimulationMetricsHTML(data)}
        </div>
        
        <div class="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
          <h3 class="font-semibold text-gray-900 dark:text-gray-100 mb-2">Pattern Analysis</h3>
          ${generateStatsHTML(data)}
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

  const update = (data: RunSubmission) => {
    // Update simulation metrics using shared function
    updateSimulationMetricsFields(content, data)
    
    // Update all stats fields using shared function
    updateStatsFields(content, data)
  }

  return { elements, show, hide, update }
}

export function setupStatsOverlay(
  elements: StatsOverlayElements,
  hideCallback: () => void,
  refreshCallback?: () => void, // <–– new optional updater
): CleanupFunction {
  const { overlay, closeButton } = elements
  let refreshTimer: number | null = null

  const startRefreshing = () => {
    stopRefreshing()
    if (!refreshCallback) return
    refreshTimer = window.setInterval(() => {
      // only refresh if overlay visible
      if (overlay.style.display !== 'none') refreshCallback()
    }, 1000)
  }

  const stopRefreshing = () => {
    if (refreshTimer) {
      clearInterval(refreshTimer)
      refreshTimer = null
    }
  }

  const closeHandler = () => {
    stopRefreshing()
    hideCallback()
  }

  const overlayClickHandler = (e: MouseEvent) => {
    if (e.target === overlay) {
      stopRefreshing()
      hideCallback()
    }
  }

  // hook into display toggle so timer starts when opened
  const observer = new MutationObserver(() => {
    const visible = overlay.style.display !== 'none'
    if (visible) startRefreshing()
    else stopRefreshing()
  })
  observer.observe(overlay, { attributes: true, attributeFilter: ['style'] })

  closeButton.addEventListener('click', closeHandler)
  overlay.addEventListener('click', overlayClickHandler)

  return () => {
    stopRefreshing()
    observer.disconnect()
    closeButton.removeEventListener('click', closeHandler)
    overlay.removeEventListener('click', overlayClickHandler)
    if (overlay.parentNode) overlay.parentNode.removeChild(overlay)
    document.body.style.overflow = ''
  }
}
