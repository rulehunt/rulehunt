// src/components/debugFooter.ts

export interface DebugFooterElements {
  container: HTMLDivElement
  textElement: HTMLDivElement
}

export function createDebugFooter(): DebugFooterElements {
  const container = document.createElement('div')
  container.className =
    'fixed bottom-0 left-0 right-0 bg-gray-900/90 dark:bg-black/90 text-green-600 dark:text-green-400 text-xs font-mono p-2 z-50 pointer-events-none'

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
