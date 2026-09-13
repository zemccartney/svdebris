/*
 * Vendored from @inox-tools/astro-tests@0.8.1 (MIT, © Luiz Ferraz)
 * https://github.com/Fryuni/inox-tools/blob/%40inox-tools/astro-tests%400.8.1/packages/astro-tests/src/astroFixture.ts
 * It appears closely based on Astro core's internal test utils (exact
 * derivation direction unverified; the two resemble each other strongly):
 * https://github.com/withastro/astro/blob/main/packages/astro/test/test-utils.ts
 *
 * Vendored 2026-07-03 so the harness's astro peer range no longer gates this
 * workspace's Astro upgrades, and so test-infra behavior (undici agent, server
 * lifecycle) is inspectable in-tree. Kept close to upstream for diffing, with
 * these deliberate adaptations:
 *
 * - Trimmed to the surface this workspace uses: config, startDevServer,
 *   build, resolveUrl, fetch, readFile, loadTestAdapterApp. (Dropped:
 *   preview, sync, buildWithCli, clean, editFile/resetAllFiles, glob,
 *   readdir, path/buffer/src readers, loadNodeAdapterHandler.)
 * - `root` must be an absolute path or URL — the upstream caller-stack
 *   (callsites) resolution of relative roots was removed.
 * - Upstream's setNestedIfNullish calls replaced with direct `??=` defaulting.
 * - debug logging via node:util debuglog (see ./log.ts).
 */
import type { AstroConfig, AstroInlineConfig } from "astro";
import type { App } from "astro/app";

import { build, dev } from "astro";
import { getViteConfig, mergeConfig, validateConfig } from "astro/config";
import * as fs from "node:fs";
import { fileURLToPath } from "node:url";
import { Agent, request } from "undici";

import { getDebug } from "./log.ts";

export type DevelopmentServer = Awaited<ReturnType<typeof dev>>;

export interface Fixture {
    /**
     * Builds into the current folder (will erase previous build).
     *
     * Equivalent to running `astro build`.
     */
    build: typeof build;
    /**
     * The final validated config.
     * Automatically passed to .startDevServer() and .build().
     */
    config: AstroConfig;
    /**
     * Send a request to the given URL. If the URL is relative, it will be
     * resolved relative to the root of the server (without a base path).
     *
     * This can only be called after .startDevServer() is called.
     */
    fetch: (
        url: string,
        options?: Parameters<typeof request>[1]
    ) => Promise<Response>;
    /**
     * Load an app built using the test adapter.
     *
     * Vendored deviation: accepts the adapter's streaming flag (upstream
     * always used the default). Pass false to force non-streamed renders,
     * where Astro sets Content-Length on the response.
     */
    loadTestAdapterApp: (isStreaming?: boolean) => Promise<TestApp>;
    /**
     * Read a file (as a string) from the build output. Do NOT use this for
     * binary files (e.g. images).
     *
     * Returns null if the file doesn't exist.
     */
    readFile: (
        path: string,
        encoding?: BufferEncoding
    ) => Promise<null | string>;
    /**
     * Resolves a relative URL to the full url of the running server.
     *
     * This can only be called after .startDevServer() is called.
     */
    resolveUrl: (url: string) => string;
    /**
     * Starts a dev server at an available port.
     *
     * Be sure to call devServer.stop() before test exit.
     *
     * Equivalent to running `astro dev`.
     */
    startDevServer: typeof dev;
}

export interface TestApp {
    render: (request_: Request) => Promise<Response>;
    toInternalApp: () => App;
}

type InlineConfig = Omit<AstroInlineConfig, "root"> & {
    root: string | URL;
};

const debug = getDebug("fixture");

// Disable telemetry when running tests
process.env["ASTRO_TELEMETRY_DISABLED"] = "true";

// Select a random default port, then hand out successive ports on each call.
const nextDefaultPort = (() => {
    let port = 10_000 + Math.floor(Math.random() * 40_000);
    return () => port++;
})();

/**
 * Loads an Astro fixture project.
 * @param root0 - Astro inline config for the fixture
 * @param root0.root - Absolute path or file URL of the fixture project
 *   (relative roots are not supported in this vendored version)
 * @returns A trimmed test fixture wrapping Astro's programmatic dev/build APIs
 * @example
 * ```ts
 * const fixture = await loadFixture({ root: "/abs/path/to/fixture" });
 * ```
 */
