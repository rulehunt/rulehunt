/**
 * Round Button Component
 *
 * Simple, focused button component for round action buttons.
 * Handles only button concerns - positioning and fade behavior are parent/container responsibilities.
 */

export interface RoundButtonConfig {
  /** SVG string or plain text for the button icon/label */
  icon: string
  /** Title attribute for tooltip */
  title: string
  /** Optional aria-label for accessibility */
  ariaLabel?: string
  /** Additional Tailwind classes for styling variants */
  className?: string
  /** Click handler */
  onClick: (e: Event) => void
  /** If true, checks isTransitioning before calling onClick */
  preventTransition?: boolean
}

export interface RoundButton {
  button: HTMLButtonElement
  cleanup: () => void
}

/**
 * Create a round button with consistent styling and event handling.
 *
 * @param config - Button configuration
 * @param isTransitioning - Optional ref to check transition state
 * @returns Button element and cleanup function
 */
export function createRoundButton(
  config: RoundButtonConfig,
  isTransitioning?: () => boolean,
): RoundButton {
  const btn = document.createElement('button')

  // Base attributes for swipe-ignore and touch optimization
  btn.setAttribute('data-swipe-ignore', 'true')
  btn.style.touchAction = 'manipulation' // avoids 300ms delay on iOS

  // Set icon (SVG content or plain text)
  // If icon starts with '<', treat as HTML (SVG), otherwise as text content
  if (config.icon.trim().startsWith('<')) {
    btn.innerHTML = config.icon
  } else {
    btn.textContent = config.icon
  }

  // Base classes: round button with hover state
  const baseClasses =
    'p-3 rounded-full bg-gray-800 dark:bg-gray-700 text-white shadow-md hover:bg-gray-700 dark:hover:bg-gray-600 transition'
  btn.className = config.className
    ? `${baseClasses} ${config.className}`
    : baseClasses

  // Set title and aria-label
  btn.title = config.title
  if (config.ariaLabel) {
    btn.setAttribute('aria-label', config.ariaLabel)
  }

  // Swallow all pointer/touch/mouse events to prevent swipe gestures
  const swallow = (e: Event) => e.stopPropagation()
  const eventListeners: Array<
    [string, EventListener, AddEventListenerOptions?]
  > = [
    ['pointerdown', swallow],
    ['pointerup', swallow],
    ['mousedown', swallow],
    ['mouseup', swallow],
    ['touchstart', swallow, { passive: true }],
    ['touchmove', swallow, { passive: true }],
    ['touchend', swallow, { passive: true }],
    ['touchcancel', swallow, { passive: true }],
  ]

  for (const [event, handler, options] of eventListeners) {
    btn.addEventListener(event, handler, options)
  }

  // Click handler with optional transition check
  const handleClick = (e: Event) => {
    e.stopPropagation()
    if (config.preventTransition && isTransitioning?.()) {
      return
    }
    config.onClick(e)
  }
  btn.addEventListener('click', handleClick)

  return {
    button: btn,
    cleanup: () => {
      // Remove all event listeners
      for (const [event, handler, options] of eventListeners) {
        btn.removeEventListener(event, handler, options)
      }
      btn.removeEventListener('click', handleClick)
      btn.remove()
    },
  }
}
