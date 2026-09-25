/**
 * Tests for errorNotice.ts (issue #244)
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  dismissAllErrorNotices,
  getErrorNoticeContainer,
  showErrorNotice,
} from '../src/components/shared/errorNotice'

function container(): HTMLElement {
  const el = getErrorNoticeContainer()
  if (!el) throw new Error('expected a notice container')
  return el
}

describe('errorNotice', () => {
  beforeEach(() => {
    dismissAllErrorNotices()
    document.body.innerHTML = ''
  })

  afterEach(() => {
    dismissAllErrorNotices()
    vi.useRealTimers()
  })

  describe('rendering', () => {
    it('renders the message into a shared container on <body>', () => {
      const notice = showErrorNotice({ message: "Couldn't save your run" })

      expect(notice).not.toBeNull()
      expect(container().parentElement).toBe(document.body)
      expect(container().contains(notice?.element ?? null)).toBe(true)
      expect(notice?.element.textContent).toContain("Couldn't save your run")
    })

    it('reuses a single container across notices', () => {
      showErrorNotice({ message: 'first' })
      showErrorNotice({ message: 'second' })

      expect(document.querySelectorAll('#rulehunt-error-notices')).toHaveLength(
        1,
      )
      expect(container().children).toHaveLength(2)
    })

    it('renders the optional detail line', () => {
      const notice = showErrorNotice({
        message: "Couldn't save your run",
        detail: 'Nothing was stored.',
      })

      expect(notice?.element.textContent).toContain('Nothing was stored.')
    })

    it('marks error notices as assertive alerts', () => {
      const notice = showErrorNotice({ message: 'boom' })

      expect(notice?.element.getAttribute('role')).toBe('alert')
      expect(notice?.element.getAttribute('aria-live')).toBe('assertive')
    })

    it('marks success notices as polite status updates', () => {
      const notice = showErrorNotice({ message: 'Run saved', tone: 'success' })

      expect(notice?.element.getAttribute('role')).toBe('status')
      expect(notice?.element.dataset.noticeTone).toBe('success')
    })

    it('renders into a caller-supplied container when given one', () => {
      const custom = document.createElement('div')
      document.body.appendChild(custom)

      const notice = showErrorNotice({ message: 'scoped', container: custom })

      expect(custom.contains(notice?.element ?? null)).toBe(true)
      expect(document.getElementById('rulehunt-error-notices')).toBeNull()
    })
  })

  describe('escaping (issue #244 constraint: never innerHTML)', () => {
    it('renders markup in the message as literal text', () => {
      const notice = showErrorNotice({
        message: '<img src=x onerror="alert(1)">',
      })

      const element = notice?.element as HTMLDivElement
      expect(element.querySelector('img')).toBeNull()
      expect(element.textContent).toContain('<img src=x onerror="alert(1)">')
    })

    it('renders markup in the detail as literal text', () => {
      const notice = showErrorNotice({
        message: 'failed',
        detail: '<script>alert(1)</script>',
      })

      const element = notice?.element as HTMLDivElement
      expect(element.querySelector('script')).toBeNull()
      expect(element.textContent).toContain('<script>alert(1)</script>')
    })

    it('renders markup in an action label as literal text', () => {
      const notice = showErrorNotice({
        message: 'failed',
        action: { label: '<b>Retry</b>', onClick: () => {} },
      })

      const element = notice?.element as HTMLDivElement
      expect(element.querySelector('b')).toBeNull()
      expect(element.textContent).toContain('<b>Retry</b>')
    })
  })

  describe('dismissal', () => {
    it('removes the notice when the close button is clicked', () => {
      const notice = showErrorNotice({ message: 'failed' })
      const closeBtn = notice?.element.querySelector<HTMLButtonElement>(
        'button[aria-label="Dismiss"]',
      )

      expect(closeBtn).not.toBeNull()
      closeBtn?.click()

      expect(container().children).toHaveLength(0)
      expect(notice?.element.isConnected).toBe(false)
    })

    it('removes the notice via the returned dismiss handle', () => {
      const notice = showErrorNotice({ message: 'failed' })
      notice?.dismiss()

      expect(container().children).toHaveLength(0)
    })

    it('is idempotent when dismissed twice', () => {
      const notice = showErrorNotice({ message: 'failed' })
      notice?.dismiss()
      expect(() => notice?.dismiss()).not.toThrow()
    })

    it('auto-dismisses after autoDismissMs', () => {
      vi.useFakeTimers()
      showErrorNotice({ message: 'Run saved', autoDismissMs: 4000 })

      expect(container().children).toHaveLength(1)
      vi.advanceTimersByTime(4000)
      expect(container().children).toHaveLength(0)
    })

    it('dismissAllErrorNotices clears the stack', () => {
      showErrorNotice({ message: 'a' })
      showErrorNotice({ message: 'b', key: 'keyed' })

      dismissAllErrorNotices()

      expect(container().children).toHaveLength(0)
    })
  })

  describe('keyed notices', () => {
    it('replaces an existing notice with the same key', () => {
      showErrorNotice({ key: 'save-run', message: 'first failure' })
      showErrorNotice({ key: 'save-run', message: 'second failure' })

      expect(container().children).toHaveLength(1)
      expect(container().textContent).toContain('second failure')
      expect(container().textContent).not.toContain('first failure')
    })

    it('stacks notices with different keys', () => {
      showErrorNotice({ key: 'save-run', message: 'save failed' })
      showErrorNotice({ key: 'submit-rating', message: 'rating failed' })

      expect(container().children).toHaveLength(2)
    })

    it('records the key on the element for debugging', () => {
      const notice = showErrorNotice({ key: 'save-run', message: 'failed' })
      expect(notice?.element.dataset.noticeKey).toBe('save-run')
    })
  })

  describe('action button', () => {
    it('invokes onClick and dismisses by default', () => {
      const onClick = vi.fn()
      const notice = showErrorNotice({
        message: 'failed',
        action: { label: 'Retry', onClick },
      })

      const actionBtn =
        notice?.element.querySelector<HTMLButtonElement>('button')
      actionBtn?.click()

      expect(onClick).toHaveBeenCalledTimes(1)
      expect(container().children).toHaveLength(0)
    })

    it('keeps the notice when dismissOnClick is false', () => {
      const notice = showErrorNotice({
        message: 'failed',
        action: { label: 'Retry', onClick: () => {}, dismissOnClick: false },
      })

      notice?.element.querySelector<HTMLButtonElement>('button')?.click()

      expect(container().children).toHaveLength(1)
    })

    it('swallows a rejected async action instead of throwing at the user', async () => {
      const consoleError = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {})
      const notice = showErrorNotice({
        message: 'failed',
        action: {
          label: 'Retry',
          onClick: () => Promise.reject(new Error('nope')),
        },
      })

      notice?.element.querySelector<HTMLButtonElement>('button')?.click()
      await Promise.resolve()
      await Promise.resolve()

      expect(consoleError).toHaveBeenCalled()
      consoleError.mockRestore()
    })

    it('renders no action button when no action is supplied', () => {
      const notice = showErrorNotice({ message: 'failed' })
      const buttons = notice?.element.querySelectorAll('button')

      expect(buttons).toHaveLength(1) // close button only
    })
  })
})
