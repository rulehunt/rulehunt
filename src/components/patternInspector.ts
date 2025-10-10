// src/components/patternInspector.ts

export interface PatternInspectorElements {
  container: HTMLDivElement
}

export interface PatternInspectorData {
  type: 'orbit' | 'pattern'
  index: number
  output: number
  bits: number[]
  // Orbit-specific
  stabilizer?: string
  size?: number
  // Pattern-specific
  orbitId?: number
}

export function createPatternInspector(): {
  root: HTMLDivElement
  elements: PatternInspectorElements
  update: (data: PatternInspectorData | null) => void
} {
  const root = document.createElement('div')
  root.className =
    'w-80 lg:w-96 bg-white dark:bg-gray-800 rounded-lg border border-gray-300 dark:border-gray-600 p-4'

  root.innerHTML = `
    <h2 class="text-lg font-semibold mb-3 text-gray-900 dark:text-white">Pattern Inspector</h2>
    <div id="pattern-content" class="text-sm">
      <div class="text-gray-500 dark:text-gray-400 text-center py-8">
        Click on a pattern in the ruleset canvas to inspect
      </div>
    </div>
  `

  const container = root.querySelector('#pattern-content') as HTMLDivElement

  const elements: PatternInspectorElements = {
    container,
  }

  function update(data: PatternInspectorData | null) {
    if (!data) {
      container.innerHTML = `
        <div class="text-gray-500 dark:text-gray-400 text-center py-8">
          Click on a pattern in the ruleset canvas to inspect
        </div>
      `
      return
    }

    const { type, index, output, bits } = data

    // Create 3x3 grid visualization
    const gridHtml = `
      <div class="grid grid-cols-3 gap-1 w-24 h-24 mx-auto mb-4">
        ${bits
          .map(
            (bit) =>
              `<div class="border ${bit === 1 ? 'bg-violet-600 dark:bg-violet-400' : 'bg-gray-100 dark:bg-gray-700'} border-gray-300 dark:border-gray-600 flex items-center justify-center text-xs font-mono ${bit === 1 ? 'text-white' : 'text-gray-600 dark:text-gray-400'}">${bit}</div>`,
          )
          .join('')}
      </div>
    `

    if (type === 'orbit') {
      const { stabilizer, size } = data
      container.innerHTML = `
        <div class="space-y-3">
          <div class="flex justify-between">
            <span class="text-gray-600 dark:text-gray-400">Type:</span>
            <span class="text-gray-900 dark:text-white font-semibold">Orbit</span>
          </div>
          <div class="flex justify-between">
            <span class="text-gray-600 dark:text-gray-400">Orbit ID:</span>
            <span class="text-gray-900 dark:text-white font-mono">${index}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-gray-600 dark:text-gray-400">Output:</span>
            <span class="text-gray-900 dark:text-white font-mono font-semibold">${output}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-gray-600 dark:text-gray-400">Stabilizer:</span>
            <span class="text-gray-900 dark:text-white font-mono">${stabilizer}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-gray-600 dark:text-gray-400">Size:</span>
            <span class="text-gray-900 dark:text-white font-mono">${size}</span>
          </div>
          <div class="border-t border-gray-300 dark:border-gray-600 pt-3 mt-3">
            <div class="text-gray-600 dark:text-gray-400 text-center mb-2">Representative Pattern</div>
            ${gridHtml}
            <div class="text-center">
              <span class="text-2xl text-gray-600 dark:text-gray-400">→</span>
              <span class="text-2xl font-bold ml-2 ${output === 1 ? 'text-violet-600 dark:text-violet-400' : 'text-gray-600 dark:text-gray-400'}">${output}</span>
            </div>
          </div>
        </div>
      `
    } else {
      // Pattern mode
      const { orbitId } = data
      container.innerHTML = `
        <div class="space-y-3">
          <div class="flex justify-between">
            <span class="text-gray-600 dark:text-gray-400">Type:</span>
            <span class="text-gray-900 dark:text-white font-semibold">Pattern</span>
          </div>
          <div class="flex justify-between">
            <span class="text-gray-600 dark:text-gray-400">Pattern ID:</span>
            <span class="text-gray-900 dark:text-white font-mono">${index}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-gray-600 dark:text-gray-400">Orbit ID:</span>
            <span class="text-gray-900 dark:text-white font-mono">${orbitId}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-gray-600 dark:text-gray-400">Output:</span>
            <span class="text-gray-900 dark:text-white font-mono font-semibold">${output}</span>
          </div>
          <div class="border-t border-gray-300 dark:border-gray-600 pt-3 mt-3">
            <div class="text-gray-600 dark:text-gray-400 text-center mb-2">3×3 Neighborhood</div>
            ${gridHtml}
            <div class="text-center">
              <span class="text-2xl text-gray-600 dark:text-gray-400">→</span>
              <span class="text-2xl font-bold ml-2 ${output === 1 ? 'text-violet-600 dark:text-violet-400' : 'text-gray-600 dark:text-gray-400'}">${output}</span>
            </div>
          </div>
        </div>
      `
    }
  }

  return { root, elements, update }
}
