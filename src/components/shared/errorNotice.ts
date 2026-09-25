/**
 * Error Notice Component
 *
 * A small, dismissible, themed notice used to surface failures the user is
 * waiting on (a save that did not save, a rating that was not recorded).
 *
 * Extracted from the `errorMessage` pattern in `authModal.ts`, which already
 * handles inline errors inside the auth dialog. This variant renders into a
 * floating stack so code that has no modal of its own (the API helpers in
 * `src/api/`) can report failures too.
 *
 * Issue #244: surface the client-side silent failures to the user.
 *
 * SECURITY: every piece of caller-supplied text reaches the DOM through
 * `textContent`. Never switch these to `innerHTML` — messages can carry
 * server-supplied content.
 */

/** Visual tone of a notice. */
export type ErrorNoticeTone = 'error' | 'success'

/** An optional button rendered next to the message (typically "Retry"). */
export interface ErrorNoticeAction {
  /** Button label. Rendered as text. */
  label: string
  /** Invoked on click. Rejections are logged, never thrown at the user. */
  onClick: () => void | Promise<void>
  /** Dismiss the notice when the action is clicked (default: true). */
  dismissOnClick?: boolean
}

export interface ErrorNoticeOptions {
  /** Short summary in the user's terms, e.g. "Couldn't save your run". */
  message: string
  /** Optional second line with what it means for the user. */
  detail?: string
  /** Optional action button. */
  action?: ErrorNoticeAction
  /** Auto-dismiss after this many ms. Omit (or 0) to require a dismissal. */
  autoDismissMs?: number
  /**
   * Notices that share a key replace one another instead of stacking, so a
   * repeatedly failing operation shows one notice rather than a pile.
   */
  key?: string
  /** Visual tone (default: 'error'). */
  tone?: ErrorNoticeTone
  /** Container to render into (default: a shared stack appended to <body>). */
  container?: HTMLElement
}

/** Handle for a notice that is currently on screen. */
export interface ErrorNotice {
  element: HTMLDivElement
  dismiss: () => void
}

const CONTAINER_ID = 'rulehunt-error-notices'

const TONE_CLASSES: Record<ErrorNoticeTone, string> = {
  error:
    'border-red-300 dark:border-red-700 bg-white dark:bg-gray-800 text-red-700 dark:text-red-300',
  success:
    'border-green-300 dark:border-green-700 bg-white dark:bg-gray-800 text-green-700 dark:text-green-300',
}

const ACTION_CLASSES: Record<ErrorNoticeTone, string> = {
  error:
    'bg-red-600 hover:bg-red-700 text-white border-none px-3 py-1.5 text-sm font-semibold rounded cursor-pointer transition-colors',
  success:
    'bg-green-600 hover:bg-green-700 text-white border-none px-3 py-1.5 text-sm font-semibold rounded cursor-pointer transition-colors',
}

/** Notices currently on screen, indexed by their caller-supplied key. */
const keyedNotices = new Map<string, ErrorNotice>()

/**
 * Get (creating if needed) the shared floating stack notices render into.
 * Returns null in a non-DOM environment (Workers, SSR, Node without jsdom).
 */
export function getErrorNoticeContainer(): HTMLElement | null {
  if (typeof document === 'undefined' || !document.body) return null

  const existing = document.getElementById(CONTAINER_ID)
  if (existing) return existing

  const container = document.createElement('div')
  container.id = CONTAINER_ID
  // z-[10001] sits just above the auth/benchmark modals (z-[10000]) so a
  // failure raised from inside a modal is still visible.
  container.className =
    'fixed bottom-4 left-4 right-4 sm:left-auto sm:max-w-sm z-[10001] flex flex-col items-end gap-2 pointer-events-none'
  document.body.appendChild(container)
  return container
}

/**
 * Show a dismissible notice. Returns null when there is no DOM to render into,
 * so callers in shared code can call it unconditionally.
 */
export function showErrorNotice(
  options: ErrorNoticeOptions,
): ErrorNotice | null {
  const container = options.container ?? getErrorNoticeContainer()
  if (!container) return null

  const tone = options.tone ?? 'error'

  // Replace any existing notice with the same key.
  if (options.key) keyedNotices.get(options.key)?.dismiss()

  const element = document.createElement('div')
  element.className = `pointer-events-auto flex items-start gap-3 w-full border rounded-lg shadow-2xl p-4 ${TONE_CLASSES[tone]}`
  element.setAttribute('role', tone === 'error' ? 'alert' : 'status')
  element.setAttribute('aria-live', tone === 'error' ? 'assertive' : 'polite')
  if (options.key) element.dataset.noticeKey = options.key
  element.dataset.noticeTone = tone

  const text = document.createElement('div')
  text.className = 'flex-1 min-w-0'

  const message = document.createElement('p')
  message.className = 'm-0 text-sm font-semibold break-words'
  message.textContent = options.message // text only — never innerHTML
  text.appendChild(message)

  if (options.detail) {
    const detail = document.createElement('p')
    detail.className =
      'm-0 mt-1 text-xs text-gray-600 dark:text-gray-400 break-words'
    detail.textContent = options.detail // text only — never innerHTML
    text.appendChild(detail)
  }

  element.appendChild(text)

  let timeoutId: ReturnType<typeof setTimeout> | undefined

  const dismiss = (): void => {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId)
      timeoutId = undefined
    }
    element.remove()
    if (options.key && keyedNotices.get(options.key)?.element === element) {
      keyedNotices.delete(options.key)
    }
  }

  const notice: ErrorNotice = { element, dismiss }

  if (options.action) {
    const action = options.action
    const actionBtn = document.createElement('button')
    actionBtn.type = 'button'
    actionBtn.textContent = action.label // text only — never innerHTML
    actionBtn.className = ACTION_CLASSES[tone]
    actionBtn.addEventListener('click', () => {
      if (action.dismissOnClick !== false) dismiss()
      try {
        const result = action.onClick()
        if (result instanceof Promise) {
          result.catch((err) => {
            console.error('[errorNotice] Action failed:', err)
          })
        }
      } catch (err) {
        console.error('[errorNotice] Action failed:', err)
      }
    })
    element.appendChild(actionBtn)
  }

  const closeBtn = document.createElement('button')
  closeBtn.type = 'button'
  closeBtn.textContent = '×'
  closeBtn.setAttribute('aria-label', 'Dismiss')
  closeBtn.className =
    'border-none bg-transparent text-2xl leading-none cursor-pointer p-0 w-6 h-6 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
  closeBtn.addEventListener('click', dismiss)
  element.appendChild(closeBtn)

  container.appendChild(element)

  if (options.key) keyedNotices.set(options.key, notice)

  if (options.autoDismissMs && options.autoDismissMs > 0) {
    timeoutId = setTimeout(dismiss, options.autoDismissMs)
  }

  return notice
}

/** Dismiss every notice in the shared stack (used by tests and teardown). */
export function dismissAllErrorNotices(): void {
  for (const notice of [...keyedNotices.values()]) notice.dismiss()
  keyedNotices.clear()

  const container =
    typeof document === 'undefined'
      ? null
      : document.getElementById(CONTAINER_ID)
  if (container) container.replaceChildren()
}
