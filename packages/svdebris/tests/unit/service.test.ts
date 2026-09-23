import type { ImageMetadata } from "astro";

import sharpService from "astro/assets/services/sharp";
import { describe, expect, test } from "vitest";

import service from "../../src/service.ts";
import { imageConfig, logger, required } from "../utils/stubs.ts";

const validateOptions = required(
    service.validateOptions,
    "service.validateOptions"
);
const sharpValidate = required(
    sharpService.validateOptions,
    "sharpService.validateOptions"
);

const svg: ImageMetadata = {
    format: "svg",
    height: 50,
    src: "/_astro/logo.Ab12Cd34.svg",
    width: 100
};

const png: ImageMetadata = {
    format: "png",
    height: 400,
    src: "/_astro/photo.Ef56Gh78.png",
    width: 400
};

const validate = (options: Parameters<typeof validateOptions>[0]) =>
    validateOptions(options, imageConfig(), logger());

describe("validateOptions on an imported SVG", () => {
    test("returns the asset URL as src, format svg, dimensions kept", async () => {
        // getImage resolves both dimensions before validateOptions runs;
        // mirror that here.
        const out = await validate({ height: 18, src: svg, width: 36 });
        expect(out.src).toBe("/_astro/logo.Ab12Cd34.svg");
        expect(out.format).toBe("svg");
        expect(out.width).toBe(36);
        expect(out.height).toBe(18);
    });

    test("removes every prop that describes a transform", async () => {
        const withWidths = await validate({
            background: "#fff",
            fit: "cover",
            height: 50,
            position: "center",
            quality: "high",
            src: svg,
            width: 100,
            widths: [100, 200]
        });
        expect(withWidths).not.toHaveProperty("background");
        expect(withWidths).not.toHaveProperty("fit");
        expect(withWidths).not.toHaveProperty("position");
        expect(withWidths).not.toHaveProperty("quality");
        expect(withWidths).not.toHaveProperty("widths");
        expect(withWidths.src).toBe("/_astro/logo.Ab12Cd34.svg");
        expect(withWidths.format).toBe("svg");

        const withDensities = await validate({
            densities: [1, 2],
            height: 50,
            src: svg,
            width: 100
        });
        expect(withDensities).not.toHaveProperty("densities");
        expect(withDensities.src).toBe("/_astro/logo.Ab12Cd34.svg");
        expect(withDensities.format).toBe("svg");
    });

    test("keeps unrelated attributes such as alt and loading", async () => {
        const out = await validate({
            alt: "a logo",
            height: 50,
            loading: "eager",
            src: svg,
            width: 100
        });
        expect(out).toMatchObject({ alt: "a logo", loading: "eager" });
    });

    test("an explicit non-SVG format on an SVG source is left for sharp to handle", async () => {
        const out = await validate({
            format: "webp",
            height: 50,
            src: svg,
            width: 100
        });
        expect(out.src).toBe(svg);
        expect(out.format).toBe("webp");
    });
});

describe("validateOptions on anything else", () => {
    test("raster input is exactly what the sharp service returns", async () => {
        const input = { height: 200, src: png, width: 200 };
        const ours = await validate({ ...input });
        const theirs = await sharpValidate(
            { ...input },
            imageConfig(),
            logger()
        );
        expect(ours).toEqual(theirs);
        expect(ours.format).toBe("webp");
    });

    test("a string src pointing at an SVG in public/ is untouched", async () => {
        const out = await validate({
            height: 50,
            src: "/logo.svg",
            width: 100
        });
        expect(out.src).toBe("/logo.svg");
        expect(out.format).toBe("svg");
    });
});

describe("everything else is sharp's", () => {
    test("the other methods are the sharp service's own", () => {
        expect(service.transform).toBe(sharpService.transform);
        expect(service.getURL).toBe(sharpService.getURL);
        expect(service.parseURL).toBe(sharpService.parseURL);
        expect(service.getHTMLAttributes).toBe(sharpService.getHTMLAttributes);
        expect(service.getSrcSet).toBe(sharpService.getSrcSet);
        expect(service.getRemoteSize).toBe(sharpService.getRemoteSize);
    });
});
