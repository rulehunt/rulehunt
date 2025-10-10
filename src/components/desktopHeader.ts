// src/components/header.ts

export interface ThemeToggleElements {
  light: HTMLButtonElement
  dark: HTMLButtonElement
  system: HTMLButtonElement
}

export interface HeaderElements {
  themeToggle: ThemeToggleElements
  githubLink: HTMLAnchorElement
}

export type Theme = 'light' | 'dark' | 'system'
export type CleanupFunction = () => void

export function createHeader(): {
  root: HTMLElement
  elements: HeaderElements
} {
  const root = document.createElement('header')
  root.className =
    'w-full border-b border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900'

  root.innerHTML = `
    <div class="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
      <!-- Left: Logo/Title -->
      <div class="flex items-center gap-3">
        <h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100">
          RuleHunt
        </h1>
        <span class="text-sm text-gray-500 dark:text-gray-400 hidden sm:inline">
          C4-Symmetric Cellular Automata Explorer
        </span>
      </div>

      <!-- Right: GitHub + Theme Toggle -->
      <div class="flex items-center gap-4">
        <!-- GitHub Link -->
        <a
          id="github-link"
          href="https://github.com/rulehunt/rulehunt"
          target="_blank"
          rel="noopener noreferrer"
          class="flex items-center gap-2 px-3 py-1.5 rounded-md border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-sm"
          title="View on GitHub"
        >
          <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path fill-rule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clip-rule="evenodd" />
          </svg>
          <span class="hidden sm:inline">GitHub</span>
        </a>

        <!-- Theme Toggle -->
        <div class="flex gap-1 p-1 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-800">
          <button id="theme-light" class="px-3 py-1 rounded text-sm transition-colors" title="Light mode">☀️</button>
          <button id="theme-dark" class="px-3 py-1 rounded text-sm transition-colors" title="Dark mode">🌙</button>
          <button id="theme-system" class="px-3 py-1 rounded text-sm transition-colors" title="System">💻</button>
        </div>
      </div>
    </div>
  `

  const elements: HeaderElements = {
    themeToggle: {
      light: root.querySelector('#theme-light') as HTMLButtonElement,
      dark: root.querySelector('#theme-dark') as HTMLButtonElement,
      system: root.querySelector('#theme-system') as HTMLButtonElement,
    },
    githubLink: root.querySelector('#github-link') as HTMLAnchorElement,
  }

  return { root, elements }
}

export function setupTheme(
  themeButtons: ThemeToggleElements,
  onThemeChange?: () => void,
): CleanupFunction {
  // Load saved theme
  const savedTheme = (localStorage.getItem('theme') as Theme) || 'system'
  let currentTheme: Theme = savedTheme

  // Apply initial theme
  applyTheme(currentTheme)
  updateActiveButton(themeButtons, currentTheme)

  // Create event handlers
  const lightHandler = () => {
    currentTheme = 'light'
    localStorage.setItem('theme', currentTheme)
    applyTheme(currentTheme)
    updateActiveButton(themeButtons, currentTheme)
    if (onThemeChange) onThemeChange()
  }

  const darkHandler = () => {
    currentTheme = 'dark'
    localStorage.setItem('theme', currentTheme)
    applyTheme(currentTheme)
    updateActiveButton(themeButtons, currentTheme)
    if (onThemeChange) onThemeChange()
  }

  const systemHandler = () => {
    currentTheme = 'system'
    localStorage.setItem('theme', currentTheme)
    applyTheme(currentTheme)
    updateActiveButton(themeButtons, currentTheme)
    if (onThemeChange) onThemeChange()
  }

  // Add event listeners
  themeButtons.light.addEventListener('click', lightHandler)
  themeButtons.dark.addEventListener('click', darkHandler)
  themeButtons.system.addEventListener('click', systemHandler)

  // Watch for system theme changes when in system mode
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
  const mediaQueryHandler = (e: MediaQueryListEvent) => {
    if (currentTheme === 'system') {
      document.documentElement.classList.toggle('dark', e.matches)
      if (onThemeChange) onThemeChange()
    }
  }

  mediaQuery.addEventListener('change', mediaQueryHandler)

  // Return cleanup function
  return () => {
    themeButtons.light.removeEventListener('click', lightHandler)
    themeButtons.dark.removeEventListener('click', darkHandler)
    themeButtons.system.removeEventListener('click', systemHandler)
    mediaQuery.removeEventListener('change', mediaQueryHandler)
  }
}

function applyTheme(theme: Theme) {
  if (theme === 'system') {
    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    document.documentElement.classList.toggle('dark', isDark)
  } else {
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }
}

function updateActiveButton(buttons: ThemeToggleElements, theme: Theme) {
  // Reset all buttons
  const baseClass = 'px-3 py-1 rounded text-sm transition-colors'
  const activeClass = 'bg-white dark:bg-gray-700'

  buttons.light.className = baseClass
  buttons.dark.className = baseClass
  buttons.system.className = baseClass

  // Highlight active button
  if (theme === 'light') {
    buttons.light.className = `${baseClass} ${activeClass}`
  } else if (theme === 'dark') {
    buttons.dark.className = `${baseClass} ${activeClass}`
  } else {
    buttons.system.className = `${baseClass} ${activeClass}`
  }
}
