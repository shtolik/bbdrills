---
name: pr-review-replies
description: Address review comments on a bbdrills pull request and reply on each review thread. Use when the user asks to handle, fix or answer PR review comments in bbdrills.
---

# Addressing PR review comments (bbdrills)

1. One focused commit per review comment (conventional subject, e.g. `fix(site): ...`).
2. Run `npm run test:unit` and `npx playwright test` if behaviour changed, then push all commits together.
3. Reply on each review thread inline, as a PR review (not as issue comments): one sentence and the commit SHA.
   Find thread ids with `gh api repos/shtolik/bbdrills/pulls/<n>/comments`; reply with
   `gh api repos/shtolik/bbdrills/pulls/<n>/comments/<comment-id>/replies -f body="..."`.
4. Markdown bodies need real newlines, never literal `\n`; write long bodies to a file and use `--body-file`.
