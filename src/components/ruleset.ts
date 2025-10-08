// src/components/ruleset.ts

export interface RulesetPanelElements {
  canvas: HTMLCanvasElement
  ruleLabel: HTMLHeadingElement
  ruleId: HTMLHeadingElement
  btnConway: HTMLButtonElement
  btnOutlier: HTMLButtonElement
  btnRandomC4Ruleset: HTMLButtonElement
  orbitSlider: HTMLInputElement
  orbitValue: HTMLSpanElement
  radioDisplayOrbits: HTMLInputElement
  radioDisplayFull: HTMLInputElement
}

export function createRulesetPanel(): {
  root: HTMLDivElement
  elements: RulesetPanelElements
} {
  const root = document.createElement('div')
  root.className = 'flex flex-col items-center'

  root.innerHTML = `
    <h2 id="rule-label" class="font-mono font-medium tracking-wide mb-3 w-full text-center truncate">
      loading rule name...
    </h2>

    <h2 id="rule-id" class="font-mono font-medium tracking-wide mb-3 w-full text-center truncate">
      loading rule id...
    </h2>
    
    <canvas id="truth" width="512" height="256" class="border border-gray-300 dark:border-gray-600 w-96 h-48 lg:w-[512px] lg:h-64"></canvas>
    
    <div class="mt-3 flex flex-wrap gap-3 justify-center">
      <button id="btn-conway" class="px-4 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:ring-offset-2">
        Conway
      </button>
      <button id="btn-outlier" class="px-4 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:ring-offset-2">
        Outlier
      </button>
      <button id="btn-random-c4-ruleset" class="px-4 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:ring-offset-2">
        Random
      </button>
    </div>
    
    <div class="mt-3 flex items-center gap-3 text-sm">
      <label for="orbit-slider" class="min-w-16 text-right">Orbit %:</label>
      <input type="range" id="orbit-slider" min="0" max="100" value="50" class="w-48 cursor-pointer" />
      <span id="orbit-value" class="min-w-12">50%</span>
    </div>
    
    <div class="mt-3 flex flex-col gap-2 p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-800">
      <label class="flex items-center gap-2 text-sm cursor-pointer px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
        <input type="radio" id="radio-display-orbits" name="display-mode" checked class="cursor-pointer" />
        <span>C4 Orbits (10x14)</span>
      </label>
      <label class="flex items-center gap-2 text-sm cursor-pointer px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
        <input type="radio" id="radio-display-full" name="display-mode" class="cursor-pointer" />
        <span>Full Table (32x16)</span>
      </label>
    </div>
  `

  const elements: RulesetPanelElements = {
    canvas: root.querySelector('#truth') as HTMLCanvasElement,
    ruleLabel: root.querySelector('#rule-label') as HTMLHeadingElement,
    ruleId: root.querySelector('#rule-id') as HTMLHeadingElement,
    btnConway: root.querySelector('#btn-conway') as HTMLButtonElement,
    btnOutlier: root.querySelector('#btn-outlier') as HTMLButtonElement,
    btnRandomC4Ruleset: root.querySelector(
      '#btn-random-c4-ruleset',
    ) as HTMLButtonElement,
    orbitSlider: root.querySelector('#orbit-slider') as HTMLInputElement,
    orbitValue: root.querySelector('#orbit-value') as HTMLSpanElement,
    radioDisplayOrbits: root.querySelector(
      '#radio-display-orbits',
    ) as HTMLInputElement,
    radioDisplayFull: root.querySelector(
      '#radio-display-full',
    ) as HTMLInputElement,
  }

  return { root, elements }
}
