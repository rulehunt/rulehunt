import fs from 'node:fs'
import path from 'node:path'

type Grid = (0 | 1)[][]

// Conway's Game of Life rules
function countNeighbors(grid: Grid, x: number, y: number): number {
  const height = grid.length
  const width = grid[0].length
  let count = 0

  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue

      const ny = ((y + dy) % height + height) % height
      const nx = ((x + dx) % width + width) % width
      
      if (grid[ny][nx] === 1) {
        count++
      }
    }
  }

  return count
}

function step(grid: Grid): Grid {
  const height = grid.length
  const width = grid[0].length
  const newGrid: Grid = []

  for (let y = 0; y < height; y++) {
    const row: (0 | 1)[] = []
    for (let x = 0; x < width; x++) {
      const neighbors = countNeighbors(grid, x, y)
      const current = grid[y][x]

      if (current === 1) {
        // Cell is alive
        row.push(neighbors === 2 || neighbors === 3 ? 1 : 0)
      } else {
        // Cell is dead
        row.push(neighbors === 3 ? 1 : 0)
      }
    }
    newGrid.push(row)
  }

  return newGrid
}

interface EntityInfo {
  cells: Array<{ x: number; y: number }>
  type?: string // e.g., "blinker", "block", "glider"
}

interface StepExpectation {
  entities: EntityInfo[]
  description?: string
}

interface TestExpectation {
  entityCount: number
  description: string
  // For tracking tests
  trackingBehavior?: {
    allSameId: boolean
    totalUniqueIds?: number
    movementExpected?: boolean
  }
  // Detailed expectations for each step
  stepExpectations?: StepExpectation[]
}

interface TestSequenceConfig {
  name: string
  initial: Grid
  steps: number
  expectations: TestExpectation
}

// Test sequences
const testSequences: Record<string, TestSequenceConfig> = {
  // Blinker: oscillates between horizontal and vertical
  blinker: {
    name: "Blinker (period 2 oscillator)",
    initial: [
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 1, 1, 1, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    ] as Grid,
    steps: 5,
    expectations: {
      entityCount: 1,
      description: "Single blinker oscillating between horizontal and vertical",
      trackingBehavior: {
        allSameId: true,
        totalUniqueIds: 1,
        movementExpected: false
      },
      stepExpectations: [
        {
          entities: [{ cells: [{x: 3, y: 3}, {x: 4, y: 3}, {x: 5, y: 3}], type: "blinker-h" }],
          description: "Horizontal blinker"
        },
        {
          entities: [{ cells: [{x: 4, y: 2}, {x: 4, y: 3}, {x: 4, y: 4}], type: "blinker-v" }],
          description: "Vertical blinker"
        },
        {
          entities: [{ cells: [{x: 3, y: 3}, {x: 4, y: 3}, {x: 5, y: 3}], type: "blinker-h" }],
          description: "Back to horizontal"
        },
        {
          entities: [{ cells: [{x: 4, y: 2}, {x: 4, y: 3}, {x: 4, y: 4}], type: "blinker-v" }],
          description: "Vertical again"
        },
        {
          entities: [{ cells: [{x: 3, y: 3}, {x: 4, y: 3}, {x: 5, y: 3}], type: "blinker-h" }],
          description: "Horizontal again"
        },
        {
          entities: [{ cells: [{x: 4, y: 2}, {x: 4, y: 3}, {x: 4, y: 4}], type: "blinker-v" }],
          description: "Vertical final"
        }
      ]
    }
  },

  // Block: still life
  block: {
    name: "Block (still life)",
    initial: [
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 1, 1, 0, 0, 0, 0, 0],
      [0, 0, 0, 1, 1, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    ] as Grid,
    steps: 3,
    expectations: {
      entityCount: 1,
      description: "Single block that remains still",
      trackingBehavior: {
        allSameId: true,
        totalUniqueIds: 1,
        movementExpected: false
      },
      stepExpectations: [
        {
          entities: [{ cells: [{x: 3, y: 2}, {x: 4, y: 2}, {x: 3, y: 3}, {x: 4, y: 3}], type: "block" }],
          description: "Block initial"
        },
        {
          entities: [{ cells: [{x: 3, y: 2}, {x: 4, y: 2}, {x: 3, y: 3}, {x: 4, y: 3}], type: "block" }],
          description: "Block unchanged"
        },
        {
          entities: [{ cells: [{x: 3, y: 2}, {x: 4, y: 2}, {x: 3, y: 3}, {x: 4, y: 3}], type: "block" }],
          description: "Block still unchanged"
        },
        {
          entities: [{ cells: [{x: 3, y: 2}, {x: 4, y: 2}, {x: 3, y: 3}, {x: 4, y: 3}], type: "block" }],
          description: "Block final"
        }
      ]
    }
  },

  // Glider: moves diagonally
  glider: {
    name: "Glider (spaceship)",
    initial: [
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 1, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 1, 0, 0, 0, 0, 0, 0],
      [0, 1, 1, 1, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    ] as Grid,
    steps: 8,
    expectations: {
      entityCount: 1,
      description: "Single glider moving diagonally - requires phase association",
      trackingBehavior: {
        allSameId: true,
        totalUniqueIds: 1,
        movementExpected: true
      }
    }
  },

  // Two entities: blinker and block
  twoEntities: {
    name: "Two entities (blinker + block)",
    initial: [
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 1, 1, 1, 0, 0, 0, 0, 0, 0], // Blinker
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 1, 1, 0, 0], // Block
      [0, 0, 0, 0, 0, 0, 1, 1, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    ] as Grid,
    steps: 4,
    expectations: {
      entityCount: 2,
      description: "One oscillating blinker and one static block",
      trackingBehavior: {
        allSameId: false,
        totalUniqueIds: 2,
        movementExpected: false
      }
    }
  },

  // Toad: period 2 oscillator with shape change
  toad: {
    name: "Toad (period 2 oscillator)",
    initial: [
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 1, 1, 1, 0, 0, 0, 0],
      [0, 0, 1, 1, 1, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    ] as Grid,
    steps: 4,
    expectations: {
      entityCount: 1,
      description: "Toad oscillator with two distinct phases",
      trackingBehavior: {
        allSameId: true,
        totalUniqueIds: 1,
        movementExpected: false
      }
    }
  },

  // Glider-blinker collision
  gliderBlinkerCollision: {
    name: "Glider collides with blinker",
    initial: [
      [0, 0, 1, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 1, 0, 0, 0, 0, 0, 0],
      [0, 1, 1, 1, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 1, 1, 1, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    ] as Grid,
    steps: 12,
    expectations: {
      entityCount: 2, // Initially 2, but collision behavior varies
      description: "Glider and blinker collision - complex interaction",
      trackingBehavior: {
        allSameId: false,
        totalUniqueIds: undefined, // Complex behavior - entities may merge/split
        movementExpected: true
      }
    }
  },
}

