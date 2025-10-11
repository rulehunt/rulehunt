// src/components/progressBar.ts

export interface ProgressBarElements {
  root: HTMLDivElement
  label: HTMLSpanElement
  bar: HTMLDivElement
  saveButton?: HTMLButtonElement
}

export interface ProgressBarOptions {
  initialValue?: number
  buttonLabel?: string
}

export function createProgressBar(options: ProgressBarOptions = {}): {
  root: HTMLDivElement
  elements: ProgressBarElements
  set: (value: number) => void
  animateTo: (value: number, durationMs?: number) => void
  value: () => number
} {
  const { initialValue = 0, buttonLabel } = options

  const root = document.createElement('div')
  root.className = 'w-full max-w-7xl mx-auto px-6 flex flex-col gap-2'

  root.innerHTML = `
    <div class="flex justify-between text-sm text-gray-600 dark:text-gray-400">
      <span>Progress to save this simulation to the leaderboard</span>
      <span id="progress-label">${initialValue}%</span>
    </div>
    <div class="flex items-center gap-2 w-full">
      <div
        id="progress-root"
        class="relative h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden flex-[9]"
        role="progressbar"
        aria-valuemin="0"
        aria-valuemax="100"
        aria-valuenow="${initialValue}"
      >
        <div id="progress-bar" class="h-full bg-blue-600 dark:bg-blue-500 transition-[width] duration-300 ease-out" style="width: ${initialValue}%"></div>
      </div>
      ${
        buttonLabel
          ? `
      <button
        id="progress-save-button"
        disabled
        class="flex-1 px-2 py-1 rounded-md text-sm font-medium transition-all
               disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed
               enabled:bg-blue-600 enabled:text-white enabled:hover:bg-blue-700 enabled:active:scale-95"
      >
        ${buttonLabel}
      </button>
      `
          : ''
      }
    </div>
  `

  const elements: ProgressBarElements = {
    root,
    label: root.querySelector('#progress-label') as HTMLSpanElement,
    bar: root.querySelector('#progress-bar') as HTMLDivElement,
  }

  if (buttonLabel) {
    elements.saveButton = root.querySelector(
      '#progress-save-button',
    ) as HTMLButtonElement
  }

  function clamp(value: number): number {
    return Math.max(0, Math.min(100, value))
  }

  function set(value: number) {
    const v = clamp(value)
    elements.bar.style.width = `${v}%`
    elements.label.textContent = `${v}%`
    elements.root.setAttribute('aria-valuenow', v.toString())

    // Enable button when progress reaches 100%
    if (elements.saveButton) {
      elements.saveButton.disabled = v < 100
    }
  }

  function animateTo(value: number, durationMs = 300) {
    const v = clamp(value)
    const bar = elements.bar
    const prevTransition = bar.style.transition
    bar.style.transition = `width ${durationMs}ms ease-out`
    requestAnimationFrame(() => {
      set(v)
      setTimeout(() => {
        bar.style.transition = prevTransition
      }, durationMs)
    })
  }

  function value(): number {
    return clamp(Number(elements.root.getAttribute('aria-valuenow') || '0'))
  }

  // Set initial state
  set(initialValue)

  return { root, elements, set, animateTo, value }
}
