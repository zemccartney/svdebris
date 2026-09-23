# How Astro's image pipeline runs, and where

Copied on 2026-09-23 from `plan/new-season-sweep/image-pipeline-model.md` on
the `image-service` branch of the consuming site, `nba-surprise-teams`, where
it was written on 2026-09-13 while thinking through that site's
`image-service-spec.html`. This copy is the one to keep current. Everything
here was read out of `astro@7.3.1` and `@astrojs/cloudflare@14.3.0` as
installed there at the time. Source locations are given so the claims can be
re-checked when either package moves. The package's `README.md` carries a
condensed version; `packages/svdebris/tests/unit/pins.test.ts` pins the three
facts in the last section.

This is the mental model the service, the endpoint, and the spec rewrite all
rest on. It is also the piece that has been confusing across every planning
conversation about images, so it is kept deliberately plain.

## Two objects, not one

Two objects, and the confusion comes from conflating them:

- **The service** is a library. Its "describe" half, `validateOptions`,
  `getURL`, `getSrcSet` and `getHTMLAttributes`, runs wherever a page renders.
  Its "pixels" half, `parseURL` and `transform`, runs wherever bytes are
  needed.
- **The endpoint** is a route at `/_image`. It is the only thing that calls
  `transform` at request time. Whether it does so at all is the endpoint's
  choice, and the Cloudflare adapter's stock endpoints do not.

Under adapter 14 with `compile`, page rendering always happens in workerd,
including dev and prerender. That is the Vite environments change. It has one
consequence people do not expect: the service module is loaded in the worker
for prerender, then loaded again in Node to write the files, as two separate
module instances that share nothing but the serialized options.

| Phase                                | Runtime | Service methods that run | Called by                                                       |
| ------------------------------------ | ------- | ------------------------ | --------------------------------------------------------------- |
| `astro dev`, page render             | workerd | describe half            | `getImage()` in the page                                        |
| `astro dev`, `/_image` request       | workerd | pixels half              | the endpoint route                                              |
| `astro build`, prerender             | workerd | describe half            | `getImage()`, which records a transform                         |
| `astro build`, file generation       | Node    | `transform` only         | Astro's generate step, via the adapter importing the entrypoint |
| Production, on-demand page or island | workerd | describe half            | `getImage()`                                                    |
| Production, `/_image` request        | workerd | pixels half              | the endpoint route, only if it calls `transform`                |

Three intuitions fall out:

- Anything the describe half needs must be serializable and must live on the
  options object. Nothing in module scope survives the hop from the prerender
  worker to Node.
- The dev 400 was a pixels-half problem in one cell of that table, the second
  row, caused by the adapter putting an endpoint there that never consults the
  service.
- The SVG bypass works because it moves SVG out of the pixels half completely.
  After `validateOptions`, an SVG has no transform to record and no `/_image`
  URL, so rows two, four and six never see it.

Sources: adapter `dist/utils/handler.js:38-40` installs the static-image
collector inside the prerender worker; `dist/utils/prerender.js:94` serializes
the collected transforms to Node; `dist/prerenderer.js:241-247` imports the
service entrypoint in Node and assigns it to `globalThis.astroAsset.imageService`
for the generate step.

## The options object

The plain object `getImage()` builds from the component's props, roughly
`{ src, width, height, format, quality, alt, loading, ... }`. It is the argument
to `validateOptions`, and the validated version is what `getSrcSet`, `getURL`
and `getHTMLAttributes` receive, what `addStaticImage` records, and what
arrives in Node as the `transform` argument. It is the only channel between the
two halves.

## What the describe half is for

The thing that is not clicking is the load-bearing fact: `getImage()` never
produces image data. It returns a URL and HTML attributes, and the URL is a
promise that someone will produce the bytes later. The pixels half is who keeps
that promise, and there are two different ways it gets kept:

```
<Image src={logo} width={36} />
   │
   ▼  describe half, runs wherever the page renders
validateOptions → getSrcSet → getURL → getHTMLAttributes
   │
   ├─ prerendered page
   │    addStaticImage records {src, width, height, format} in a map
   │    and returns the future filename "/_astro/logo_Zk3q.svg"
   │        … after every page has rendered …
   │    generate step walks the map, calls transform() once per entry,
   │    writes the files                            ← pixels half, in Node
   │
   └─ on-demand page, island, or dev
        getURL returns "/_image?href=/_astro/logo.svg&w=36&f=svg"
            … later, when a browser requests that URL …
        endpoint: parseURL → load bytes → transform() → Response
                                                        ← pixels half, in the worker
```

So the describe half's job is to decide, from a source and the requested props,
what the `<img>` tag should say and what transform is being asked for. It hands
that transform onward in one of two encodings: a hash-keyed map entry at build,
or a query string at request time. `getURL` and `parseURL` are a matched pair
for the second encoding. `addStaticImage` and `hashTransform` are the first.

Three things follow, and they are the intuitions worth keeping:

- Rendering a page never waits on pixels. A page with fifty images renders
  fifty tags, and the bytes get produced in bulk afterwards or lazily on
  request.
- Deduplication is a describe-half property. Five identical descriptions
  collapse to one map entry and one file. That is why the variant count is
  decided in `validateOptions`, not in `transform`.
- The SVG bypass works by making the describe half return the source's own
  URL. Neither branch below it fires. There is no map entry and no `/_image`
  URL, so the pixels half never learns the SVG existed.

Sources: `astro/dist/assets/internal.js`, the body of `getImage` (the
`validateOptions` call, the `addStaticImage` branch, and the returned object);
`astro/dist/assets/services/service.js` for `baseService`;
`astro/dist/assets/utils/hash.js` for `hashTransform` and `propsToFilename`;
`astro/dist/assets/build/generate.js` for the generate step.

## Why the SVG bypass is possible

Three facts, all in `astro/dist/assets/internal.js` and
`services/service.js`:

- `getImage` fills in width and height from the ESM metadata _before_ calling
  `validateOptions`, so by the time the service sees the options both
  dimensions are already resolved.
- The base `getURL` returns a string `src` unchanged when it is not a remote
  URL, and `isRemoteAllowed` returns false for a root-relative path without
  throwing (`@astrojs/internal-helpers/dist/remote.js:46-58`).
- `addStaticImage` is skipped whenever `src` is a string and `getURL` returned
  it unchanged (`internal.js`, the `isRemoteImage(validatedOptions.src) &&
initialImageURL === validatedOptions.src` guard).

So `validateOptions` can, for an SVG, run the base validation and hand back the
same options with `src` replaced by the metadata's own asset URL. After that,
`<Image>` renders `<img src="/_astro/logo.hash.svg">` with the right width and
height, no variant is registered, no `/_image` URL is generated, and
`transform` never sees an SVG. That holds in dev, in the build, and inside a
runtime server island, because in each case `src.src` is the URL the plain
`<img>` already uses today.

This leans on the "a string `src` is a remote image" convention in
`imageKind.js`. It is stable across several majors but not documented API, so
the package pins it with a test.
