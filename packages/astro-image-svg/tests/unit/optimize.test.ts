import type { AstroIntegrationLogger } from "astro";

import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { DEFAULT_SVGO, optimizeSvgs } from "../../src/optimize.ts";

const cruft = `<?xml version="1.0"?>
<!-- comment -->
<svg xmlns="http://www.w3.org/2000/svg" width="100" height="50" viewBox="0 0 100 50" version="1.1">
  <metadata>x</metadata>
  <rect x="0.000" y="0.000" width="100.000" height="50.000" fill="#1D4ED8"/>
</svg>`;

// The mocks are typed as Astro's logger for the call and kept as mocks for
// the assertions.
const makeLogger = () => {
    const log = {
        debug: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
        warn: vi.fn()
    };
    return { log, logger: log as unknown as AstroIntegrationLogger };
};

describe("optimizeSvgs", () => {
    let dir: string;
    beforeEach(async () => {
        dir = await mkdtemp(path.join(tmpdir(), "optimize-"));
    });
    afterEach(() => rm(dir, { force: true, recursive: true }));

    test("rewrites an SVG smaller and keeps its viewBox", async () => {
        await writeFile(path.join(dir, "a.svg"), cruft);
        const { log, logger } = makeLogger();
        const result = await optimizeSvgs(
            pathToFileURL(`${dir}/`),
            DEFAULT_SVGO,
            logger
        );
        const out = await readFile(path.join(dir, "a.svg"), "utf-8");
        expect(result).toMatchObject({ files: 1, rewritten: 1 });
        expect(result.after).toBeLessThan(result.before);
        expect(out).toContain('viewBox="0 0 100 50"');
        expect(out).not.toContain("<!--");
        expect(log.info).toHaveBeenCalledOnce();
    });

    test("walks nested directories and leaves non-SVG files alone", async () => {
        await writeFile(path.join(dir, "keep.txt"), "hello");
        await mkdir(path.join(dir, "deep/er"), { recursive: true });
        await writeFile(path.join(dir, "deep/er/b.svg"), cruft);
        const result = await optimizeSvgs(
            pathToFileURL(`${dir}/`),
            DEFAULT_SVGO,
            makeLogger().logger
        );
        expect(result.files).toBe(1);
        expect(await readFile(path.join(dir, "keep.txt"), "utf-8")).toBe(
            "hello"
        );
    });

    test("never writes a larger result", async () => {
        const minimal =
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"/>';
        await writeFile(path.join(dir, "m.svg"), minimal);
        const result = await optimizeSvgs(
            pathToFileURL(`${dir}/`),
            DEFAULT_SVGO,
            makeLogger().logger
        );
        expect(result.rewritten).toBe(0);
        expect(await readFile(path.join(dir, "m.svg"), "utf-8")).toBe(minimal);
    });

    test("skips and warns on a file svgo cannot parse", async () => {
        await writeFile(path.join(dir, "bad.svg"), "<svg><unclosed");
        const { log, logger } = makeLogger();
        const result = await optimizeSvgs(
            pathToFileURL(`${dir}/`),
            DEFAULT_SVGO,
            logger
        );
        expect(result.rewritten).toBe(0);
        expect(log.warn).toHaveBeenCalledOnce();
        expect(await readFile(path.join(dir, "bad.svg"), "utf-8")).toBe(
            "<svg><unclosed"
        );
    });

    test("does nothing and logs nothing on a directory with no SVGs", async () => {
        const { log, logger } = makeLogger();
        const result = await optimizeSvgs(
            pathToFileURL(`${dir}/`),
            DEFAULT_SVGO,
            logger
        );
        expect(result.files).toBe(0);
        expect(log.info).not.toHaveBeenCalled();
    });

    test("DEFAULT_SVGO is preset-default with multipass and no removeViewBox", () => {
        expect(DEFAULT_SVGO.multipass).toBe(true);
        expect(JSON.stringify(DEFAULT_SVGO)).not.toContain("removeViewBox");
    });
});
