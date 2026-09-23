# Upstream issues found while reading the image pipeline

Copied on 2026-09-23 from `plan/new-season-sweep/upstream-issues.md` on the
`image-service` branch of the consuming site, `nba-surprise-teams`. This copy
is the one to keep current, because the reproduction fixture it refers to is
`packages/svdebris/tests/integration/fixtures/cloudflare` in this repository.

Candidates for filing against `withastro/astro` (the `@astrojs/cloudflare`
adapter lives in the `withastro/adapters` repo). Each was read out of installed
source on 2026-09-13. Issues 1–3 were reproduced that same day in a copy of
the package's Cloudflare fixture (`astro@7.3.2`, `@astrojs/cloudflare@14.3.1`,
`wrangler` as installed then; the exact versions are quoted in each Repro
section); issue 1's production half is an open question with a verification
step; issues 4 and 5 are unreproduced by design. Before filing: the Astro
team gets a lot of low-effort reports, and a report with a one-file repro and
a pointed patch is the kind that lands.

Versions read: `astro@7.3.1`, `@astrojs/cloudflare@14.3.0`.

## 1. SVG through `<Image>` returns 400 under the adapter's default mode

**Where.** `@astrojs/cloudflare/dist/utils/image-binding-transform.js`, the
`supportedFormats` map inside `transformStream`. It lists jpeg, jpg, png, gif,
webp and avif. A request with `f=svg` returns
`400 Unsupported format: svg` before the Images binding is consulted.

**Why it matters more than it looks.** Under the default `cloudflare-binding`
mode nothing is generated at build (`normalizeImageServiceConfig` sets
`transformAtBuild: false` for the string form), so every `<Image>` on every
page, prerendered or not, is a runtime `/_image` request through this wrapper.
An SVG passed to `<Image>` on a zero-config Cloudflare site therefore fails in
**production**, not only in dev. Under `compile` it fails in dev only.

**Platform fact.** Cloudflare Images documents SVG as a supported input and
output, does not resize it, ignores optimization parameters for it, and
sanitizes it with svg-hush on delivery. The wrapper is stricter than the
product it wraps.

**Proposed fix.** In `transform()`, when `f=svg`, return the ASSETS response
body unchanged with `Content-Type: image/svg+xml`. Alternatively add `svg` to
the map, since the binding accepts it. Two lines either way.

**Repro.** Versions: `astro@7.3.2`, `@astrojs/cloudflare@14.3.1`,
`wrangler@4.131.1` (`pnpm list --depth 0` in a fresh copy of this package's
Cloudflare fixture, `/tmp/cf-repro`, with `adapter: cloudflare()` and no
other image config).

Dev, `pnpm exec astro dev --port 4399`, then the page's first SVG
`<Image>`:

```
$ SRC=$(curl -s http://localhost:4399/ | grep -o '/_image?[^"]*f=svg[^"]*' | head -1 | sed 's/&amp;/\&/g')
$ curl -s -o /dev/null -w '%{http_code}\n' "http://localhost:4399$SRC"
400
```

`SRC` was
`/_image?href=%2F%40fs%2Fprivate%2Ftmp%2Fcf-repro%2Fsrc%2Fassets%2Flogo.svg%3ForigWidth%3D100%26origHeight%3D50%26origFormat%3Dsvg&w=36&h=18&f=svg`;
the body is `Unsupported format: svg`, exactly as the source predicts.

Production, `pnpm exec astro build && pnpm exec astro preview --port 4398`,
same page, same extraction:

```
$ SRC=$(curl -s http://localhost:4398/ | grep -o '/_image?[^"]*f=svg[^"]*' | head -1 | sed 's/&amp;/\&/g')
$ curl -s -o /dev/null -w '%{http_code}\n' "http://localhost:4398$SRC"
404
```

`SRC` was `/_image?href=%2F_astro%2Flogo.zjSuecgy.svg&w=36&h=18&f=svg`. This
half did not reproduce as a 400 on these versions; the body is empty. The
same bare 404 comes back for three requests that should behave
differently if `transform()` were actually running:

