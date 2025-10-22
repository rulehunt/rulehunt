// src/components/desktop/soundControls.ts

/**
 * Creates sound controls for the desktop header.
 * Provides on/off toggle and volume slider for CA sonification.
 */

export interface SoundControlsElements {
  toggleButton: HTMLButtonElement
  volumeSlider: HTMLInputElement
  volumeValue: HTMLSpanElement
}

export function createSoundControls(
  onToggle: (enabled: boolean) => void,
  onVolumeChange: (volume: number) => void,
): { root: HTMLDivElement; elements: SoundControlsElements } {
  // Get initial state from localStorage
  const soundEnabled = localStorage.getItem('sound-enabled') === 'true'
  const soundVolume = localStorage.getItem('sound-volume') || '15'

  const root = document.createElement('div')
  root.className =
    'flex items-center gap-2 px-3 py-1.5 rounded-md border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 transition-colors'

  root.innerHTML = `
    <button
      id="sound-toggle"
      class="text-lg transition-opacity hover:opacity-80"
      aria-label="${soundEnabled ? 'Disable sound' : 'Enable sound'}"
      title="${soundEnabled ? 'Disable sound' : 'Enable sound'}"
    >
      ${soundEnabled ? '🔊' : '🔇'}
    </button>
    <input
      type="range"
      id="volume-slider"
      min="0"
      max="100"
      step="1"
      value="${soundVolume}"
      ${soundEnabled ? '' : 'disabled'}
      class="w-20 accent-violet-600 dark:accent-violet-400 disabled:opacity-30 disabled:cursor-not-allowed"
      aria-label="Volume level"
      title="Volume: ${soundVolume}%"
    />
    <span
      id="volume-value"
      class="text-xs font-medium text-gray-700 dark:text-gray-300 w-10 text-right"
    >
      ${soundVolume}%
    </span>
  `

  const elements: SoundControlsElements = {
    toggleButton: root.querySelector('#sound-toggle') as HTMLButtonElement,
    volumeSlider: root.querySelector('#volume-slider') as HTMLInputElement,
    volumeValue: root.querySelector('#volume-value') as HTMLSpanElement,
  }

  // Toggle button handler
  elements.toggleButton.addEventListener('click', () => {
    const newState = localStorage.getItem('sound-enabled') !== 'true'
    localStorage.setItem('sound-enabled', String(newState))

    // Update button UI
    elements.toggleButton.textContent = newState ? '🔊' : '🔇'
    elements.toggleButton.setAttribute(
      'aria-label',
      newState ? 'Disable sound' : 'Enable sound',
    )
    elements.toggleButton.title = newState ? 'Disable sound' : 'Enable sound'

    // Enable/disable slider
    elements.volumeSlider.disabled = !newState

    // Notify callback
    onToggle(newState)
  })

  // Volume slider handler
  elements.volumeSlider.addEventListener('input', () => {
    const volume = elements.volumeSlider.value
    localStorage.setItem('sound-volume', volume)

    // Update volume display
    elements.volumeValue.textContent = `${volume}%`
    elements.volumeSlider.title = `Volume: ${volume}%`

    // Notify callback (convert 0-100 to 0-1 range)
    const volumeDecimal = Number.parseInt(volume) / 100
    onVolumeChange(volumeDecimal)
  })

  return { root, elements }
}
