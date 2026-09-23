# Decisions

Append-only. Each entry: date, the decision, why, and what it costs if wrong. Re-open a decision by adding a new entry that references the old one.

## 2026-09-11

- **First spec written** for a portable image service: sharp at build, jimp plus wasm codecs at runtime in workerd, a custom endpoint, and an svg-hush audit. Superseded two days later; kept here because section 8 of the final spec explains what was dropped from it.

## 2026-09-13, design

- **SVG is removed from the pixel half entirely, in `validateOptions`.** An imported SVG's `src` is swapped for its emitted asset URL, which Astro treats like a file in `public/`. Why: Astro resolves dimensions before the hook, returns a non-remote string src unchanged from `getURL`, and skips static-image registration when it does. Cost if wrong: depends on undocumented mechanism behind documented behavior; the pin tests exist for that.
- **Runtime raster transformation dropped.** No server-rendered sites to use it; on Cloudflare it competes with an Images binding that is free at personal scale and does the work outside the isolate; wasm encoding in a Worker cannot fit the free plan's 10 ms of CPU. Cost: none for the owner's sites; a narrow open-source audience is unserved.
- **Sharp stays the raster path; jimp and jSquash dropped.** With SVG out of `transform`, the raster half is redundant with Astro's sharp service, so the service spreads sharp's and overrides one method. Cost: none.
- **Cloudflare adapter mode `compile`, not `custom`.** Both honor a user service; `custom` logs a false sharp warning on every dev start because the adapter checks the entrypoint before integrations run. Cost: `compile` provisions an unused local Images binding in dev, silently.
- **svgo lives in the package**, as a build-done pass over the client output, on by default, because Astro's own `experimental.svgOptimizer` optimizes only the inline component markup and never the emitted file, and a bypassed SVG never reaches `transform`. Cost: the filename hash is of unoptimized bytes.
- **No GIF bypass** (sharp converts animated GIF correctly at build), **no svg-hush audit** (its own tool), **AVIF needs nothing** (sharp encodes it at build).
- **Own repository, modelled on the astro-pagemeta workspace**, with git hooks through mise plus hk. Consumed by the site through a `link:` dependency until publish. Cost: the site branch is undeployable until then, by design.
- **Name** `@grepco/astro-image-svg`, changed on 2026-09-23 (below).

## 2026-09-13, execution rulings

Made by the controlling agent while running the plan, each recorded with its cost if wrong.

- R1: six static `delete` statements instead of a loop; the strict lint forbids computed-key delete. Cost: three lines.
- R2: the `config:done` tests use a synchronous `toThrow` form. Cost: none.
- R3: the repo starts with an empty root commit so every review had a base. Cost: one empty commit.
- R6: the workspace root depends on its own package so the Cloudflare adapter's Node-side bare import resolves in the fixture build. Cost: one dev dependency and a knip ignore.
- R7: a deprecated tsdown option (`deps.skipNodeModulesBundle`) replaced by `deps.neverBundle: true`; dist still externalizes Astro and svgo. Cost: none.
- R8: the vendored fixture's Astro peer range widened to include 7. Cost: none.
- R9: a temporary knip ignore for svgo until the pass imported it, then removed. Cost: none.
- R10: a plan test combining `widths` and `densities` split in two; Astro rejects the pair. Cost: none.
- R11: the bypass also requires the validated format to be svg, so an explicit raster format on an SVG goes to sharp as in stock Astro. The spec had claimed Astro throws there; corrected. Cost: an explicit raster request follows the stock path, which it already did.
- R12: two stub type names lengthened for a lint. Cost: none.
- R13: `eslint-plugin-unicorn` 74 renamed `prevent-abbreviations` to `name-replacements`, silently re-enabling abbreviation policing; turned off. Cost: none; it was off by convention.
- R14: the site's prettier config ignores the agent's planning workspace directory. Cost: one ignore line.
- R15: capture-run summaries committed with the site's log entry. Cost: four small files.
- R16: the server island renders 3 logo tags, not the 5 an older log recorded; accepted since before and after island responses differ by 3 bytes and screenshots are identical. Cost: none observed.
- R17: the svgo pass walks the build-done hook's `dir`, verified to be the client directory on both Astro majors, rather than the spec's `config.build.client`. Cost: none.
- R18: the `link:` dependency stays until publish. Cost: none until merge.

## 2026-09-13, final reviews

- README qualified: `<Picture>` needs `formats={["svg"]}`; explicit raster format on an SVG and the `assetsPrefix`-plus-allowed-domain case are documented as untouched; the integration's throw and the `image.service.config` passthrough are documented; adapter major pairing stated.
- `engines.node` set to `>=22.12.0` in both manifests so the Node 22.12 CI leg can install under `engine-strict`.
- `files` ships `src` beside `dist` so sourcemaps resolve; `LICENSE` copied into the package.
- The site's log corrected: the byte deltas came from one whitespace byte per `<Image>` and from the removal of a duplicate `loading` attribute the old plain tag emitted, which had made four `loading="eager"` emoji callers effectively lazy; `<Image>` restored eager.

## 2026-09-23

- **Renamed to `@grepco/svdebris`**, repository `zemccartney/svdebris`. Zack does not want the `astro-` prefix; the README carries a "The name" section; keywords keep `astro` and `astro-integration`. Cost: discoverability leans on keywords.
- **`unrun` added as a dev dependency.** tsdown 0.22 loads its TypeScript config natively only where Node has unflagged type stripping; on Node 22.12 it needs this optional peer, and the first CI run failed that leg without it. Cost: one dev dependency.
- **Work-tracking system adopted**: `AGENTS.md` as the agent-agnostic entry, `planning/STATUS.md` as the single resume point, this log, and `planning/log.md`. Cost: three files to keep current.
