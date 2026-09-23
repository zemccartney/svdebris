# Status

Last updated 2026-09-23. Owner: Zack. This file is the resume point; read `AGENTS.md` first.

## Where things stand

The package is built, tested, reviewed, renamed, and pushed. Nothing is published.

- `packages/svdebris` at this repository's `main` head. Source is three files: `src/service.ts` (the bypass), `src/index.ts` (the integration), `src/optimize.ts` (the svgo pass). Tests: 9 files, 40 tests, green on Astro 7 and on Astro 6 with `@astrojs/cloudflare` 14 and 13 respectively.
- CI runs on GitHub on every push to `main`: static checks, then a matrix of Astro 7 on Node 24, Astro 6 on Node 24, and Astro 7 on Node 22.12. The first run failed only the Node 22.12 leg, because tsdown needs the optional `unrun` package to load its TypeScript config where Node lacks native type stripping; that dependency is now declared and the leg builds locally under 22.12. Confirm the next run is fully green.
- The consuming site, `nba-surprise-teams`, has a branch `image-service` (in a git worktree at `.claude/worktrees/image-service`) that already adopts the package through `"@grepco/svdebris": "link:../svdebris/packages/svdebris"`, replaces the site's own svgo integration, and puts its two SVG components back on `<Image>`. Verified there: 45 SVGs at 78,211 bytes, favicon 2,531, zero `/_image` in built HTML, dev smoke 47 images with no `/_image` requests, 44 of 44 static screenshots at 0.00%, 8 of 8 server-island screenshots identical on real workerd. That branch is not deployable until the package is published, because the `link:` path only resolves with a sibling checkout; every commit on it is prefixed `[CF-Pages-Skip]`.
- Zack has not yet read the code. Everything so far was designed with him and built by agents under review.

## Now: review and clean up

The next step is Zack's own review of the package, guided by `planning/review-guide.md`. Its outputs are: questions answered or recorded, cleanups applied, and a decision on whether the design holds before anything is published. There is no time pressure; nothing depends on this landing by a date.

Concretely:

1. Read `docs/how-astro-images-run.md`, then `packages/svdebris/README.md`, then the source in the order the review guide gives.
2. Run the checks and the suite once, and run at least one fixture test alone to see what it does.
3. Walk the decision trail (review guide, "Reading the decision trail") and challenge anything that reads wrong. Record the outcome in `planning/decisions.md`.
4. Apply cleanups. The review guide lists the nits the final review chose to leave, and the places where the vendored harness drifted from its source.

## Remaining phases, in order

- **Integrate with nba-surprise-teams by hand.** Zack wants to do the `link:` integration himself. Two routes: study branch `image-service` as a worked answer and keep it, or reset that branch to its base (`chart-parity` at `907fd89`) and redo the swap from the spec's section 6, using the branch as the comparison. Either way the acceptance checks are the site's `plan/baseline` harness and the numbers above.
- **Publish.** `npm publish --access public` from `packages/svdebris` under the `@grepco` scope, after deciding the version and checking `pnpm pack` contents (`dist`, `src`, `LICENSE`, `README.md`). Then switch the site from `link:` to the registry version and drop the worktree symlink.
- **File upstream.** `planning/upstream-issues.md`: three adapter issues with transcripts, plus an Astro-core proposal and a docs contribution. Issue 1's production half needs one check on a real Cloudflare Worker deploy before filing; the file says exactly what to run.
- **Merge the site branch** into Zack's workstream once the site installs the published package.

## Open decisions

- Version number for the first publish.
- Whether the README's naming note reads the way Zack wants it.
- Whether to keep the vendored `astro-fixture` renames that lint forced during scaffolding, or restore it to byte parity with its source and exempt it from those rules.
- Whether `svgo` stays a hard dependency or becomes optional. Today it is required and the pass runs by default.

## Resume checklist

An agent picking this up should, before doing anything else:

1. Read `AGENTS.md`, this file, the last entry of `planning/log.md`, and `planning/review-guide.md`.
2. Run `git log --oneline -5` here and `git -C ../nba-surprise-teams/.claude/worktrees/image-service log --oneline -3` if that worktree still exists, and say what the latest commits are.
3. Check the latest CI run (`gh run list --limit 1`) and say whether it is green.
4. Ask Zack, and wait for answers:
    - Which phase are we in: still reviewing, or ready to integrate, publish, or file upstream?
    - How deep a review does he want this session: read-along with explanations, a focused audit of one file, or cleanups he has already decided on?
    - For the site integration, keep the existing branch or redo it from scratch?
    - Any preferences that have changed since the last log entry (tooling, naming, scope)?
5. Restate the stopping point, the next step, and the remaining phases in a few sentences, and confirm that matches what Zack expects.

Then work, and before stopping: update this file's "Where things stand" and "Now", append to `planning/log.md`, and record decisions in `planning/decisions.md`.
