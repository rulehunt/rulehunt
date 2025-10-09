import type { RunSubmission } from '../../schema'
import type { GridStatistics } from '../../statistics'

export interface StatsData extends GridStatistics {
  interestScore: number
}

export function generateStatsHTML(data: StatsData | RunSubmission): string {
  const entityCount = 'entityCount' in data && data.entityCount !== undefined ? data.entityCount : 0
  const entityChange = 'entityChange' in data && data.entityChange !== undefined ? data.entityChange : 0
  const entityChangeStr =
    entityChange > 0 ? `+${entityChange}` : entityChange.toString()

  return `
    <div class="grid grid-cols-2 gap-x-4 gap-y-2 font-mono text-sm">
      <div>
        <div class="text-gray-500 dark:text-gray-400 text-xs">Population</div>
        <div data-field="population" class="text-gray-900 dark:text-white">
          ${data.population.toLocaleString()}
        </div>
      </div>
      <div>
        <div class="text-gray-500 dark:text-gray-400 text-xs">Activity</div>
        <div data-field="activity" class="text-gray-900 dark:text-white">
          ${data.activity.toLocaleString()}
        </div>
      </div>
      <div>
        <div class="text-gray-500 dark:text-gray-400 text-xs">Pop. Change</div>
        <div data-field="popChange" class="text-gray-900 dark:text-white">
          ${data.populationChange.toLocaleString()}
        </div>
      </div>
      <div>
        <div class="text-gray-500 dark:text-gray-400 text-xs">Entropy 2×2</div>
        <div data-field="entropy2x2" class="text-gray-900 dark:text-white">
          ${data.entropy2x2.toFixed(4)}
        </div>
      </div>
      <div>
        <div class="text-gray-500 dark:text-gray-400 text-xs">Entropy 4×4</div>
        <div data-field="entropy4x4" class="text-gray-900 dark:text-white">
          ${data.entropy4x4.toFixed(4)}
        </div>
      </div>
      <div>
        <div class="text-gray-500 dark:text-gray-400 text-xs">Entropy 8×8</div>
        <div data-field="entropy8x8" class="text-gray-900 dark:text-white">
          ${data.entropy8x8.toFixed(4)}
        </div>
      </div>
      <div>
        <div class="text-gray-500 dark:text-gray-400 text-xs">Entities</div>
        <div data-field="entityCount" class="text-gray-900 dark:text-white">
          ${entityCount}
        </div>
      </div>
      <div>
        <div class="text-gray-500 dark:text-gray-400 text-xs">Entity Change</div>
        <div data-field="entityChange" class="text-gray-900 dark:text-white">
          ${entityChangeStr}
        </div>
      </div>
      <div>
        <div class="text-gray-500 dark:text-gray-400 text-xs">Interest Score</div>
        <div data-field="interest" class="text-gray-900 dark:text-white font-semibold text-lg">
          ${(data.interestScore * 100).toFixed(1)}%
        </div>
      </div>
    </div>
  `
}

export function getInterestColorClass(interestScore: number): string {
  if (interestScore > 0.7) {
    return 'text-green-600 dark:text-green-400'
  }
  if (interestScore > 0.4) {
    return 'text-yellow-600 dark:text-yellow-400'
  }
  return 'text-red-600 dark:text-red-400'
}

// Helper function to copy text to clipboard
export async function copyToClipboard(text: string): Promise<boolean> {
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

export function updateStatsFields(
  container: HTMLElement,
  data: StatsData | RunSubmission,
) {
  const updateField = (selector: string, value: string) => {
    const el = container.querySelector(selector)
    if (el) el.textContent = value
  }

  updateField('[data-field="population"]', data.population.toLocaleString())
  updateField('[data-field="activity"]', data.activity.toLocaleString())
  updateField(
    '[data-field="popChange"]',
    data.populationChange.toLocaleString(),
  )
  updateField('[data-field="entropy2x2"]', data.entropy2x2.toFixed(4))
  updateField('[data-field="entropy4x4"]', data.entropy4x4.toFixed(4))
  updateField('[data-field="entropy8x8"]', data.entropy8x8.toFixed(4))

  const entityCount = 'entityCount' in data && data.entityCount !== undefined ? data.entityCount : 0
  const entityChange = 'entityChange' in data && data.entityChange !== undefined ? data.entityChange : 0
  updateField('[data-field="entityCount"]', entityCount.toString())
  updateField(
    '[data-field="entityChange"]',
    `${entityChange > 0 ? '+' : ''}${entityChange}`,
  )

  updateField('[data-field="interest"]', `${(data.interestScore * 100).toFixed(1)}%`)
}
