# Handoff

## Now

- 2026-10-29: repo lives in `bball/bbdrills` under the workspace (junction at the old path until mid-November).
  Agent instructions are in `AGENTS.md`; Copilot and Claude files point to it.
- Main checkout is on `main`, level with origin. Untracked there: `page.html`, `pr-body.md` (old, Jul/Aug; keep or
  delete). The superseded local commit `708c4a2` (first GA workflow draft) is kept on `backup/main-708c4a2`.
- Analytics: one GA snippet per page with placeholder `__GA_MEASUREMENT_ID__`, filled by `deploy-pages.yml`
  (the only deploy; Pages is set to "GitHub Actions"). Before this, the home page loaded gtag twice and drill pages
  never got the id.
- Local branches out of step with origin (`add/sitemap-robots` ahead 31, `add/share-button` ahead 1, others
  merged); no open PRs. Decide which to keep.
- Next feature work: `plan.md` (sets/reps controls, 7-day history, diary page).
