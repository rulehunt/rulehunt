import type { RunSubmission } from '../../schema'

export interface SimulationMetrics {
  rulesetName: string
  rulesetHex: string
  seedType: string
  seedPercentage?: number
  stepCount: number
  elapsedTime: number // in ms
  actualSps?: number
  requestedSps?: number
  gridSize?: number
}

export function generateSimulationMetricsHTML(
  data: SimulationMetrics | RunSubmission,
): string {
  const gridSize = 'gridSize' in data && data.gridSize ? data.gridSize : 0
  const actualSps = 'actualSps' in data && data.actualSps ? data.actualSps : 0
  const requestedSps =
    'requestedSps' in data && data.requestedSps ? data.requestedSps : 0

  // Handle different time fields
  const elapsedTimeMs =
    'watchedWallMs' in data
      ? data.watchedWallMs
      : 'elapsedTime' in data
        ? data.elapsedTime
        : 0
  const stepCount = 'stepCount' in data ? data.stepCount : 0

  return `
    <div class="space-y-2 font-mono text-sm">
      <div class="flex justify-between items-center">
        <span class="text-gray-600 dark:text-gray-400 text-xs">Name:</span>
        <span data-field="ruleset-name" class="text-gray-900 dark:text-gray-100 font-semibold">${data.rulesetName}</span>
      </div>
      
      <div class="flex justify-between items-start">
        <span class="text-gray-600 dark:text-gray-400 text-xs">Hex:</span>
        <span data-field="ruleset-hex" class="text-gray-900 dark:text-gray-100 text-right text-xs break-all max-w-[200px]">${data.rulesetHex}</span>
      </div>
      
      <div class="flex justify-between items-center">
        <span class="text-gray-600 dark:text-gray-400 text-xs">Seed:</span>
        <span data-field="seed-type" class="text-gray-900 dark:text-gray-100">
          ${data.seedType}${data.seedPercentage !== undefined ? ` (${data.seedPercentage}%)` : ''}
        </span>
      </div>
      
      <div class="flex justify-between items-center">
        <span class="text-gray-600 dark:text-gray-400 text-xs">Steps:</span>
        <span data-field="step-count" class="text-gray-900 dark:text-gray-100">${stepCount.toLocaleString()}</span>
      </div>
      
      <div class="flex justify-between items-center">
        <span class="text-gray-600 dark:text-gray-400 text-xs">Time:</span>
        <span data-field="elapsed-time" class="text-gray-900 dark:text-gray-100">${(elapsedTimeMs / 1000).toFixed(1)}s</span>
      </div>
      
      ${
        gridSize > 0
          ? `
      <div class="flex justify-between items-center">
        <span class="text-gray-600 dark:text-gray-400 text-xs">Grid Size:</span>
        <span data-field="grid-size" class="text-gray-900 dark:text-gray-100">${gridSize.toLocaleString()}</span>
      </div>
      `
          : ''
      }
      
      <div class="flex justify-between items-center">
        <span class="text-gray-600 dark:text-gray-400 text-xs">Steps/Second:</span>
        <span data-field="sps" class="text-gray-900 dark:text-gray-100">
          ${actualSps > 0 ? `${actualSps.toFixed(1)}` : '—'}${requestedSps > 0 ? ` / ${requestedSps}` : ''}
        </span>
      </div>
    </div>
  `
}

export function updateSimulationMetricsFields(
  container: HTMLElement,
  data: SimulationMetrics | RunSubmission,
) {
  const updateField = (selector: string, value: string) => {
    const el = container.querySelector(selector)
    if (el) el.textContent = value
  }

  updateField('[data-field="ruleset-name"]', data.rulesetName)
  updateField('[data-field="ruleset-hex"]', data.rulesetHex)

  const seedText =
    data.seedType +
    (data.seedPercentage !== undefined ? ` (${data.seedPercentage}%)` : '')
  updateField('[data-field="seed-type"]', seedText)

  const stepCount = 'stepCount' in data ? data.stepCount : 0
  updateField('[data-field="step-count"]', stepCount.toLocaleString())

  const elapsedTimeMs =
    'watchedWallMs' in data
      ? data.watchedWallMs
      : 'elapsedTime' in data
        ? data.elapsedTime
        : 0
  updateField(
    '[data-field="elapsed-time"]',
    `${(elapsedTimeMs / 1000).toFixed(1)}s`,
  )

  const gridSize = 'gridSize' in data && data.gridSize ? data.gridSize : 0
  if (gridSize > 0) {
    updateField('[data-field="grid-size"]', gridSize.toLocaleString())
  }

  const actualSps = 'actualSps' in data && data.actualSps ? data.actualSps : 0
  const requestedSps =
    'requestedSps' in data && data.requestedSps ? data.requestedSps : 0
  const spsText = `${actualSps > 0 ? actualSps.toFixed(1) : '—'}${requestedSps > 0 ? ` / ${requestedSps}` : ''}`
  updateField('[data-field="sps"]', spsText)
}
