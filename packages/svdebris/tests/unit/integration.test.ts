import type { AstroIntegration } from "astro";

import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, test, vi } from "vitest";

import svgImages, { ENTRYPOINT, type Options } from "../../src/index.ts";
import { required } from "../utils/stubs.ts";

type BuildDoneArgs = Parameters<NonNullable<Hooks["astro:build:done"]>>[0];
type DoneArgs = Parameters<NonNullable<Hooks["astro:config:done"]>>[0];
type Hooks = NonNullable<AstroIntegration["hooks"]>;
type SetupArgs = Parameters<NonNullable<Hooks["astro:config:setup"]>>[0];

const logger = () => ({
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn()
});

function doneArgs(entrypoint: string): DoneArgs {
    return {
        config: { image: { service: { entrypoint } } }
    } as unknown as DoneArgs;
}

function hook<K extends keyof Hooks>(
    name: K,
    options?: Options
): NonNullable<Hooks[K]> {
    // AstroIntegration["hooks"] is intersected with Partial<Record<string,
    // unknown>>, so indexing it with a generic K widens past Hooks[K]; the
    // cast restates what the literal-key lookup actually returns.
    return required(
        svgImages(options).hooks[name] as NonNullable<Hooks[K]> | undefined,
        `hook ${name}`
    );
}

function setupArgs(over: {
    adapterName?: string;
    command?: "build" | "dev";
    endpoint?: string;
}): SetupArgs & {
    logger: ReturnType<typeof logger>;
    updateConfig: ReturnType<typeof vi.fn>;
} {
    return {
        command: over.command ?? "dev",
        config: {
            adapter:
                over.adapterName ?
                    { hooks: {}, name: over.adapterName }
                :   undefined,
            image: { endpoint: { entrypoint: over.endpoint, route: "/_image" } }
        },
        logger: logger(),
        updateConfig: vi.fn()
    } as unknown as SetupArgs & {
        logger: ReturnType<typeof logger>;
        updateConfig: ReturnType<typeof vi.fn>;
    };
}

describe("astro:config:setup", () => {
    test("sets the service entrypoint", async () => {
        const args = setupArgs({});
        await hook("astro:config:setup")(args);
        expect(args.updateConfig).toHaveBeenCalledWith({
            image: { service: { entrypoint: ENTRYPOINT } }
        });
    });

    test("warns in dev when the Cloudflare adapter chose the generic endpoint", async () => {
        const args = setupArgs({
            adapterName: "@astrojs/cloudflare",
            command: "dev",
            endpoint: "astro/assets/endpoint/generic"
        });
        await hook("astro:config:setup")(args);
        // Cast away the AstroIntegrationLogger half of the intersection:
        // its declared-method signature is what unbound-method objects to.
        expect(
            (args.logger as unknown as ReturnType<typeof logger>).warn
        ).toHaveBeenCalledOnce();
        expect(String(args.logger.warn.mock.calls[0]?.[0])).toContain(
            'imageService: "compile"'
        );
    });

    test("stays quiet under compile in dev, at build, and on other adapters", async () => {
        for (const over of [
            {
                adapterName: "@astrojs/cloudflare",
                command: "dev" as const,
                endpoint: "@astrojs/cloudflare/image-transform-endpoint"
            },
            {
                adapterName: "@astrojs/cloudflare",
                command: "build" as const,
                endpoint: "astro/assets/endpoint/generic"
            },
            {
                adapterName: "@astrojs/node",
                command: "dev" as const,
                endpoint: "astro/assets/endpoint/generic"
            },
            {
                command: "dev" as const,
                endpoint: "astro/assets/endpoint/generic"
            }
        ]) {
            const args = setupArgs(over);
            await hook("astro:config:setup")(args);
            expect(
                (args.logger as unknown as ReturnType<typeof logger>).warn
            ).not.toHaveBeenCalled();
        }
    });
});

describe("astro:config:done", () => {
    test("passes when the entrypoint is ours", () => {
        expect(() =>
            hook("astro:config:done")(doneArgs(ENTRYPOINT))
        ).not.toThrow();
    });

    test("throws naming the replacement when something else set the service", () => {
        expect(() =>
            hook("astro:config:done")(doneArgs("astro/assets/services/sharp"))
        ).toThrow(/astro\/assets\/services\/sharp/);
    });
});

describe("astro:build:done", () => {
    test("runs the pass by default and skips it with optimize: false", async () => {
        const dir = await mkdtemp(path.join(tmpdir(), "int-"));
        const cruft =
            '<?xml version="1.0"?><!-- c --><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><rect width="1.000" height="1.000"/></svg>';
        await writeFile(path.join(dir, "a.svg"), cruft);
        const args = {
            dir: pathToFileURL(`${dir}/`),
            logger: logger()
        } as unknown as BuildDoneArgs;

        await hook("astro:build:done", { optimize: false })(args);
        expect(
            (args.logger as unknown as ReturnType<typeof logger>).info
        ).not.toHaveBeenCalled();

        await hook("astro:build:done")(args);
        expect(
            (args.logger as unknown as ReturnType<typeof logger>).info
        ).toHaveBeenCalledOnce();
        await rm(dir, { force: true, recursive: true });
    });
});
