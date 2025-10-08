// src/components/simulation.ts

export interface SimulationPanelElements {
  canvas: HTMLCanvasElement
  btnStep: HTMLButtonElement
  btnReset: HTMLButtonElement
  btnPlay: HTMLButtonElement
  stepsPerSecondInput: HTMLInputElement
  aliveSlider: HTMLInputElement
  aliveValue: HTMLSpanElement
  radioCenterSeed: HTMLInputElement
  radioRandomSeed: HTMLInputElement
  radioPatchSeed: HTMLInputElement
}

export function createSimulationPanel(): {
  root: HTMLDivElement
  elements: SimulationPanelElements
} {
  const root = document.createElement('div')
  root.className = 'flex flex-col items-center gap-3'

  root.innerHTML = `
    <canvas id="simulation" width="400" height="400" class="border border-gray-300 dark:border-gray-600 w-80 h-80 lg:w-96 lg:h-96"></canvas>
    
    <div class="flex flex-wrap items-center gap-3">
      <div class="flex flex-col gap-2 p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-800">
        <label class="flex items-center gap-2 text-sm cursor-pointer px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
          <input type="radio" id="radio-random-seed" name="initial-condition" class="cursor-pointer" />
          <span>Random Seed (Full Grid)</span>
        </label>
        <label class="flex items-center gap-2 text-sm cursor-pointer px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
          <input type="radio" id="radio-patch-seed" name="initial-condition" checked class="cursor-pointer" />
          <span>Random Patch (10x10)</span>
        </label>
        <label class="flex items-center gap-2 text-sm cursor-pointer px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
          <input type="radio" id="radio-center-seed" name="initial-condition" class="cursor-pointer" />
          <span>Center Seed</span>
        </label>
      </div>
      <button id="btn-reset" class="px-4 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:ring-offset-2">
        Reset
      </button>
    </div>
    
    <div class="flex items-center gap-3 text-sm">
      <label for="alive-slider" class="min-w-16 text-right">Alive %:</label>
      <input type="range" id="alive-slider" min="0" max="100" value="50" class="w-48 cursor-pointer" />
      <span id="alive-value" class="min-w-12">50%</span>
    </div>
    
    <div class="flex items-center gap-3 text-sm">
      <button id="btn-step" class="px-4 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:ring-offset-2">
        Step
      </button>
      <button id="btn-play" class="px-4 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:ring-offset-2">
        Play
      </button>
      <label for="steps-per-second" class="ml-2">Steps/sec:</label>
      <input type="number" id="steps-per-second" min="1" max="60" value="10" class="w-16 px-2 py-1 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400" />
    </div>
  `

  const elements: SimulationPanelElements = {
    canvas: root.querySelector('#simulation') as HTMLCanvasElement,
    btnStep: root.querySelector('#btn-step') as HTMLButtonElement,
    btnReset: root.querySelector('#btn-reset') as HTMLButtonElement,
    btnPlay: root.querySelector('#btn-play') as HTMLButtonElement,
    stepsPerSecondInput: root.querySelector(
      '#steps-per-second',
    ) as HTMLInputElement,
    aliveSlider: root.querySelector('#alive-slider') as HTMLInputElement,
    aliveValue: root.querySelector('#alive-value') as HTMLSpanElement,
    radioCenterSeed: root.querySelector(
      '#radio-center-seed',
    ) as HTMLInputElement,
    radioRandomSeed: root.querySelector(
      '#radio-random-seed',
    ) as HTMLInputElement,
    radioPatchSeed: root.querySelector('#radio-patch-seed') as HTMLInputElement,
  }

  return { root, elements }
}
