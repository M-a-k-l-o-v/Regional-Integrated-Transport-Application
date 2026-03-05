# Work Notes

This folder stores timestamped coding notes to reduce restart friction.

## Commands

- Create one note now:
  - `npm run notes:once`
- Start auto notes every 30 minutes:
  - `npm run notes:watch`
- Start auto notes + automatic commits every 30 minutes:
  - `npm run notes:watch:autocommit`

Each note is generated from:
- current git context (recent commits, changed files, touched areas, and a resume plan)
- a concise project snapshot from the root `README.md`
- `work-notes/project-context.md` for persistent project goals/constraints
- note rotation:
  - newest note stays in `work-notes/`
  - previous generated notes are moved to `work-notes/previousNotes/`

Scripts live in `work-notes/scripts/`.

## Optional flags

- `NOTES_AUTO_COMMIT=true`: auto-commit tracked/unignored changes after each generated note.
- `NOTES_RUN_ON_START=true`: generate/commit immediately on watcher start (otherwise first run is after interval).
- `NOTES_INTERVAL_MINUTES=30`: watcher interval in minutes.
- `NOTES_WINDOW_MINUTES=30`: lookback window used by note generation.
- `NOTES_STOP_ON_IDLE=true`: stop watcher when no backend activity is detected.
- `NOTES_IDLE_STOP_MINUTES=30`: inactivity threshold before stop (default 30m).
