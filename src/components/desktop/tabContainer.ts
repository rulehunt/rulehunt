// src/components/desktop/tabContainer.ts

export type TabId = 'explore' | 'analyze' | 'leaderboard'

export interface TabConfig {
  id: TabId
  label: string
  icon: string
  shortcut: string
}

export interface TabContainerElements {
  container: HTMLDivElement
  tabButtons: Map<TabId, HTMLButtonElement>
}

export interface TabContainerConfig {
  onTabChange: (tabId: TabId) => void
  initialTab?: TabId
}

const TABS: TabConfig[] = [
  { id: 'explore', label: 'Explore', icon: '🎮', shortcut: 'Ctrl+1' },
  { id: 'analyze', label: 'Analyze', icon: '📊', shortcut: 'Ctrl+2' },
  { id: 'leaderboard', label: 'Leaderboard', icon: '🏆', shortcut: 'Ctrl+3' },
]

export function createTabContainer(
  config: TabContainerConfig,
): {
  root: HTMLDivElement
  elements: TabContainerElements
  getActiveTab: () => TabId
  setActiveTab: (tabId: TabId) => void
  cleanup: () => void
} {
  const { onTabChange, initialTab = 'explore' } = config

  let activeTab: TabId = initialTab

  // Create container
  const root = document.createElement('div')
  root.className =
    'w-full border-b border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900'

  const container = document.createElement('div')
  container.className = 'max-w-7xl mx-auto px-6'

  const tabNav = document.createElement('nav')
  tabNav.className = 'flex gap-1'
  tabNav.setAttribute('role', 'tablist')
  tabNav.setAttribute('aria-label', 'Desktop navigation tabs')

  const tabButtons = new Map<TabId, HTMLButtonElement>()

  // Create tab buttons
  for (const tab of TABS) {
    const button = document.createElement('button')
    button.setAttribute('role', 'tab')
    button.setAttribute('aria-selected', tab.id === activeTab ? 'true' : 'false')
    button.setAttribute('aria-controls', `${tab.id}-panel`)
    button.id = `tab-${tab.id}`
    button.title = `${tab.label} (${tab.shortcut})`

    const baseClasses =
      'flex items-center gap-2 px-4 py-3 text-sm font-medium transition-all duration-200 border-b-2'
    const activeClasses =
      'border-violet-600 dark:border-violet-400 text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-900/20'
    const inactiveClasses =
      'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800'

    button.className = `${baseClasses} ${tab.id === activeTab ? activeClasses : inactiveClasses}`

    button.innerHTML = `
      <span class="text-lg" aria-hidden="true">${tab.icon}</span>
      <span>${tab.label}</span>
    `

    tabButtons.set(tab.id, button)
    tabNav.appendChild(button)
  }

  container.appendChild(tabNav)
  root.appendChild(container)

  const elements: TabContainerElements = {
    container,
    tabButtons,
  }

  // Update UI to reflect active tab
  function updateTabUI(newTabId: TabId) {
    const baseClasses =
      'flex items-center gap-2 px-4 py-3 text-sm font-medium transition-all duration-200 border-b-2'
    const activeClasses =
      'border-violet-600 dark:border-violet-400 text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-900/20'
    const inactiveClasses =
      'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800'

    for (const [tabId, button] of tabButtons.entries()) {
      const isActive = tabId === newTabId
      button.className = `${baseClasses} ${isActive ? activeClasses : inactiveClasses}`
      button.setAttribute('aria-selected', isActive ? 'true' : 'false')
    }
  }

  // Set active tab (programmatic)
  function setActiveTab(newTabId: TabId) {
    if (activeTab === newTabId) return
    activeTab = newTabId
    updateTabUI(newTabId)
    updateURLHash(newTabId)
    onTabChange(newTabId)
  }

  // Get active tab
  function getActiveTab(): TabId {
    return activeTab
  }

  // Update URL hash
  function updateURLHash(tabId: TabId) {
    if (window.location.hash !== `#${tabId}`) {
      window.history.replaceState(null, '', `#${tabId}`)
    }
  }

  // Read URL hash and set initial tab
  function readURLHash(): TabId | null {
    const hash = window.location.hash.slice(1) // Remove '#'
    if (hash === 'explore' || hash === 'analyze' || hash === 'leaderboard') {
      return hash
    }
    return null
  }

  // Tab click handlers
  const clickHandlers = new Map<TabId, () => void>()
  for (const tab of TABS) {
    const handler = () => setActiveTab(tab.id)
    clickHandlers.set(tab.id, handler)
    tabButtons.get(tab.id)?.addEventListener('click', handler)
  }

  // Keyboard shortcuts (Ctrl+1, Ctrl+2, Ctrl+3)
  const keyboardHandler = (e: KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey) {
      if (e.key === '1') {
        e.preventDefault()
        setActiveTab('explore')
      } else if (e.key === '2') {
        e.preventDefault()
        setActiveTab('analyze')
      } else if (e.key === '3') {
        e.preventDefault()
        setActiveTab('leaderboard')
      }
    }
  }
  window.addEventListener('keydown', keyboardHandler)

  // Handle browser back/forward with hash changes
  const hashChangeHandler = () => {
    const hashTab = readURLHash()
    if (hashTab && hashTab !== activeTab) {
      activeTab = hashTab
      updateTabUI(hashTab)
      onTabChange(hashTab)
    }
  }
  window.addEventListener('hashchange', hashChangeHandler)

  // Apply URL hash on init
  const urlTab = readURLHash()
  if (urlTab) {
    activeTab = urlTab
    updateTabUI(urlTab)
  } else {
    // Set initial hash if not present
    updateURLHash(activeTab)
  }

  // Cleanup function
  function cleanup() {
    for (const [tabId, handler] of clickHandlers.entries()) {
      tabButtons.get(tabId)?.removeEventListener('click', handler)
    }
    window.removeEventListener('keydown', keyboardHandler)
    window.removeEventListener('hashchange', hashChangeHandler)
  }

  return { root, elements, getActiveTab, setActiveTab, cleanup }
}
