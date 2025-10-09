# RuleHunt

Distributed exploration of 2^140 C4-symmetric cellular automata rules. TikTok-style mobile interface for crowd-sourced pattern discovery.

## Commands
- `pnpm run check` - TypeScript type checking (required before commit)
- `pnpm run lint` - Biome linter check
- `pnpm run lint:fix` - Auto-fix linting issues
- `pnpm run build` - Full production build (tsc + vite + copy resources)
- `pnpm run dev` - Local Vite dev server

## PR Reviews with Claude Code

RuleHunt uses custom slash commands to streamline PR reviews with
component-specific criteria. Reviews leverage Claude Code's GitHub CLI
integration (`gh pr view`, `gh pr diff`, `gh pr review`).

### Quick Review Pattern

For general reviews, use natural language:
```bash
claude
Please review PR #42 and post your findings
```

For component-specific reviews, use slash commands:
```bash
claude
/review-migration 21  # Database schema changes
/review-api 23        # API endpoint changes
/review-ui 24         # UI component changes
```

### Slash Command Usage

**Database migrations:**
```bash
/review-migration <PR_NUMBER>
```

**API endpoints:**
```bash
/review-api <PR_NUMBER>
```

**UI components:**
```bash
/review-ui <PR_NUMBER>
```

### Review Criteria by Component

| Component | Key Checks |
|-----------|------------|
| **Database Migrations** | SQLite syntax, indexes (partial for booleans), schema.ts alignment, naming (`NNNN_description.sql`) |
| **API Endpoints** | Zod validation, parameterized queries, error format `{ ok: false, error: string }`, status codes |
| **UI Components** | No swipe conflicts (`data-swipe-ignore`), event cleanup, theme support, touch optimization (`passive: true`) |
| **CA Engine** | Interface stability, explicit operations, memory cleanup (`destroy()`), GPU fallback |
| **Utils/Core** | Pure functions, explicit return types, unit tests, no `any` types |

### Examples

**Review a migration PR:**
```bash
claude
/review-migration 21
```
Claude will fetch the diff, check SQL syntax, verify indexes, compare with
schema.ts, and post findings directly to the PR.

**Review an API PR:**
```bash
claude
/review-api 23
```
Claude will verify Zod validation, check for SQL injection prevention, test
error handling patterns, and ensure consistency with existing endpoints.

**Review a UI PR:**
```bash
claude
/review-ui 24
```
Claude will check for swipe gesture conflicts, verify event cleanup, test
theme support, and validate mobile-first responsive patterns.

## Architecture

**Entry Point:** `src/main.ts` - Detects mobile/desktop (<640px breakpoint), mounts layout

**Mobile** (`src/components/mobile.ts`)
- Dual-canvas swipe system for rule transitions
- GPU.js with CPU fallback (tests GPU support on init)
- Swipe timing: pause CA → animate static canvases → swap refs after transition
- 3-second fade pattern for UI elements (zoom buttons, header)

**Desktop** (`src/components/desktop.ts`)
- Grid-based multi-simulation view
- Rule browser with orbit/full pattern visualization
- Click ruleset canvas to inspect rules (printed to console)

**CA Engine**
- `cellular-automata-interface.ts` - Common interface
- `cellular-automata-base.ts` - Shared functionality
- `cellular-automata-cpu.ts` - Optimized CPU implementation
- `cellular-automata-gpu.ts` - WebGPU implementation
- Target: ~1M cells at 60 SPS

**Rulesets** (`src/utils.ts`)
- C4-symmetric: 140-bit compressed → 512-bit expanded lookup
- Hex format: 35 chars (3 + 16 + 16) = 140 bits
- Orbit lookup: Uint8Array[pattern] → orbitId
- Lazy expansion: only expand C4→512 on first CA.play()

**Database** (Cloudflare D1 via Pages Functions)
- `functions/api/save.ts` - Submit run statistics
- `functions/api/leaderboard.ts` - Query top runs
- Schema defined in `src/schema.ts` with Zod validation

## Key Concepts

**C4 Symmetry:** Rotational invariance (0°/90°/180°/270°) reduces 2^512 to 2^140 rules

**Pattern:** 9-bit int (0-511) representing 3×3 neighborhood, little-endian row-major

**Orbit:** Equivalence class of patterns under C4 rotation (140 total orbits)

**RuleData:** `{ name: string, hex: string, ruleset: C4Ruleset | Ruleset, expanded?: Ruleset }`

