/*
 * Vendored from @inox-tools/astro-tests@0.8.1 (MIT, © Luiz Ferraz)
 * https://github.com/Fryuni/inox-tools/blob/%40inox-tools/astro-tests%400.8.1/packages/astro-tests/src/testAdapter.ts
 * whose own header states it was copied (and TypeScript-ified) from Astro
 * core's test adapter:
 * https://github.com/withastro/astro/blob/main/packages/astro/test/test-adapter.js
 *
 * Vendored 2026-07-03. Adaptations: debug logging via node:util debuglog;
 * integration name is a literal (upstream used the debug instance's name);
 * the `env` option and the entryPoints/middlewareEntryPoint/routes collector
 * callbacks were dropped (unused in this workspace — re-vendor if needed).
 */
import type { AstroIntegration } from "astro";

import { getDebug } from "./log.ts";

const debug = getDebug("testAdapter");

export interface Options {
    /**
     * Whether to expose `Astro.clientAddress`.
     * @default true
     */
    provideAddress?: boolean;
}

/**
 * Create a minimal SSR adapter for tests. Built apps expose `createApp` and
 * `manifest` from their server entrypoint, which `loadTestAdapterApp()` uses
 * to render requests in-process.
 * @param options - Adapter behavior toggles
 * @returns An Astro integration that registers the test adapter
 */
export default function testAdapter(options: Options = {}): AstroIntegration {
    debug("New test adapter created", options);

    const { provideAddress = true } = options;

    return {
        hooks: {
            "astro:config:done": ({ setAdapter }) => {
                debug("Applying adapter");
                setAdapter({
                    exports: ["manifest", "createApp"],
                    name: "my-ssr-adapter",
                    serverEntrypoint: "@my-ssr",
                    supportedAstroFeatures: {
                        envGetSecret: "stable",
                        hybridOutput: "stable",
                        i18nDomains: "stable",
                        serverOutput: "stable",
                        sharpImageService: "stable",
                        staticOutput: "stable"
                    }
                });
            },
            "astro:config:setup": ({ updateConfig }) => {
                updateConfig({
                    vite: {
                        plugins: [
                            {
                                load(id) {
                                    if (id === "@my-ssr") {
                                        return `
											import { App } from 'astro/app';
											import fs from 'fs';

											class MyApp extends App {
												#manifest = null;
												constructor(manifest, streaming) {
													super(manifest, streaming);
													this.#manifest = manifest;
												}

												async render(request, { routeData, clientAddress, locals, addCookieHeader } = {}) {
													const url = new URL(request.url);
													if(this.#manifest.assets.has(url.pathname)) {
														const filePath = new URL('../../client/' + this.removeBase(url.pathname), import.meta.url);
														const data = await fs.promises.readFile(filePath);
														return new Response(data);
													}

													${provideAddress ? `request[Symbol.for('astro.clientAddress')] = clientAddress ?? '0.0.0.0';` : ""}
													return super.render(request, { routeData, locals, addCookieHeader });
												}
											}

											export function createExports(manifest) {
												return {
													manifest,
													createApp: (streaming) => new MyApp(manifest, streaming)
												};
											}
										`;
                                    }
                                },
                                name: "test-ssr-adapter",
                                resolveId(id) {
                                    if (id === "@my-ssr") {
                                        return id;
                                    }
                                }
                            }
                        ]
                    }
                });
            }
        },
        name: "@grepco/astro-fixture:test-adapter"
    };
}
