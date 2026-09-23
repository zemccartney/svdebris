# Working in this repository

This file is the entry point for any coding agent (pi, Claude Code, Codex, Cursor, or a person). Read it first, then `planning/STATUS.md`, and only then touch code.

## What this is

`@grepco/svdebris` is an Astro integration. Its image service is Astro's own sharp service with one method overridden, `validateOptions`, so an imported SVG whose requested format is svg is handed back as a reference to its own emitted file: one file per source, correct derived dimensions, no `/_image` request in dev, build, or production, on any adapter. The integration sets that service, warns under Cloudflare adapter modes where dev raster would break, and runs an svgo pass over the build output. Nothing else. The name is explained in `packages/svdebris/README.md`.

The mental model behind it is `docs/how-astro-images-run.md`. Read it before reading `packages/svdebris/src/service.ts`; the code is twenty lines and every one of them leans on that model.

## Layout

- `packages/svdebris/` is the published package: `src/` (three files), `tests/` (unit, pins, fixture builds), `README.md`.
- `packages/astro-fixture/` is a vendored test harness that drives real Astro builds and dev servers; it is not published.
- `planning/` is the work-tracking system described below.
- `docs/` holds explanations that outlive any one phase.
- `scripts/use-astro.ts` switches the workspace to another supported Astro major for local and CI matrix runs.

## Commands

Tools are pinned by `mise.toml` (node, pnpm, hk). Run `mise install --locked` once, then `mise run setup` to install dependencies and git hooks. From the repo root:

- `pnpm build` builds the package with tsdown, then runs attw and publint.
- `pnpm --filter @grepco/svdebris test` runs the whole suite. The Cloudflare fixture build inside it takes a minute or more.
- `pnpm --filter @grepco/svdebris exec vitest --run tests/unit` runs only the fast unit and pin tests. Run `pnpm build` first if `dist/` is missing, since fixture tests resolve the package through its built entry points.
- `pnpm lint`, `pnpm fmt`, `pnpm typecheck`, `pnpm knip` are the static checks; `mise run check` runs all of them plus the tests through hk.
- `node scripts/use-astro.ts 6` switches to Astro 6; restore with `git restore pnpm-workspace.yaml packages/svdebris/package.json pnpm-lock.yaml && pnpm install`.

Hooks: hk runs prettier, eslint and typecheck on every commit and stages fixes. The lint is strict: no non-null assertions, no `any` reaching an assertion, sorted imports and object keys, JSDoc descriptions where JSDoc exists. Abbreviation policing is deliberately off.

## How work is tracked here

Three files in `planning/` carry every phase, so that work split across days and agents does not lose its place:

- `planning/STATUS.md` is the single resume point. Its "Now" section is the next thing to do; its "Remaining phases" section is everything after that; its "Resume checklist" is what an agent does before starting. Update it at the end of every session, even a short one.
- `planning/decisions.md` is the decision log. Every choice that a later reader might reasonably re-litigate gets an entry with the date, the decision, the reason, and what it costs if wrong. Append; never rewrite history.
- `planning/log.md` is the session log. One entry per session: what changed, what was verified, what was left open.

Companion files: `planning/review-guide.md` says how to read and evaluate the code and the documents; `planning/upstream-issues.md` holds the adapter and core issues found along the way, with reproductions.

The design documents that produced this package live in the consuming site's repository, `nba-surprise-teams`, branch `image-service`, under `plan/new-season-sweep/`: the spec (`image-service-spec.html`, open it in a browser), the implementation plan, and the site's log. `planning/review-guide.md` explains how to read them.

## Resuming

On resume, an agent reads this file, `planning/STATUS.md`, and `planning/log.md`'s last entry, then asks the owner the questions in the status file's resume checklist before doing anything, and restates the stopping point, the next step, and the remaining work in its own words. Then it works, and before stopping it updates `STATUS.md`, appends to `log.md`, and records any decision in `decisions.md`.

## Conventions

- Commits: imperative subject, a body that says why, and whatever attribution trailer your agent's conventions require.
- Never edit `packages/astro-fixture/` casually; it is vendored, and its README records its provenance and the deviations from upstream.
- Keep the package doing one thing. Runtime raster transformation, custom endpoints, GIF handling, and SVG sanitizing were all considered and deliberately excluded; `planning/decisions.md` says why.
