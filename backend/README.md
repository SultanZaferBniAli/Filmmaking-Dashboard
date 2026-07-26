# Film Workshops Dashboard — Excel-backed backend

No database, no CMS. The four master workbooks under `../import-data/<entity>/<entity>.xlsx`
are the permanent store — every read parses the `البيانات` sheet live, and every write goes
back into that same sheet via an atomic temp-file-then-rename swap, with a timestamped backup
taken first. There is no filesystem folder-scanning or auto-import: the only way data changes is
through the API — either the raw CRUD routes (used by the dashboard's own edit UI) or the
`/admin` upload → review → apply pipeline (used to bulk-load/update workshops, trainers,
participants, and feedback from Excel).

## Data model

Four entities, linked by id, each one master workbook:

| Entity | File | Id field | Notes |
|---|---|---|---|
| Workshops | `workshops/workshops.xlsx` | `workshop_id` (`WS-###`) | References one trainer via `trainer_id`. |
| Trainers | `trainers/trainers.xlsx` | `trainer_id` (`TR-###`) | |
| Participants | `participants/participants.xlsx` | `participant_id` | Carries `workshop_id`. Applicant + acceptance + attendance in one row. |
| Feedback | `feedback/feedback.xlsx` | `feedback_id` | Carries `workshop_id`, optionally `participant_id`. |

Relationships: Trainer 1—\* Workshop; Workshop 1—\* Participant; Workshop 1—\* Feedback. Adding a
new workshop means appending a row to `workshops.xlsx` — never creating a new folder or file.

## Env vars (`.env`, see `.env.example`)

| Var | Default | Meaning |
|---|---|---|
| `PORT` | `4000` | HTTP port |
| `DATA_DIR` | `../import-data` | Root folder containing `workshops/`, `trainers/`, `participants/`, `feedback/`, `_staging/`, `_backups/`, `_audit/`. Point this at a temp copy when testing. |
| `MAX_UPLOAD_BYTES` | `10485760` (10MB) | Upload size limit (Excel files and images) |

## Running

```sh
npm install
cp .env.example .env
npm run dev        # tsx watch src/server.ts
npm run verify      # prints row counts from the live workbooks
npm test             # vitest — all tests run against a temp-copied fixture dir, never the real files
```

If a master workbook is missing (fresh install, or a fresh entity), it's created automatically
on first read/write with just the header row — no manual setup step.

## The upload → review → apply pipeline (`/admin`)

This is the *only* way bulk data gets into the system. It never writes on upload — only on an
explicit Apply.

1. **Upload** — `POST /admin/upload`, multipart, one or more `.xlsx` files (either four
   per-entity files, or a single combined workbook with multiple sheets). Each sheet's entity is
   auto-detected — first by sheet name (aliases like `workshops`/`ورش العمل`, `trainers`/`مدربين`,
   etc.), falling back to column-header overlap against each entity's canonical columns (this is
   how a per-entity export, whose sheet is always named `البيانات`, gets identified). Every row
   is run through the same normalization + Zod validation the dashboard's own CRUD routes use
   (`entities/*.ts`), diffed against current data (insert / update-with-changed-fields / skip),
   and checked for **blocking errors**: duplicate id, duplicate email/national_id within a
   workshop, or a `workshop_id`/`trainer_id` that doesn't reference an existing record. Normalize
   warnings (unmapped city, unverified phone, etc.) are non-blocking. The result is persisted to
   `_staging/<stagingId>.json` and returned as `{ stagingId, batches: [{entity, summary, rows,
   issues}] }` — nothing in the master workbooks has changed yet.
2. **Review / fix** — `GET /admin/staging/:id` re-fetches the staged state (survives a page
   reload). `PATCH /admin/staging/:id/batches/:entity/rows/:rowIndex` edits one row's fields and
   re-runs the *entire* batch's validation (so fixing a duplicate clears both rows' errors, not
   just the edited one), persisting the updated staging state.
3. **Apply** — `POST /admin/staging/:id/apply` (optional body `{ batches: [...] }` to apply a
   subset). Each targeted batch is re-validated fresh against the *current* master data
   immediately before writing (in case it changed since staging), then upserted via the same
   atomic write + backup + audit-log path as every other write in this backend. A batch that
   still has blocking errors is skipped (not applied) without aborting sibling batches, and stays
   staged so it can be fixed and retried. If a target workbook is open in Excel, the whole apply
   call aborts with `423` (any batches *already* written earlier in the same call stay written)
   — the staging session is preserved either way, so retrying after closing the file just works.
   Once every batch in the session has applied cleanly, the session is discarded automatically.
4. **Discard** — `DELETE /admin/staging/:id` drops the staging entry. Nothing is touched.

Re-uploading and applying an unchanged file always reports `inserted: 0, updated: 0` for every
row (idempotent).

**Feedback/participants collected per-workshop, with no `workshop_id` column.** A post-workshop
survey export (Google Forms, a paper form, etc.) has no `workshop_id` — it's an internal
reference this system carries, not something a coordinator fills in — and a feedback export
typically has no `feedback_id` either. Uploading such a file: `feedback_id` is auto-generated on
upload if missing (stamped once, stable across edits/apply — never regenerated); every row will
be flagged with a `workshop_id` blocking error until you tell it which workshop the file belongs
to via `PATCH /admin/staging/:id/batches/:entity/workshop` (`entity` is `participants` or
`feedback`), body `{ "workshop_id": "WS-107" }` — this bulk-sets `workshop_id` on every staged row
and re-validates the whole batch in one call, rather than fixing each row by hand. The admin UI
surfaces this as a "which workshop is this?" picker above the review table.

