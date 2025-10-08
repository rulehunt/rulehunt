// src/components/theme.ts

export interface ThemeToggleElements {
  light: HTMLButtonElement
  dark: HTMLButtonElement
  system: HTMLButtonElement
}

export function createThemeToggle(): {
  root: HTMLDivElement
  elements: ThemeToggleElements
} {
  const root = document.createElement('div')
  root.className =
    'absolute top-4 right-4 flex gap-1 p-1 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-800'

  root.innerHTML = `
    <button id="theme-light" class="px-3 py-1 rounded text-sm transition-colors" title="Light mode">☀️</button>
    <button id="theme-dark" class="px-3 py-1 rounded text-sm transition-colors" title="Dark mode">🌙</button>
    <button id="theme-system" class="px-3 py-1 rounded text-sm transition-colors" title="System">💻</button>
  `

  const elements: ThemeToggleElements = {
    light: root.querySelector('#theme-light') as HTMLButtonElement,
    dark: root.querySelector('#theme-dark') as HTMLButtonElement,
    system: root.querySelector('#theme-system') as HTMLButtonElement,
  }

  return { root, elements }
}

export type Theme = 'light' | 'dark' | 'system'

export function setupTheme(
  elements: ThemeToggleElements,
  onThemeChange?: () => void,
) {
  const baseClasses = 'px-3 py-1 rounded text-sm transition-colors'
  const activeClasses = `${baseClasses} bg-blue-500 text-white`
  const inactiveClasses = `${baseClasses} hover:bg-gray-200 dark:hover:bg-gray-700`

  function setTheme(theme: Theme) {
    localStorage.setItem('theme', theme)

    // Update button styles
    elements.light.className =
      theme === 'light' ? activeClasses : inactiveClasses
    elements.dark.className = theme === 'dark' ? activeClasses : inactiveClasses
    elements.system.className =
      theme === 'system' ? activeClasses : inactiveClasses

    if (theme === 'system') {
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      document.documentElement.classList.toggle('dark', isDark)
    } else {
      document.documentElement.classList.toggle('dark', theme === 'dark')
    }

    // Notify listeners that theme changed
    onThemeChange?.()
  }

  elements.light.addEventListener('click', () => setTheme('light'))
  elements.dark.addEventListener('click', () => setTheme('dark'))
  elements.system.addEventListener('click', () => setTheme('system'))

  // Initialize theme
  const savedTheme = localStorage.getItem('theme') as Theme | null
  setTheme(savedTheme || 'system')

  // Listen for system theme changes
  window
    .matchMedia('(prefers-color-scheme: dark)')
    .addEventListener('change', () => {
      if (localStorage.getItem('theme') === 'system') {
        setTheme('system')
      }
    })

  return { setTheme }
}

/** Apply the stored theme (without requiring UI elements). */
export function applyThemeFromStorage() {
  const savedTheme = (localStorage.getItem('theme') as Theme | null) || 'system'
  if (savedTheme === 'system') {
    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    document.documentElement.classList.toggle('dark', isDark)
  } else {
    document.documentElement.classList.toggle('dark', savedTheme === 'dark')
  }
}

export function watchSystemThemeChange(onChange?: () => void) {
  const mq = window.matchMedia('(prefers-color-scheme: dark)')
  mq.addEventListener('change', () => {
    if (localStorage.getItem('theme') === 'system') {
      applyThemeFromStorage()
      onChange?.()
    }
  })
}
