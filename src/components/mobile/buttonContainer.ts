/**
 * Button Container Helpers
 *
 * Container components for managing button positioning and behavior.
 * Separates layout/behavior concerns from button implementation.
 */

export type CleanupFunction = () => void

export interface ButtonContainerPosition {
  top?: string
  right?: string
  bottom?: string
  left?: string
}

/**
 * Create a positioned container for buttons.
 * Parent controls positioning - buttons remain simple and reusable.
 *
 * @param position - CSS position values
 * @param className - Optional additional Tailwind classes
 * @returns Container element
 */
export function createButtonContainer(
  position: ButtonContainerPosition,
  className?: string,
): HTMLElement {
  const container = document.createElement('div')
  container.className = className
    ? `absolute z-10 ${className}`
    : 'absolute z-10'
  Object.assign(container.style, position)
  return container
}

export interface AutoFadeContainerConfig {
  /** CSS position values */
  position: ButtonContainerPosition
  /** Time in ms before fading starts */
  fadeAfterMs: number
  /** Opacity level when faded (0-1) */
  fadedOpacity: number
  /** Optional additional Tailwind classes */
  className?: string
}

export interface AutoFadeContainer {
  container: HTMLElement
  resetFade: () => void
  cleanup: CleanupFunction
}

/**
 * Create a container that automatically fades after inactivity.
 * Used for controls like zoom buttons that should fade after a timeout.
 *
 * @param config - Container configuration
 * @returns Container with fade management
 */
export function createAutoFadeContainer(
  config: AutoFadeContainerConfig,
): AutoFadeContainer {
  const container = document.createElement('div')

  // Base classes with fade transition
  const baseClasses = 'absolute z-10 transition-opacity duration-500'
  container.className = config.className
    ? `${baseClasses} ${config.className}`
    : baseClasses

  // Apply positioning
  Object.assign(container.style, config.position)
  container.style.opacity = '1'

  let fadeTimer: number | null = null

  const resetFade = () => {
    if (fadeTimer) {
      clearTimeout(fadeTimer)
    }
    container.style.opacity = '1'
    fadeTimer = window.setTimeout(() => {
      container.style.opacity = config.fadedOpacity.toString()
    }, config.fadeAfterMs)
  }

  const cleanup = () => {
    if (fadeTimer) {
      clearTimeout(fadeTimer)
    }
    container.remove()
  }

  return {
    container,
    resetFade,
    cleanup,
  }
}