// Generate sequences
function generateSequence(name: string, initial: Grid, steps: number) {
  const sequence: Grid[] = [initial]
  let current = initial

  for (let i = 0; i < steps; i++) {
    current = step(current)
    sequence.push(current)
  }

  return sequence
}

// Main
const outputDir = path.join(process.cwd(), 'resources')
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true })
}

const allSequences: Record<string, { 
  name: string
  sequence: Grid[]
  expectations: TestExpectation
}> = {}

for (const [key, config] of Object.entries(testSequences)) {
  const sequence = generateSequence(key, config.initial, config.steps)
  allSequences[key] = {
    name: config.name,
    sequence,
    expectations: config.expectations,
  }
}

// Custom JSON stringifier for more readable grids
function stringifySequences(sequences: typeof allSequences): string {
  let result = '{\n'
  const entries = Object.entries(sequences)
  
  entries.forEach(([key, data], index) => {
    result += `  "${key}": {\n`
    result += `    "name": "${data.name}",\n`
    
    // Add expectations
    result += `    "expectations": {\n`
    result += `      "entityCount": ${data.expectations.entityCount},\n`
    result += `      "description": "${data.expectations.description}"`
    if (data.expectations.trackingBehavior) {
      result += ',\n      "trackingBehavior": {\n'
      result += `        "allSameId": ${data.expectations.trackingBehavior.allSameId},\n`
      result += `        "totalUniqueIds": ${data.expectations.trackingBehavior.totalUniqueIds ?? 'null'},\n`
      result += `        "movementExpected": ${data.expectations.trackingBehavior.movementExpected ?? false}\n`
      result += '      }'
    }
    result += '\n    },\n'
    
    result += `    "sequence": [\n`
    
    data.sequence.forEach((grid, stepIndex) => {
      result += `      [\n`
      grid.forEach((row, rowIndex) => {
        result += `        [${row.join(',')}]`
        if (rowIndex < grid.length - 1) result += ','
        result += '\n'
      })
      result += `      ]`
      if (stepIndex < data.sequence.length - 1) result += ','
      result += '\n'
    })
    
    result += `    ]\n`
    result += `  }`
    if (index < entries.length - 1) result += ','
    result += '\n'
  })
  
  result += '}\n'
  return result
}

const outputPath = path.join(outputDir, 'conway-test-sequences.json')
fs.writeFileSync(outputPath, stringifySequences(allSequences))

console.log(`Generated Conway's Game of Life test sequences to ${outputPath}`)
console.log('Sequences generated:')
for (const [key, data] of Object.entries(allSequences)) {
  console.log(`- ${key}: ${data.name} (${data.sequence.length} steps)`)
}