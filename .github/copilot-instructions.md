Copilot instructions — bbdrills

Purpose

Short, actionable instructions for future Copilot/assistant sessions working on this repo (media + content site for training drills).

Build / test / lint

- This repository contains content, data files, and media assets — there are no build/test/lint scripts committed.
- Tools present in the repo (used by current workflows):
  - yt-dlp: .\\tools\\yt-dlp.exe
    - Example: get metadata for a video ID into JSON:
      .\\tools\\yt-dlp.exe --no-warnings --skip-download --print-json "https://youtu.be/<ID>" > metadata.json
    - Or to query duration only (no JSON tooling required): run yt-dlp with --get-duration or parse the JSON output.
  - ffmpeg: .\\tools\\ffmpeg\\bin\\ffmpeg.exe
    - GIF generation example (from repository notes):
      ".\\tools\\ffmpeg\\bin\\ffmpeg.exe" -hide_banner -y -ss <START> -t <DURATION> -i "videos\\<file>" -vf "fps=12,scale=320:-1:flags=lanczos" "gifs61\\<ID>.gif"
  - Both tools are kept in tools/ (ignored) and not tracked in git. Use explicit paths above or add tools\\ to PATH for convenience.

High-level architecture

- Data-driven static content:
  - default_drills.json and default_drills_with_meta.json are the canonical manifests describing drills and metadata (names, groups, video links, durations, gif ranges, sets/reps).
  - drills.md is a human-readable markdown table derived from the JSON manifest and used as a quick-edit surface.
  - stage1_drills_readable.html is a generated view of the JSON data (bilingual toggle, local links). The HTML is committed; the generator used to produce it is not committed.
- Media assets:
  - videos/ — local copies of videos when available. Filenames follow a convention (see Key conventions).
  - gifs/ and gifs61/ — generated GIFs for previewing clips.
- Metadata and reports:
  - report_video_durations.csv — mapping of video IDs → duration/download status used when enriching JSON.
- Tooling note: Tools (yt-dlp, ffmpeg) are kept in the untracked tools/ folder. See copilot.md for the full runbook and exact commands.\n\nKey conventions (important, repository-specific)

- Video filename pattern: <drill_id>_<youtube_id>.<ext>
  - Example: videos/hip-airplane_URY-escJjss.mp4
  - When adding a local copy for a drilled video, name it with that pattern so the existing manifests resolve automatically.
- JSON manifest fields (present in default_drills_with_meta.json):
  - id, name_en, name_fi, group_fi, group_en, local_video (relative path), video_url, details, video_length (seconds), gif_start (s), gif_end (s), sets, reps
  - Keep numeric durations in seconds (integer). gif_start/gif_end are seconds relative to the local video or remote video timeline.
- GIFs and ranges:
  - GIF files were previously stored in gifs61/ but current working location for published site is site/gifs25fps/ and filenames follow the convention: <drill-id>_<youtube-id>.gif (25 fps). Use this naming when generating new previews.
  - The repository relies on gif_start/gif_end in the JSON; do not change these automatically. The repository owner prefers to edit gif start/end seconds manually before committing.
- Failed or unavailable downloads:
  - If a video could not be downloaded it is left as an external video_url (YouTube link) and local_video is empty. To provide a local copy, place the file in videos/ using the filename convention above.
- Regeneration workflow (notes to assistant):
  - Edits should be made to the JSON manifest (site/default_drills_with_meta.json or drills.md). The site now expects the manifest under site/default_drills_with_meta.json — move or copy the canonical file into site/ when preparing the site for publishing.
  - When regenerating GIFs prefer 25fps previews sized to 320px width. Use the included ffmpeg binary and follow the pattern:
    "<ffmpeg>" -ss <START> -t <DURATION> -i "videos\<drill_id>_<youtube_id>.mp4" -vf "fps=25,scale=320:-1:flags=lanczos" "site/gifs25fps\<drill_id>_<youtube_id>.gif"
  - Prefer storing preview media under site/gifs25fps/ so GitHub Pages serves them directly. For large files, use Git LFS — see .gitattributes added to repo and instructions below.

- Theme & UI persistence (new):
  - Site defaults to English. UI state (language, theme, filter) is persisted in localStorage key: bbdrills_ui_v1. Progress is saved in bbdrills_progress_v3.
  - Theme button cycles system → dark → light and can be overridden; the site honors prefers-color-scheme when theme is 'system'.

