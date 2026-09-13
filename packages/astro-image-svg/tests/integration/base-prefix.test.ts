import { readdir } from "node:fs/promises";
import path from "node:path";
import { describe, expect, test } from "vitest";

import { imgTags } from "../utils/html.ts";
import { isolatedFixture } from "../utils/isolated-fixture.ts";
import { required } from "../utils/stubs.ts";

const service = { entrypoint: "@grepco/astro-image-svg/service" };

// The requirement is parity with the plain <img src={logo.src}> tag in the
// fixture: however Astro rewrites that URL for base or assetsPrefix, <Image>
// must produce the same string.
async function srcs(inline: Parameters<typeof isolatedFixture>[1]) {
    const { cleanup, fixture, root } = await isolatedFixture("basic");
    try {
        await fixture.build({ ...inline, image: { service } });
        const tags = imgTags((await fixture.readFile("/index.html")) ?? "");
        const assets = await readdir(path.join(root, "dist/_astro"));
        return {
            logo: required(
                tags.find((t) => t["alt"] === "logo 36")?.["src"],
                "logo src"
            ),
            plain: required(
                tags.find((t) => t["alt"] === "plain")?.["src"],
                "plain src"
            ),
            svgCount: assets.filter((f) => f.endsWith(".svg")).length
        };
    } finally {
        await cleanup();
    }
}

describe("base and assetsPrefix", () => {
    test("with base /sub the src carries the base and one file is emitted", async () => {
        const { logo, plain, svgCount } = await srcs({ base: "/sub" });
        expect(svgCount).toBe(1);
        expect(logo).toBe(plain);
        expect(logo.startsWith("/sub/_astro/")).toBe(true);
    });

    test("with assetsPrefix the src matches the plain tag's prefixed URL", async () => {
        const { logo, plain, svgCount } = await srcs({
            build: { assetsPrefix: "https://cdn.example" }
        });
        expect(svgCount).toBe(1);
        expect(logo).toBe(plain);
        expect(logo.startsWith("https://cdn.example/")).toBe(true);
    });
});