```
$ curl -s -o /dev/null -w 'HTTP_CODE:%{http_code} SIZE:%{size_download}\n' 'http://localhost:4398/_image?href=%2F_astro%2Fphoto.CVf3mFFr.png&w=200&h=200&f=webp'
HTTP_CODE:404 SIZE:0
$ curl -s -o /dev/null -w 'HTTP_CODE:%{http_code} SIZE:%{size_download}\n' 'http://localhost:4398/_image'
HTTP_CODE:404 SIZE:0
$ curl -s -o /dev/null -w 'HTTP_CODE:%{http_code} SIZE:%{size_download}\n' 'http://localhost:4398/_image?href=http%3A%2F%2Fevil.example.com%2Fx.png&w=10&h=10&f=webp'
HTTP_CODE:404 SIZE:0
```

The first is a non-SVG (webp) transform of the same build's PNG, which
should succeed (200) if the format check were reached and passed. The
second omits `href` entirely, and the third points at a disallowed remote
host; `transform()`'s own code, read directly from
`image-binding-transform.js`, answers both of those with `403 Forbidden`
before it ever checks format — not 404. All three came back identical to
the SVG request (404, zero-byte body), which suggests `/_image` isn't
reaching `transform()` at all under `astro preview` in this
setup — falling through to the adapter's static-asset fallback
instead — rather than disproving the format-check bug.

Reran after a clean rebuild to rule out a stale build artifact:

```
$ rm -rf dist .wrangler node_modules/.astro node_modules/.vite
$ pnpm exec astro build && pnpm exec astro preview --port 4398
$ curl -s -o /dev/null -w 'HTTP_CODE:%{http_code} SIZE:%{size_download}\n' 'http://localhost:4398/_image?href=%2F_astro%2Flogo.zjSuecgy.svg&w=36&h=18&f=svg'
HTTP_CODE:404 SIZE:0
```

Same result. Before filing the production half, check that `astro
preview`'s local wrangler emulation isn't itself the cause: `astro
preview` runs the built worker through wrangler's local
Miniflare/workerd emulation, so a uniform 404 across every `/_image`
shape may be a local routing artifact rather than the wrapper's real
behavior. Re-check by deploying this same fixture to a real Cloudflare
Worker (or running `wrangler dev --remote` against it) and requesting the
recorded `/_image?href=%2F_astro%2Flogo.zjSuecgy.svg&w=36&h=18&f=svg` URL:
a 400 there confirms the production bug as documented, while a 200 with
`Content-Type: image/svg+xml` means the binding path handles SVG in real
production and only the dev-mode half of this issue should be filed.

## 2. `compile` ignores a user image service in dev

**Where.** `@astrojs/cloudflare/dist/utils/image-config.js`, the `compile`
case of `setImageConfig`. It keeps a user-set service
(`hasUserImageService(config) ? config.service : WORKERD_IMAGE_SERVICE`) but
picks the endpoint with `command === "dev" || runtimeService === "cloudflare-binding"`,
so in dev the route is always the Images-binding transform endpoint. That
endpoint never calls the configured service's `transform`.

**Contrast.** The `custom` case immediately below routes dev to
`GENERIC_ENDPOINT`, which loads the configured service and calls its
`transform`. So a user service works in dev under `custom` and is silently
bypassed under `compile`.

**Proposed fix.** In the `compile` case, `hasUserImageService(config) &&
command === "dev"` selects `GENERIC_ENDPOINT`, mirroring `custom`. One
condition.

**Repro.** Same `/tmp/cf-repro` project and versions as issue 1
(`astro@7.3.2`, `@astrojs/cloudflare@14.3.1`, `wrangler@4.131.1`).
`logging-service.mjs` wraps `baseService` and logs `USER SERVICE TRANSFORM
CALLED <src>` before returning the input unchanged.

With `adapter: cloudflare({ imageService: "compile" })` and `image: {
service: { entrypoint: "./logging-service.mjs" } }`, `pnpm exec astro dev
--port 4399`, requesting both the page's SVG `/_image` URL and its PNG
(webp) one:

```
$ curl -s -o /dev/null -w '%{http_code}\n' 'http://localhost:4399/_image?...&f=svg'
400
$ curl -s -o /dev/null -w '%{http_code}\n' 'http://localhost:4399/_image?...&f=webp'
200
```

Grepping the dev server's captured stdout for `USER SERVICE TRANSFORM CALLED`:
`(no match)`.

The log line never appears — not even for the webp request that came back
200 — so `compile`'s dev endpoint never calls the configured service's
`transform`, confirming the bypass.

Switching only `imageService` to `"custom"` (same `logging-service.mjs`,
same page):

