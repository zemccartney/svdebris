import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        include: ["tests/**/*.test.ts"],
        // Settings measured in the pagemeta workspace: 3 workers is the
        // contention sweet spot for Astro builds; isolate:false keeps one
        // module cache per worker; threads avoids fork overhead.
        isolate: false,
        maxWorkers: 3,
        // Task 1 only: no tests exist yet, and vitest 5 exits 1 on an empty
        // run. Task 2 adds real tests and removes this.
        passWithNoTests: true,
        pool: "threads",
        reporters: "tree",
        testTimeout: 120_000
    }
});
