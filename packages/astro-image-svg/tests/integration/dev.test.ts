import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { imgTags } from "../utils/html.ts";
import { isolatedFixture } from "../utils/isolated-fixture.ts";
import { required } from "../utils/stubs.ts";

const { cleanup, fixture } = await isolatedFixture("basic");

const config = {
    image: { service: { entrypoint: "@grepco/astro-image-svg/service" } }
};

afterAll(() => cleanup());

const fetchText = async (url: string): Promise<string> => {
    const response = await fixture.fetch(url);
    return response.text();
};

describe("dev server with the service", () => {
    let developmentServer: Awaited<ReturnType<typeof fixture.startDevServer>>;

    beforeAll(async () => {
        developmentServer = await fixture.startDevServer(config);
    });

    afterAll(async () => {
        await developmentServer.stop();
    });

    test("SVG <img> src is the plain tag's URL and serves as image/svg+xml", async () => {
        const tags = imgTags(await fetchText("/"));
        const plain = required(
            tags.find((t) => t["alt"] === "plain")?.["src"],
            "plain src"
        );
        const logo = required(
            tags.find((t) => t["alt"] === "logo 36")?.["src"],
            "logo src"
        );
        expect(logo).toBe(plain);
        expect(logo).not.toContain("/_image");
        const response = await fixture.fetch(logo);
        expect(response.status).toBe(200);
        expect(response.headers.get("content-type")).toContain("image/svg+xml");
    });

    test("dimensions are derived in dev exactly as at build", async () => {
        const byAlt = Object.fromEntries(
            imgTags(await fetchText("/")).map((t) => [t["alt"], t])
        ) as Record<string, Record<string, string>>;
        expect(byAlt["logo 36"]).toMatchObject({ height: "18", width: "36" });
        expect(byAlt["logo h50"]).toMatchObject({ height: "50", width: "100" });
    });

    test("raster in dev still goes through /_image", async () => {
        const photo = imgTags(await fetchText("/")).find(
            (t) => t["alt"] === "photo 200"
        );
        expect(photo?.["src"]).toContain("/_image");
    });
});
