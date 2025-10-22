// src/components/mobile/events/swipeHandlers.ts

import type { CleanupFunction } from '../../../types'

/**
 * Swipe gesture configuration constants
 */
export const SWIPE_COMMIT_THRESHOLD_PERCENT = 0.1 // 10% of screen height
export const SWIPE_COMMIT_MIN_DISTANCE = 50 // 50px minimum
export const SWIPE_VELOCITY_THRESHOLD = -0.3 // pixels/ms
export const SWIPE_FAST_THROW_THRESHOLD = -0.5 // pixels/ms for fast flicks

/**
 * Callbacks for swipe gesture events.
 * These callbacks are invoked during different phases of the swipe lifecycle.
 */
export interface SwipeGestureCallbacks {
  /** Called when a swipe gesture is committed (user confirms navigation) */
  onCommit: () => void
  /** Called when a swipe gesture is cancelled (user releases without committing) */
  onCancel: () => void
  /** Optional: Called when drag starts (useful for pausing animations) */
  onDragStart?: () => void
}

/**
 * Module-level state interface for tracking swipe system state.
 * These values are managed by the parent and passed via accessors.
 */
export interface SwipeModuleState {
  /** Accessor to check if a transition is currently in progress */
  isTransitioning: () => boolean
  /** Setter to update the transition state */
  setIsTransitioning: (value: boolean) => void
  /** Accessor to check if offscreen content is ready for swiping */
  isOffscreenReady: () => boolean
  /** Accessor to get the current swipe lock timestamp */
  getSwipeLockUntil: () => number
  /** Setter to update the swipe lock timestamp */
  setSwipeLockUntil: (timestamp: number) => void
  /** Accessor to get the current gesture ID */
  getGestureId: () => number
  /** Setter to increment and return the new gesture ID */
  incrementGestureId: () => number
}

/**
 * Creates a dual-canvas swipe handler for TikTok-style vertical swipe transitions.
 *
 * ## Swipe Flow (timing carefully orchestrated to prevent flashing):
 * 1. Touch start → pause onScreen CA (both canvases now static)
 * 2. Touch move → animate both static canvases (TikTok-style scroll)
 * 3. Commit decision → run transition animation (incoming canvas already has next rule)
 * 4. After animation → wait one frame, then onCommit swaps references
 * 5. onCommit defers CA operations by 16ms to let browser finish compositing:
 *    - Starts playing new onScreen CA
 *    - Prepares offScreen canvas with fresh rule for NEXT swap
 *
 * This timing eliminates race conditions and prevents visible flashes.
 *
 * @param wrapper - Container element that receives touch events
 * @param canvas1 - First canvas element
 * @param canvas2 - Second canvas element
 * @param callbacks - Lifecycle callbacks (onCommit, onCancel, onDragStart)
 * @param state - Module-level state accessors for transition tracking
 * @returns Cleanup function to remove event listeners
 */
