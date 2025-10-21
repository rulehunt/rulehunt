// src/components/mobile/soundToggle.ts

/**
 * Creates a sound toggle button for the mobile header.
 * Allows users to enable/disable CA sonification.
 */
export function createSoundToggle(
  onToggle: (enabled: boolean) => void,
): HTMLButtonElement {
  const soundEnabled = localStorage.getItem('sound-enabled') === 'true'

  const button = document.createElement('button')
  button.setAttribute('data-swipe-ignore', 'true')
  button.style.touchAction = 'manipulation'
  button.className =
    'p-2 rounded-lg transition-colors bg-white/10 hover:bg-white/20 dark:bg-black/10 dark:hover:bg-black/20'
  button.setAttribute(
    'aria-label',
    soundEnabled ? 'Disable sound' : 'Enable sound',
  )
  button.title = soundEnabled ? 'Disable sound' : 'Enable sound'

  // Set initial icon
  updateIcon(button, soundEnabled)

  button.addEventListener('click', () => {
    const newState = localStorage.getItem('sound-enabled') !== 'true'
    localStorage.setItem('sound-enabled', String(newState))
    updateIcon(button, newState)
    button.setAttribute(
      'aria-label',
      newState ? 'Disable sound' : 'Enable sound',
    )
    button.title = newState ? 'Disable sound' : 'Enable sound'
    onToggle(newState)
  })

  return button
}

function updateIcon(button: HTMLButtonElement, enabled: boolean): void {
  button.textContent = enabled ? '🔊' : '🔇'
}
