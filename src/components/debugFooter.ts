export interface DebugFooterElements {
  container: HTMLDivElement
  textElement: HTMLDivElement
}

// --- Internal state ---------------------------------------------------------
let globalFooter: DebugFooterElements | null = null

// --- Create / Initialize ----------------------------------------------------
export function createDebugFooter(): DebugFooterElements {
  const container = document.createElement('div')
  container.className =
    'fixed bottom-0 left-0 right-0 bg-gray-900/90 dark:bg-black/90 text-green-600 dark:text-green-400 text-xs font-mono p-2 z-50 pointer-events-none'

  const textElement = document.createElement('div')
  textElement.className = 'whitespace-pre-wrap leading-tight'
  container.appendChild(textElement)

  const footer = { container, textElement }
  globalFooter = footer // store reference globally

  return footer
}

// --- Text Update (rolling log) ----------------------------------------------
export function updateDebugText(
  footer: DebugFooterElements,
  text: string,
  maxLines = 10,
): void {
  const lines = footer.textElement.textContent
    ? footer.textElement.textContent.split('\n')
    : []
  lines.push(text)
  while (lines.length > maxLines) lines.shift()
  footer.textElement.textContent = lines.join('\n')
}

// --- Global Logging Helper ---------------------------------------------------
/**
 * Append a structured log entry to the global debug footer.
 * Example:
 *   debugFooterLog('DRAG_START', { delta: -120, vy: -0.35 })
 */
export function debugFooterLog(
  tag: string,
  data: Record<string, unknown> = {},
): void {
  if (!globalFooter) return
  const time = new Date().toLocaleTimeString()
  const msg = `[${time}] ${tag}: ${JSON.stringify(data)}`
  updateDebugText(globalFooter, msg)
}

export function debugFooterClear(): void {
  if (!globalFooter) return
  globalFooter.textElement.textContent = ''
}

// --- Optional helper for explicit control -----------------------------------
export function getDebugFooter(): DebugFooterElements | null {
  return globalFooter
}
