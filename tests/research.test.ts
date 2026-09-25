/**
 * Tests for the Research panel (database export) and its tab registration.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createResearchPanel,
  EXPORT_DATABASE_PATH,
} from '../src/components/desktop/research'
import {
  createTabContainer,
  type TabId,
} from '../src/components/desktop/tabContainer'

describe('createResearchPanel', () => {
  it('renders a download link pointing at the export endpoint', () => {
    const panel = createResearchPanel()
    const link = panel.elements.downloadButton

    expect(link.tagName).toBe('A')
    expect(link.getAttribute('href')).toBe(EXPORT_DATABASE_PATH)
    expect(EXPORT_DATABASE_PATH).toBe('/api/export-database')
    expect(link.getAttribute('download')).toBe('rulehunt-export.csv')
    expect(link.textContent).toContain('Download Full Database')
  })

  it('describes what the dataset contains', () => {
    const panel = createResearchPanel()
    const text = panel.root.textContent ?? ''

    expect(text).toContain('Ruleset identity')
    expect(text).toContain('Aggregated statistics')
    expect(text).toContain('Entity tracking')
    // One list entry per documented column group.
    expect(panel.root.querySelectorAll('li').length).toBeGreaterThanOrEqual(5)
  })

  it('does not claim a scheduled refresh cadence the backend does not provide', () => {
    const panel = createResearchPanel()
    const text = (panel.root.textContent ?? '').toLowerCase()

    // functions/api/export-database.ts queries D1 live on each request; there is
    // no cron trigger in wrangler.toml, so no daily-refresh promise may appear.
    expect(text).not.toContain('daily')
    expect(text).not.toContain('2 am utc')
    expect(text).toContain('generated on request')
  })

  it('exposes a sections container so further sections can be appended', () => {
    const panel = createResearchPanel()
    expect(panel.elements.sections.children.length).toBe(1)

    const extra = document.createElement('section')
    panel.elements.sections.appendChild(extra)

    expect(panel.elements.sections.children.length).toBe(2)
    expect(panel.root.contains(extra)).toBe(true)
  })

  it('uses a responsive full-width layout like the other tab columns', () => {
    const panel = createResearchPanel()
    expect(panel.root.className).toContain('w-full')
    expect(panel.elements.sections.className).toContain('max-w-4xl')
  })
})

describe('tabContainer research tab', () => {
  let onTabChange: ReturnType<typeof vi.fn>
  let container: ReturnType<typeof createTabContainer> | undefined

  beforeEach(() => {
    window.location.hash = ''
    onTabChange = vi.fn()
  })

  afterEach(() => {
    container?.cleanup()
    container = undefined
    window.location.hash = ''
  })

  function mount(initialTab?: TabId) {
    container = createTabContainer({
      onTabChange: onTabChange as (tabId: TabId) => void,
      initialTab,
    })
    document.body.appendChild(container.root)
    return container
  }

  it('renders a Research tab button after Statistics', () => {
    const tabs = mount()
    const labels = [...tabs.root.querySelectorAll('button')].map((b) =>
      b.textContent?.trim(),
    )

    expect(labels.at(-1)).toContain('Research')
    expect(tabs.elements.tabButtons.get('research')).toBeDefined()
    expect(tabs.elements.tabButtons.get('research')?.title).toBe(
      'Research (Ctrl+5)',
    )
  })

  it('activates the research tab on click and updates the URL hash', () => {
    const tabs = mount()
    tabs.elements.tabButtons.get('research')?.click()

    expect(tabs.getActiveTab()).toBe('research')
    expect(onTabChange).toHaveBeenCalledWith('research')
    expect(window.location.hash).toBe('#research')
  })

  it('switches to the research tab on Ctrl+5 and Cmd+5', () => {
    const tabs = mount()

    window.dispatchEvent(new KeyboardEvent('keydown', { key: '5', ctrlKey: true }))
    expect(tabs.getActiveTab()).toBe('research')

    tabs.setActiveTab('explore')
    window.dispatchEvent(new KeyboardEvent('keydown', { key: '5', metaKey: true }))
    expect(tabs.getActiveTab()).toBe('research')
  })

  it('honours a #research hash on load', () => {
    window.location.hash = '#research'
    const tabs = mount()

    expect(tabs.getActiveTab()).toBe('research')
    expect(
      tabs.elements.tabButtons.get('research')?.getAttribute('aria-selected'),
    ).toBe('true')
  })

  it('marks only the active tab as selected when research is active', () => {
    const tabs = mount()
    tabs.setActiveTab('research')

    for (const [tabId, button] of tabs.elements.tabButtons.entries()) {
      expect(button.getAttribute('aria-selected')).toBe(
        tabId === 'research' ? 'true' : 'false',
      )
    }
  })
})
