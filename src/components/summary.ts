// src/components/summary.ts

export interface SummaryPanelElements {
  simName: HTMLSpanElement
  simRule: HTMLSpanElement
  simSeed: HTMLSpanElement
  simSteps: HTMLSpanElement
  simTime: HTMLSpanElement
  simSps: HTMLSpanElement
  statPopulation: HTMLDivElement
  statActivity: HTMLDivElement
  statEntropy2x2: HTMLDivElement
  statEntropy4x4: HTMLDivElement
  statEntropy8x8: HTMLDivElement
  statInterest: HTMLDivElement
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
    
    <!-- Simulation Metadata -->
    <div class="space-y-2 mb-4 pb-4 border-b border-gray-200 dark:border-gray-700">
      <div class="flex justify-between items-center text-xs">
        <span class="text-gray-600 dark:text-gray-400">Name:</span>
        <span id="sim-name" class="font-mono text-gray-900 dark:text-gray-100">—</span>
      </div>
      
      <div class="flex justify-between items-start text-xs">
        <span class="text-gray-600 dark:text-gray-400">Rule:</span>
        <span id="sim-rule" class="font-mono text-gray-900 dark:text-gray-100 text-right max-w-[200px] truncate" title="">—</span>
      </div>
      
      <div class="flex justify-between items-center text-xs">
        <span class="text-gray-600 dark:text-gray-400">Seed:</span>
        <span id="sim-seed" class="font-mono text-gray-900 dark:text-gray-100">—</span>
      </div>
      
      <div class="flex justify-between items-center text-xs">
        <span class="text-gray-600 dark:text-gray-400">Steps:</span>
        <span id="sim-steps" class="font-mono text-gray-900 dark:text-gray-100">0</span>
      </div>
      
      <div class="flex justify-between items-center text-xs">
        <span class="text-gray-600 dark:text-gray-400">Time:</span>
        <span id="sim-time" class="font-mono text-gray-900 dark:text-gray-100">0s</span>
      </div>
      
      <div class="flex justify-between items-center text-xs">
        <span class="text-gray-600 dark:text-gray-400">SPS:</span>
        <span id="sim-sps" class="font-mono text-gray-900 dark:text-gray-100">—</span>
      </div>
    </div>
    
    <!-- Grid Statistics -->
    <h4 class="text-sm font-semibold mb-2 text-gray-900 dark:text-gray-100">Current Statistics</h4>
    <div class="grid grid-cols-2 gap-3 text-sm">
      <div>
        <div class="text-gray-600 dark:text-gray-400 text-xs">Population</div>
        <div id="stat-population" class="font-mono text-lg">0</div>
      </div>
      <div>
        <div class="text-gray-600 dark:text-gray-400 text-xs">Activity</div>
        <div id="stat-activity" class="font-mono text-lg">0</div>
      </div>
      <div>
        <div class="text-gray-600 dark:text-gray-400 text-xs">Entropy 2×2</div>
        <div id="stat-entropy-2x2" class="font-mono text-lg">0.00</div>
      </div>
      <div>
        <div class="text-gray-600 dark:text-gray-400 text-xs">Entropy 4×4</div>
        <div id="stat-entropy-4x4" class="font-mono text-lg">0.00</div>
      </div>
      <div>
        <div class="text-gray-600 dark:text-gray-400 text-xs">Entropy 8×8</div>
        <div id="stat-entropy-8x8" class="font-mono text-lg">0.00</div>
      </div>
      <div>
        <div class="text-gray-600 dark:text-gray-400 text-xs">Interest</div>
        <div id="stat-interest" class="font-mono text-lg font-bold">0.0%</div>
      </div>
    </div>
  `
  const elements: SummaryPanelElements = {
    simName: root.querySelector('#sim-name') as HTMLSpanElement,
    simRule: root.querySelector('#sim-rule') as HTMLSpanElement,
    simSeed: root.querySelector('#sim-seed') as HTMLSpanElement,
    simSteps: root.querySelector('#sim-steps') as HTMLSpanElement,
    simTime: root.querySelector('#sim-time') as HTMLSpanElement,
    simSps: root.querySelector('#sim-sps') as HTMLSpanElement,
    statPopulation: root.querySelector('#stat-population') as HTMLDivElement,
    statActivity: root.querySelector('#stat-activity') as HTMLDivElement,
    statEntropy2x2: root.querySelector('#stat-entropy-2x2') as HTMLDivElement,
    statEntropy4x4: root.querySelector('#stat-entropy-4x4') as HTMLDivElement,
    statEntropy8x8: root.querySelector('#stat-entropy-8x8') as HTMLDivElement,
    statInterest: root.querySelector('#stat-interest') as HTMLDivElement,
  }

  return { root, elements }
}
