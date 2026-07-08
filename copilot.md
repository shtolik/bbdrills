Copilot run — YouTube drills processing

Date: 2026-07-03T20:10:00+03:00
Source: stage1_drills_readable.html and Lepy_p2014_off_season.pdf

Summary of updates:
- Parsed the PDF and added Finnish drill names (where present or translated) and Details (Lisätiedot) into drills.md.
- Grouped drills into: Juoksu treeni (Running), Kuntosali treeni (Gym), Kehonpain treeni (Bodyweight) in drills.md and the generated JSON.
- Filled video durations where available by querying yt-dlp; created default_drills_with_meta.json and updated default_drills.json to include: name_en, name_fi, group_fi, group_en, local_video, video_url, details, video_length (seconds), gif_start, gif_end, sets, reps.
- Regenerated stage1_drills_readable.html from the enriched JSON so the page shows Finnish names, details, sets/reps and video durations (local links when available).

Status and edge cases:
- Video metadata/durations: durations were fetched from YouTube metadata via yt-dlp for available videos and populated into JSON and drills.md where possible. See report_video_durations.csv for raw results.
- Missing / failed downloads:
  * b1NVhY5U8M — download/query failed (unsupported/redirect). Left as external URL and local filename placeholder; needs cookies/auth or manual placement in videos\ to serve locally.
  * gxf460U591I — marked "video not available" by YouTube; left as external URL and no local copy.
- GIF generation: GIFs can be created locally using ffmpeg. For best performance prefer creating animated WebP and short MP4 previews in addition to GIF fallbacks. GIF defaults are 0–8s in metadata; run ffmpeg locally to create previews when ready.

Preview generation recommendations:
- Create animated WebP and MP4 previews:
  ".\\tools\\ffmpeg\\bin\\ffmpeg.exe" -ss <START> -t <DURATION> -i "videos\\<drill-id>_<youtube-id>.mp4" -vf "fps=25,scale=320:-1:flags=lanczos" -loop 0 "site\\previews\\webp\\<drill-id>_<youtube-id>.webp"
  ".\\tools\\ffmpeg\\bin\\ffmpeg.exe" -ss <START> -t <DURATION> -i "videos\\<drill-id>_<youtube-id>.mp4" -c:v libx264 -preset veryfast -crf 28 -an -pix_fmt yuv420p -movflags +faststart "site\\previews\\mp4\\<drill-id>_<youtube-id>.mp4"
- Create GIF fallbacks (25fps) if needed:
  ".\\tools\\ffmpeg\\bin\\ffmpeg.exe" -ss <START> -t <DURATION> -i "videos\\<drill-id>_<youtube-id>.mp4" -vf "fps=25,scale=320:-1:flags=lanczos" "site\\gifs25fps\\<drill-id>_<youtube-id>.gif"
- Update site/default_drills_with_meta.json with preview_webp and preview_mp4 fields (paths relative to site/).
- Use .gitattributes / Git LFS for large files (site/previews/*, site/gifs25fps/*, videos/*).

Files produced/updated:
- drills.md — added columns: Drill Name (FI), Group (fi|en), Details (Lisätiedot), Video length (s), GIF start-end, plus existing fields.
- default_drills_with_meta.json — full enriched manifest (id, name_en, name_fi, group_fi, group_en, local_video, video_url, details, video_length, gif_start, gif_end, sets, reps).
- default_drills.json — overwritten with the enriched JSON (backup saved as default_drills.json.bak).
- stage1_drills_readable.html — regenerated from the enriched JSON (shows FI names, details, sets/reps and durations/local links where available).
- report_video_durations.csv — raw mapping of YouTube ID → duration/download status.

Next steps and suggestions:
1) If local copies for b1NVhY5U8M are required, provide an authenticated cookies.txt for yt-dlp or place a file named b1NVhY5U8M.mp4 in videos\.
2) Create GIFs locally using ffmpeg: ffmpeg\ffmpeg-8.1.1-essentials_build\bin\ffmpeg.exe -hide_banner -y -ss 0 -t 8 -i "videos\<ID>.<ext>" -vf "fps=12,scale=320:-1:flags=lanczos" "gifs61\<ID>.gif". Then update drills.md GIF File column and JSON gif paths.
3) Implement a small client-side tracker (localStorage) in stage1_drills_readable.html to mark drills done and export/import diary JSON — will be the next feature toward a phone-friendly app.

Notes on reproducibility and licensing:
- All metadata extraction and downloads were done with .\\tools\\yt-dlp.exe (kept untracked in tools/). Re-run the scripts if you add/remove videos.
- Respect content owners and YouTube terms when redistributing or bundling videos.

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>

### Tools on this machine
- yt-dlp: .\\tools\\yt-dlp.exe
- ffmpeg: .\\tools\\ffmpeg\\bin\\ffmpeg.exe
- PowerShell: C:\WINDOWS\system32\cmd.exe
- Report file (if present): D:\\work\\workspace\\bbdrills\\report_video_durations.csv
Notes: ffprobe not found on PATH; yt-dlp merges streams only if ffmpeg available on PATH or specified.

[Update] Downloaded walking-lunges (tQNktxPkSeE) and hill-sprints (98Bt-bFM6Zg); updated JSON, drills.md and stage1_drills_readable.html. Merged fragments with ffmpeg where needed.

Testing reminder
- Playwright tests are in tests/playwright.spec.ts and validate: site loads, manifest fetch, each card has a usable preview (webp/mp4/gif), theme/lang persistence, modal open behavior, and that declared preview files are served by the site.
- Run tests locally:
  1) Start a static server from the repo root: npx http-server -c-1 . -p 8000
  2) npm install
  3) npx playwright test --project=chromium
- After editing site markup, CSS, or manifest, run Playwright tests and manually verify mobile layout before committing.

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>

