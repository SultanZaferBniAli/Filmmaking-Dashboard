# Prompt — Build a validated, Excel-backed backend for the Film Workshops Dashboard

Paste everything below into your coding agent.

---

## Role & goal
Add a **backend service** to an existing **React 19 + TypeScript + Vite** dashboard (RTL Arabic UI) for a film-training program. **There is no database.** The **Excel files are the source of truth and the permanent store.** The backend reads them, serves them to the dashboard through the existing TypeScript interfaces, validates every write, saves edits back into the Excel files, records every change, and keeps versioned backups — so nothing is ever lost. Keep the existing interfaces as the shared contract; do not redesign the UI.

## Entities & relationships (the data model)
Four related entities, each stored in its own workbook under `./import-data/<entity>/`, in the sheet named `البيانات`:

- **Workshop** (`workshop_id`, e.g. `WS-003`) → `import-data/workshops/workshops.xlsx` — has one trainer (`trainer_id`).
- **Trainer** (`trainer_id`, e.g. `TR-001`) → `import-data/trainers/trainers.xlsx`.
- **Participant** (`participant_id`, e.g. `P-003-011`) → `import-data/participants/participants.xlsx` — belongs to a workshop (`workshop_id`); holds application status + attendance.
- **Feedback** (`feedback_id`) → `import-data/feedback/feedback.xlsx` — belongs to a workshop (`workshop_id`); anonymous.

