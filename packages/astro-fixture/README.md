# @grepco/astro-fixture

Private, vendored test harness for driving real Astro dev servers and builds in this workspace's tests. Not published.

## Why vendored

The upstream package (`@inox-tools/astro-tests`) gates its Astro support through a peer range (e.g. 1.0 supports only `astro ^6.0.8`), which put a third party on this workspace's Astro-upgrade critical path. Vendoring inverts that: we fix ~400 lines we can read, on our schedule. It also makes historically opaque test-infra behavior (undici agent config, server lifecycle — see `planning/artifacts/testing-isolation.md`) inspectable in-tree.

## Provenance

Vendored 2026-07-03 from **`@inox-tools/astro-tests@0.8.1`** (MIT, © Luiz Ferraz) — the exact version this workspace's suite was green on under Astro 5.

That package appears closely based on **Astro core's internal test harness** (`packages/astro/test/test-utils.ts` and `test-adapter.js` in [withastro/astro](https://github.com/withastro/astro)) — its `testAdapter` explicitly says it was copied from Astro's; for the fixture the derivation direction is unverified, but the resemblance is strong. Functionally it is that harness expressed against Astro's public programmatic API (`astro`, `astro/config`, `astro/app`) instead of Astro's monorepo-internal `../dist/...` imports. We vendored this form because the public API is the only stable contract available outside Astro's repo; Astro's own file cannot run against an installed `astro` package.

## Maintenance: the two-upstream diff

> **TLDR intuition: Astro tells you _what_ changed; inox shows you how that change looks _in your file's shape_.**

When upgrading Astro majors (or chasing harness bugs), consult both upstreams:

1. **Astro core (source of truth for driving Astro):** diff `packages/astro/test/test-utils.ts` between the git tags matching the Astro versions in play — not `main`, which tracks unreleased Astro. The file isn't published to npm, so repo tags are the only version-matched view. E.g.:

    ```sh
    git clone --filter=blob:none https://github.com/withastro/astro
    git -C astro diff astro@5.18.0 astro@6.4.1 -- packages/astro/test/test-utils.ts packages/astro/test/test-adapter.js
    ```

    This reveals how the Astro team adapted their own harness to their changes.

2. **inox-tools (nearest-shape reference; packaging/harness fixes):** its package _is_ published, so diff the published tarballs directly — no clone needed:

    ```sh
    npm diff --diff=@inox-tools/astro-tests@0.8.1 --diff=@inox-tools/astro-tests@1.0.0
    ```

    Because our file descends from theirs, these diffs apply to our code nearly line-for-line (e.g. their 1.0 targets Astro 6).

Consult these at defined events — an Astro major bump, or a harness bug — not on a schedule.

## Deviations from upstream

- Trimmed to the surface this workspace uses: `config`, `startDevServer`, `build`, `resolveUrl`, `fetch`, `readFile`, `loadTestAdapterApp`. Dropped: `preview`, `sync`, `buildWithCli`, `clean`, `editFile`/`resetAllFiles`, `glob`, `readdir`, buffer/src readers, `loadNodeAdapterHandler`. Re-vendor from upstream if needed.
- `loadFixture` requires an absolute path or URL `root` (upstream resolved relative roots via caller stack inspection — removed; this workspace's `isolatedFixture()` always passes absolute temp-dir roots).
- Debug logging uses `node:util` `debuglog` instead of the `debug` package (one less dependency). Enable with `NODE_DEBUG="grepco:astro-fixture*"` (upstream used `DEBUG=inox-tools:astro-tests*`).
- `testAdapter`'s `env` option dropped (unused here); integration name is a literal.

## Usage

```ts
import { loadFixture } from "@grepco/astro-fixture/astroFixture";
import testAdapter from "@grepco/astro-fixture/testAdapter";

const fixture = await loadFixture({ root: "/abs/path/to/fixture" });
const devServer = await fixture.startDevServer({});
const res = await fixture.fetch("/");
await devServer.stop();

await fixture.build({ adapter: testAdapter() });
const app = await fixture.loadTestAdapterApp();
const response = await app.render(new Request("https://example.com/"));
```