- Testing guidance (Playwright) (updated 2026-07-10):
  - Playwright tests should verify: site loads, manifest fetch succeeds, number of cards equals manifest length, all thumbnails have non-empty src, no console errors, theme/lang/filter buttons function and state is persisted across reloads, clicking "Open video" opens the modal.
  - Best practices developed from recent fixes in this repo:
    - Keep performance/timing tests focused and env-gated. Use an explicit check for PERF_TESTS === '1' to enable perf tests locally; do not enable by default in CI.
    - Prefer focused checks (e.g., first N previews) over global "all ready" timing assertions to reduce flakiness.
    - When a UI element may be absent in some environments (e.g., "Open video"), explicitly mark the test as skipped using test.info().skip() so CI/test reports show the skip instead of silently passing.
    - Avoid swallowing wait failures. Waits that check modal hide/visibility should assert the change (no empty catch blocks). If fallback behavior is needed, implement a reliable action (click backdrop at safe coords) and then assert the modal is hidden.
    - Tests that change persistent UI state (localStorage progress/theme) should ensure the final asserted state is explicit (do not toggle done→incomplete by accident). If controls to reach the desired state are missing, fail the test so the issue is visible.
    - For webServer reuse, prefer reusing an existing server only in local/dev runs. In CI, start a fresh server (use process.env.CI to differentiate).
    - Document playbook commands in README when adding or changing env-gated tests (include both shell and PowerShell variants).

- Commit/PR formatting guidance:
  - Use Markdown for PR bodies and commit messages where helpful (headings, code blocks, lists). This improves readability on GitHub.
  - Always use real newlines rather than literal escape sequences like "\\n\\n". Escaped sequences appear verbatim in messages and break formatting. If automation or a shell produces literal backslash-n sequences, convert them to real newlines before sending. Recommended helper (PowerShell): `.\ .github\gh-comment.ps1` — it normalizes literal "\\n" into real newlines and posts via `gh pr comment`.

    Examples:
    - Use a file or pipe: `Get-Content comment.md | .\ .github\gh-comment.ps1 -PR 4` (preferred for long bodies)
    - Pass a string with literal escapes: `.\ .github\gh-comment.ps1 -PR 4 -Body "Line1\\n\\nLine2"` (the helper will convert `\\n` to real line breaks)
    - In bash, prefer `$'line1\n\nline2'` or a here-doc to emit real newlines: `gh pr comment 4 --body $'line1\n\nline2'`.
  - Prefer concise subject lines and a short paragraph body. If multiple paragraphs are needed, separate them with an empty line (a real blank line), not literal backslash-n characters.
  - If you want the assistant to include a longer multi-paragraph body, provide it as plain text; the assistant will format it with real newlines and Markdown.

- PR review reply workflow (owner preference):
  - When addressing GitHub PR review comments, follow this flow:
    1. For each review comment being fixed, create a focused commit that contains only that change. Use a clear commit message referencing the comment (e.g., "fix(review): address comment about X - update Y").
    2. For each fixed comment, post a reply to that specific review comment explaining what was changed. Use Markdown and real newlines; do not include literal "\\n" sequences.
    3. Repeat steps 1–2 for each review comment being addressed. Do not push interim commits to the PR branch until all related review replies and commits for the current review batch are ready.
    4. When all comment fixes and corresponding replies are prepared locally, push all commits at once and then post the replies on GitHub (or push then post replies, but ensure replies reference the commits pushed).
  - Rationale: batching pushes and posting replies together avoids noisy repeated review notifications and keeps the PR timeline tidy. Posting a reply per comment makes it clear which comments were addressed and how.
  - Formatting rules for replies:
    - Use Markdown, include code snippets if relevant, and reference the commit SHA or branch tip when appropriate.
    - Keep replies short and actionable: one sentence describing the fix and a short note if any follow-up is needed.
  - When not to follow this flow:
    - For urgent/security fixes that must be pushed immediately, push and comment inline explaining urgency.
    - For trivial whitespace or doc fixes that don't require a reply, group them into a single commit and note them in PR summary.

  - Example workflow commands (Windows PowerShell):
    # Make a focused change for comment A
    git checkout feature/branch
    # edit files
    git add <files>
    git commit -m "fix(review): address comment A - improve X"

    # Make focused change for comment B
    # edit files
    git add <files>
    git commit -m "fix(review): address comment B - update Y"

    # push all fixes together
    git push origin feature/branch

    # reply to each GitHub review comment with a short Markdown note referencing the commit

  - Ask the repo owner if they prefer a single aggregated comment summarizing all fixes instead of per-comment replies; default to per-comment replies.

  - Assistant behavior enforced by memory:
    - Do not post PR or review replies containing literal "\\n" sequences; always format using real newlines and Markdown.
    - When asked to address review comments, the assistant will prepare separate commits per comment and prepare replies for each, then push all commits together and post the replies.
    - If the assistant cannot post replies automatically (no gh/permissions), it will list the exact replies and the commit SHAs so the user can post them.

