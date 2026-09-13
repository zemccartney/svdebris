/*
 * Switch the workspace to a different supported Astro major, for local and
 * CI matrix testing. Usage: node scripts/use-astro.ts <major>
 *
 * Rewrites the `astro` catalog entry in pnpm-workspace.yaml and the
 * package's `@astrojs/cloudflare` devDependency range (the adapter releases
 * a major per Astro major), then runs `pnpm install --no-frozen-lockfile`.
 * Restore with:
 *   git restore pnpm-workspace.yaml packages/astro-image-svg/package.json pnpm-lock.yaml && pnpm install
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const CLOUDFLARE_ADAPTER_BY_ASTRO_MAJOR: Record<string, string> = {
    "6": "^13.0.0",
    "7": "^14.0.0"
};

const major = process.argv[2];

if (!major || !Object.hasOwn(CLOUDFLARE_ADAPTER_BY_ASTRO_MAJOR, major)) {
    const supported = Object.keys(CLOUDFLARE_ADAPTER_BY_ASTRO_MAJOR).join(", ");
    console.error(
        `${major ? `Unsupported Astro major "${major}".` : "Missing Astro major."}\n\nUsage: node scripts/use-astro.ts <major>\nSupported majors: ${supported}`
    );
    // eslint-disable-next-line unicorn/no-process-exit -- CLI usage error
    process.exit(1);
}

const workspaceFile = "pnpm-workspace.yaml";
const workspaceYaml = readFileSync(workspaceFile, "utf-8");
const rewrittenYaml = workspaceYaml.replace(
    /^(\s*astro:\s*)\^\d+\.\d+\.\d+$/m,
    (_, prefix: string) => `${prefix}^${major}.0.0`
);
if (rewrittenYaml === workspaceYaml && !workspaceYaml.includes(`^${major}.`)) {
    console.error(
        `Could not find the astro catalog entry in ${workspaceFile}.`
    );
    // eslint-disable-next-line unicorn/no-process-exit -- CLI usage error
    process.exit(1);
}
writeFileSync(workspaceFile, rewrittenYaml);

const packageFile = "packages/astro-image-svg/package.json";
const packageJson = readFileSync(packageFile, "utf-8");
writeFileSync(
    packageFile,
    packageJson.replace(
        /"@astrojs\/cloudflare":\s*"\^\d+\.\d+\.\d+"/,
        () =>
            `"@astrojs/cloudflare": "${CLOUDFLARE_ADAPTER_BY_ASTRO_MAJOR[major]}"`
    )
);

console.log(`Catalog astro → ^${major}.0.0; installing...`);
execFileSync("pnpm", ["install", "--no-frozen-lockfile"], { stdio: "inherit" });
