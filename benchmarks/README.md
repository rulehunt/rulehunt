# RuleHunt Performance Benchmarks

This directory contains performance benchmarks for the RuleHunt cellular automata engine.

## Overview

The main goal of these benchmarks is to determine the optimal grid size where GPU acceleration outperforms CPU computation (issue #12).

## Running Benchmarks

### CPU Benchmarks

CPU benchmarks can be run in Node.js using vitest:

```bash
pnpm vitest bench --run benchmarks/cpu-performance.bench.ts
```

### GPU Benchmarks

GPU benchmarks require a browser environment since WebGL/WebGPU are not available in Node.js. There are two approaches:

1. **Manual Browser Testing**: Open the dev server and use browser DevTools Performance tab
2. **Playwright/Puppeteer**: Automated browser-based benchmarking (future work)

## Benchmark Structure

### CPU Performance (`cpu-performance.bench.ts`)

Tests Conway's Game of Life across various grid sizes:
- 100x100 (10,000 cells)
- 200x200 (40,000 cells)
- 300x300 (90,000 cells)
- 400x400 (160,000 cells)
- 500x500 (250,000 cells)
- 600x600 (360,000 cells)
- 800x800 (640,000 cells)
- 1000x1000 (1,000,000 cells)

Each benchmark runs 100 simulation steps with 5 iterations to get reliable averages.

## Findings

### CPU Performance

The CPU implementation shows linear scaling with grid size, as expected for a naive grid-based cellular automata algorithm.

**Key Observations:**
- Small grids (< 200x200) have negligible overhead
- Medium grids (400x400 - 600x600) are comfortable for 60fps on modern hardware
- Large grids (> 800x800) may struggle to maintain interactive framerates

### GPU Performance

GPU benchmarks require browser environment. Preliminary observations from development:

**Expected Crossover Point:**
Based on GPU.js overhead and transfer costs, GPU acceleration likely becomes beneficial around:
- **Estimated: 400x400 to 600x600 cells (160,000 - 360,000 cells)**
- Below this, CPU may be faster due to GPU setup/transfer overhead
- Above this, massive parallelism of GPU provides significant speedup

### Recommendations

1. **Default Mobile (TARGET_GRID_SIZE = 600,000)**:
   - Use GPU if available
   - Fall back to CPU with adaptive grid sizing

2. **Desktop**:
   - Fixed 400x400 grid works well on CPU
   - Could benefit from GPU acceleration for larger grids

3. **Future Optimization**:
   - Implement GPU/CPU benchmark on startup
   - Dynamically choose implementation based on detected performance
   - Consider WebGPU for better performance than WebGL

## Future Work

- [ ] Browser-based GPU benchmarking infrastructure
- [ ] Automated GPU vs CPU comparison
- [ ] Memory usage profiling
- [ ] WebGPU implementation benchmarks
- [ ] Rule complexity impact analysis (simple vs complex rulesets)
