# Prompt — Wire the real WS-003 Excel data into the Film Workshops Dashboard

Paste everything below into your coding agent.

---

## Role & goal
You are working in an existing **React 19 + TypeScript + Vite** dashboard (RTL Arabic UI, Tailwind v4) for a film-training program. Today all data is **synthetically generated** in `src/data/`. Replace it with **real data** from four linked Excel files so the real workshop, its trainer, its participants, and its feedback render on screen. Do **not** redesign the UI or change the TypeScript interfaces — they are the contract; only swap the data source behind them.

## Where the real data lives
Four Excel files under `./import-data/`, each in its own entity folder alongside a `README.txt` and an attachments subfolder. Each workbook has a data sheet named `البيانات` (plus an Arabic `دليل الأعمدة` guide tab you can ignore):

- `import-data/workshops/workshops.xlsx` — 1 row, the workshop. Key: `workshop_id = WS-003`, `trainer_id = TR-001`. Photos in `workshops/photos/`.
- `import-data/trainers/trainers.xlsx` — 1 row, the trainer. Key: `trainer_id = TR-001`. Docs/photo in `trainers/documents/`.
- `import-data/participants/participants.xlsx` — 99 rows, each carries `workshop_id = WS-003` and a unique `participant_id`. Includes empty attendance columns (`day_1`..`day_5`, `sessions_attended`, `total_sessions`, `attendance_percentage`, `attendance_status`) to be filled after the workshop runs. CVs/portfolios/certificates in `participants/attachments/`, named by `participant_id`.
- `import-data/feedback/feedback.xlsx` — 10 rows, each carries `workshop_id = WS-003`. Anonymous, so `participant_id` is blank.

They relate by shared IDs: Workshops.`trainer_id` → Trainers; Participants.`workshop_id` and Feedback.`workshop_id` → Workshops.

## The existing contract (do not change)
Read these first and keep their exported types identical:
- `src/data/workshops.ts` → `Workshop` interface and `export const workshops: Workshop[]`
- `src/data/trainers.ts` → trainer type and export
- `src/data/participants.ts` → `Participant` interface and `export const participants: Participant[]`
- `src/state/useDashboardData.ts`, `src/state/selectors.ts`, `src/state/participantSelectors.ts`, `src/state/trainerSelectors.ts` — consumers. Everything renders through these.

## Approach: build-time import (no backend)
1. Add a dev dependency `xlsx` (SheetJS) and a script `scripts/import-data.ts` run via a new npm script `"import-data"`.
2. The script reads the `البيانات` sheet of each of the four files, maps rows to the existing interfaces (mapping below), and writes typed JSON into `src/data/generated/` (`workshops.json`, `trainers.json`, `participants.json`, `feedback.json`).
3. Change `src/data/workshops.ts`, `trainers.ts`, `participants.ts` to **import that JSON** and export it as the typed arrays, instead of running the generators. Keep the generators in the file but unused (or behind a flag) so nothing else breaks.
4. Re-run `import-data` regenerates the JSON whenever the Excel files change.

## Column mapping (Excel → interface)

**Workshops.xlsx → `Workshop`**
`workshop_id`→`workshop_id`, `workshop_name`→`workshop_name`, `workshop_type`→`workshop_type`, `field`→`field`, `description`→`description`, `themes`→`objectives` (split the string on `؛`/`;` into the array), `region_code`→`region`, `city`→`city`, `start_date`→`start_date`, `end_date`→`end_date`, `location_type`→`location_type`, `location_name`→`location_name`, `location_link`→`location_link`, `language`→`language`, `status`→`status` (`upcoming`). `trainer_name` comes from the Trainers file via `trainer_id`; `trainer_nationality` = `EG`. Fields the Excel doesn't have (`capacity`, `level`, `objectives`, application/attendance/rating aggregate numbers) → default to sensible empties (`0`, `''`, `[]`) — **do not fabricate values**. Derive the aggregate counts (`total_applications`, `total_accepted`, `total_attendance`, rating_*_count) from the Participants and Feedback data where possible (see below).

**Trainers.xlsx → trainer type**
`trainer_id`, `name_ar`→name, `nationality`/`nationality_code`, `field`, `years_experience`, `professional_membership`, `bio`, `notable_works`, `award`. Map to whatever the existing trainer interface expects; leave unmapped optional fields empty.

**Participants.xlsx → `Participant`**
`participant_id`→`id`, `full_name_arabic`→`fullName`, `full_name_en`→(optional), `gender`→`gender`, `nationality`→`nationality`, `phone`→`phone`, `email`→`email`, `city`→`city`, `region_code`→`region`, `date_of_birth`→`dateOfBirth`, `education_level`→`education`, `experience_level`→`experienceLevel` (map Arabic label to enum: بدون خبرة→`none`, سنتين وأقل→`1_to_2`, 3 سنوات فأكثر→`3_to_5`), `track`→`specialization`, `current_role`→`jobTitle`, `how_heard`→`application.source`, `application_date`→`application.applicationDate`, `evaluation_score`→`application.evaluationScore`, `portfolio_url`→`portfolioUrl`.
Map `status` → `application.status`: `accepted`→`accepted`, `waitlist`→`applicant`, `applicant`→`applicant`.
Build the participant's `workshops[]` entry from `workshop_id` + the attendance columns: if attendance is empty (pre-event), set attendance to 0/`registered`; once filled, `attendance_percentage`→`attendancePercentage`, `attendance_status`→`attendanceStatus`, `sessions_attended`/`total_sessions` accordingly.

**Feedback.xlsx → ratings**
Each row: `q1..q8` are ممتاز/محايد/ضعيف dimensions, `overall_rating` (1–5), `recommend_nps` (0–10), `reason`, `suggestions`. Aggregate into the workshop's rating fields: convert the 10 `overall_rating` values into `rating_1_count..rating_5_count` for WS-003, and expose average = 4.4. Keep raw feedback rows available for a feedback/report view if one exists.

## Requirements
- Type-safe: `npm run build` (tsc + vite) passes; `npm run lint` (oxlint) passes; no runtime console errors.
- Preserve RTL/Arabic rendering and ISO date handling.
- Gracefully handle empty/optional fields (blank attendance, missing capacity) — no crashes, no `NaN` in KPIs; guard divisions by zero.
- Phone values beginning with `~` are known-unreliable imports — keep as-is, do not attempt to "fix".

## Acceptance criteria (verify before finishing)
- Dashboard overview shows **1 workshop** (WS-003, "تقنيات مونتاج الأفلام", Al-Khobar, in-person, Aug 18–22 2024) with trainer **أحمد حافظ**.
- Participants page shows **99 participants** with status counts **34 accepted / 6 waitlist(shown as applicant) / 59 applicant** and correct filters.
- Feedback/ratings reflect **10 responses, average 4.4/5**.
- Re-running `npm run import-data` after editing an Excel file updates the dashboard.
- Report which interface fields had no Excel source and how each was defaulted or derived.
