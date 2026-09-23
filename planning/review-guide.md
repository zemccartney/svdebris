# Review guide

How to read, evaluate, and clean up this package, and how to read the documents that produced it. Written 2026-09-23 for Zack's first pass over code he has not yet seen.

## Reading order for the code

Read in this order; each file assumes the one before.

1. `docs/how-astro-images-run.md`. The whole design rests on the split between the "describe" half of an image service, which runs wherever a page renders, and the "pixels" half, which runs wherever bytes are needed. Read the diagram until the sentence "`getImage()` never produces image data" feels obvious.
2. `packages/svdebris/README.md`. What a user sees. Check every claim against the code as you go.
3. `packages/svdebris/src/service.ts`. Twenty lines. Sharp's service spread into a new object with `validateOptions` replaced. The override runs sharp's own validation first, then, only for an imported SVG whose validated format is svg, returns the options with `src` swapped for the emitted asset URL and the six transform props deleted. Everything downstream in Astro then treats the image the way it treats a file in `public/`: served as-is, no static image registered, no `/_image` URL.
4. `packages/svdebris/src/index.ts`. The integration. Three hooks: `astro:config:setup` sets the service entrypoint and warns under the Cloudflare adapter modes that would route dev raster through this service in workerd; `astro:config:done` throws if another integration replaced the service after it; `astro:build:done` runs the svgo pass unless `optimize` is false.
5. `packages/svdebris/src/optimize.ts`. A port of the site's old svgo integration: walk the output directory, optimize each SVG, write only when smaller, skip and warn on parse errors, log totals.
6. Tests, in this order: `tests/unit/service.test.ts` (the bypass against real sharp), `tests/unit/pins.test.ts` (the Astro conventions the bypass relies on, named so a failure reads as a sentence), `tests/unit/integration.test.ts` and `tests/unit/optimize.test.ts`, then the fixture builds under `tests/integration/`: `static`, `dev`, `base-prefix`, `optimize`, `cloudflare`. The fixtures under `tests/integration/fixtures/` carry a plain `<img src={logo.src}>` beside every `<Image>` on purpose: parity with that tag is the requirement every build test asserts.
7. Packaging and tooling: `packages/svdebris/package.json` (exports, files, peer range), `tsdown.config.ts`, `vitest.config.ts`, `knip.json`, `eslint.config.ts`, `.github/workflows/ci.yml`, `scripts/use-astro.ts`.

## What each test proves, and how to run one alone

Build first if `dist/` is absent: `pnpm --filter @grepco/svdebris build`. Then, from the repo root, `pnpm --filter @grepco/svdebris exec vitest --run <path>`.

