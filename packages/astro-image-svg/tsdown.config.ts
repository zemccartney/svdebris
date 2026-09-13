import { defineConfig } from "tsdown";

export default defineConfig({
    attw: { profile: "esm-only" },
    deps: {
        // The service imports Astro's own sharp service at runtime; never
        // inline any dependency, the consumer must resolve them from its
        // own node_modules.
        neverBundle: true
    },
    dts: { sourcemap: true },
    entry: ["src/index.ts", "src/service.ts"],
    failOnWarn: "ci-only",
    format: "esm",
    publint: true,
    target: "node22",
    tsconfig: "src/tsconfig.json"
});
