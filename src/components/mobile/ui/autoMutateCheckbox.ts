// src/components/mobile/ui/autoMutateCheckbox.ts
import {
  getAutoMutateEnabled,
  setAutoMutateEnabled,
} from '../../../dataStorage'

export interface AutoMutateCheckboxConfig {
  onToggle: (enabled: boolean) => void
  isTransitioning: () => boolean
}

/**
 * Creates the auto-mutate checkbox control that enables/disables
 * automatic mutation in rule generation.
 *
 * @param config - Configuration object with callbacks
 * @returns Object with checkbox element and update function
 */
export function createAutoMutateCheckbox(config: AutoMutateCheckboxConfig): {
  element: HTMLElement
  update: () => void
} {
  const container = document.createElement('label')
  container.className =
    'flex items-center gap-2 px-3 py-2 bg-black/50 rounded-lg cursor-pointer select-none'
  container.htmlFor = 'auto-mutate-checkbox'

  const checkbox = document.createElement('input')
  checkbox.type = 'checkbox'
  checkbox.id = 'auto-mutate-checkbox'
  checkbox.checked = getAutoMutateEnabled()
  checkbox.className = 'w-[18px] h-[18px] cursor-pointer'

  const labelText = document.createElement('span')
  labelText.textContent = 'Auto-Mutate'
  labelText.className = 'text-white text-sm font-medium'

  const tooltip = document.createElement('span')
  tooltip.textContent =
    'When enabled, automatically mutates starred rules during exploration. When disabled, uses exact starred rules.'
  tooltip.className =
    'absolute hidden group-hover:block bg-gray-900 text-white text-xs p-2 rounded shadow-lg max-w-xs z-50'
  tooltip.style.cssText =
    'bottom: 100%; left: 50%; transform: translateX(-50%); margin-bottom: 8px;'

  container.classList.add('group', 'relative')
  container.appendChild(tooltip)

  checkbox.addEventListener('change', () => {
    if (config.isTransitioning()) {
      // Revert checkbox state if transitioning
      checkbox.checked = getAutoMutateEnabled()
      return
    }

    const enabled = checkbox.checked
    setAutoMutateEnabled(enabled)
    config.onToggle(enabled)
  })

  container.appendChild(checkbox)
  container.appendChild(labelText)

  const update = () => {
    checkbox.checked = getAutoMutateEnabled()
  }

  return { element: container, update }
}
