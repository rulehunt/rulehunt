/**
 * Grid Editor Component
 *
 * Provides drawing tools for editing cellular automata grids.
 * Issue #9 - Phase 1: Grid Editing Tools
 */

import type { CellularAutomataBase } from '../../cellular-automata-base'

export type Tool = 'pencil' | 'line' | 'rectangle' | 'bucket' | 'erase'

export interface GridEditorElements {
  container: HTMLDivElement
  btnEditMode: HTMLButtonElement
  toolsContainer: HTMLDivElement
  btnPencil: HTMLButtonElement
  btnLine: HTMLButtonElement
  btnRectangle: HTMLButtonElement
  btnBucket: HTMLButtonElement
  btnErase: HTMLButtonElement
  btnClear: HTMLButtonElement
  btnUndo: HTMLButtonElement
  btnRedo: HTMLButtonElement
}

interface EditState {
  isEditMode: boolean
  activeTool: Tool
  isDrawing: boolean
  startRow?: number
  startCol?: number
  history: Uint8Array[]
  historyIndex: number
}

export class GridEditor {
  private elements: GridEditorElements
  private ca: CellularAutomataBase
  private canvas: HTMLCanvasElement
  private state: EditState
  private gridRows: number
  private gridCols: number

  constructor(
    ca: CellularAutomataBase,
    canvas: HTMLCanvasElement,
    gridRows: number,
    gridCols: number,
  ) {
    this.ca = ca
    this.canvas = canvas
    this.gridRows = gridRows
    this.gridCols = gridCols

    this.state = {
      isEditMode: false,
      activeTool: 'pencil',
      isDrawing: false,
      history: [],
      historyIndex: -1,
    }

    this.elements = this.createElements()
    this.attachEventListeners()
  }

  private createElements(): GridEditorElements {
    const container = document.createElement('div')
    container.className = 'flex flex-col gap-2 p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-800'

    // Edit mode toggle button
    const btnEditMode = document.createElement('button')
    btnEditMode.textContent = 'Enter Edit Mode'
    btnEditMode.className = 'px-4 py-2 rounded-md border border-blue-300 dark:border-blue-600 bg-blue-50 dark:bg-blue-900 text-sm hover:bg-blue-100 dark:hover:bg-blue-800 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500'

    // Tools container (hidden by default)
    const toolsContainer = document.createElement('div')
    toolsContainer.className = 'flex flex-col gap-2'
    toolsContainer.style.display = 'none'

    // Tool buttons
    const btnPencil = this.createToolButton('✏️ Pencil', 'pencil')
    const btnLine = this.createToolButton('📏 Line', 'line')
    const btnRectangle = this.createToolButton('⬜ Rectangle', 'rectangle')
    const btnBucket = this.createToolButton('🪣 Fill', 'bucket')
    const btnErase = this.createToolButton('🧹 Erase', 'erase')

    // Action buttons
    const btnClear = document.createElement('button')
    btnClear.textContent = '🗑️ Clear All'
    btnClear.className = 'px-4 py-2 rounded-md border border-red-300 dark:border-red-600 bg-red-50 dark:bg-red-900 text-sm hover:bg-red-100 dark:hover:bg-red-800 transition-colors'

    const btnUndo = document.createElement('button')
    btnUndo.textContent = '↶ Undo'
    btnUndo.className = 'px-4 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors'
    btnUndo.disabled = true

    const btnRedo = document.createElement('button')
    btnRedo.textContent = '↷ Redo'
    btnRedo.className = 'px-4 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors'
    btnRedo.disabled = true

    // Assemble tools
    const toolsRow = document.createElement('div')
    toolsRow.className = 'flex flex-wrap gap-2'
    toolsRow.appendChild(btnPencil)
    toolsRow.appendChild(btnLine)
    toolsRow.appendChild(btnRectangle)
    toolsRow.appendChild(btnBucket)
    toolsRow.appendChild(btnErase)

    const actionsRow = document.createElement('div')
    actionsRow.className = 'flex flex-wrap gap-2'
    actionsRow.appendChild(btnClear)
    actionsRow.appendChild(btnUndo)
    actionsRow.appendChild(btnRedo)

    toolsContainer.appendChild(toolsRow)
    toolsContainer.appendChild(actionsRow)
    container.appendChild(btnEditMode)
    container.appendChild(toolsContainer)

    return {
      container,
      btnEditMode,
      toolsContainer,
      btnPencil,
      btnLine,
      btnRectangle,
      btnBucket,
      btnErase,
      btnClear,
      btnUndo,
      btnRedo,
    }
  }

