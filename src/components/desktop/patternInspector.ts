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

  let currentData: PatternInspectorData | null = null
  let rotation = 0 // 0, 90, 180, 270 degrees

  // Rotate 3x3 grid 90 degrees counter-clockwise
  function rotateBits90(bits: number[]): number[] {
    // Original:     After 90° CCW:
    // 0 1 2         2 5 8
    // 3 4 5   -->   1 4 7
    // 6 7 8         0 3 6
    return [bits[2], bits[5], bits[8], bits[1], bits[4], bits[7], bits[0], bits[3], bits[6]]
  }

  function getRotatedBits(bits: number[], rotationDegrees: number): number[] {
    let result = [...bits]
    const rotations = (rotationDegrees / 90) % 4
    for (let i = 0; i < rotations; i++) {
      result = rotateBits90(result)
    }
    return result
  }

  function handleRotate() {
    rotation = (rotation + 90) % 360
    renderData()
  }

  function renderData() {
    if (!currentData) {
      container.innerHTML = `
        <div class="text-gray-500 dark:text-gray-400 text-center py-8">
          Click on a pattern in the ruleset canvas to inspect
        </div>
      `
      return
    }

    const { type, index, output, bits } = currentData
    const displayBits = getRotatedBits(bits, rotation)

    if (type === 'orbit') {
      const { stabilizer, size } = currentData
      container.innerHTML = `
        <div class="flex gap-4">
          <!-- Left side: numerical values -->
          <div class="flex-1 space-y-2 text-sm">
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
          </div>

          <!-- Right side: kernel view with output and rotate button -->
          <div class="flex flex-col items-center gap-1 mx-12">
            <button id="rotate-btn" class="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors" title="Rotate 90° (${rotation}°)">
              <svg class="w-4 h-4 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
            <div class="flex items-center gap-2">
              <div class="grid grid-cols-3 gap-1 w-20 h-20">
                ${displayBits
                  .map(
                    (bit) =>
                      `<div class="border ${bit === 1 ? 'bg-violet-600 dark:bg-violet-400' : 'bg-gray-100 dark:bg-gray-700'} border-gray-300 dark:border-gray-600 flex items-center justify-center text-xs font-mono ${bit === 1 ? 'text-white' : 'text-gray-600 dark:text-gray-400'}">${bit}</div>`,
                  )
                  .join('')}
              </div>
              <div class="flex flex-row items-center">
                <span class="text-xl text-gray-600 dark:text-gray-400 px-6">→</span>
                <span class="text-xl font-bold ${output === 1 ? 'text-violet-600 dark:text-violet-400' : 'text-gray-600 dark:text-gray-400'}">${output}</span>
              </div>
            </div>
          </div>
        </div>
      `

      // Attach rotate button handler
      const rotateBtn = container.querySelector('#rotate-btn')
      if (rotateBtn) {
        rotateBtn.addEventListener('click', handleRotate)
      }
    } else {
      // Pattern mode - no rotate button
      const { orbitId } = currentData
      container.innerHTML = `
        <div class="flex gap-4">
          <!-- Left side: numerical values -->
          <div class="flex-1 space-y-2 text-sm">
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
          </div>

          <!-- Right side: kernel view with output (no rotate button for patterns) -->
          <div class="flex items-center gap-2">
            <div class="grid grid-cols-3 gap-1 w-20 h-20">
              ${displayBits
                .map(
                  (bit) =>
                    `<div class="border ${bit === 1 ? 'bg-violet-600 dark:bg-violet-400' : 'bg-gray-100 dark:bg-gray-700'} border-gray-300 dark:border-gray-600 flex items-center justify-center text-xs font-mono ${bit === 1 ? 'text-white' : 'text-gray-600 dark:text-gray-400'}">${bit}</div>`,
                )
                .join('')}
            </div>
            <div class="flex flex-col items-center">
              <span class="text-xl text-gray-600 dark:text-gray-400">→</span>
              <span class="text-xl font-bold ${output === 1 ? 'text-violet-600 dark:text-violet-400' : 'text-gray-600 dark:text-gray-400'}">${output}</span>
            </div>
          </div>
        </div>
      `
    }
  }

  function update(data: PatternInspectorData | null) {
    currentData = data
    rotation = 0 // Reset rotation when new data is loaded
    renderData()
  }

  return { root, elements, update }
}
