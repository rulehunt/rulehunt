import type { Coordinate, Grid } from './schema'

export interface Entity {
  cells: Coordinate[]
}

export function detectEntities(grid: Grid): Entity[] {
  const height = grid.length
  const width = grid[0]?.length ?? 0

  if (height !== 10 || width !== 10) {
    throw new Error('Grid must be 10x10')
  }

  const visited = Array(height)
    .fill(null)
    .map(() => Array(width).fill(false))
  const entities: Entity[] = []

  const getCell = (y: number, x: number): 0 | 1 => {
    const wrappedY = ((y % height) + height) % height
    const wrappedX = ((x % width) + width) % width
    return grid[wrappedY][wrappedX]
  }

  const hasEmptyBorder = (cells: Coordinate[]): boolean => {
    const borderCells = new Set<string>()

    for (const { x, y } of cells) {
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          if (Math.abs(dy) === 2 || Math.abs(dx) === 2) {
            borderCells.add(`${y + dy},${x + dx}`)
          }
        }
      }
    }

    const entityCells = new Set(cells.map(({ x, y }) => `${y},${x}`))

    for (const cellStr of borderCells) {
      if (!entityCells.has(cellStr)) {
        const [y, x] = cellStr.split(',').map(Number)
        if (getCell(y, x) === 1) {
          return false
        }
      }
    }

    return true
  }

  const bfs = (startY: number, startX: number): Coordinate[] => {
    const queue: Coordinate[] = [{ x: startX, y: startY }]
    const component: Coordinate[] = []
    visited[startY][startX] = true

    while (queue.length > 0) {
      const coord = queue.shift()
      if (!coord) continue
      component.push(coord)

      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dy === 0 && dx === 0) continue

          const newY = (((coord.y + dy) % height) + height) % height
          const newX = (((coord.x + dx) % width) + width) % width

          if (!visited[newY][newX] && grid[newY][newX] === 1) {
            visited[newY][newX] = true
            queue.push({ x: newX, y: newY })
          }
        }
      }
    }

    return component
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (grid[y][x] === 1 && !visited[y][x]) {
        const component = bfs(y, x)
        if (hasEmptyBorder(component)) {
          entities.push({ cells: component })
        }
      }
    }
  }

  return entities
}
