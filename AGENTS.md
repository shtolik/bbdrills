# bbdrills (drills.my): instructions for coding agents

Workspace rules, start and stop procedure: read `../AGENTS.md` first.

Static, data-driven site of short off-season basketball drills (LePy coaching staff's list): compact preview,
YouTube link, local progress tracking. Live at https://drills.my (GitHub Pages, `site/CNAME`).

## Layout

`site/` published static site (manifest `site/default_drills_with_meta.json`, `previews/`, `locales/`);
`src/site/` Preact app (`App.tsx`, `main.tsx`, `i18n.ts`, `url.ts`); `src/lib/progress.ts` localStorage progress;
`site/site.bundle.js` built by esbuild, git-ignored; `tests/unit/` vitest, `tests/*playwright.spec.ts` e2e;
`plan.md` feature plan. Drills, media, previews, manifest fields: skill `drill-media`.

## Commands

```bash
npm install                 # after every branch switch
npm run build               # typecheck + bundle site/site.bundle.js
npm run test:unit           # vitest
npx playwright test         # e2e; starts npx http-server on :8000 (reuses a running one locally)
npm run format:check        # prettier; CI checks it on pushes touching src/ or site/
```

Perf tests are off by default: `PERF_TESTS=1 npx playwright test -g "performance: first two"`.

## Rules

- Work on a branch and open a PR; a push to `main` deploys the live site (`deploy-pages.yml`).
- Before pushing a behaviour change: `npm run test:unit` and `npx playwright test`.
- Git LFS is required; large media only through LFS and with the owner's OK.
- Playwright: keep perf tests env-gated; mark absent UI as skipped (`test.info().skip()`), never swallow wait
  failures; CI starts a fresh server and calls `./node_modules/.bin/playwright`, not `npx -p`.
- Conventional commit subjects (`feat(site):`, `fix(...)`, `ci:`, `test:`, `chore:`). Review comments: skill
  `pr-review-replies`.
- Remote: `origin` (GitHub `shtolik/bbdrills`). No n40l backup yet.
