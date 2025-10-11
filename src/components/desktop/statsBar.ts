// src/components/desktop/statsBar.ts

export interface StatsBarElements {
  population: HTMLSpanElement
  activity: HTMLSpanElement
  interest: HTMLSpanElement
  steps: HTMLSpanElement
}

export interface StatsBarData {
  population: number
  activity: number
  interestScore: number
  stepCount: number
}

export function createStatsBar(): {
  root: HTMLDivElement
  elements: StatsBarElements
  update: (data: StatsBarData) => void
} {
  const root = document.createElement('div')
  root.className =
    'w-full mt-4 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900'

  root.innerHTML = `
    <div class="flex items-center justify-between gap-6 text-sm">
      <div class="flex items-center gap-2">
        <span class="text-gray-500 dark:text-gray-400">📊 Live Stats:</span>
      </div>

      <div class="flex items-center gap-6 flex-1">
        <div class="flex items-center gap-2">
          <span class="text-gray-600 dark:text-gray-400">Population:</span>
          <span id="stats-population" class="font-mono font-semibold text-gray-900 dark:text-white">0</span>
        </div>

        <div class="flex items-center gap-2">
          <span class="text-gray-600 dark:text-gray-400">Activity:</span>
          <span id="stats-activity" class="font-mono font-semibold text-gray-900 dark:text-white">0</span>
        </div>

        <div class="flex items-center gap-2">
          <span class="text-gray-600 dark:text-gray-400">Interest:</span>
          <span id="stats-interest" class="font-mono font-bold text-lg">0.0</span>
        </div>

        <div class="flex items-center gap-2 ml-auto">
          <span class="text-gray-600 dark:text-gray-400">Steps:</span>
          <span id="stats-steps" class="font-mono font-semibold text-gray-900 dark:text-white">0</span>
        </div>
      </div>
    </div>
  `

  const elements: StatsBarElements = {
    population: root.querySelector('#stats-population') as HTMLSpanElement,
    activity: root.querySelector('#stats-activity') as HTMLSpanElement,
    interest: root.querySelector('#stats-interest') as HTMLSpanElement,
    steps: root.querySelector('#stats-steps') as HTMLSpanElement,
  }

  function update(data: StatsBarData) {
    elements.population.textContent = data.population.toString()
    elements.activity.textContent = data.activity.toString()
    elements.interest.textContent = data.interestScore.toFixed(1)
    elements.steps.textContent = data.stepCount.toString()

    // Color-code interest score
    const interest = data.interestScore
    if (interest >= 8) {
      elements.interest.className = 'font-mono font-bold text-lg text-green-600 dark:text-green-400'
    } else if (interest >= 5) {
      elements.interest.className = 'font-mono font-bold text-lg text-yellow-600 dark:text-yellow-400'
    } else {
      elements.interest.className = 'font-mono font-bold text-lg text-gray-600 dark:text-gray-400'
    }
  }

  return { root, elements, update }
}