export async function loadFixture({
    root,
    ...remaining
}: InlineConfig): Promise<Fixture> {
    if (!root) throw new Error("Must provide { root: '/abs/path/...' }");
    const inlineConfig: AstroInlineConfig = remaining;

    debug('Setting default log level to "silent"');
    // Silent by default during tests to not pollute the console output
    inlineConfig.logLevel ??= "silent";
    inlineConfig.vite ??= {};
    inlineConfig.vite.logLevel ??= "silent";
    inlineConfig.devToolbar ??= { enabled: false };

    debug("Disabling Vite discovery for dependency optimization");
    // Prevent hanging when testing the dev server on some scenarios
    inlineConfig.vite.optimizeDeps ??= {};
    inlineConfig.vite.optimizeDeps.noDiscovery ??= true;

    inlineConfig.server ??= {};
    if (typeof inlineConfig.server === "function") {
        debug("Wrapping server config for default port");
        const original = inlineConfig.server;
        inlineConfig.server = (options) => ({
            port: nextDefaultPort(),
            ...original(options)
        });
    } else {
        inlineConfig.server.port ??= nextDefaultPort();
    }

    if (typeof root !== "string") {
        // Handle URL, should already be absolute so just convert to path
        inlineConfig.root = fileURLToPath(root);
    } else if (root.startsWith("file://")) {
        debug("Root is a file URL, converting to path");
        inlineConfig.root = fileURLToPath(new URL(root));
    } else {
        // Vendored deviation: relative roots (upstream resolved them against
        // the caller's stack frame) are not supported.
        inlineConfig.root = root;
    }

    const config = await validateConfig(inlineConfig, inlineConfig.root, "dev");

    debug("Output dir:", config.outDir);
    debug("Src dir:", config.srcDir);

    const viteConfig = await getViteConfig(
        {},
        inlineConfig
    )({
        command: "serve",
        mode: "dev"
    });

    // Mutable server address state shared with resolveUrl; startDevServer
    // overwrites host/port with the actually-bound address.
    const serverState = {
        host: viteConfig.server?.host,
        https: Boolean(viteConfig.server?.https),
        port: viteConfig.server?.port
    };
    const protocol = serverState.https ? "https" : "http";

    const resolveUrl = (url: string) => {
        const host =
            typeof serverState.host === "string" ?
                serverState.host
            :   "localhost";
        return `${protocol}://${host}:${serverState.port}${url.replace(/^\/?/, "/")}`;
    };

    const fixtureId = Date.now();

    const resolveOutPath = (outPath: string) =>
        new URL(outPath.replace(/^\//, ""), config.outDir);

    return {
        build: async (extraInlineConfig) => {
            process.env["NODE_ENV"] = "production";
            debug(`Building fixture ${inlineConfig.root}`);
            return build(mergeConfig(inlineConfig, extraInlineConfig));
        },
        config,
        fetch: async (url, init) => {
            if (config.vite.server?.https) {
                debug("Injecting agent to enable HTTPS and HTTP/2 support");
                init = {
                    // Use a custom fetch dispatcher. This is an undici option
                    // that allows us to customize the fetch behavior. We use
                    // it here to allow h2.
                    dispatcher: new Agent({
                        // Enable HTTP/2 support
                        allowH2: true,
                        connect: {
                            // We disable cert validation because we're using
                            // self-signed certs
                            rejectUnauthorized: false
                        }
                    }),
                    ...init
                };
            }
            const resolvedUrl = resolveUrl(url);
            try {
                const response = await request(resolvedUrl, init);
                const blob = await response.body.blob();
                const headers = new Headers();
                for (const [key, value] of Object.entries(response.headers)) {
                    if (Array.isArray(value)) {
                        for (const v of value) headers.append(key, v);
                    } else if (value) {
                        headers.append(key, value);
                    }
                }

                return new Response(await blob.arrayBuffer(), {
                    headers,
                    status: response.statusCode
                });
            } catch (error) {
                // undici throws a vague error when it fails, so we log the
                // url here to easily debug it
                if (
                    error instanceof Error &&
                    error.message.includes("fetch failed")
                ) {
                    console.error(
                        `[astro-fixture] failed to fetch ${resolvedUrl}`
                    );
                    console.error(error);
                }
                throw error;
            }
        },
        loadTestAdapterApp: async (isStreaming) => {
            const entryUrl = new URL(
                `server/entry.mjs?id=${fixtureId}`,
                config.outDir
            );
            debug(`Importing test adapter entrypoint from ${entryUrl.href}`);
            const module_ = (await import(
                /* @vite-ignore */ entryUrl.href
            )) as {
                createApp: (isStreaming?: boolean) => App;
                manifest: unknown;
            };
            debug("Instantiating test adapter app");
            const app = module_.createApp(isStreaming);
            debug("Manifest:", module_.manifest);
            (app as unknown as { manifest?: unknown }).manifest =
                module_.manifest;
            return {
                render: (request_: Request) => app.render(request_),
                toInternalApp: () => app
            };
        },
        readFile: async (filePath, encoding = "utf-8") => {
            const target = resolveOutPath(filePath);

            if (!fs.existsSync(target)) {
                // eslint-disable-next-line unicorn/no-null -- vendored API contract: null signals a missing file, matching upstream astro-tests
                return null;
            }

            return fs.promises.readFile(target, encoding);
        },
        resolveUrl,
        startDevServer: async (extraInlineConfig) => {
            process.env["NODE_ENV"] = "development";
            /*
             * Vendored deviation (required since Astro 7): astro's
             * vite-plugin-astro-server bails out of configureServer when
             * process.env.VITEST is set (a guard for getViteConfig-style
             * component tests running inside vitest's own Vite server),
             * which leaves a booted dev server with no request handler —
             * every fetch 404s ("Cannot GET /"). We boot real dev servers
             * from within vitest workers, so hide the variable during
             * startup. Safe under both worker pools: process.env is
             * per-worker (copied for threads, per-process for forks) and
             * test files run sequentially within a worker.
             */
            const vitestEnvironment = process.env["VITEST"];
            delete process.env["VITEST"];
            try {
                debug(`Starting dev server for fixture ${inlineConfig.root}`);
                const developmentServer = await dev(
                    mergeConfig(inlineConfig, {
                        ...extraInlineConfig,
                        force: true
                    })
                );
                serverState.host = parseAddressToHost(
                    developmentServer.address.address
                );
                serverState.port = developmentServer.address.port;
                debug(
                    `Dev server for ${inlineConfig.root} running at ${resolveUrl("/")}`
                );
                return developmentServer;
            } finally {
                if (vitestEnvironment !== undefined) {
                    process.env["VITEST"] = vitestEnvironment;
                }
            }
        }
    };
}

/**
 * Wrap IPv6 addresses in brackets so they are usable in URLs.
 * @param address - Host address reported by the dev server
 * @returns The address, bracketed when IPv6
 */
function parseAddressToHost(address: string): string {
    if (address.startsWith("::")) {
        return `[${address}]`;
    }
    return address;
}
