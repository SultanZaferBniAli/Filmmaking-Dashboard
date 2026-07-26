# Prompt — Admin page: upload 4 Excel sheets + images → review → Apply (Excel is the database)

Paste everything below into Claude Code.

---

## Goal
Add an **`/admin` page** to the existing **React 19 + TypeScript + Vite** dashboard (RTL Arabic). It lets a user **upload the workshop's Excel data, see the full parsed content, review and fix its quality, and — only when they click "تطبيق / Apply" — commit it so it reflects on the dashboard.** It also lets the user **upload images for trainers and for workshops.** **Excel is the database:** the master workbooks under `import-data/<entity>/<entity>.xlsx` are the single source of truth; the backend reads them to serve the dashboard and writes to them on Apply. **No SQL database, no CMS, no folder-watching** — remove any old folder-scanning/auto-import (it crashes on locked/malformed files) and replace it with this controlled upload → review → apply pipeline.

## The data model — four Excel sheets (the four entities)
Each is one master workbook (data sheet named `البيانات`), linked by IDs:

1. **Workshop details** → `import-data/workshops/workshops.xlsx` (`workshop_id`, e.g. `WS-003`). All workshop info: name, type (حضوري/عن بُعد), field/track, region, city, location, dates & times, language, capacity/target, axes/objectives, `trainer_id`, status. A workshop references one trainer.
2. **Trainer** → `import-data/trainers/trainers.xlsx` (`trainer_id`, e.g. `TR-001`). Name, nationality, field, years of experience, professional membership, bio, notable works, **profile image path**.
3. **Participants (applied + accepted)** → `import-data/participants/participants.xlsx` (`participant_id`, carries `workshop_id`). The full applicant data from when they applied **and** their acceptance outcome: identity, contact, city/region, education, experience, track, `status` (applicant / accepted / waitlist / rejected), evaluation score, and attendance once the workshop runs.
4. **Feedback / ratings** → `import-data/feedback/feedback.xlsx` (`feedback_id`, carries `workshop_id`). Post-workshop survey used to **track ratings for every workshop and, through it, each trainer**: per-question ratings (ممتاز/محايد/ضعيف), overall rating, recommendation, notes, suggestions. The dashboard aggregates these into each workshop's rating **and** each trainer's rating across all the workshops they delivered.

Relationships: Trainer 1—* Workshop; Workshop 1—* Participant; Workshop 1—* Feedback. Adding a new workshop = new rows appended to these master files — never new per-workshop folders.

## The flow (this is the exact logic to implement)
**Step 1 — Upload & Review (reads carefully, writes NOTHING):**
1. On `/admin`, the user uploads the Excel — either the four per-entity files or a single combined workbook with the known sheets (auto-detect entity by sheet names/headers).
2. The backend parses **every row carefully**, runs full validation + cleaning (rules below), and returns a **staged preview** without touching any master file: the complete normalized content shown in full, a **diff** vs. current data (new **insert** / **update** with changed fields / identical **skip**), and a **quality report** (warnings + errors, each naming row + field + reason).
3. The staged result is held server-side under a `stagingId` (temp file in `import-data/_staging/`) until applied or discarded.

**Step 2 — Review, fix, then Apply:**
4. The admin UI shows the full parsed content in editable tables so the user can **inspect and correct** flagged cells inline before committing (fixes update the staged data, re-validated live).
5. When satisfied, the user clicks **تطبيق (Apply)**. Apply upserts the staged rows into the correct master workbook — insert new, update only changed cells, skip identical — keyed on the entity ID (`workshop_id`/`trainer_id`/`participant_id`; for participants fall back to `national_id` then `email` within the same `workshop_id`). It makes a timestamped backup first, writes atomically (temp + rename), and appends each change to `import-data/_audit/audit-log.jsonl` with `source=admin-upload`.
6. A **تجاهل (Discard)** button drops the staging entry and changes nothing.
7. After Apply, the data reflects on the dashboard with no rebuild and no folder changes.

