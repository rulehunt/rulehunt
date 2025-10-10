// src/components/zoomSlider.ts

export interface ZoomSliderElements {
  slider: HTMLInputElement
  plusButton: HTMLButtonElement
  minusButton: HTMLButtonElement
  valueDisplay: HTMLSpanElement
}

export interface ZoomSliderOptions {
  min?: number
  max?: number
  initial?: number
  step?: number
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

export function createZoomSlider(options: ZoomSliderOptions = {}): {
  root: HTMLDivElement
  elements: ZoomSliderElements
  set: (value: number) => void
  value: () => number
} {
  const min = options.min ?? 1
  const max = options.max ?? 100
  const initial = options.initial ?? 1
  const step = options.step ?? 1

  const root = document.createElement('div')
  root.className =
    'flex flex-col items-center justify-between h-80 lg:h-96 py-4 px-3 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm rounded-lg border border-gray-300 dark:border-gray-600 shadow-sm'

  root.innerHTML = `
    <button
      id="zoom-plus"
      class="w-10 h-10 mb-3 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-bold text-xl"
      title="Zoom in"
      aria-label="Zoom in"
    >
      +
    </button>

    <div class="flex flex-col items-center flex-1 justify-center gap-2 my-2">
      <input
        type="range"
        id="zoom-slider"
        min="${min}"
        max="${max}"
        value="${initial}"
        step="${step}"
        orient="vertical"
        class="flex-1 cursor-pointer [writing-mode:vertical-lr] [direction:rtl]"
        style="-webkit-appearance: slider-vertical;"
        aria-label="Zoom level"
        aria-valuemin="${min}"
        aria-valuemax="${max}"
        aria-valuenow="${initial}"
      />
      <span
        id="zoom-value"
        class="text-sm font-medium text-gray-700 dark:text-gray-300 min-w-[3ch] text-center"
      >${initial}x</span>
    </div>

    <button
      id="zoom-minus"
      class="w-10 h-10 mt-3 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-bold text-xl"
      title="Zoom out"
      aria-label="Zoom out"
    >
      −
    </button>
  `

  const elements: ZoomSliderElements = {
    slider: root.querySelector('#zoom-slider') as HTMLInputElement,
    plusButton: root.querySelector('#zoom-plus') as HTMLButtonElement,
    minusButton: root.querySelector('#zoom-minus') as HTMLButtonElement,
    valueDisplay: root.querySelector('#zoom-value') as HTMLSpanElement,
  }

  // Internal state
  let currentValue = initial

  // Update display
  function updateDisplay(value: number) {
    currentValue = clamp(value, min, max)
    elements.slider.value = currentValue.toString()
    elements.slider.setAttribute('aria-valuenow', currentValue.toString())
    elements.valueDisplay.textContent = `${currentValue}x`
  }

  // Set value programmatically
  function set(value: number) {
    updateDisplay(value)
  }

  // Get current value
  function getValue(): number {
    return currentValue
  }

  // Event handlers
  elements.slider.addEventListener('input', () => {
    const value = Number.parseInt(elements.slider.value, 10)
    updateDisplay(value)
  })

  elements.plusButton.addEventListener('click', () => {
    const newValue = currentValue + step
    if (newValue <= max) {
      updateDisplay(newValue)
    }
  })

  elements.minusButton.addEventListener('click', () => {
    const newValue = currentValue - step
    if (newValue >= min) {
      updateDisplay(newValue)
    }
  })

  return {
    root,
    elements,
    set,
    value: getValue,
  }
}
