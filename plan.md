Feature plan: Sets & Repeats, Local Tracking, History & Gamification

Overview

- Add per-drill "Mark 1 set complete" and "+1 set" controls, enlarge sets/reps numbers, track daily progress in localStorage, show a 7-day completion indicator, and provide a Diary/History page. Phase the work so core UX and storage are in place first, then add gamification and export features.

Goals

- Make it easy to record sets done without replaying the whole video.
- Provide persistent local history per day and a compact weekly view (7 dots) for streaks.
- Visually mark cards completed for the day.
- Keep all data local initially and test with unit + integration tests.

Scope (MVP - Phase 1)

- Per-card SetControls: "Mark 1 set complete", "+1 set" buttons, larger numeric display for sets/reps.
- LocalStorage schema and helpers for today and weekly aggregation.
- Weekly 7-dot indicator on DrillCard showing last 7 days (full/partial/none).
- Card completed visual state (gray/dimmed + Done badge) when setsLeft === 0.
- Diary page (/diary) showing last 7/30 days with drill summaries and CSV export.
- Unit tests for storage helpers, Playwright checks for critical UI flows.

Phases

- Phase 1 (MVP): storage helpers, SetControls, WeeklyDots, card completed style, diary skeleton, unit tests for storage.
- Phase 2: diary editing, CSV export, confetti/animation on completion, accessibility polishing, Playwright flows covering diary and SetControls.
- Phase 3: achievements/badges, streaks logic, light social share or export, opt-in sync/backups (deferred).

Data model (localStorage)

- Key: bbdrills_progress_v3
  - Schema: { meta:{version:3,createdAt}, byDate: { "YYYY-MM-DD": { "<drillId>": { targetSets, repsPerSet?, sessions:[{timestamp,sets,reps?}], setsCompleted, lastUpdated } } } }
  - Example:
    {
    "meta": { "version": 3, "createdAt": "2026-07-10T12:00:00Z" },
    "byDate": {
    "2026-07-10": {
    "hip-airplane": {
    "targetSets": 3,
    "repsPerSet": 12,
    "sessions": [ { "timestamp":"2026-07-10T09:10:00Z","sets":1 } ],
    "setsCompleted": 1,
    "lastUpdated": "2026-07-10T09:10:00Z"
    }
    }
    }
    }
- Helper functions expose weekly aggregation and convenience APIs (markSetComplete, addTargetSets, undoLastSession).
- Migration: helper available to convert legacy bbdrills_progress_v1 into v3; not run automatically for existing users unless needed.

Files changed / status

- src/lib/progress.ts -- implemented (storage helpers, v3 schema, migration helper, unit tests) [DONE]
- site/index.html -- wired to v3 schema, inline helpers, SetControls implemented (Mark 1 set) [DONE]
- src/components/SetControls.tsx -- planned (could be extracted from inline code) [PENDING]
- src/components/WeeklyDots.tsx -- planned [PENDING]
- src/components/DrillCard.tsx -- planned (refactor from site/index.html) [PENDING]
- src/pages/diary.html / diary route -- planned [PENDING]
- tests/unit/progress.spec.ts -- implemented [DONE]
- tests/unit/migration.spec.ts -- implemented [DONE]
- tests/playwright.spec.ts -- to add focused Playwright checks for SetControls and diary [PENDING]
- README.md / .github/copilot-instructions.md -- update to note new storage key and test commands [PENDING]

Acceptance criteria

- Clicking "Mark 1 set complete" updates localStorage for today's date and updates the UI immediately.
- Clicking "+1 set" increases the target sets and updates setsLeft accordingly.
- When setsLeft reaches 0, the card enters completed visual state and shows Done badge.
- WeeklyDots reflect full/partial/none correctly for the last 7 days.
- Diary page lists days with drill summaries and allows CSV export.
- Unit tests for storage helpers pass locally; Playwright tests for critical flows pass locally with default test server.

Tests & QA

- Unit tests: storage read/write, migration, weekly aggregation, streak calc.
- Playwright: mark set complete, +1 set, card completed state, weekly dots update, diary page load.
- Keep perf-sensitive tests minimal and gated by PERF_TESTS env var.

Security & Privacy

- All tracking is localStorage-only by default. If sync is added later, require explicit opt-in and explain data usage.
- Avoid storing PII. Export CSVs contain only drill IDs, dates, setsDone/setsTotal.

Developer notes & UX ideas

- Small confetti + sound on full completion (user-toggleable).
- Achievements: first full completion, 7-day streak, 30-day streak, repeated-drill milestones.
- Quick-challenges and badge-sharing could increase engagement with younger players.

Next steps (recommended order)

1. Implement src/lib/progress.ts + unit tests (progress.spec.ts).
2. Implement SetControls UI and wire to progress helpers; test manually.
3. Add WeeklyDots and integrate into DrillCard; style completed state.
4. Create Diary page and CSV export.
5. Add Playwright tests for main flows and run locally; gate heavy perf tests behind PERF_TESTS.
6. Update README and copilot-instructions.md with run commands and storage keys.

Open questions / decisions

- Should clicking "+1 set" immediately persist and count toward today, or be a template change for future sessions? (Recommended: persist immediately for today.)
- UX for decrementing sets or undoing a mistake: add "undo last" or long-press confirm? (Recommended: Add undo toast with 5s window in Phase 1.)

If this looks good, approve to start implementation. Preferred next action: "implement storage helpers + unit tests" or "scaffold UI components first".
