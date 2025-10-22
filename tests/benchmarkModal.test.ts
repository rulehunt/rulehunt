/**
 * Tests for benchmarkModal.ts
 */

import { beforeEach, describe, expect, it } from 'vitest'
import {
  createBenchmarkModal,
  hideModal,
  showModal,
  showProgressBar,
  updateProgress,
} from '../src/components/desktop/benchmarkModal'

describe('benchmarkModal', () => {
  beforeEach(() => {
    // Clean up the DOM before each test
    document.body.innerHTML = ''
  })

  describe('createBenchmarkModal', () => {
    it('should create all required DOM elements', () => {
      const elements = createBenchmarkModal()

      expect(elements.overlay).toBeInstanceOf(HTMLDivElement)
      expect(elements.modal).toBeInstanceOf(HTMLDivElement)
      expect(elements.header).toBeInstanceOf(HTMLDivElement)
      expect(elements.title).toBeInstanceOf(HTMLHeadingElement)
      expect(elements.closeBtn).toBeInstanceOf(HTMLButtonElement)
      expect(elements.content).toBeInstanceOf(HTMLDivElement)
      expect(elements.buttonContainer).toBeInstanceOf(HTMLDivElement)
      expect(elements.clearBtn).toBeInstanceOf(HTMLButtonElement)
      expect(elements.infoText).toBeInstanceOf(HTMLDivElement)
      expect(elements.progressArea).toBeInstanceOf(HTMLDivElement)
      expect(elements.progressBar).toBeInstanceOf(HTMLDivElement)
      expect(elements.progressFill).toBeInstanceOf(HTMLDivElement)
      expect(elements.progressText).toBeInstanceOf(HTMLDivElement)
      expect(elements.chartContainer).toBeInstanceOf(HTMLDivElement)
      expect(elements.chartCanvas).toBeInstanceOf(HTMLCanvasElement)
      expect(elements.resultsArea).toBeInstanceOf(HTMLDivElement)
    })

    it('should have correct modal title', () => {
      const elements = createBenchmarkModal()

      expect(elements.title.textContent).toBe('GPU vs CPU Benchmark')
    })

    it('should have correct close button text', () => {
      const elements = createBenchmarkModal()

      expect(elements.closeBtn.textContent).toBe('×')
    })

    it('should have correct clear button text', () => {
      const elements = createBenchmarkModal()

      expect(elements.clearBtn.textContent).toBe('Clear Data')
    })

    it('should have overlay initially hidden', () => {
      const elements = createBenchmarkModal()

      expect(elements.overlay.style.display).toBe('none')
    })

    it('should have progress bar initially hidden', () => {
      const elements = createBenchmarkModal()

      expect(elements.progressBar.style.display).toBe('none')
    })

    it('should have progress fill at 0% width', () => {
      const elements = createBenchmarkModal()

      expect(elements.progressFill.style.width).toBe('0%')
    })
  })

  describe('showModal', () => {
    it('should make overlay visible', () => {
      const elements = createBenchmarkModal()
      showModal(elements)

      expect(elements.overlay.style.display).toBe('flex')
    })
  })

  describe('hideModal', () => {
    it('should hide overlay', () => {
      const elements = createBenchmarkModal()
      showModal(elements) // First show it
      hideModal(elements)

      expect(elements.overlay.style.display).toBe('none')
    })
  })

  describe('showProgressBar', () => {
    it('should make progress bar visible', () => {
      const elements = createBenchmarkModal()
      showProgressBar(elements)

      expect(elements.progressBar.style.display).toBe('block')
    })
  })

  describe('updateProgress', () => {
    it('should update progress fill width and text', () => {
      const elements = createBenchmarkModal()
      updateProgress(elements, 50, 'Testing in progress...')

      expect(elements.progressFill.style.width).toBe('50%')
      expect(elements.progressText.textContent).toBe('Testing in progress...')
    })

    it('should handle 0% progress', () => {
      const elements = createBenchmarkModal()
      updateProgress(elements, 0, 'Starting...')

      expect(elements.progressFill.style.width).toBe('0%')
      expect(elements.progressText.textContent).toBe('Starting...')
    })

    it('should handle 100% progress', () => {
      const elements = createBenchmarkModal()
      updateProgress(elements, 100, 'Complete!')

      expect(elements.progressFill.style.width).toBe('100%')
      expect(elements.progressText.textContent).toBe('Complete!')
    })
  })
})
