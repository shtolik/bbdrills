---
name: drill-media
description: Add or change drills, local videos, MP4 previews or WebP posters in bbdrills, or edit the drill manifest (site/default_drills_with_meta.json, drills.md). Use when the user adds a drill, downloads or trims a video, regenerates previews, or changes manifest fields or the localStorage schema.
---

# Drills, media and manifest

## Files

- `site/default_drills_with_meta.json`: canonical manifest (site and tests use it); `drills.md`: the same drills as
  a human-editable table. Change both together.
- `site/previews/`: MP4 previews and WebP posters. Local tools (git-ignored): `tools/yt-dlp.exe`,
  `tools/ffmpeg/bin/ffmpeg.exe`; tracked helper scripts in `tools/scripts/`.

## Rules

- Media names: `<drill-id>_<youtube-id>.<ext>` (e.g. `hip-airplane_URY-escJjss.mp4`); manifests resolve local files
  by that pattern. Previews: MP4 H.264, 25 fps, 320 px wide, plus a single-frame WebP poster.
- Large media goes through Git LFS (the pre-push hook fails without `git-lfs`). Never commit large binaries without
  asking the owner.
- Never change `gif_start`/`gif_end` (preview ranges) automatically; the owner sets them by hand.
- When adding a local video, update both `local_video` in the manifest and `drills.md`.
- Manifest fields: `id, name_en, name_fi, group_fi, group_en, local_video, video_url, details, video_length (s),
  gif_start (s), gif_end (s), sets, reps` (+ preview fields). Durations are integer seconds.
- UI state lives in localStorage `bbdrills_ui_v1` (language, theme, filter); progress in `bbdrills_progress_v3`
  (`src/lib/progress.ts`). Keep migrations (`tests/unit/migration.spec.ts`) when changing the schema.
- Respect content owners: videos are public YouTube links; remove previews if a rights holder objects.
