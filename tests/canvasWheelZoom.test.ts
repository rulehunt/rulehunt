/**
 * Tests for setupCanvasWheelZoom (mouse wheel zoom over the simulation canvas)
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CellularAutomata } from '../src/cellular-automata-cpu'
import { setupCanvasWheelZoom } from '../src/components/desktop/events/miscHandlers'
import { createZoomSlider } from '../src/components/desktop/zoomSlider'

/** Minimal CA stub exposing only what the wheel handler touches. */
function createAutomataStub() {
  let zoom = 1
  return {
    setZoom: vi.fn((level: number) => {
      zoom = level
    }),
    getZoom: vi.fn(() => zoom),
    render: vi.fn(),
  }
}

function setup(initial = 1) {
  const canvas = document.createElement('canvas')
  const zoomSlider = createZoomSlider({ initial, min: 1, max: 100 })
  const automata = createAutomataStub()
  const tracked: Array<{
    target: EventTarget
    type: string
    listener: EventListener
    options?: AddEventListenerOptions
  }> = []

  const addEventListener = (
    target: EventTarget,
    type: string,
    listener: EventListener,
    options?: AddEventListenerOptions,
  ) => {
    target.addEventListener(type, listener, options)
    tracked.push({ target, type, listener, options })
  }

  setupCanvasWheelZoom(
    canvas,
    zoomSlider,
    automata as unknown as CellularAutomata,
    addEventListener,
  )

  return { canvas, zoomSlider, automata, tracked }
}

/** Dispatch a wheel event and report whether the default was prevented. */
function wheel(canvas: HTMLCanvasElement, deltaY: number): boolean {
  const event = new WheelEvent('wheel', { deltaY, cancelable: true })
  canvas.dispatchEvent(event)
  return event.defaultPrevented
}

describe('setupCanvasWheelZoom', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('zooms in when the wheel scrolls up', () => {
    const { canvas, zoomSlider, automata } = setup(10)

    wheel(canvas, -100)

    expect(zoomSlider.value()).toBeGreaterThan(10)
    expect(automata.setZoom).toHaveBeenCalledWith(zoomSlider.value())
    expect(automata.render).toHaveBeenCalled()
  })

  it('zooms out when the wheel scrolls down', () => {
    const { canvas, zoomSlider, automata } = setup(10)

    wheel(canvas, 100)

    expect(zoomSlider.value()).toBeLessThan(10)
    expect(automata.setZoom).toHaveBeenCalledWith(zoomSlider.value())
  })

  it('keeps the slider display in sync with the wheel zoom', () => {
    const { canvas, zoomSlider } = setup(10)

    wheel(canvas, -100)

    const value = zoomSlider.value()
    expect(zoomSlider.elements.slider.value).toBe(String(value))
    expect(zoomSlider.elements.valueDisplay.textContent).toBe(`${value}x`)
  })

  it('always moves at least one step at the low end of the range', () => {
    const { canvas, zoomSlider } = setup(1)

    wheel(canvas, -100)

    expect(zoomSlider.value()).toBe(2)
  })

  it('clamps to the slider maximum', () => {
    const { canvas, zoomSlider, automata } = setup(100)

    for (let i = 0; i < 5; i++) wheel(canvas, -100)

    expect(zoomSlider.value()).toBe(100)
    expect(automata.setZoom).not.toHaveBeenCalled()
  })

  it('clamps to the slider minimum', () => {
    const { canvas, zoomSlider, automata } = setup(1)

    for (let i = 0; i < 5; i++) wheel(canvas, 100)

    expect(zoomSlider.value()).toBe(1)
    expect(automata.setZoom).not.toHaveBeenCalled()
  })

  it('prevents the page from scrolling over the canvas', () => {
    const { canvas } = setup(10)

    expect(wheel(canvas, -100)).toBe(true)
  })

  it('ignores wheel events with no vertical delta', () => {
    const { canvas, zoomSlider, automata } = setup(10)

    wheel(canvas, 0)

    expect(zoomSlider.value()).toBe(10)
    expect(automata.setZoom).not.toHaveBeenCalled()
  })

  it('registers a non-passive wheel listener through the tracked wrapper', () => {
    const { canvas, tracked } = setup()

    expect(tracked).toHaveLength(1)
    expect(tracked[0].target).toBe(canvas)
    expect(tracked[0].type).toBe('wheel')
    expect(tracked[0].options).toEqual({ passive: false })
  })

  it('stops zooming once the tracked listener is removed', () => {
    const { canvas, zoomSlider, tracked } = setup(10)

    for (const { target, type, listener, options } of tracked) {
      target.removeEventListener(type, listener, options)
    }
    wheel(canvas, -100)

    expect(zoomSlider.value()).toBe(10)
  })
})