**Interest Score:** Goldilocks zone heuristic (10-70% population, activity, multi-scale entropy)

## Code Patterns

**Cleanup Functions**
- Always return `CleanupFunction = () => void`
- Clean up timers, event listeners, DOM nodes
- Call cleanup before remounting layouts

**Explicit CA Operations**
```typescript
prepareAutomata(ca, rule, orbitLookup, seedPercentage) // pause, clear, seed, render
startAutomata(ca, rule) // play with expanded ruleset
softResetAutomata(ca) // pause, clear, softReset, render
```

**UI Fade Pattern** (zoom buttons, mobile header)
```typescript
let fadeTimer: number | null = null
const resetFade = () => {
  if (fadeTimer) clearTimeout(fadeTimer)
  element.style.opacity = '1'
  fadeTimer = window.setTimeout(() => {
    element.style.opacity = '0.3'
  }, 3000)
}
```

**Dual Canvas Swipe** (prevents visual flashing)
- onTouchStart: pause onScreen CA (both canvases static)
- onTouchMove: animate both canvas transforms
- onCommit: swap refs AFTER transition completes, defer CA ops by 16ms

## File Organization

```
src/
├── main.ts                          # Entry point, layout switching
├── schema.ts                        # Zod schemas + TypeScript types
├── utils.ts                         # C4 symmetry, hex serialization
├── identity.ts                      # User UUID generation
├── statistics.ts                    # Stats tracking (population, entropy, entities)
├── entityDetection.ts               # Connected component analysis
├── cellular-automata-*.ts           # CA engine implementations
├── api/                             # Frontend API clients
│   ├── save.ts                      # POST run submissions
│   └── leaderboard.ts               # GET top runs
└── components/
    ├── mobile.ts                    # Mobile TikTok-style layout
    ├── mobileHeader.ts              # Mobile header with info overlay
    ├── desktop.ts                   # Desktop multi-sim grid
    ├── desktopHeader.ts             # Desktop header with controls
    ├── simulation.ts                # Single simulation component
    ├── ruleset.ts                   # Ruleset visualization (orbit/full)
    ├── statsOverlay.ts              # Mobile stats modal
    ├── progressBar.ts               # Simulation progress indicator
    ├── leaderboard.ts               # Leaderboard display
    ├── theme.ts                     # Dark/light mode toggle
    └── shared/                      # Reusable components
        ├── stats.ts                 # Stats display logic
        └── simulationInfo.ts        # Simulation metadata display

functions/api/                       # Cloudflare Pages Functions
├── save.ts                          # D1 insert endpoint
└── leaderboard.ts                   # D1 query endpoint

resources/
└── c4-orbits.json                   # Precomputed C4 orbit data (140 orbits)

scripts/
└── generate-c4-orbits.ts            # Generate orbit lookup table
```

## Conventions

**Commits:** `feat:`, `fix:`, `chore:` + Claude Code footer
**PRs:** Title matches commit convention, link issues with `Resolves #N`
**TypeScript:** Strict mode, no `any` types, explicit return types on exported functions
**Formatting:** Biome with single quotes, semicolons optional, 80 char line width, 2-space indent
**Testing:** Minimal (vitest for `entityDetection.test.ts` only) - more tests needed (issue #13)

## Common Patterns from Codebase

**Swipe-ignore elements** (mobile.ts)
```typescript
btn.setAttribute('data-swipe-ignore', 'true')
btn.style.touchAction = 'manipulation' // avoids 300ms delay
```

**Theme detection**
```typescript
const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches
```

**Resize debouncing**
```typescript
let resizeTimer: number | null = null
window.addEventListener('resize', () => {
  if (resizeTimer) clearTimeout(resizeTimer)
  resizeTimer = window.setTimeout(handleResize, 120)
})
```

**Grid size calculation** (mobile.ts:101-117)
- Target 600k cells max
- Compute adaptive cellSize to fit screen

## Known Limitations

- No URL state management yet (issue #3: shareable links)
- Desktop reset is hard reset (issue #11: needs soft reset like mobile)
- GPU benchmark not done (issue #12)
- Minimal test coverage (issue #13)
- Console-only rule inspection on desktop (issue #8: needs UI)

## Deployment

- Cloudflare Pages for static frontend
- Cloudflare D1 for run storage
- `pnpm run deploy` - Deploy to rulehunt.org
- Database migrations: `pnpm run db:migrate`