export function setupDualCanvasSwipe(
  wrapper: HTMLElement,
  canvas1: HTMLCanvasElement,
  canvas2: HTMLCanvasElement,
  callbacks: SwipeGestureCallbacks,
  state: SwipeModuleState,
): CleanupFunction {
  const { onCommit, onCancel, onDragStart } = callbacks

  // Track which canvas is currently on-screen (true = canvas1, false = canvas2)
  let canvas1IsOnScreen = true

  let startY = 0
  let currentY = 0
  let startT = 0
  let dragging = false
  let directionLocked: 'up' | 'down' | null = null
  let pausedForDrag = false

  const samples: { t: number; y: number }[] = []
  const getHeight = () => wrapper.clientHeight

  // Helper to get current canvas roles based on tracking variable
  const getCurrentCanvases = () => {
    return canvas1IsOnScreen
      ? { onScreen: canvas1, offScreen: canvas2 }
      : { onScreen: canvas2, offScreen: canvas1 }
  }

  const resetTransforms = (h: number) => {
    const { onScreen, offScreen } = getCurrentCanvases()
    onScreen.style.transform = 'translateY(0)'
    offScreen.style.transform = `translateY(${h}px)`
  }

  function waitForTransitionEndScoped(
    el: HTMLElement,
    id: number,
  ): Promise<void> {
    return new Promise((resolve) => {
      const done = (ev: TransitionEvent) => {
        el.removeEventListener('transitionend', done)
        if (ev.propertyName === 'transform' && id === state.getGestureId()) {
          resolve()
        }
      }
      el.addEventListener('transitionend', done)
    })
  }

  const handleTouchStart = (e: TouchEvent) => {
    if (!state.isOffscreenReady()) return

    const now = performance.now()

    if (now < state.getSwipeLockUntil()) {
      e.preventDefault()
      e.stopPropagation()
      return
    }

    const target = e.target as HTMLElement | null
    if (
      target?.closest(
        '[data-swipe-ignore="true"], button, a, input, select, textarea',
      )
    ) {
      return
    }

    if (e.touches.length !== 1) return
    if (state.isTransitioning()) return

    state.incrementGestureId()

    startY = e.touches[0].clientY
    currentY = startY
    startT = e.timeStamp
    directionLocked = null
    dragging = true
    pausedForDrag = false
    samples.length = 0
    samples.push({ t: startT, y: startY })

    const { onScreen, offScreen } = getCurrentCanvases()
    wrapper.style.transition = 'none'
    onScreen.style.transition = 'none'
    offScreen.style.transition = 'none'
  }

  const handleTouchMove = (e: TouchEvent) => {
    if (!dragging || e.touches.length !== 1) return
    const y = e.touches[0].clientY
    const dy = y - startY
    const absDy = Math.abs(dy)

    // Lock direction with a little hysteresis
    if (!directionLocked && absDy > 8) {
      directionLocked = dy < 0 ? 'up' : 'down'
      // Pause only when we know it's an upward swipe (real intent)
      if (directionLocked === 'up' && !pausedForDrag) {
        onDragStart?.()
        pausedForDrag = true
      }
    }

    // Reject downward gestures early & visibly snap back
    if (directionLocked === 'down') {
      dragging = false
      const h = getHeight()
      resetTransforms(h)
      onCancel()
      return
    }

    currentY = y
    samples.push({ t: e.timeStamp, y })
    const cutoff = e.timeStamp - 100
    while (samples.length > 2 && samples[0].t < cutoff) samples.shift()

    const delta = Math.min(0, dy)
    const height = getHeight()

    const { onScreen, offScreen } = getCurrentCanvases()
    onScreen.style.transform = `translateY(${delta}px)`
    offScreen.style.transform = `translateY(${height + delta}px)`
  }

  const doCancel = async () => {
    const { onScreen, offScreen } = getCurrentCanvases()
    const height = getHeight()
    const duration = 0.25
    const transition = `transform ${duration}s cubic-bezier(0.4,0,0.2,1)`

    const targetOnScreen = 'translateY(0)'
    const targetOffScreen = `translateY(${height}px)`

    const curOnScreen = onScreen.style.transform || ''
    const curOffScreen = offScreen.style.transform || ''

    // Fast path: already in place — skip transitions entirely
    if (curOnScreen === targetOnScreen && curOffScreen === targetOffScreen) {
      onScreen.style.transition = 'none'
      offScreen.style.transition = 'none'
      onCancel()
      return
    }

    onScreen.style.transition = transition
    offScreen.style.transition = transition
    onScreen.style.transform = targetOnScreen
    offScreen.style.transform = targetOffScreen

    // Safety timeout in case transitionend never fires
    const timeout = new Promise<void>((resolve) =>
      setTimeout(resolve, duration * 1000 + 50),
    )

    await Promise.race([
      Promise.all([
        waitForTransitionEndScoped(onScreen, state.getGestureId()),
        waitForTransitionEndScoped(offScreen, state.getGestureId()),
      ]),
      timeout,
    ])

    onScreen.style.transition = 'none'
    offScreen.style.transition = 'none'
    onCancel()
  }

  const handleTouchEndCore = async (forceCancel = false) => {
    const wasDragging = dragging
    const lockedDirection = directionLocked
    dragging = false

    const delta = currentY - startY
    const dragDistance = Math.abs(delta)
    const tinyAccidentalMove = dragDistance < 15

    if (
      !wasDragging ||
      forceCancel ||
      lockedDirection === 'down' ||
      tinyAccidentalMove
    ) {
      await doCancel()
      state.setSwipeLockUntil(performance.now() + 350)
      return
    }

    const height = getHeight()

    // Compute velocity
    let vy = 0
    if (samples.length >= 2) {
      const a = samples[0]
      const b = samples[samples.length - 1]
      const dt = Math.max(1, b.t - a.t)
      vy = (b.y - a.y) / dt
    }

    const slowPullback = delta > 0
    const fastFlick = vy < SWIPE_FAST_THROW_THRESHOLD
    const normalFlick =
      dragDistance > height * SWIPE_COMMIT_THRESHOLD_PERCENT ||
      (dragDistance > SWIPE_COMMIT_MIN_DISTANCE &&
        vy < SWIPE_VELOCITY_THRESHOLD)

    const shouldCommit =
      height > 0 &&
      dragDistance > 0 &&
      !tinyAccidentalMove &&
      !slowPullback &&
      (fastFlick || normalFlick)

    // Fast path for taps: if almost no drag, skip animations entirely
    if (!shouldCommit && tinyAccidentalMove) {
      const { onScreen, offScreen } = getCurrentCanvases()
      const h = getHeight()
      onScreen.style.transition = 'none'
      offScreen.style.transition = 'none'
      onScreen.style.transform = 'translateY(0)'
      offScreen.style.transform = `translateY(${h}px)`
      onCancel()
      return
    }

    const { onScreen, offScreen } = getCurrentCanvases()
    const duration = shouldCommit ? 0.35 : 0.25
    const transition = `transform ${duration}s cubic-bezier(0.4,0,0.2,1)`
    onScreen.style.transition = transition
    offScreen.style.transition = transition
    void onScreen.offsetWidth

    state.setIsTransitioning(true)

    if (shouldCommit) {
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      const bgColor = isDark ? '#111827' : '#ffffff' // gray-900 : white

      requestAnimationFrame(() => {
        // Explicitly fill background before rendering to prevent black flash
        const ctx = offScreen.getContext('2d')
        if (ctx) {
          ctx.save()
          ctx.fillStyle = bgColor
          ctx.fillRect(0, 0, offScreen.width, offScreen.height)
          ctx.restore()
        }
      })

      // Normal upward slide
      onScreen.style.transform = `translateY(-${height}px)`
      offScreen.style.transform = 'translateY(0)'

      await Promise.all([
        waitForTransitionEndScoped(onScreen, state.getGestureId()),
        waitForTransitionEndScoped(offScreen, state.getGestureId()),
      ])

      onScreen.style.transition = 'none'
      offScreen.style.transition = 'none'
      onScreen.style.transform = `translateY(-${height}px)`
      offScreen.style.transform = 'translateY(0)'

      // Toggle the tracking flag BEFORE calling onCommit
      canvas1IsOnScreen = !canvas1IsOnScreen

      requestAnimationFrame(() => onCommit())
    } else {
      await doCancel()
    }

    state.setIsTransitioning(false)
    state.setSwipeLockUntil(performance.now() + 350)
  }

  const handleTouchEnd = (_: TouchEvent) => {
    void handleTouchEndCore(false)
  }
  const handleTouchCancel = (_: TouchEvent) => {
    void handleTouchEndCore(true)
  }

  // Mouse event handlers (for desktop testing)
  const handleMouseDown = (e: MouseEvent) => {
    // Check if clicking on button or other interactive element (same as touch handler)
    const target = e.target as HTMLElement | null
    if (
      target?.closest(
        '[data-swipe-ignore="true"], button, a, input, select, textarea',
      )
    ) {
      return
    }

    // Convert mouse event to touch-like event
    const fakeTouch = {
      ...e,
      touches: [
        {
          clientX: e.clientX,
          clientY: e.clientY,
        } as Touch,
      ] as unknown as TouchList,
    } as unknown as TouchEvent
    handleTouchStart(fakeTouch)
  }

  const handleMouseMove = (e: MouseEvent) => {
    if (!dragging) return
    const fakeTouch = {
      ...e,
      touches: [
        {
          clientX: e.clientX,
          clientY: e.clientY,
        } as Touch,
      ] as unknown as TouchList,
    } as unknown as TouchEvent
    handleTouchMove(fakeTouch)
  }

  const handleMouseUp = (e: MouseEvent) => {
    if (!dragging) return
    const fakeTouch = e as unknown as TouchEvent
    handleTouchEnd(fakeTouch)
  }

  // Add both touch and mouse event listeners
  // touchstart NOT passive so we can preventDefault() during swipe lock
  // touchmove CAN be passive since we never preventDefault() on it
  wrapper.addEventListener('touchstart', handleTouchStart, { passive: false })
  wrapper.addEventListener('touchmove', handleTouchMove, { passive: true })
  wrapper.addEventListener('touchend', handleTouchEnd, { passive: true })
  wrapper.addEventListener('touchcancel', handleTouchCancel, { passive: true })

  wrapper.addEventListener('mousedown', handleMouseDown)
  window.addEventListener('mousemove', handleMouseMove)
  window.addEventListener('mouseup', handleMouseUp)

  return () => {
    wrapper.removeEventListener('touchstart', handleTouchStart)
    wrapper.removeEventListener('touchmove', handleTouchMove)
    wrapper.removeEventListener('touchend', handleTouchEnd)
    wrapper.removeEventListener('touchcancel', handleTouchCancel)

    wrapper.removeEventListener('mousedown', handleMouseDown)
    window.removeEventListener('mousemove', handleMouseMove)
    window.removeEventListener('mouseup', handleMouseUp)
  }
}
