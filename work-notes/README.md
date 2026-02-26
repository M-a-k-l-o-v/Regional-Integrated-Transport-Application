# Work Notes

This folder stores timestamped coding notes to reduce restart friction.

## Commands

- Create one note now:
  - `npm run notes:once`
- Start auto notes every 30 minutes:
  - `npm run notes:watch`

Each note is generated from:
- current git context (recent commits, changed files, touched areas, and a resume plan)
- a concise project snapshot from the root `README.md`
- `work-notes/project-context.md` for persistent project goals/constraints
- note rotation:
  - newest note stays in `work-notes/`
  - previous generated notes are moved to `work-notes/previousNotes/`

Scripts live in `work-notes/scripts/`.