- Posting review replies (owner preference):
  - Post replies as a Pull Request review (use the Reviews API or `gh pr review`) so replies are attached to the PR's review timeline and, when possible, to the specific review threads. Do not post them as general issue comments.
  - If replying to a specific inline review thread, attach your reply to that thread (use `gh api` to POST a review comment tied to the file path and position) so the reply is visible inline.
  - When automation posts review replies, prefer a short per-comment reply (one sentence) explaining the change and referencing the commit SHA.

- Pre-push test checklist (required):
  - Before pushing any branch that changes behavior, run unit tests and Playwright checks locally:
    - npm run test:unit   # runs vitest unit tests
  - npx playwright test  # runs Playwright e2e locally (optionally use PERF_TESTS=1 locally for perf checks)
  - Fix any failing tests locally before pushing. CI will also run unit tests before Playwright, but local verification avoids noisy failures and repeated pushes.
- CI note: GitHub Actions should run Playwright using the @playwright/test CLI to avoid mismatched 'playwright' package issues. Use commands like:
  - npx -p @playwright/test playwright install chromium --with-deps
  - npx -p @playwright/test playwright test --reporter=list

Other notes:
- Git LFS: To keep the main Git history small, track large media with Git LFS. Steps a maintainer can run locally:
  1. Install Git LFS (https://git-lfs.github.com/)
  2. git lfs install
  3. git lfs track "site/gifs25fps/*" "videos/*" (or rely on committed .gitattributes)
  4. git add .gitattributes && git add <large files> && git commit -m "Track media with LFS"
  - If migrating existing committed files to LFS, use `git lfs migrate import --include="site/gifs25fps/*,videos/*"` (careful: rewrites history).

- Where to look next: site/index.html, site/default_drills_with_meta.json, site/gifs25fps/ (preview assets), drills.md
- When asked about regenerating or renaming assets, prefer editing drills.md and site/default_drills_with_meta.json then run ffmpeg/yt-dlp routines.

- If asked to add performance improvements: recommend converting GIF previews to animated WebP or short muted MP4/WebM files for much lower size and better playback performance. See site performance notes.

- Copilot sessions should not commit large binary files without asking the repository owner; add .gitattributes first and recommend LFS migration instead of committing large files directly.

- Regeneration steps and Playwright test expectations are recorded above; reference them when making changes or CI updates.

- Regeneration example commands and binary locations are in the top of this file (ffmpeg, yt-dlp).
Existing docs and important lines to reuse

- See copilot.md for a short runbook used by the author: it documents where yt-dlp and ffmpeg live and includes the exact ffmpeg GIF command used. Copilot sessions should prefer copying those exact invocations rather than inventing new ones.

Other AI assistant configs

- No CLAUDE.md, AGENTS.md, .cursorrules, .windsurfrules, AIDER_CONVENTIONS.md or similar assistant configs found in the repo. Nothing to merge.

Working with Copilot in this repo

- Start by reading default_drills_with_meta.json, drills.md, and copilot.md to understand the current data and prior runbook steps.
- When asked to update durations or gif ranges, do not change gif_start/gif_end automatically — follow the repository owner preference and get confirmation if unsure.
- If asked to add a local video, enforce the filename convention and update both local_video in the JSON and drills.md.

Contact / follow-ups

- No MCP server configuration suggested for this repository (no web-e2e or Playwright needs detected). 


---
Created: .github/copilot-instructions.md — captures repo-specific commands, architecture, and conventions. If you want additions (e.g., exact JSON field definitions, or to add a regeneration script and CI), say which area to cover and it will be added.

Testing reminder
- After making changes to site markup, manifest (site/default_drills_with_meta.json), or preview assets, run the Playwright tests and manually verify mobile layout.
- Quick test run (local):
  1) Start a static server from the repo root: npx http-server -c-1 . -p 8000
  2) npm install
  3) npx playwright test --project=chromium
- Tests check that declared previews (gif/webp/mp4) are served and that UI persistence (bbdrills_ui_v1, bbdrills_progress_v1) works.
- If adding or restoring large preview files, run git lfs install and git lfs track patterns in .gitattributes before pushing.

Commit guidance
- Commit small code/docs changes separately from large-media additions. When adding media, commit .gitattributes and track files with Git LFS locally before committing binaries.

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>