  private createToolButton(label: string, tool: Tool): HTMLButtonElement {
    const btn = document.createElement('button')
    btn.textContent = label
    btn.dataset.tool = tool
    btn.className = 'px-4 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors'
    return btn
  }

  private attachEventListeners(): void {
    // Edit mode toggle
    this.elements.btnEditMode.addEventListener('click', () => {
      this.toggleEditMode()
    })

    // Tool selection
    const toolButtons = [
      this.elements.btnPencil,
      this.elements.btnLine,
      this.elements.btnRectangle,
      this.elements.btnBucket,
      this.elements.btnErase,
    ]

    for (const btn of toolButtons) {
      btn.addEventListener('click', () => {
        const tool = btn.dataset.tool as Tool
        this.setActiveTool(tool)
      })
    }

    // Actions
    this.elements.btnClear.addEventListener('click', () => this.clearGrid())
    this.elements.btnUndo.addEventListener('click', () => this.undo())
    this.elements.btnRedo.addEventListener('click', () => this.redo())

    // Canvas events (only active in edit mode)
    this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e))
    this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e))
    this.canvas.addEventListener('mouseup', () => this.handleMouseUp())
    this.canvas.addEventListener('mouseleave', () => this.handleMouseUp())
  }

  private toggleEditMode(): void {
    this.state.isEditMode = !this.state.isEditMode

    if (this.state.isEditMode) {
      // Enter edit mode
      this.ca.pause()
      this.elements.btnEditMode.textContent = 'Exit Edit Mode'
      this.elements.btnEditMode.className = 'px-4 py-2 rounded-md border border-green-300 dark:border-green-600 bg-green-50 dark:bg-green-900 text-sm hover:bg-green-100 dark:hover:bg-green-800 transition-colors focus:outline-none focus:ring-2 focus:ring-green-500'
      this.elements.toolsContainer.style.display = 'flex'
      this.canvas.style.cursor = 'crosshair'
      this.saveHistory() // Save initial state
    } else {
      // Exit edit mode
      this.elements.btnEditMode.textContent = 'Enter Edit Mode'
      this.elements.btnEditMode.className = 'px-4 py-2 rounded-md border border-blue-300 dark:border-blue-600 bg-blue-50 dark:bg-blue-900 text-sm hover:bg-blue-100 dark:hover:bg-blue-800 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500'
      this.elements.toolsContainer.style.display = 'none'
      this.canvas.style.cursor = 'default'
    }
  }

  private setActiveTool(tool: Tool): void {
    this.state.activeTool = tool

    // Update button styles
    const toolButtons = [
      this.elements.btnPencil,
      this.elements.btnLine,
      this.elements.btnRectangle,
      this.elements.btnBucket,
      this.elements.btnErase,
    ]

    for (const btn of toolButtons) {
      if (btn.dataset.tool === tool) {
        btn.className = 'px-4 py-2 rounded-md border-2 border-blue-500 bg-blue-100 dark:bg-blue-900 text-sm font-semibold'
      } else {
        btn.className = 'px-4 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors'
      }
    }
  }

  private getGridCoordinates(e: MouseEvent): { row: number; col: number } | null {
    const rect = this.canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    const cellWidth = rect.width / this.gridCols
    const cellHeight = rect.height / this.gridRows

    const col = Math.floor(x / cellWidth)
    const row = Math.floor(y / cellHeight)

    if (row < 0 || row >= this.gridRows || col < 0 || col >= this.gridCols) {
      return null
    }

    return { row, col }
  }

  private handleMouseDown(e: MouseEvent): void {
    if (!this.state.isEditMode) return

    const coords = this.getGridCoordinates(e)
    if (!coords) return

    this.state.isDrawing = true
    this.state.startRow = coords.row
    this.state.startCol = coords.col

    this.saveHistory() // Save before edit

    // Apply tool
    switch (this.state.activeTool) {
      case 'pencil':
        this.applyPencil(coords.row, coords.col)
        break
      case 'erase':
        this.applyErase(coords.row, coords.col)
        break
      case 'bucket':
        this.applyBucket(coords.row, coords.col)
        break
      // Line and rectangle handled on mouse up
    }
  }

  private handleMouseMove(e: MouseEvent): void {
    if (!this.state.isDrawing || !this.state.isEditMode) return

    const coords = this.getGridCoordinates(e)
    if (!coords) return

    // Only pencil and erase work on drag
    if (this.state.activeTool === 'pencil') {
      this.applyPencil(coords.row, coords.col)
    } else if (this.state.activeTool === 'erase') {
      this.applyErase(coords.row, coords.col)
    }
  }

  private handleMouseUp(): void {
    if (!this.state.isDrawing) return

    this.state.isDrawing = false
    // Tools like line/rectangle would complete here
    this.state.startRow = undefined
    this.state.startCol = undefined
  }

  private applyPencil(row: number, col: number): void {
    this.ca.setCell(row, col, 1) // Draw alive cell
    this.ca.render()
  }

  private applyErase(row: number, col: number): void {
    this.ca.setCell(row, col, 0) // Erase (set to dead)
    this.ca.render()
  }

  private applyBucket(startRow: number, startCol: number): void {
    // Flood fill algorithm
    const targetValue = this.ca.getCell(startRow, startCol)
    if (targetValue === undefined) return

    const fillValue = this.state.activeTool === 'erase' ? 0 : 1
    if (targetValue === fillValue) return // Already filled

    const queue: Array<[number, number]> = [[startRow, startCol]]
    const visited = new Set<string>()
    let iterations = 0
    const maxIterations = 100000 // Prevent infinite loops

    while (queue.length > 0 && iterations++ < maxIterations) {
      const [row, col] = queue.shift()!
      const key = `${row},${col}`

      if (visited.has(key)) continue
      visited.add(key)

      const currentValue = this.ca.getCell(row, col)
      if (currentValue !== targetValue) continue

      this.ca.setCell(row, col, fillValue)

      // Add neighbors
      const neighbors: Array<[number, number]> = [
        [row - 1, col],
        [row + 1, col],
        [row, col - 1],
        [row, col + 1],
      ]

      for (const [r, c] of neighbors) {
        if (r >= 0 && r < this.gridRows && c >= 0 && c < this.gridCols) {
          queue.push([r, c])
        }
      }
    }

    this.ca.render()
  }

  private clearGrid(): void {
    this.saveHistory()
    this.ca.clearGrid()
    this.ca.render()
  }

  private saveHistory(): void {
    // Remove any redo history
    this.state.history = this.state.history.slice(0, this.state.historyIndex + 1)

    // Save current state
    const gridCopy = this.ca.getGrid()
    this.state.history.push(gridCopy)
    this.state.historyIndex++

    // Limit history size
    const maxHistory = 20
    if (this.state.history.length > maxHistory) {
      this.state.history.shift()
      this.state.historyIndex--
    }

    this.updateHistoryButtons()
  }

  private undo(): void {
    if (this.state.historyIndex <= 0) return

    this.state.historyIndex--
    const gridState = this.state.history[this.state.historyIndex]
    this.ca.setGrid(gridState)
    this.ca.render()
    this.updateHistoryButtons()
  }

  private redo(): void {
    if (this.state.historyIndex >= this.state.history.length - 1) return

    this.state.historyIndex++
    const gridState = this.state.history[this.state.historyIndex]
    this.ca.setGrid(gridState)
    this.ca.render()
    this.updateHistoryButtons()
  }

  private updateHistoryButtons(): void {
    this.elements.btnUndo.disabled = this.state.historyIndex <= 0
    this.elements.btnRedo.disabled =
      this.state.historyIndex >= this.state.history.length - 1
  }

  getContainer(): HTMLDivElement {
    return this.elements.container
  }

  destroy(): void {
    // Clean up event listeners if needed
    this.state.history = []
  }
}
