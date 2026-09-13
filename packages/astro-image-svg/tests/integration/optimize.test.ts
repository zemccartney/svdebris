import type { AstroIntegration } from "astro";

import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { describe, expect, test } from "vitest";

import { DEFAULT_SVGO, optimizeSvgs } from "../../src/optimize.ts";
import { isolatedFixture } from "../utils/isolated-fixture.ts";
import { required } from "../utils/stubs.ts";

const service = { entrypoint: "@grepco/astro-image-svg/service" };

// Task 8 replaces this with the real integration; here the pass is wired
// by hand so the two can be tested independently.
const passOnly: AstroIntegration = {
    hooks: {
        "astro:build:done": async ({ dir, logger }) => {
            await optimizeSvgs(dir, DEFAULT_SVGO, logger);
        }
    },
    name: "pass-only"
};

async function build(shouldOptimize: boolean) {
    const { cleanup, fixture, root } = await isolatedFixture("basic");
    await fixture.build({
        image: { service },
        integrations: shouldOptimize ? [passOnly] : []
    });
    const assets = await readdir(path.join(root, "dist/_astro"));
    const svg = required(
        assets.find((f) => f.endsWith(".svg")),
        "the emitted SVG"
    );
    const file = path.join(root, "dist/_astro", svg);
    const { size } = await stat(file);
    const text = await readFile(file, "utf-8");
    await cleanup();
    return { size, text };
}

describe("the optimize pass after a build", () => {
    test("off: the emitted SVG is byte-identical to the source", async () => {
        const { text } = await build(false);
        const source = await readFile(
            path.resolve(
                new URL(".", import.meta.url).pathname,
                "fixtures/basic/src/assets/logo.svg"
            ),
            "utf-8"
        );
        expect(text).toBe(source);
    });

    test("on: smaller, still parses, viewBox kept", async () => {
        const off = await build(false);
        const on = await build(true);
        expect(on.size).toBeLessThan(off.size);
        expect(on.text).toContain('viewBox="0 0 100 50"');
        expect(on.text.startsWith("<svg")).toBe(true);
    });
});