Relationships are by ID (application-level, since there's no DB): Trainer 1—* Workshop; Workshop 1—* Participant; Workshop 1—* Feedback. Attachments live beside each workbook (`workshops/photos/`, `trainers/documents/`, `participants/attachments/`).

## Stack (no database)
- **Runtime/API:** Node.js + **Fastify** (or Express) in TypeScript.
- **Excel read/write:** **SheetJS (`xlsx`)** — the single persistence layer. Treat each workbook's `البيانات` sheet as a table: row 1 = English headers, rows below = records.
- **Validation:** **Zod** — one schema per entity, the single source of truth. Every write goes through `schema.parse()`; reject invalid payloads with a structured 422.
- **File uploads:** `@fastify/multipart`; store files under `import-data/<entity>/<attachments>/`, save only the relative path in the sheet.
- **Config:** environment variables (`.env`); no secrets in code.
- Do **not** add Postgres, SQLite, Prisma, Supabase, or any DB/ORM. The dependency list is essentially `fastify`, `xlsx`, `zod`, `@fastify/multipart`.

## Persistence layer — Excel as the store (build this first)
Create one module (`backend/src/store.ts`) that all routes use. It must:

- **Read:** load a workbook, parse the `البيانات` sheet into typed objects. Cache in memory and invalidate on write. Never read while a write to the same file is in flight.
- **Write safely (atomic):** write to a temp file (`<file>.tmp`) then `fs.rename` over the original, so a crash never leaves a half-written workbook. Preserve the header row order, column formatting, and the second `دليل الأعمدة` guide sheet.
- **Single-writer lock:** serialize all writes per file through an async mutex/queue. Excel files cannot take concurrent writes — two requests must never write the same workbook at once.
- **File-open detection:** if the workbook is locked because someone has it open in Excel (an `~$…` lock file exists or the rename fails with a permission error), do **not** corrupt or silently drop the write — return `423 Locked` with a clear message ("close the file in Excel and retry"), and keep the pending change so it can be re-applied.
- **Versioned backups (this replaces DB durability):** before every write, copy the current workbook to `import-data/_backups/<entity>/<filename>.<ISO-timestamp>.xlsx`. Every change therefore has a restore point. Provide a `restore` script that copies a chosen backup back over the live file.
- **Soft delete:** add a `deleted_at` column to each sheet. A `DELETE` request sets `deleted_at` (and logs it); it never removes the row. Normal reads exclude soft-deleted rows; a `?includeDeleted=true` query returns them; a `restore` clears `deleted_at`.

## Validation rules (the core — enforce ALL of these)
Normalize or reject on write; return a clear error naming the field and reason; never store a bad value. Because there's no DB to enforce constraints, the backend enforces them in code against the current sheet contents.

**Workshop**
- `workshop_id`: required, pattern `^WS-\d{3,}$`, unique across the sheet.
- `workshop_type` / `location_type`: enum `in-person | virtual`.
- `region`: enum of the 13 KSA region codes (`riyadh, makkah, madinah, eastern, qassim, hail, tabuk, northern-borders, jazan, najran, bahah, jouf, asir`). Reject unknown codes.
- `start_date` ≤ `end_date`, both ISO `YYYY-MM-DD`. `start_time`/`end_time` `HH:MM`.
- `trainer_id`: required; must match an existing row in the trainers sheet.
- `status`: enum `upcoming | completed`. `capacity`: integer ≥ 0 or empty.

**Trainer**
- `trainer_id`: required, pattern `^TR-\d{3,}$`, unique.
- `nationality_code`: ISO-3166 alpha-2 (2 uppercase letters). `name_ar`: required, non-empty.

**Participant**
- `participant_id`: required, unique; `workshop_id`: required, must match an existing workshop row.
- `full_name_arabic`: required, non-empty after trimming/whitespace-collapsing.
- `email`: valid email, lowercased; unique within the same `workshop_id`.
- `national_id`: 10 digits (Saudi) — accept but **flag** if it doesn't match; always store as **text** (never a number — preserve leading zeros).
- `phone`: normalize to `+966XXXXXXXXX`. If the value arrived as a number with ≥4 trailing zeros (the corruption pattern seen in the source data), **do not treat as valid** — keep it, set `phone_verified=false`, and warn; don't pretend it's correct.
- `gender`: enum `male | female` (map ذكر→male, انثى→female).
- `nationality`: `SA` or `non-SA` (map سعودي/ابن مواطنة→SA, غير سعودي→non-SA + keep the country string).
- `city` → `region`: normalize free-text/misspelled/English city names to a region code via a mapping table; if unmappable (multi-city like "mecca+khobar", or outside KSA like الكويت), keep the raw city, leave region empty, and warn — never guess.
- `date_of_birth`: accept ISO dates; convert Excel serial numbers; reject implausible ages (<10 or >90) → empty + warning.
- `experience_level`: enum `none | less_than_1 | 1_to_2 | 3_to_5 | 6_to_10 | more_than_10` (map the Arabic labels).
- `status`: enum `applicant | accepted | waitlist | rejected`. `evaluation_score`: 0–100 or empty.
- **Attendance (empty until the workshop runs):** `day_1..day_5` yes/no/empty; `sessions_attended` 0–`total_sessions`; `attendance_percentage` computed server-side = `sessions_attended/total_sessions`; `attendance_status` derived (`لم يحضر` if 0, else `حضور جزئي` / `حضور فعلي`). Reject `sessions_attended > total_sessions`.

**Feedback**
- `feedback_id`: required, unique; `workshop_id`: must match an existing workshop row.
- `q1..q8`: enum `ممتاز | محايد | ضعيف` or empty.
- `overall_rating`: integer 1–5. `recommend_nps`: integer 0–10. `reason`/`suggestions`: free text, trimmed.
- Allow anonymous rows (`participant_id` empty) — expected.

## Edge cases to handle explicitly
- Duplicate applicant (same national_id or email within a workshop) → `409`, don't add a second row.
- Referential integrity in code: adding a participant/feedback whose `workshop_id` isn't in the workshops sheet → `400`. Deleting a workshop that still has participants → blocked (require they be moved/removed first).
- Partial data: a participant with no attendance yet, or feedback before attendance is filled, must save fine.
- Empty/whitespace-only cells treated as empty. Arabic text preserved (UTF-8, no mojibake); strip `_x000D_` and stray `\r\n`.
- Numbers-as-text and text-as-numbers coerced safely; never lose leading zeros on IDs/phones.
- Workbook locked/open in Excel → `423`, change preserved for retry (see persistence layer).

## Saving edits & re-importing sheets (must-have)
The point of this backend is that **data is saved permanently and every change is recorded.**

**Change log (append-only, replaces the DB audit table)**
- Maintain `import-data/_audit/audit-log.jsonl` (one JSON object per line — append-only, never rewritten).
- On **every** create, update, delete, and restore, append: `timestamp`, `entity`, `record_id`, `action`, `changed_fields` (JSON `{field:{before,after}}`, only fields that actually changed), `source` (`excel-import | dashboard-edit | api`), `source_detail` (e.g. imported filename), `actor` (if known).
- Expose `GET /:entity/:id/history` returning that record's timeline from the log. A single-field edit logs only that field.

**Adding / re-importing an Excel sheet = update, never overwrite or duplicate**
- `POST /import/:entity` accepts an uploaded workbook and **upserts** its rows into the live workbook, keyed on the entity ID (`workshop_id` / `trainer_id` / `participant_id`); for participants, fall back to matching `national_id` then `email` within the same `workshop_id`, so a re-export with a changed ID still matches the same person.
- Per row, decide **insert** (new), **update** (exists but fields differ — write only changed cells, log each change with `source=excel-import`), or **skip** (identical — no write, no log).
- Adding a brand-new workshop's sheets (e.g. `WS-004`) **appends** and must not touch `WS-003` rows.
- Wrap each import as an all-or-nothing operation on that file (temp-write + atomic rename): a fatal error leaves the original untouched; recoverable per-row issues become warnings and the good rows still commit.
- Return a **diff report**: `{ inserted, updated:[{id,fields:[…]}], skipped, warnings:[…], errors:[…] }` so the change is reviewable before it's trusted.
- **Idempotent:** importing the same unchanged file twice → second run reports `inserted:0, updated:0`.

**Dashboard edits save the same way**
- Edits from the UI persist via `PATCH /:entity/:id`, run the same Zod validation, write back to the workbook, and append to the change log with `source=dashboard-edit`. A successful response means it's written to the Excel file — there is no unsaved state.

## API endpoints
- CRUD per entity: `GET /:entity`, `GET /:entity/:id`, `POST`, `PATCH`, `DELETE` (soft-delete).
- `GET /workshops/:id/participants`, `GET /workshops/:id/feedback` (relational reads by `workshop_id`).
- `POST /import/:entity` — validate every row, upsert, return the diff report above.
- `POST /:entity/:id/attachments` — multipart upload; validate type/size; store under the entity's attachments folder; return the path.
- `GET /:entity/:id/history` — change timeline. `POST /:entity/:id/restore` — clear `deleted_at`.
- Consistent error shape `{ error: { code, message, fieldErrors:[{path,message}] } }`; `422` validation, `409` conflict, `423` file locked, `404/400` as appropriate.

## Requirements
- **Type-safe end to end:** Zod schemas → inferred TS types aligned with the dashboard interfaces. `npm run build` and lint pass; no runtime console errors.
- **Seed/verify script** that loads the four `import-data` workbooks and reports the counts.
- **Tests** (Vitest/Jest): unit tests for each Zod schema covering valid, invalid, boundary, corrupt-phone, unmappable-city, duplicate, and missing-reference cases; a store test proving atomic write + backup creation + soft-delete/restore; and an integration test that imports all four workbooks and asserts the counts (**1 workshop, 1 trainer, 99 participants — 34 accepted / 6 waitlist / 59 applicant, 10 feedback, average overall 4.4/5**), then re-imports the same files and asserts **0 inserted / 0 updated**.
- **Frontend wiring:** replace the synthetic exports in `src/data/*` with async fetches to the API behind the existing interfaces; add loading/error states; keep the generators as a dev fallback behind an env flag.
- Document env vars, how to run the server, how to import a sheet, and how to restore a backup, in `backend/README.md`.

## Acceptance criteria (verify before finishing)
- Server runs and serves all four entities read from the Excel files.
- A `PATCH` edit is written back into the workbook (visible when the file is reopened), creates a timestamped backup, and appends a change-log entry with the changed fields and `source`.
- Re-importing an Excel file updates changed rows, creates **zero** duplicates, returns a diff report, and a second unchanged import reports 0/0.
- `GET /:entity/:id/history` returns the edit timeline; editing one field logs only that field; a `DELETE` soft-deletes and is recoverable via `restore`.
- An invalid payload (bad region, corrupt phone, duplicate national_id, feedback for a missing workshop) returns the correct 4xx with a field-level reason and writes nothing.
- A workbook left open in Excel returns `423` on write instead of corrupting the file.
- The dashboard renders WS-003, trainer أحمد حافظ, 99 participants with correct status counts, and feedback averaging 4.4/5 — all served from the Excel-backed API.
- Report which fields had no source data and how each default/derivation was chosen.
