import type { AstroIntegration } from "astro";
import type { Config as SvgoConfig } from "svgo";

import { DEFAULT_SVGO, optimizeSvgs } from "./optimize.ts";

/**
 * What the integration sets as `image.service.entrypoint`.
 */
export const ENTRYPOINT = "@grepco/astro-image-svg/service";

export interface Options {
    /**
     * Run svgo over every emitted SVG after the build. `true` uses
     * preset-default with multipass; pass an svgo config to replace it.
     * @default true
     */
    optimize?: boolean | SvgoConfig;
}

const GENERIC_ENDPOINT = "astro/assets/endpoint/generic";
const CLOUDFLARE = "@astrojs/cloudflare";

/**
 * Make `<Image>` treat an imported SVG as the file it is, and optimize the
 * SVGs the build emits.
 * @param options - See {@link Options}
 * @param options.optimize - Whether, and how, to run the svgo pass
 * @returns The integration to add to `integrations`
 */
export default function svgImages({
    optimize = true
}: Options = {}): AstroIntegration {
    return {
        hooks: {
            "astro:build:done": async ({ dir, logger }) => {
                if (optimize === false) return;
                await optimizeSvgs(
                    dir,
                    optimize === true ? DEFAULT_SVGO : optimize,
                    logger
                );
            },
            "astro:config:done": ({ config }) => {
                const actual = config.image.service.entrypoint;
                if (actual !== ENTRYPOINT) {
                    throw new Error(
                        `[astro-image-svg] image.service.entrypoint is "${actual}", expected "${ENTRYPOINT}". Another integration replaced the image service after this one ran.`
                    );
                }
            },
            "astro:config:setup": ({
                command,
                config,
                logger,
                updateConfig
            }) => {
                // The adapter's hook has already run. Under compile and the
                // default mode it routes dev /_image to its own endpoint; under
                // custom, passthrough and cloudflare it chose Astro's generic
                // endpoint, which would call this service's transform in
                // workerd, where sharp cannot run.
                if (
                    command === "dev" &&
                    config.adapter?.name === CLOUDFLARE &&
                    config.image.endpoint.entrypoint === GENERIC_ENDPOINT
                ) {
                    logger.warn(
                        'Raster images will fail in dev under this imageService mode. Set imageService: "compile" on the Cloudflare adapter.'
                    );
                }
                updateConfig({
                    image: { service: { entrypoint: ENTRYPOINT } }
                });
            }
        },
        name: "@grepco/astro-image-svg"
    };
}
