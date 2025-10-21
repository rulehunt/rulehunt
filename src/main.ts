import { setupDesktopLayout } from './components/desktop/layout.ts'
import { applyThemeFromStorage } from './components/desktop/theme'
import { setupMobileLayout } from './components/mobile/layout.ts'
import type { CleanupFunction } from './types'

function isMobile(): boolean {
  return window.innerWidth < 640
}

window.addEventListener('DOMContentLoaded', async () => {
  // --- Apply theme before mounting UI ---
  applyThemeFromStorage()

  const appRoot = document.getElementById('app') as HTMLDivElement
  let currentLayout: 'mobile' | 'desktop' | null = null
  let currentCleanup: CleanupFunction | null = null

  async function updateLayout() {
    const shouldBeMobile = isMobile()
    const targetLayout = shouldBeMobile ? 'mobile' : 'desktop'

    if (currentLayout === targetLayout) return

    if (currentCleanup) {
      currentCleanup()
      currentCleanup = null
    }

    appRoot.innerHTML = ''

    if (shouldBeMobile) {
      currentCleanup = await setupMobileLayout(appRoot)
      currentLayout = 'mobile'
      console.log('Mobile layout initialized')
    } else {
      currentCleanup = await setupDesktopLayout(appRoot)
      currentLayout = 'desktop'
      console.log('Desktop layout initialized')
    }
  }

  await updateLayout()

  let resizeTimeout: number
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout)
    resizeTimeout = window.setTimeout(updateLayout, 250)
  })
})
