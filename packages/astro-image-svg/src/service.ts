import type { LocalImageService } from "astro";
import type { SharpImageServiceConfig } from "astro/assets/services/sharp";

import sharpService from "astro/assets/services/sharp";
import { isESMImportedImage } from "astro/assets/utils";

type Service = LocalImageService<SharpImageServiceConfig>;
type ValidateOptions = NonNullable<Service["validateOptions"]>;

/**
 * Sharp's own validation, then, for an imported SVG whose requested format
 * is svg, hand back the options with `src` swapped for the emitted asset
 * URL. Astro treats a non-remote string `src` as a file it must not
 * process: no static image is registered at build, no `/_image` URL is
 * generated, and the `<img>` gets the width and height `getImage` already
 * resolved from the metadata.
 * @param options - The options `getImage` built from the component's props
 * @param imageConfig - Astro's image config
 * @param logger - Astro's runtime logger
 * @returns The validated options, rewritten for an SVG source
 */
const validateOptions: ValidateOptions = async (
    options,
    imageConfig,
    logger
) => {
    const validated = await (sharpService.validateOptions?.(
        options,
        imageConfig,
        logger
    ) ?? options);
    if (
        !isESMImportedImage(validated.src) ||
        validated.src.format !== "svg" ||
        validated.format !== "svg"
    ) {
        return validated;
    }
    const bypassed = {
        ...validated,
        format: "svg" as const,
        src: validated.src.src
    };
    delete bypassed.background;
    delete bypassed.densities;
    delete bypassed.fit;
    delete bypassed.position;
    delete bypassed.quality;
    delete bypassed.widths;
    return bypassed;
};

const service: Service = { ...sharpService, validateOptions };

export default service;
