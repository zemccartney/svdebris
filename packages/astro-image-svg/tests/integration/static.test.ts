import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import svgImages from "../../src/index.ts";
import { imgTags } from "../utils/html.ts";
import { isolatedFixture } from "../utils/isolated-fixture.ts";
import { required } from "../utils/stubs.ts";

const { cleanup, fixture, root } = await isolatedFixture("basic");

const config = { integrations: [svgImages({ optimize: false })] };

afterAll(() => cleanup());

describe("static build with the service", () => {
    let index: string;
    let md: string;
    let assets: string[];
    let svgFile: string;

    beforeAll(async () => {
        await fixture.build(config);
        index = (await fixture.readFile("/index.html")) ?? "";
        md = (await fixture.readFile("/md/index.html")) ?? "";
        assets = await readdir(path.join(root, "dist/_astro"));
        svgFile = required(
            assets.find((f) => f.endsWith(".svg")),
            "the emitted SVG"
        );
    });

    test("emits exactly one SVG file for the one SVG source", () => {
        expect(assets.filter((f) => f.endsWith(".svg"))).toHaveLength(1);
    });

    test("every SVG <img> points at that one file, the same URL the plain <img> gets", () => {
        const tags = imgTags(index);
        const plain = required(
            tags.find((t) => t["alt"] === "plain")?.["src"],
            "plain src"
        );
        expect(plain).toBe(`/_astro/${svgFile}`);
        const svgImgs = tags.filter((t) => t["alt"]?.startsWith("logo"));
        expect(svgImgs).toHaveLength(4);
        for (const img of svgImgs) {
            expect(img["src"]).toBe(plain);
        }
    });

    test("width and height are what Astro derives from the 100×50 source", () => {
        const byAlt: Record<
            string,
            Record<string, string>
        > = Object.fromEntries(
            imgTags(index).map((t): [string, Record<string, string>] => [
                t["alt"] ?? "",
                t
            ])
        );
        expect(byAlt["logo 36"]).toMatchObject({ height: "18", width: "36" });
        expect(byAlt["logo 72"]).toMatchObject({ height: "36", width: "72" });
        expect(byAlt["logo h50"]).toMatchObject({
            height: "50",
            width: "100"
        });
        expect(byAlt["logo layout"]).toMatchObject({
            height: "18",
            width: "36"
        });
    });

    test("a layout prop produces no srcset for an SVG", () => {
        const layout = imgTags(index).find((t) => t["alt"] === "logo layout");
        expect(layout).not.toHaveProperty("srcset");
    });

    test("no page references /_image", () => {
        expect(index).not.toContain("/_image");
        expect(md).not.toContain("/_image");
    });

    test("the markdown image uses the same file", () => {
        const [img] = imgTags(md);
        expect(img?.["src"]).toBe(`/_astro/${svgFile}`);
    });

    test("raster still goes through sharp: two WebP variants, no PNG copy", async () => {
        const webps = assets.filter((f) => f.endsWith(".webp"));
        expect(webps).toHaveLength(2);
        expect(assets.filter((f) => f.endsWith(".png"))).toHaveLength(0);
        for (const f of webps) {
            const { size } = await stat(path.join(root, "dist/_astro", f));
            expect(size).toBeGreaterThan(0);
        }
        const webpUrls = webps.map((f) => `/_astro/${f}`);
        const photos = imgTags(index).filter((t) =>
            t["alt"]?.startsWith("photo")
        );
        expect(photos).toHaveLength(2);
        for (const t of photos) {
            expect(webpUrls).toContain(t["src"]);
        }
    });
});
