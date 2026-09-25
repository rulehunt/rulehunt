// src/components/desktop/events/miscHandlers.ts

import type { CellularAutomata } from '../../../cellular-automata-cpu.ts'
import type { createZoomSlider } from '../zoomSlider.ts'

/**
 * Setup handlers for zoom control buttons
 */
export function setupZoomHandlers(
  zoomSlider: ReturnType<typeof createZoomSlider>,
  cellularAutomata: CellularAutomata,
) {
  zoomSlider.elements.slider.addEventListener('input', () => {
    const zoomLevel = zoomSlider.value()
    cellularAutomata.setZoom(zoomLevel)
    cellularAutomata.render()
  })

  zoomSlider.elements.plusButton.addEventListener('click', () => {
    const zoomLevel = zoomSlider.value()
    cellularAutomata.setZoom(zoomLevel)
    cellularAutomata.render()
  })

  zoomSlider.elements.minusButton.addEventListener('click', () => {
    const zoomLevel = zoomSlider.value()
    cellularAutomata.setZoom(zoomLevel)
    cellularAutomata.render()
  })
}

/**
 * Multiplicative step applied per wheel tick.
 *
 * Multiplicative stepping keeps the perceived zoom rate constant across the
 * whole 1-100 range; a fixed linear step feels coarse near 1x and glacial
 * near 100x.
 */
const WHEEL_ZOOM_FACTOR = 1.15

/**
 * Setup mouse wheel zoom on the simulation canvas.
 *
 * Scrolling up over the canvas zooms in, scrolling down zooms out. The zoom
 * slider is kept in sync so all zoom controls agree, and the value is clamped
 * to the slider's own min/max so the wheel can never exceed its range.
 *
 * The listener is registered through the caller-supplied tracked
 * `addEventListener` wrapper so it is torn down with the rest of the layout.
 * It is registered with `{ passive: false }` because the handler calls
 * `preventDefault()` to stop the page scrolling while the pointer is over the
 * canvas.
 */
export function setupCanvasWheelZoom(
  canvas: HTMLCanvasElement,
  zoomSlider: ReturnType<typeof createZoomSlider>,
  cellularAutomata: CellularAutomata,
  addEventListener: (
    target: EventTarget,
    type: string,
    listener: EventListener,
    options?: AddEventListenerOptions,
  ) => void,
) {
  const slider = zoomSlider.elements.slider
  const min = Number.parseInt(slider.min, 10) || 1
  const max = Number.parseInt(slider.max, 10) || 100

  const wheelHandler = (event: WheelEvent) => {
    // Only over the canvas: keep the page from scrolling while zooming.
    event.preventDefault()

    if (event.deltaY === 0) return

    // deltaY < 0 is scroll up. Only the sign matters, so trackpads and
    // line/page deltaMode values behave the same as a mouse wheel.
    const zoomIn = event.deltaY < 0
    const current = zoomSlider.value()
    const scaled = zoomIn
      ? current * WHEEL_ZOOM_FACTOR
      : current / WHEEL_ZOOM_FACTOR
    // Zoom levels are integers, so round away from `current` to guarantee
    // every tick moves at least one step (1 * 1.15 would otherwise round
    // back to 1 and the wheel would appear dead at the low end).
    const stepped = zoomIn
      ? Math.max(Math.round(scaled), current + 1)
      : Math.min(Math.round(scaled), current - 1)
    const next = Math.max(min, Math.min(max, stepped))

    if (next === current) return

    // `set()` does not fire the slider's input event, so drive the CA
    // explicitly -- same pair of calls the slider handlers above make, which
    // keeps the zoom interpolation identical for both input paths.
    zoomSlider.set(next)
    cellularAutomata.setZoom(next)
    cellularAutomata.render()
  }

  addEventListener(canvas, 'wheel', wheelHandler as EventListener, {
    passive: false,
  })
}

/**
 * Setup handler for benchmark button
 */
export function setupBenchmarkHandler(
  btnBenchmark: HTMLButtonElement,
  openBenchmarkModal: () => void,
) {
  btnBenchmark.addEventListener('click', () => {
    openBenchmarkModal()
  })
}

/**
 * Setup handler for headless mode button
 */
export function setupHeadlessHandler(
  btnHeadless: HTMLButtonElement,
  openDataModeLayout: () => void,
) {
  btnHeadless.addEventListener('click', () => {
    openDataModeLayout()
  })
}