| File                                    | Proves                                                                                                                                                                                                                                                                                                                                  |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tests/unit/service.test.ts`            | The override returns the asset URL as `src`, keeps width and height, strips the six transform props, leaves raster input identical to sharp's, leaves string-src SVGs alone, leaves an explicit raster format on an SVG to sharp, and overrides nothing else.                                                                           |
| `tests/unit/pins.test.ts`               | A string `src` counts as remote; base `getURL` returns a non-remote string unchanged; base `getSrcSet` is empty without widths or densities; base `getHTMLAttributes` keeps width and height for a string src. An Astro upgrade that breaks one fails a test whose name states the assumption.                                          |
| `tests/unit/integration.test.ts`        | The three hooks, called with stubbed arguments: entrypoint set, warning fires only for Cloudflare plus the generic endpoint in dev, done check throws naming the replacement, pass skipped with `optimize: false`.                                                                                                                      |
| `tests/unit/optimize.test.ts`           | The pass on a temp directory: smaller output with `viewBox` kept, nested walk, never larger, skip and warn on garbage, silence on an empty directory, default config shape.                                                                                                                                                             |
| `tests/integration/static.test.ts`      | A real static build: one SVG file for six uses (three sizes, a `layout`, a `<Picture formats={["svg"]}>`, a direct `getImage()`), every SVG `<img>` equal to the plain tag's URL, derived dimensions, no srcset for the layout case, no `/_image`, markdown images use the same file, the PNG still produces sharp's two WebP variants. |
| `tests/integration/dev.test.ts`         | The same on a real dev server, plus the SVG URL serving as `image/svg+xml` and raster still going through `/_image`.                                                                                                                                                                                                                    |
| `tests/integration/base-prefix.test.ts` | Parity with the plain tag under `base: "/sub"` and under `build.assetsPrefix`.                                                                                                                                                                                                                                                          |
| `tests/integration/optimize.test.ts`    | With the pass off the emitted SVG is byte-identical to the source; with it on, smaller with `viewBox` kept.                                                                                                                                                                                                                             |
| `tests/integration/cloudflare.test.ts`  | The static assertions through `@astrojs/cloudflare` in `compile` mode: prerender in workerd, files under `dist/client`, the pass reaching them. Slow.                                                                                                                                                                                   |

## What to look for

- **The three conventions.** In `node_modules/astro/dist/assets/internal.js`, find where `getImage` resolves width and height before calling `validateOptions`, and where it skips `addStaticImage` when the URL came back unchanged from a string src. In `services/service.js`, find `getURL` returning a non-remote string unchanged. These are what the pins guard. Ask whether you are comfortable depending on them; the README's "Why this exists" is the argument that the documented behavior (files in `public/` are served as-is) is what we ride on.
- **The format guard.** `validated.format !== "svg"` in `service.ts`. Base validation sets the default format to svg for an SVG source, so the guard only declines the bypass when the caller asked for a raster format explicitly, including `<Picture>`'s default `formats`. Then sharp's own rules apply. Decide whether that is the behavior you want; the alternative, coercing to svg, would silently override explicit intent.
- **The warning condition** in `index.ts`. It fires only when all three hold: dev, Cloudflare adapter, generic endpoint. Trace it against `node_modules/@astrojs/cloudflare/dist/utils/image-config.js` if you want to see why those are the modes where raster in dev would fail.
- **The optimize pass's scope.** It walks `astro:build:done`'s `dir`, which is the client output directory, including files copied from `public/`. The filename hash is computed before the pass, so it is a hash of the unoptimized bytes; the README says so.
- **Packaging.** `exports` map `.` and `./service`; `files` ships `dist` and `src` so sourcemaps resolve; the peer range is `^6.0.0 || ^7.0.0` and CI proves both; `engines.node` is `>=22.12.0`.

## Nits the final review left on purpose

None block anything. Fix the ones you care about.

- `src/optimize.ts`: a file read error rejects the whole hook and fails the build, while a parse error is skipped with a warning; `Promise.all` opens every file at once; the totals log would print `NaN%` if every file were empty.
- `tests/utils/isolated-fixture.ts` and `tests/integration/optimize.test.ts` use `new URL(".", import.meta.url).pathname`; `fileURLToPath` is the correct call and would survive paths with spaces.
- `tests/utils/html.ts`'s `imgTags` matches only double-quoted attributes. Astro emits those, so it holds today.
- `tests/integration/static.test.ts` reads pages with `?? ""`, so a missing page would make the "no `/_image`" check pass vacuously; the other assertions on the same page would fail loudly, so it is covered indirectly.
- With a `layout` prop, Astro emits `sizes` and `data-astro-image` attributes on the SVG `<img>` even though there is no `srcset`. Harmless; browsers ignore `sizes` without `srcset`.
- Test idioms differ slightly between files (a typed tuple in one, a cast in another) and the stubs use `as unknown as` double casts.
- `src/service.ts` sets `format: "svg" as const` after the guard already established it; it pins the literal type and could use a comment saying so.
- `packages/astro-fixture` differs from its source only by the widened Astro peer range, identifier renames a lint forced during scaffolding, and a port counter turned into a closure; `packages/astro-fixture/README.md` records provenance.

## Reading the decision trail

The design was worked out in conversation on 2026-09-13 and lives in the consuming site's repository, `nba-surprise-teams`, branch `image-service`, directory `plan/new-season-sweep/`.

1. `image-service-spec.html`. Open it in a browser; it is a styled document. Every load-bearing claim carries a tag: **verified** means read out of installed source with a file and line cited; **unverified** means a milestone had to prove it; **zack decides** means a product call. Sections 3 to 6 are the design as built; section 8 is a table of everything dropped and why, which is the most useful section when something looks missing.
2. `image-pipeline-model.md`. The same document as this repo's `docs/how-astro-images-run.md`.
3. `image-service-plan.md`. Fourteen tasks with code, commands and expected output. It was executed task by task by subagents with a review after each; it reads as history now. Where the executed code differs from the plan text, `planning/decisions.md` in this repo records the ruling.
4. `log.md`, the entry titled Step 11, records the site's adoption round with its numbers, and the older entries record how the site got to plain `<img>` in the first place.
5. `upstream-issues.md`, also copied to this repo's `planning/`.

Then this repo's `planning/decisions.md`, which condenses every decision, including the eighteen rulings made during execution, each with what it costs if it turns out wrong. If a decision there reads wrong to you, that is exactly the kind of thing to re-open; append a new dated entry rather than editing the old one.
