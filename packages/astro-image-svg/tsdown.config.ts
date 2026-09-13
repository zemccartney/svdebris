import { defineConfig } from "tsdown";

export default defineConfig({
    attw: { profile: "esm-only" },
    deps: {
        // The service imports Astro's own sharp service at runtime; never
        // inline it, the consumer's astro must resolve it.
        neverBundle: [/^astro(\/|$)/, /^@grepco\/astro-image-svg/],
        skipNodeModulesBundle: true
    },
    dts: { sourcemap: true },
    entry: ["src/index.ts", "src/service.ts"],
    failOnWarn: "ci-only",
    format: "esm",
    publint: true,
    target: "node22",
    tsconfig: "src/tsconfig.json"
});
