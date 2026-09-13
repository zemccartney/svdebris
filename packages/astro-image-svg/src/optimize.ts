import type { AstroIntegrationLogger } from "astro";
import type { Config as SvgoConfig } from "svgo";

import Fs from "node:fs/promises";
import Path from "node:path";
import { fileURLToPath } from "node:url";
import { optimize } from "svgo";

/**
 * svgo v4 dropped removeViewBox from preset-default, so viewBox survives and
 * an SVG still scales to whatever width and height the markup asks for.
 * Never add removeViewBox: the same logo is rendered at several sizes.
 */
export const DEFAULT_SVGO: SvgoConfig = {
    multipass: true,
    plugins: [{ name: "preset-default" }]
};

export interface OptimizeResult {
    after: number;
    before: number;
    files: number;
    rewritten: number;
}

const formatKb = (bytes: number): string => `${(bytes / 1024).toFixed(1)} KB`;

const collectSvgs = async (dir: string): Promise<string[]> => {
    const entries = await Fs.readdir(dir, { withFileTypes: true });
    const found = await Promise.all(
        entries.map(async (entry) => {
            const full = Path.join(dir, entry.name);
            if (entry.isDirectory()) return collectSvgs(full);
            return entry.name.endsWith(".svg") ? [full] : [];
        })
    );
    return found.flat();
};

/**
 * Run svgo over every `.svg` under a directory, in place. A file is
 * rewritten only when the result is smaller; a file svgo cannot parse is
 * left exactly as it was and reported once.
 * @param dir - Directory to walk, normally Astro's build output
 * @param config - svgo config
 * @param logger - Astro's integration logger
 * @returns Byte totals before and after, files seen, files rewritten
 */
export async function optimizeSvgs(
    dir: URL,
    config: SvgoConfig,
    logger: AstroIntegrationLogger
): Promise<OptimizeResult> {
    const root = fileURLToPath(dir);
    const files = await collectSvgs(root);
    let before = 0;
    let after = 0;
    let rewritten = 0;

    await Promise.all(
        files.map(async (file) => {
            const source = await Fs.readFile(file, "utf-8");
            const sourceBytes = Buffer.byteLength(source);
            before += sourceBytes;

            let optimized: string;
            try {
                optimized = optimize(source, config).data;
            } catch (error) {
                logger.warn(
                    `Skipped ${Path.relative(root, file)}: ${error instanceof Error ? error.message : String(error)}`
                );
                after += sourceBytes;
                return;
            }

            const optimizedBytes = Buffer.byteLength(optimized);
            if (optimizedBytes >= sourceBytes) {
                after += sourceBytes;
                return;
            }

            await Fs.writeFile(file, optimized, "utf-8");
            after += optimizedBytes;
            rewritten += 1;
        })
    );

    if (files.length > 0) {
        const saved = before - after;
        logger.info(
            `Optimized ${rewritten}/${files.length} SVGs: ${formatKb(before)} to ${formatKb(after)} (saved ${formatKb(saved)}, ${((saved / before) * 100).toFixed(1)}%)`
        );
    }

    return { after, before, files: files.length, rewritten };
}
