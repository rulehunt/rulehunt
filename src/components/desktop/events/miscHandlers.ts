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
