// tests/cellular-automata-factory.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  createCellularAutomata,
  predictImplementation,
} from '../src/cellular-automata-factory'
import type { CAFactoryOptions } from '../src/cellular-automata-factory'

// Mock the GPU.js module
vi.mock('gpu.js', () => {
  return {
    GPU: vi.fn().mockImplementation((options) => {
      // Simulate GPU availability based on test context
      const shouldSucceed =
        !(global as any).__MOCK_GPU_UNAVAILABLE__ &&
        options?.mode === 'gpu'
      return {
        mode: shouldSucceed ? 'gpu' : 'cpu',
        destroy: vi.fn(),
      }
    }),
  }
})

describe('createCellularAutomata', () => {
  beforeEach(() => {
    // Reset GPU availability cache
    ;(global as any).__MOCK_GPU_UNAVAILABLE__ = false
    vi.clearAllMocks()
  })

  afterEach(() => {
    delete (global as any).__MOCK_GPU_UNAVAILABLE__
  })

  describe('forced implementation', () => {
    it('should create CPU implementation when forced', () => {
      const canvas = document.createElement('canvas')
      const options: CAFactoryOptions = {
        gridRows: 100,
        gridCols: 100,
        fgColor: '#ffffff',
        bgColor: '#000000',
        forceImplementation: 'cpu',
      }

      const ca = createCellularAutomata(canvas, options)
      expect(ca).toBeDefined()
      expect(ca.constructor.name).toBe('CellularAutomata')
    })

    it('should create GPU implementation when forced and GPU available', () => {
      const canvas = document.createElement('canvas')
      const options: CAFactoryOptions = {
        gridRows: 100,
        gridCols: 100,
        fgColor: '#ffffff',
        bgColor: '#000000',
        forceImplementation: 'gpu',
      }

      const ca = createCellularAutomata(canvas, options)
      expect(ca).toBeDefined()
      expect(ca.constructor.name).toBe('GPUCellularAutomata')
    })

    it('should create GPU when forced (GPU available in test env)', () => {
      const canvas = document.createElement('canvas')
      const options: CAFactoryOptions = {
        gridRows: 100,
        gridCols: 100,
        fgColor: '#ffffff',
        bgColor: '#000000',
        forceImplementation: 'gpu',
      }

      // In test environment, GPU.js is available, so this should succeed
      const ca = createCellularAutomata(canvas, options)
      expect(ca).toBeDefined()
      expect(ca.constructor.name).toBe('GPUCellularAutomata')
    })
  })

  describe('automatic selection', () => {
    it('should use CPU for headless mode (null canvas)', () => {
      const options: CAFactoryOptions = {
        gridRows: 1000,
        gridCols: 1000,
        fgColor: '#ffffff',
        bgColor: '#000000',
      }

      const ca = createCellularAutomata(null, options)
      expect(ca).toBeDefined()
      expect(ca.constructor.name).toBe('CellularAutomata')
    })

    it('should use GPU for large grid when GPU is available', () => {
      const canvas = document.createElement('canvas')
      const options: CAFactoryOptions = {
        gridRows: 1000,
        gridCols: 1000,
        fgColor: '#ffffff',
        bgColor: '#000000',
      }

      // In test environment, GPU is available and grid is large
      const ca = createCellularAutomata(canvas, options)
      expect(ca).toBeDefined()
      expect(ca.constructor.name).toBe('GPUCellularAutomata')
    })

    it('should use CPU for small grids below threshold', () => {
      const canvas = document.createElement('canvas')
      const options: CAFactoryOptions = {
        gridRows: 100,
        gridCols: 100, // 10,000 cells < default 250,000 threshold
        fgColor: '#ffffff',
        bgColor: '#000000',
      }

      const ca = createCellularAutomata(canvas, options)
      expect(ca).toBeDefined()
      expect(ca.constructor.name).toBe('CellularAutomata')
    })

    it('should use GPU for large grids above threshold', () => {
      const canvas = document.createElement('canvas')
      const options: CAFactoryOptions = {
        gridRows: 1000,
        gridCols: 1000, // 1,000,000 cells > default 250,000 threshold
        fgColor: '#ffffff',
        bgColor: '#000000',
      }

      const ca = createCellularAutomata(canvas, options)
      expect(ca).toBeDefined()
      expect(ca.constructor.name).toBe('GPUCellularAutomata')
    })

    it('should respect custom GPU threshold', () => {
      const canvas = document.createElement('canvas')

      // Grid with 10,000 cells
      const smallOptions: CAFactoryOptions = {
        gridRows: 100,
        gridCols: 100,
        fgColor: '#ffffff',
        bgColor: '#000000',
        gpuThreshold: 5000, // Custom low threshold
      }

      const ca = createCellularAutomata(canvas, smallOptions)
      // 10,000 > 5,000, so should use GPU
      expect(ca.constructor.name).toBe('GPUCellularAutomata')
    })

    it('should use CPU with very high threshold', () => {
      const canvas = document.createElement('canvas')
      const options: CAFactoryOptions = {
        gridRows: 1000,
        gridCols: 1000, // 1,000,000 cells
        fgColor: '#ffffff',
        bgColor: '#000000',
        gpuThreshold: Number.POSITIVE_INFINITY, // Never use GPU
      }

      const ca = createCellularAutomata(canvas, options)
      expect(ca).toBeDefined()
      expect(ca.constructor.name).toBe('CellularAutomata')
    })

    it('should use GPU with threshold of 0', () => {
      const canvas = document.createElement('canvas')
      const options: CAFactoryOptions = {
        gridRows: 10,
        gridCols: 10, // Even tiny grid
        fgColor: '#ffffff',
        bgColor: '#000000',
        gpuThreshold: 0, // Always prefer GPU when available
      }

      const ca = createCellularAutomata(canvas, options)
      expect(ca).toBeDefined()
      expect(ca.constructor.name).toBe('GPUCellularAutomata')
    })
  })

  describe('option forwarding', () => {
    it('should forward all CA options to implementation', () => {
      const canvas = document.createElement('canvas')
      const onDiedOut = vi.fn()

      const options: CAFactoryOptions = {
        gridRows: 100,
        gridCols: 100,
        fgColor: '#ff0000',
        bgColor: '#00ff00',
        onDiedOut,
        forceImplementation: 'cpu',
      }

      const ca = createCellularAutomata(canvas, options)
      expect(ca).toBeDefined()

      // Verify colors were set (checking internal state would require accessing protected properties)
      // We can at least verify the instance was created successfully with these options
    })
  })
})