```sh
curl -F files=@workshops.xlsx -F files=@trainers.xlsx http://localhost:4000/admin/upload
# -> { stagingId, batches: [...] }
curl -X POST http://localhost:4000/admin/staging/<stagingId>/apply
```

## Image upload

- **Trainer photo** (one per trainer): `POST /admin/trainers/:id/photo` (multipart field
  `file`), `DELETE /admin/trainers/:id/photo`. Stored at
  `trainers/photos/<trainer_id>.<ext>` and the trainer's `profile_image` column is updated in
  the same call. Uploading a new photo removes the old file first (so switching extensions
  doesn't leave an orphan).
- **Workshop photos** (cover + gallery): `POST /admin/workshops/:id/photos` (multipart field
  `files`, one or more; optional field `cover=true` to also set the first uploaded file as the
  workshop's cover image), `DELETE /admin/workshops/:id/photos/:filename`. Stored at
  `workshops/photos/<workshop_id>_<n>.<ext>`; the cover selection is stored in the workshop's
  `workshop_image` column (falls back to the first gallery photo if unset, and re-falls-back if
  the cover photo is deleted).
- Both validate file type (`.jpg`/`.jpeg`/`.png`/`.webp`) and size (`MAX_UPLOAD_BYTES`), and both
  back up whatever file was previously at that exact path before writing (see Backups below).
- Workshop report/guide documents (`POST/DELETE /workshops/:id/report-file` and `.../guide-file`)
  work the same as before, just stored flat at `workshops/reports/` and `workshops/guides/`
  (filenames `<workshop_id>_<timestamp>.<ext>`, latest wins).

## Other API routes

- Raw CRUD (operates on the underlying Excel column names, for editing):
  `GET/POST /:entity`, `GET/PATCH/DELETE /:entity/:id`, `POST /:entity/:id/restore`.
  `entity` is one of `workshops`, `trainers`, `participants`, `feedback`.
- Dashboard-consumable shape (matches the frontend TS interfaces exactly — joins trainer
  display fields, derives nested participants/aggregates live):
  `GET /view/workshops`, `GET /view/workshops/:id`, `GET /view/trainers`,
  `GET /view/participants`, `GET /view/feedback`.
- Relational reads: `GET /workshops/:id/participants`, `GET /workshops/:id/feedback`.
- Attendance save (Workshop Detail's "الحضور" tab): `PATCH /workshops/:id/attendance` with
  `{ participantAttendance: [{ participant_id, day_1..day_5 }] }` — recomputes
  `sessions_attended`/`attendance_percentage`/`attendance_status` server-side, writes all
  changed participants in one atomic call, returns the refreshed `view/workshops/:id` shape.
- Documents (CV/passport, not photos): `POST /:entity/:id/attachments` (multipart field `file`;
  pdf/doc/docx/jpg/png, size-limited) — trainers only today, stored under
  `trainers/documents/<id>_<timestamp>.<ext>`.
- Change history: `GET /:entity/:id/history` — that record's audit-log timeline.
- Errors: `{ error: { code, message, fieldErrors: [{path, message}] } }` —
  `422` validation (incl. `UNSUPPORTED_FILE_TYPE`/`FILE_TOO_LARGE` for images), `404`
  (`STAGING_NOT_FOUND` for an expired/already-applied staging id), `409` conflict, `423` file
  locked.

## Persistence details

- **Soft delete only.** `DELETE` sets `deleted_at`; normal reads filter it out;
  `?includeDeleted=true` includes it; `POST /:entity/:id/restore` clears it.
- **Backups**: every write (Excel row data *or* an image file) copies whatever was previously at
  that path first — data to `<DATA_DIR>/_backups/<entity>/<filename>.<ISO-timestamp>.xlsx`,
  images to `<DATA_DIR>/_backups/images/<filename>.<ISO-timestamp>`. Restore a specific data
  backup: `npm run restore -- <entity> <backup-filename>` (run with no filename to list what's
  available). Restoring itself takes a fresh backup of whatever was live immediately before, so a
  restore is itself reversible.
- **Change log**: every create/update/delete/restore appends one line to
  `<DATA_DIR>/_audit/audit-log.jsonl` (`{timestamp, entity, record_id, action, changed_fields,
  source, source_detail, actor}`). `source` is `excel-import`, `dashboard-edit`, `api`, or
  `admin-upload` (the `/admin` pipeline).
- **File-open detection**: if a workbook is open in Excel (its `~$<name>` lock file exists) or
  the atomic rename fails with `EPERM`/`EBUSY`, the write returns `423` immediately and is
  queued in memory — a background sweeper retries every 5s until the file is closed, so a
  dashboard-edit change is never silently dropped. (An `/admin` apply call does *not* auto-retry
  — it reports `423` and the staging session stays put for the user to retry manually.)
- **Concurrency**: all reads and writes to the same workbook are serialized through a per-file
  queue — never concurrent.
- **Staging cleanup**: `_staging/<id>.json` files are deleted on discard or once every batch in
  the session has applied successfully. A session left both un-applied and un-discarded (e.g. the
  browser tab was closed) simply sits there — safe to delete manually at any time, since nothing
  reads it except by its own id.

## Known field defaults (no direct Excel source)

`level` defaults to `'متوسط'` (required 3-value union, no empty option in the frontend
contract); `capacity` defaults to `0`; `description`/`objectives`/`trainer_notes`/
`general_notes`/`recommendations` default to empty; `created_at`/`updated_at` reuse the
workshop's own `start_date`/`end_date` (no such columns exist in the source); `Trainer.email`
has no source column and defaults to `''`; `Trainer.experienceYears` is parsed from the leading
number in the prose `years_experience` column (e.g. `"أكثر من 25 عامًا"` → `25`).
