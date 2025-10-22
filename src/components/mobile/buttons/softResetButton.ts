// src/components/mobile/buttons/softResetButton.ts

import { createRoundButton } from '../roundButton'

/**
 * Dependencies required by the soft reset button factory.
 * Uses dependency injection for module state access.
 */
export interface SoftResetButtonDeps {
  /** Callback to trigger the soft reset (reload simulation) */
  onSoftReset: () => void
  /** Optional callback to reset fade/transition state */
  onResetFade?: () => void
  /** Accessor to check if a transition is currently in progress */
  isTransitioning: () => boolean
}

/**
 * Creates the soft reset button with pulse animation controls.
 * The pulse animation can be triggered to draw user attention to the reset option.
 *
 * @param deps - Dependencies for button operation
 * @returns Button element, cleanup function, and pulse control methods
 */
export function createSoftResetButton(
  deps: SoftResetButtonDeps,
): {
  button: HTMLButtonElement
  cleanup: () => void
  startPulse: () => void
  stopPulse: () => void
} {
  const { onSoftReset, onResetFade, isTransitioning } = deps

  const { button, cleanup: cleanupButton } = createRoundButton(
    {
      icon: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>`,
      title: 'Reload simulation',
      onClick: () => {
        if (isTransitioning()) return
        onSoftReset()
        onResetFade?.()
        stopPulse()
      },
    },
    isTransitioning,
  )

  /**
   * Starts the pulse animation with orange border to draw attention.
   * Useful for signaling that a reset is recommended.
   */
  const startPulse = () => {
    button.classList.add('animate-pulse')
    button.style.borderColor = '#f97316' // orange-500
    button.style.borderWidth = '2px'
  }

  /**
   * Stops the pulse animation and restores default styling.
   */
  const stopPulse = () => {
    button.classList.remove('animate-pulse')
    button.style.borderColor = ''
    button.style.borderWidth = ''
  }

  return { button, cleanup: cleanupButton, startPulse, stopPulse }
}
