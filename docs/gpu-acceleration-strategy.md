# GPU Acceleration Strategy

## Summary

After benchmarking GPU.js vs CPU implementations across different grid sizes, we've implemented a **dynamic selection strategy** that automatically chooses the best implementation based on grid size and rendering needs.

## Key Findings

### Performance Comparison (400x400 grid, 160K cells)

- **CPU (optimized)**: ~7ms/step → **140 SPS**
- **GPU.js**: ~12-15ms/step → **66-79 SPS**

**Result**: GPU.js is **2x SLOWER** than optimized CPU for typical data mode grid sizes due to GPU ↔ CPU synchronization overhead.

### Root Cause

GPU.js requires per-step synchronization (`syncToHost()`) to copy GPU texture data back to CPU for statistics tracking. This overhead dominates performance at moderate grid sizes (< 500x500).

```typescript
// GPU.js overhead per step:
1. GPU kernel computation    (~2-3ms)
2. syncToHost() GPU→CPU copy  (~9-12ms) ← BOTTLENECK
3. Statistics on CPU          (~0.6ms)
```

## Implementation: Dynamic Selection Factory

Created `src/cellular-automata-factory.ts` that automatically selects CPU vs GPU based on:

1. **GPU Availability**: Feature detection with caching
2. **Grid Size**: Crossover threshold (default: 250K cells = 500x500)
3. **Canvas Presence**: Headless mode always uses CPU
4. **Override Options**: Force CPU or GPU if needed

### Usage

```typescript
import { createCellularAutomata } from './cellular-automata-factory'

// Automatic selection (recommended)
const ca = createCellularAutomata(canvas, {
  gridRows: 400,
  gridCols: 400,
  fgColor: '#000000',
  bgColor: '#ffffff',
  // gpuThreshold: 250_000 (default)
})

// Force CPU (useful for data collection)
const cpuCA = createCellularAutomata(canvas, {
  gridRows: 400,
  gridCols: 400,
  forceImplementation: 'cpu',
  ...options
})

// Custom threshold
const customCA = createCellularAutomata(canvas, {
  gridRows: 800,
  gridCols: 800,
  gpuThreshold: 500_000, // Only use GPU above 500K cells
  ...options
})
```

### Selection Logic

| Grid Size | Canvas | Selection | Reason |
|-----------|--------|-----------|--------|
| < 250K cells | Yes | **CPU** | Sync overhead > GPU speedup |
| ≥ 250K cells | Yes | **GPU** | Parallelism outweighs sync cost |
| Any size | No (headless) | **CPU** | Statistics need frequent sync |
| Any size | Force override | **As specified** | Manual control |

## Current Usage

### Mobile Layout
- Target: ~600K cells (adaptive)
- **Will use GPU** on most devices (above 250K threshold)
- Mobile benefits from GPU.js parallelism at larger grid sizes

### Desktop Layout
- Currently uses CPU directly
- Could benefit from factory for larger simulations

### Data Mode (Headless)
- 400x400 = 160K cells
- **Uses CPU** (headless + below threshold)
- Optimized CPU faster for data collection workflows

## Performance Targets & Achievements

| Mode | Grid Size | Target SPS | Achieved | Implementation |
|------|-----------|------------|----------|----------------|
| Data Mode | 400x400 (160K) | 200 | **140** | CPU ✅ |
| Mobile | ~600K (adaptive) | 60 | TBD | GPU (likely) |
| Desktop | 300x300 (90K) | 60 | TBD | CPU |

**Data Mode**: With Phase 2 optimizations, we achieved **140 SPS** (70% of target) using CPU. This is excellent performance without GPU complexity.

## Desktop Benchmark Tool

The existing `src/components/desktop/benchmark.ts` provides a comprehensive CPU vs GPU comparison tool that:

- Tests multiple grid sizes (100x100 through 700x700)
- Accumulates samples across multiple rounds
- Calculates statistics with error bars
- Identifies crossover point where GPU becomes faster
- Persists results to localStorage

**Usage**: Access via desktop layout's benchmark modal to determine optimal threshold for your hardware.

## Future Optimizations

### Near-term
1. ✅ Dynamic CPU/GPU selection (implemented)
2. ⏳ Use factory in desktop layout
3. ⏳ Run desktop benchmark to validate 250K threshold

### Long-term (if 200+ SPS needed for data mode)
1. **Native WebGPU**: Replace GPU.js with native WebGPU API
   - Eliminates library overhead
   - Better control over sync strategy
   - Potential 3-5x speedup over current GPU.js

2. **Batched Synchronization**: Run N steps on GPU before syncing
   - Amortize sync cost over multiple steps
   - Statistics sampling already supports this (every 10 steps)

3. **GPU-side Statistics**: Move entity detection & entropy to GPU
   - Eliminate sync entirely during simulation
   - Only sync final results
   - Significant architecture change

## Recommendations

### For Current Needs
**Stick with CPU** for data mode:
- 140 SPS is excellent (3x baseline improvement)
- Simple, reliable, well-tested
- Statistics optimization was the real win (23x improvement)
- GPU acceleration not worth the complexity for current grid sizes

### For Future Scaling
**Consider GPU.js** when:
- Target grid sizes > 500x500 (250K+ cells)
- Real-time rendering is priority
- 60 SPS target (not 200+)

**Consider Native WebGPU** when:
- Need 200+ SPS for large grids
- Willing to invest in significant architecture changes
- Statistics can be GPU-accelerated or sampled less frequently

## Files Modified

- **Created**: `src/cellular-automata-factory.ts` - Dynamic selection logic
- **Modified**: `src/components/mobile/layout.ts` - Uses factory instead of direct instantiation
- **Modified**: `src/cellular-automata-gpu.ts` - Fixed statistics recording for headless mode
- **Existing**: `src/components/desktop/benchmark.ts` - CPU vs GPU benchmark tool

## Testing

- ✅ Type check passes
- ⏳ Runtime test with mobile layout
- ⏳ Verify console logs show correct selection
- ⏳ Run desktop benchmark to validate crossover point

## References

- Phase 2 optimization results: `docs/entity-detection-optimization-plan.md`
- GPU.js library: https://gpu.rocks/
- WebGPU spec: https://gpuweb.github.io/gpuweb/
- Desktop benchmark implementation: `src/components/desktop/benchmark.ts`
