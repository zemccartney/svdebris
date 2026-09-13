import type { AstroIntegration } from "astro";

/**
 * Placeholder replaced in Task 8.
 * @returns An integration that does nothing yet
 */
export default function svgImages(): AstroIntegration {
    return { hooks: {}, name: "@grepco/astro-image-svg" };
}
