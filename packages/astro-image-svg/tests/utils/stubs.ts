import type { LocalImageService } from "astro";

import { vi } from "vitest";

export type ImageConfigArgument = Parameters<Validate>[1];
export type LoggerArgument = Parameters<Validate>[2];
type Validate = NonNullable<LocalImageService["validateOptions"]>;

/**
 * The subset of Astro's image config the base and sharp services read.
 * @returns A config object with no allowed remote hosts
 */
export function imageConfig(): ImageConfigArgument {
    return {
        domains: [],
        endpoint: {
            entrypoint: "astro/assets/endpoint/generic",
            route: "/_image"
        },
        remotePatterns: [],
        service: { config: {}, entrypoint: "@grepco/astro-image-svg/service" }
    } as unknown as ImageConfigArgument;
}

/**
 * A logger whose four methods are mocks.
 * @returns A runtime logger that records calls and prints nothing
 */
export function logger(): LoggerArgument {
    return {
        debug: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
        warn: vi.fn()
    } as unknown as LoggerArgument;
}

/**
 * Narrow an optional value, failing the test with a name instead of a
 * non-null assertion the strict lint forbids.
 * @param value - Possibly undefined value
 * @param what - What it is, for the error message
 * @returns The value, defined
 */
export function required<T>(value: T | undefined, what: string): T {
    if (value === undefined) throw new Error(`${what} is undefined`);
    return value;
}
