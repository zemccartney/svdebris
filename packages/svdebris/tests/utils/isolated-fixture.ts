import type { AstroInlineConfig } from "astro";

import { loadFixture } from "@grepco/astro-fixture/astroFixture";
import { cp, mkdir, mkdtemp, rm } from "node:fs/promises";
import path from "node:path";

type FixtureConfig = Omit<AstroInlineConfig, "root">;

// Temp dirs must be within the package tree so Vite can walk up and find
// node_modules and package.json for module resolution, including the
// package self-reference that resolves "@grepco/svdebris/service".
const packageRoot = path.resolve(
    new URL(".", import.meta.url).pathname,
    "../.."
);
const temporaryBase = path.join(packageRoot, ".test-tmp");
const fixturesBase = path.join(packageRoot, "tests/integration/fixtures");

/**
 * Copy a fixture into a fresh temp dir and load it.
 * @param fixtureName - Directory name under tests/integration/fixtures
 * @param inlineConfig - Astro inline config merged into every dev/build call
 * @returns The fixture, its temp root, and a cleanup function
 */
export async function isolatedFixture(
    fixtureName: string,
    inlineConfig: FixtureConfig = {}
) {
    const sourcePath = path.join(fixturesBase, fixtureName);
    await mkdir(temporaryBase, { recursive: true });
    const root = await mkdtemp(path.join(temporaryBase, "fixture-"));
    await cp(sourcePath, root, {
        filter: (source) => {
            const relative = source.slice(sourcePath.length);
            return !/^\/?(\.(astro|DS_Store)|dist|node_modules)(\/|$)/.test(
                relative
            );
        },
        recursive: true
    });
    const fixture = await loadFixture({ root, ...inlineConfig });
    return {
        cleanup: () => rm(root, { force: true, recursive: true }),
        fixture,
        root
    };
}