describe('predictImplementation', () => {
  beforeEach(() => {
    ;(global as any).__MOCK_GPU_UNAVAILABLE__ = false
    vi.clearAllMocks()
  })

  afterEach(() => {
    delete (global as any).__MOCK_GPU_UNAVAILABLE__
  })

  it('should predict CPU when forced', () => {
    const result = predictImplementation(1000, 1000, {
      forceImplementation: 'cpu',
    })
    expect(result).toBe('cpu')
  })

  it('should predict GPU when forced', () => {
    const result = predictImplementation(100, 100, {
      forceImplementation: 'gpu',
    })
    expect(result).toBe('gpu')
  })

  it('should predict CPU for headless mode', () => {
    const result = predictImplementation(1000, 1000, {
      hasCanvas: false,
    })
    expect(result).toBe('cpu')
  })

  it('should predict GPU for large grid when GPU available', () => {
    const result = predictImplementation(1000, 1000, {
      hasCanvas: true,
    })
    // In test environment, GPU is available and grid is large
    expect(result).toBe('gpu')
  })

  it('should predict CPU for small grids', () => {
    const result = predictImplementation(100, 100, {
      hasCanvas: true,
      gpuThreshold: 250_000,
    })
    // 10,000 cells < 250,000
    expect(result).toBe('cpu')
  })

  it('should predict GPU for large grids', () => {
    const result = predictImplementation(1000, 1000, {
      hasCanvas: true,
      gpuThreshold: 250_000,
    })
    // 1,000,000 cells > 250,000
    expect(result).toBe('gpu')
  })

  it('should predict GPU at exact threshold', () => {
    const result = predictImplementation(500, 500, {
      hasCanvas: true,
      gpuThreshold: 250_000,
    })
    // 250,000 cells === 250,000 (should use GPU at >=)
    expect(result).toBe('gpu')
  })

  it('should use default threshold when not specified', () => {
    const result = predictImplementation(400, 400, {
      hasCanvas: true,
    })
    // 160,000 cells < 250,000 default
    expect(result).toBe('cpu')
  })

  it('should predict GPU with custom low threshold', () => {
    const result = predictImplementation(100, 100, {
      hasCanvas: true,
      gpuThreshold: 5000,
    })
    // 10,000 > 5,000
    expect(result).toBe('gpu')
  })

  it('should use default hasCanvas=true when not specified', () => {
    const result = predictImplementation(1000, 1000)
    // Should behave as if hasCanvas=true, so check threshold
    expect(result).toBe('gpu') // 1M cells > default threshold
  })
})
