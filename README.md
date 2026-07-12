# BBDrills — Off-season basketball drills

This repository contains the static website for BBDrills: a small, data-driven site that lists short basketball training drills with a compact preview, a link to the original YouTube video, and simple progress tracking.

## What this repo contains

- site/ — the built static site published to GitHub Pages
- site/previews/ — small MP4 previews and poster WebP images (kept compact)
- site/default_drills_with_meta.json and drills.md — canonical drill manifest and human-editable table

## Contributing

- .github/CODEOWNERS assigns likely reviewers. Enforcement (requiring approvals from code owners) depends on branch-protection settings; the file alone does not enforce reviews.

## Copyright & permissions

- Drill instructions originate from a PDF shared by the LePy coaching staff. Video links point to public YouTube videos. If you are a content owner and want material removed or changed, please open an issue or contact @shtolik.

## Preview policy

- Animated previews are MP4 (H.264, 25fps) and posters are single-frame WebP. If a rights-holder objects, previews will be removed or replaced with static posters.

## Live site

- GitHub Pages: https://shtolik.github.io/bbdrills

## Contact

- Open an issue or mention @shtolik on GitHub for removals, corrections, or questions.

## Running tests

- Run full Playwright suite: npm test
- Run only the focused performance test (skipped by default). Enable it with PERF_TESTS=1:
  Shell (bash/zsh): PERF_TESTS=1 npx playwright test -g "performance: first two"
  PowerShell: $env:PERF_TESTS='1'; npx playwright test -g "performance: first two"

## Key files

- src/site/App.tsx — new Preact application entry that renders drills and handles UI state (theme/lang/filter), modal, and lazy loading.
- src/site/main.tsx — Preact mount that also loads the YouTube iframe API flag.
- site/site.bundle.js — generated bundle (gitignored); produced by `npm run build:site` using esbuild.
- site/default_drills_with_meta.json — canonical manifest used by the site and tests.
- src/lib/progress.ts — progress persistence helpers used by both site and tests.
- tests/playwright.spec.ts and playwright.config.ts — Playwright end-to-end tests and configuration.

Make sure to run `npm install` after switching branches so site bundle can be built locally with `npm run build:site`.
