import cloudflare from "@astrojs/cloudflare";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import svgImages from "../../src/index.ts";
import { imgTags } from "../utils/html.ts";
import { isolatedFixture } from "../utils/isolated-fixture.ts";
import { required } from "../utils/stubs.ts";

const { cleanup, fixture, root } = await isolatedFixture("cloudflare", {
    adapter: cloudflare({ imageService: "compile" }),
    integrations: [svgImages()]
});

afterAll(() => cleanup());

describe("Cloudflare adapter, compile mode, server build", () => {
    let index: string;
    let assets: string[];
    let svgFile: string;

    beforeAll(async () => {
        await fixture.build({});
        index = (await fixture.readFile("/client/index.html")) ?? "";
        assets = await readdir(path.join(root, "dist/client/_astro"));
        svgFile = required(
            assets.find((f) => f.endsWith(".svg")),
            "the emitted SVG"
        );
    });

    test("one SVG file, referenced directly, no /_image", () => {
        expect(assets.filter((f) => f.endsWith(".svg"))).toHaveLength(1);
        const tags = imgTags(index);
        const plain = required(
            tags.find((t) => t["alt"] === "plain")?.["src"],
            "plain src"
        );
        expect(plain).toBe(`/_astro/${svgFile}`);
        const logos = tags.filter((t) => t["alt"]?.startsWith("logo"));
        expect(logos).toHaveLength(4);
        for (const img of logos) {
            expect(img["src"]).toBe(plain);
        }
        expect(index).not.toContain("/_image");
    });

    test("raster was generated at build by sharp through our entrypoint", () => {
        expect(assets.filter((f) => f.endsWith(".webp"))).toHaveLength(2);
    });

    test("the optimize pass reached the client dir", async () => {
        const text = await readFile(
            path.join(root, "dist/client/_astro", svgFile),
            "utf-8"
        );
        expect(text).not.toContain("<!--");
        expect(text).toContain("viewBox=");
    });
});