```
$ curl -s -o /dev/null -w '%{http_code}\n' 'http://localhost:4399/_image?...&f=svg'
200
```

Grepping the dev server's captured stdout for `USER SERVICE TRANSFORM CALLED`:

```
{"message":"USER SERVICE TRANSFORM CALLED /@fs/private/tmp/cf-repro/src/assets/logo.svg?origWidth=100&origHeight=50&origFormat=svg","label":"vite","level":"info"}
```

The log line appears, and the SVG request itself now returns 200 instead
of issue 1's 400, because the user service's `transform` runs in place of
the binding wrapper.

## 3. `custom` warns about sharp before integrations can set the service

**Where.** `@astrojs/cloudflare/dist/utils/image-config.js`, the `custom`
case: `if (command === "dev" && config.service.entrypoint === SHARP_IMAGE_SERVICE) logger.warn(...)`.
This runs inside the adapter's `astro:config:setup`, which Astro `unshift`s to
the front of the integrations list (`astro/dist/integrations/hooks.js`,
`runHookConfigSetup`). Any integration that sets `image.service` through
`updateConfig` runs after it, so the warning fires on every dev start even
though the service is replaced moments later.

**Why it is the wrong place.** The adapter already re-reads
`config.image.service.entrypoint` in `astro:config:done` (`dist/index.js`,
`hasUserBuildImageService = ...`), precisely because "integrations may set
`image.service` via `updateConfig()` after this hook runs" (its own comment).
The warning belongs next to that re-read.

**Proposed fix.** Move the check to `astro:config:done`.

**Repro.** Same project and versions as issues 1 and 2. `adapter:
cloudflare({ imageService: "custom" })`, no top-level `image.service`, and:

```js
integrations: [{
    name: "set-service",
    hooks: { "astro:config:setup": ({ updateConfig }) => updateConfig({ image: { service: { entrypoint: "./logging-service.mjs" } } }) }
}],
```

`pnpm exec astro dev --port 4399` startup log includes:

```
The Sharp image service cannot run inside the workerd runtime, so '/_image' requests will fail in dev and production. Configure a workerd-compatible 'image.service', or set 'imageService' to 'compile' for build-time optimization. See https://docs.astro.build/en/guides/integrations-guide/cloudflare/#imageservice
```

Then, requesting the page's SVG `/_image` URL:

```
$ curl -s -o /dev/null -w '%{http_code}\n' 'http://localhost:4399/_image?...&f=svg'
200
```

Grepping the dev server's captured stdout for `USER SERVICE TRANSFORM CALLED`:

```
{"message":"USER SERVICE TRANSFORM CALLED /@fs/private/tmp/cf-repro/src/assets/logo.svg?origWidth=100&origHeight=50&origFormat=svg","label":"vite","level":"info"}
```

The 200 and the log line confirm the integration's service — not
sharp — is what actually serves the request: the warning fired against a
default that was already gone by request time.

## 4. Astro core: identical SVG variants per requested size

**Where.** `astro/dist/assets/services/service.js` `baseService`, and the
sharp service's `transform`, which returns SVG input unchanged. The variant
filename is `<base>_<hashTransform(props)>.svg`, so a logo used at five sizes
emits five byte-identical files. On this site, 45 sources became 98 files.

**Status.** Not a bug, a missed optimization, and the fix touches
`baseService` semantics. The image service in `image-service-spec.html` is the
proving ground: its `validateOptions` bypass, if it holds up, is the shape an
upstream change could take. File after the package proves it, with numbers.

## 5. Docs contribution: the image service lifecycle

**Not a bug.** Astro's Image Service reference
(docs.astro.build/en/reference/image-service-reference/) lists each hook
with its signature and a one-line purpose. It does not say which hooks run
where or when, that `getImage()` never produces bytes, that the build map and
the `/_image` URL are two encodings of the same transform description, or
that an adapter may run the describe half and the pixels half in different
runtimes. Every planning conversation about this site's images stalled on
exactly those gaps.

**Draft.** `image-pipeline-model.md` beside this file. For a docs PR, keep
the general model (two halves, the diagram, the three intuitions) separate
from the Cloudflare-specific table so the general part stands alone; the
adapter split becomes one paragraph with the Cloudflare adapter as the
example.

**Where.** withastro/docs. Read their contributing guide first; reference
pages have a fixed shape, so this may fit better as a guide or a recipe than
as additions to the reference.