## Images for trainers and workshops (new)
The admin page also manages pictures:
- **Trainer photo:** upload one profile image per trainer (by `trainer_id`) → stored at `import-data/trainers/photos/<trainer_id>.<ext>`; the path is saved to the trainer's `profile_image` field; it shows on the trainer card/profile and in the report's trainer card.
- **Workshop photos:** upload a cover image plus a gallery for a workshop (by `workshop_id`) → stored at `import-data/workshops/photos/<workshop_id>_<n>.<ext>`; paths saved to the workshop record; they show on the workshop detail Photos tab and the report's photo-library section.
- Uploading validates file **type** (jpg/png/webp) and **size** (reject > ~10 MB), shows a thumbnail preview, and lets the user remove/replace. Saving an image writes the file, updates the record via the same atomic-write + audit-log path, and reflects on the dashboard.

## Admin page UI
- RTL. A section per action: **Upload data** (dropzone → review panel), and **Manage images** (pick a trainer or workshop, drop images, see thumbnails).
- Review panel: summary counts (`# new`, `# updated`, `# unchanged`, `# warnings`, `# errors`), detected entity label, a **full editable table** of parsed rows with changed/flagged cells highlighted, and a **quality list** of warnings/errors.
- Actions: **تطبيق (Apply)** — enabled only when there are no blocking errors — and **تجاهل (Discard)**.
- If a master workbook is open/locked in Excel, Apply returns `423` and the UI says "close the file in Excel and retry" — it never corrupts the file or crashes.

## Validation & cleaning (reuse the established rules)
Check quality before anything is stored:
- Trim/whitespace-collapse; strip `_x000D_`, stray `\r\n`; empty → blank. Preserve Arabic (UTF-8).
- IDs & phones stored as **text** (keep leading zeros). Phone → `+966XXXXXXXXX`; a number with ≥4 trailing zeros = corrupted → keep, mark `phone_verified=false`, warn.
- `date_of_birth`: Excel serials → ISO; implausible ages → blank + warning.
- `city → region_code` via mapping; unmappable (multi-city, outside KSA) → keep raw city, blank region, warn.
- gender ذكر/انثى→male/female; nationality سعودي/ابن مواطنة→SA, غير سعودي→non-SA; experience & status Arabic labels → dashboard enums.
- Enforce in code against current sheet contents: unique IDs; unique `email`/`national_id` per workshop (**duplicate → error**); participant/feedback `workshop_id` must reference an existing workshop; workshop `trainer_id` must reference an existing trainer (**missing reference → error**).
- Separate **warnings** (Apply still allowed — unverified phone, unmapped city) from **errors** (block Apply for that row — duplicate, missing required field, bad reference).

## Robustness (replace the crashing behavior)
- Delete all filesystem folder-watching/auto-import; ingestion happens **only** via upload.
- A malformed/locked/wrong-format upload returns a clear `422`/`423` and **never crashes the server or dashboard** (wrap parsing in try/catch).
- Apply is transactional per file: fatal error → original untouched; recoverable per-row issues → warnings, good rows still commit.
- Idempotent: uploading + applying the same unchanged file → 0 inserts / 0 updates.
- Every write (data or image) makes a backup under `import-data/_backups/` first and logs to the audit file; provide a restore script.

## Dashboard reflection
- The dashboard reads all four entities and images from the API (which reads the master workbooks + photo folders). After Apply, the new/updated data and images are live — the dashboard refetches on navigation or via a cache-invalidation, no rebuild.

## Requirements
- Type-safe (Zod schemas → TS types aligned with the dashboard interfaces). `npm run build` and lint pass; no console errors.
- Minimal deps: `xlsx` (SheetJS) for read/write, `zod` for validation, `@fastify/multipart` (or equivalent) for uploads. No SQL DB/ORM/CMS.
- Document in `backend/README.md`: the upload→review→apply flow, image upload, where backups/audit log/photos live, and how to restore.

## Acceptance criteria
- On `/admin`, uploading the four sheets (or a combined workbook) shows the **full parsed content** in editable tables with correct new/updated/unchanged counts and a quality list — and **writes nothing** yet.
- Fixing a flagged cell in the review re-validates it live; **Apply** merges the rows into the correct master workbook (visible when reopened), backs up, and logs; **Discard** changes nothing.
- Re-uploading + applying the same unchanged file reports 0 new / 0 updated.
- A duplicate participant, a missing required field, or a row referencing a non-existent workshop/trainer is flagged as an **error** and blocked from Apply, with a per-row reason.
- Uploading a trainer photo and workshop photos stores them, links them to the records, and they appear on the trainer profile, the workshop Photos tab, and the report — after Apply/save, with no rebuild.
- A malformed or Excel-locked file shows a clear message and does not crash the app.
