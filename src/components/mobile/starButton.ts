/**
 * Star Button Component
 *
 * Toggle button for starring/favoriting simulations.
 * Dynamically updates appearance based on starred state (yellow when starred, gray when not).
 */

import { createRoundButton } from './roundButton.ts'

export interface StarButtonConfig {
  /** Callback to get current starred state */
  getIsStarred: () => boolean
  /** Callback when starred state changes */
  onToggle: (isStarred: boolean) => void
  /** Optional callback to reset container fade */
  onResetFade?: () => void
  /** Callback to check if system is transitioning */
  isTransitioning: () => boolean
}

export interface StarButton {
  button: HTMLButtonElement
  cleanup: () => void
}

const starFilledIcon = `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
       fill="currentColor" class="w-6 h-6">
    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
  </svg>`

const starOutlineIcon = `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
       fill="none" stroke="currentColor" stroke-width="2" class="w-6 h-6">
    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
  </svg>`

/**
 * Create a star button with toggle functionality.
 */
export function createStarButton(config: StarButtonConfig): StarButton {
  const { getIsStarred, onToggle, onResetFade, isTransitioning } = config

  const updateButtonAppearance = (button: HTMLButtonElement) => {
    const starred = getIsStarred()
    button.innerHTML = starred ? starFilledIcon : starOutlineIcon

    // Update background color using inline styles
    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    if (starred) {
      button.style.backgroundColor = '#eab308' // yellow-500
    } else {
      button.style.backgroundColor = isDark ? '#374151' : '#1f2937' // gray-700 : gray-800
    }
  }

  const { button, cleanup } = createRoundButton(
    {
      icon: starOutlineIcon,
      title: 'Star this simulation',
      onClick: () => {
        if (isTransitioning()) return

        const newStarredState = !getIsStarred()
        onToggle(newStarredState)
        updateButtonAppearance(button)
        onResetFade?.()
      },
      preventTransition: true,
    },
    isTransitioning,
  )

  // Set initial appearance
  updateButtonAppearance(button)

  return { button, cleanup }
}
