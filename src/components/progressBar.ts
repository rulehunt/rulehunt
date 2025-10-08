// src/components/progress-bar.ts

export interface ProgressBarElements {
  root: HTMLDivElement
  label: HTMLSpanElement
  bar: HTMLDivElement
}

export function createProgressBar(initialValue = 0): {
  root: HTMLDivElement
  elements: ProgressBarElements
  set: (value: number) => void
  animateTo: (value: number, durationMs?: number) => void
  value: () => number
} {
  const root = document.createElement('div')
  root.className = 'w-full max-w-md flex flex-col gap-2'

  root.innerHTML = `
    <div class="flex justify-between text-sm text-gray-600 dark:text-gray-400">
      <span>Progress to 10,000 steps</span>
      <span id="progress-label">${initialValue}%</span>
    </div>
    <div
      id="progress-root"
      class="relative w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden"
      role="progressbar"
      aria-valuemin="0"
      aria-valuemax="100"
      aria-valuenow="${initialValue}"
    >
      <div id="progress-bar" class="h-full bg-blue-600 dark:bg-blue-500 transition-[width] duration-300 ease-out" style="width: ${initialValue}%"></div>
    </div>
  `

  const elements: ProgressBarElements = {
    root,
    label: root.querySelector('#progress-label') as HTMLSpanElement,
    bar: root.querySelector('#progress-bar') as HTMLDivElement,
  }

  function clamp(value: number): number {
    return Math.max(0, Math.min(100, value))
  }

  function set(value: number) {
    const v = clamp(value)
    elements.bar.style.width = `${v}%`
    elements.label.textContent = `${v}%`
    elements.root.setAttribute('aria-valuenow', v.toString())
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

  return { root, elements, set, animateTo, value }
}
