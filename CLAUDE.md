<!-- BEGIN LOOM ORCHESTRATION -->
This repository uses [Loom](https://github.com/rjwalters/loom) for AI-powered development orchestration — see the Loom repository for the full guide (roles, labels, worktrees, configuration). When installed, Loom also writes a locally-substituted copy of that guide to `.loom/CLAUDE.md`.
<!-- END LOOM ORCHESTRATION -->

<!-- BEGIN REPO-SKILLS -->
This repository has [Repo Skills](https://github.com/rjwalters/repo) v0.12.3 installed —
general repository hygiene and environment commands invoked as `/repo:<command>`. Run
`/repo:help` for the command list, or see `.claude/skills/repo/SKILL.md` for the full
guide. Hygiene commands apply safe, reversible fixes by default and report each
change; run with `--ask` to review first, and `--prune` to allow irreversible
removals. Managed by `install.sh` — edit outside the markers only.
<!-- END REPO-SKILLS -->

## About RuleHunt

RuleHunt is a web platform for exploring the space of 2D cellular automata
rules — a TikTok-style interface where visitors contribute compute to discover
and catalog interesting emergent behaviour among the 2^512 possible rules.
Live at https://rulehunt.org/.

## Stack

- TypeScript, no UI framework — DOM built directly in `src/components/`
- Vite (rolldown-backed) for dev and build; Biome for lint and format
- Vitest + jsdom for tests, coverage via v8, reported to Codecov
- Cloudflare Pages for hosting, Pages Functions for the API, D1 for storage
- pnpm, pinned via the `packageManager` field

## Commands

```bash
pnpm dev              # vite dev server
pnpm build            # generate build info, tsc -b, vite build, copy resources
pnpm ci               # what CI runs: check + lint + test:coverage
pnpm check            # tsc --noEmit
pnpm lint             # biome check .      (lint:fix to apply)
pnpm test             # vitest watch       (test:coverage for one-shot + lcov)
pnpm db-local:init    # initialise the local D1 database
pnpm db-prod:migrate  # apply migrations to the remote D1 database
```

## Layout

- `src/cellular-automata-*.ts` — the CA engine. A factory picks a CPU or GPU
  (gpu.js) implementation at runtime based on grid size and whether rendering
  is needed; `cellular-automata-interface.ts` is the contract both satisfy.
- `src/components/{desktop,mobile,shared}/` — the two layouts and what they
  share; `audioEngine.ts` sonifies activity.
- `src/entityDetection.ts` — finds and classifies structures in a grid.
- `functions/api/` — Cloudflare Pages Functions; each file is an endpoint.
- `migrations/` — D1 schema, applied in order.
- `resources/` — generated data (C4 orbits, Conway test sequences) committed
  alongside the `scripts/generate-*.ts` that produce them.

## Notes

- `src/buildInfo.ts` is generated and gitignored. `tsc` needs it, so run
  `node scripts/generate-build-info.cjs` before type-checking a clean checkout.
- Tests run under jsdom, which does not expose Web Storage; `tests/setup.ts`
  supplies an in-memory `localStorage`.
