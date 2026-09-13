/*
 * Vendored from @inox-tools/astro-tests@0.8.1 (MIT, © Luiz Ferraz)
 * https://github.com/Fryuni/inox-tools/blob/%40inox-tools/astro-tests%400.8.1/packages/astro-tests/src/internal/log.ts
 *
 * Adaptation: uses node:util debuglog instead of the `debug` package to
 * avoid the dependency. Enable output with NODE_DEBUG="grepco:astro-fixture*".
 */
import { debuglog } from "node:util";

/**
 * Create a namespaced debug logger for a harness component.
 * @param name - Component name appended to the `grepco:astro-fixture` namespace
 * @returns A logger that prints only when NODE_DEBUG matches the namespace
 */
export function getDebug(name: string): ReturnType<typeof debuglog> {
    return debuglog(`grepco:astro-fixture:${name}`);
}
