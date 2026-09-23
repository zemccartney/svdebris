# @grepco/svdebris

An Astro image service that leaves SVGs alone.

## The name

This is an Astro integration despite the name. Most integrations carry an `astro-` prefix, but the prefix is only a convention, and the name would rather say what the thing does: it deals with the debris Astro's image pipeline leaves behind for SVGs, the duplicate files and needless `/_image` requests. Keywords carry `astro` and `astro-integration` so it still turns up where integrations are searched for.

Pass an imported SVG to `<Image>`, `<Picture formats={["svg"]}>`, `getImage()`, a markdown image or a content-collection image field and you get one emitted file per source, referenced directly, with the width and height Astro derives from the source. No per-size variants, no `/_image` request in dev, build or production. Raster images are untouched: this is Astro's own sharp service with one method changed.

Emitted SVGs are also optimized with svgo after the build.

## Install

```sh
npx astro add @grepco/svdebris
```

or by hand:

```js
// astro.config.mjs
import svgImages from "@grepco/svdebris";

export default defineConfig({
    integrations: [svgImages()]
});
```

With `@astrojs/cloudflare`, set the adapter to compile mode:

```js
adapter: cloudflare({ imageService: "compile" }),
```

Under `custom`, `passthrough` or `cloudflare` modes the adapter routes dev `/_image` requests to an endpoint that calls this service's `transform` inside workerd, where sharp cannot run, so raster images fail in dev. The integration warns when it sees that.

## Why this exists

Astro's image pipeline has two halves. The "describe" half runs wherever a page renders and turns `<Image>` props into a URL and attributes. The "pixels" half runs wherever bytes are needed and produces files, at build or on request. For an SVG the pixels half has nothing to do, but Astro still records one output per distinct set of props, so a logo used at five sizes becomes five identical files, and on-demand renders make a `/_image` request per logo.

This service rewrites an imported SVG in the describe half so that Astro treats it the way it treats a file in `public/`: served as-is. The bypass never reaches the pixels half.

## Options

```ts
svgImages({
    // Run svgo over every emitted SVG after the build. Default: true, which
    // is preset-default with multipass. Pass an svgo config to replace it,
    // or false to skip.
    optimize: true
});
```

The optimize pass runs after Astro has named the files, so the content hash in an SVG's filename is of the unoptimized bytes. It still changes whenever the source changes. The pass walks the whole client output, including files copied from `public/`.

Do not add `removeViewBox` to a custom svgo config: without a viewBox an SVG stops scaling to the requested width and height.

If another integration replaces `image.service.entrypoint` after this one runs, the integration throws at startup, naming the replacement it found instead. `image.service.config` passes through unchanged to sharp, so its `limitInputPixels`, `kernel`, and per-format encoder options all still apply.

## What it does not touch

- An SVG referenced by string path from `public/` or a remote URL. Astro already serves the former as-is; the latter keeps Astro's remote handling.
- GIF, AVIF, or any raster. Sharp's behavior, including animated GIF and AVIF output at build.
- Runtime image transformation. None is added.
- An explicit raster `format` on an SVG source, including `<Picture>`'s default `formats`. That request goes to sharp exactly as in stock Astro: a build error unless `image.dangerouslyProcessSVG` is on, in which case sharp rasterizes it.
- An SVG whose emitted URL is remote-allowed: with `build.assetsPrefix` pointing at a host that is also listed in `image.domains` or `image.remotePatterns`, Astro treats the asset URL as a processable remote image and the bypass does not apply.

## Requirements

Astro 6 or 7. sharp installed, as Astro's own sharp service requires.

`@astrojs/cloudflare` 14 pairs with Astro 7 and 13 with Astro 6; the package's own tests run both.
