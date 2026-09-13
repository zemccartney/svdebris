import { baseService } from "astro/assets";
import { isESMImportedImage, isRemoteImage } from "astro/assets/utils";
import { describe, expect, test } from "vitest";

import { imageConfig, logger, required } from "../utils/stubs.ts";

const getSourceSet = required(baseService.getSrcSet, "baseService.getSrcSet");
const getHTMLAttributes = required(
    baseService.getHTMLAttributes,
    "baseService.getHTMLAttributes"
);

describe("Astro conventions the SVG bypass relies on (spec §2)", () => {
    test("a string src counts as a remote image, an object with src as an imported one", () => {
        expect(isRemoteImage("/_astro/logo.abc.svg")).toBe(true);
        expect(isESMImportedImage("/_astro/logo.abc.svg")).toBe(false);
        expect(
            isESMImportedImage({
                format: "svg",
                height: 1,
                src: "/x.svg",
                width: 1
            })
        ).toBe(true);
    });

    test("baseService.getURL returns a non-remote string src unchanged", async () => {
        const url = await baseService.getURL(
            {
                format: "svg",
                height: 50,
                src: "/_astro/logo.abc.svg",
                width: 100
            },
            imageConfig(),
            logger()
        );
        expect(url).toBe("/_astro/logo.abc.svg");
    });

    test("baseService.getSrcSet is empty for a string src with no widths or densities", async () => {
        const set = await getSourceSet(
            {
                format: "svg",
                height: 50,
                src: "/_astro/logo.abc.svg",
                width: 100
            },
            imageConfig(),
            logger()
        );
        expect(set).toEqual([]);
    });

    test("baseService.getHTMLAttributes keeps width and height for a string src", async () => {
        const attributes = await getHTMLAttributes(
            {
                alt: "x",
                format: "svg",
                height: 18,
                src: "/_astro/logo.abc.svg",
                width: 36
            },
            imageConfig(),
            logger()
        );
        expect(attributes).toMatchObject({ height: 18, width: 36 });
        expect(attributes).not.toHaveProperty("src");
        expect(attributes).not.toHaveProperty("format");
    });
});
