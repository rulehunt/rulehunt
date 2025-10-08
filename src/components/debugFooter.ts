// src/components/debugFooter.ts

export interface DebugFooterElements {
  container: HTMLDivElement
  textElement: HTMLDivElement
}

export function createDebugFooter(): DebugFooterElements {
  const container = document.createElement('div')
  container.className =
    'fixed bottom-0 left-0 right-0 bg-gray-900/90 dark:bg-black/90 text-green-600 dark:text-green-400 text-xs font-mono p-2 z-50 pointer-events-none'
  container.style.maxHeight = '150px'
  container.style.overflowY = 'auto'

  const textElement = document.createElement('div')
  textElement.className = 'whitespace-pre-wrap leading-tight'
  container.appendChild(textElement)

  return { container, textElement }
}

export function updateDebugText(
  elements: DebugFooterElements,
  text: string,
): void {
  elements.textElement.textContent = text
}

export function appendDebugLine(
  elements: DebugFooterElements,
  line: string,
): void {
  const currentText = elements.textElement.textContent || ''
  const lines = currentText.split('\n')
  lines.push(line)

  // Keep only last 6 lines
  if (lines.length > 6) {
    lines.shift()
  }

  elements.textElement.textContent = lines.join('\n')
}
