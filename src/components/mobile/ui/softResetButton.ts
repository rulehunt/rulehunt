// src/components/mobile/ui/softResetButton.ts
import { createRoundButton } from '../roundButton'

/**
 * Creates the soft reset button that reloads the simulation with new random initial conditions.
 *
 * @param onSoftReset - Callback to reset the simulation
 * @param onResetFade - Optional callback to reset button container fade timer
 * @param isTransitioningFn - Function that returns whether a transition is in progress
 * @returns Object with button element, cleanup function, and pulse control functions
 */
export function createSoftResetButton(
  onSoftReset: () => void,
  onResetFade?: () => void,
  isTransitioningFn?: () => boolean,
): {
  button: HTMLButtonElement
  cleanup: () => void
  startPulse: () => void
  stopPulse: () => void
} {
  const { button, cleanup: cleanupButton } = createRoundButton(
    {
      icon: `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
             fill="currentColor" class="w-6 h-6">
          <path d="M12 5V2L8 6l4 4V7a5 5 0 1 1-5 5H5a7 7 0 1 0 7-7z"/>
        </svg>`,
      title: 'Reload simulation',
      onClick: () => {
        if (isTransitioningFn?.()) return
        onSoftReset()
        onResetFade?.()
        stopPulse() // Stop pulse when user resets
      },
    },
    isTransitioningFn,
  )

  const startPulse = () => {
    button.classList.add('animate-pulse')
    button.style.borderColor = '#f97316' // Orange border
    button.style.borderWidth = '2px'
  }

  const stopPulse = () => {
    button.classList.remove('animate-pulse')
    button.style.borderColor = ''
    button.style.borderWidth = ''
  }

  return { button, cleanup: cleanupButton, startPulse, stopPulse }
}
