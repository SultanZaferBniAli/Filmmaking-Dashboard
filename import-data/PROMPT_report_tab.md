# Prompt — Build the full post-workshop Report tab (workshop detail page)

Paste everything below into Claude Code.

---

## Goal
In the existing **React 19 + TypeScript + Vite** dashboard (RTL Arabic), rebuild the **Report tab** on the workshop detail page so it reproduces the organization's official **post-workshop report** ("نموذج تقرير بعد الورشة التدريبية") for the selected workshop, populated entirely from real data. The tab already exists at `src/components/workshop-detail/ReportTab.tsx` and there is an export helper at `src/utils/exportReportPdf.ts` — extend both. Match the existing design system (colors, fonts, cards, RTL) — do not restyle the app.

## Source of the layout
The report is the uploaded template PDF `نموذج تقرير بعد الورشة التدريبية- ن4 - 070726.pdf`. Place a copy in the repo (e.g. `docs/report-template.pdf`) so you can trace it exactly. It is a **designed, branded, multi-slide document** (cover + summary slide + detailed-report slide + photo-library slide). Its structure is fully specified below. It has **three sections**, shown as a table of contents (المحتوى): `01 الملخص التنفيذي` · `02 التقرير التفصيلي` · `03 مكتبة الصور`. Render them as three stacked sections (or sub-tabs) inside the Report tab, in this order.

## CRITICAL — the preview/export must BE this template, filled in
The report must not be a loose re-interpretation. When the user clicks **preview/export**, the output must **reproduce this exact template — the same branded layout, slides, colors, logos, and positions — with every placeholder replaced by the real workshop data.** Treat the template as a fixed design where you only swap the placeholder tokens for real values.

Placeholders in the template that MUST be filled from data (every one of them, on the right slide):
- Cover/summary: `(اسم الورشة)` → workshop name · `تاريخ الورشة` → date range · the `#` counts (مشاركين/مسجلين/مقبولين/حضور) · `الجنسية` · `(المحور 1..6)` → axes · `صورة المدرب` → trainer photo · `(اسم المدرب)` · `التخصص` · `الموقع/المدينة/التاريخ/حضوري أو عن بعد` · `# ذكور / # اناث` · age buckets `18-24 / 25-30 / 30+` · `(الرأي الأول/الثاني/الثالث)` → testimonials.
- Detailed slide: `لغة الورشة`, `الحي/المدينة`, `(مسار)`, `التاريخ`, `الجهة التدريبية`, `(المجال)`, `(اسم المدرب/ة)`, `عدد الحضور المستهدف #`, `سمات الحضور المستهدف • 1..4`, `(المحور 1..6)`, by-gender/region/age/experience `#`, funnel `إجمالي المشاركات المستلمة # / المقبولين # / الحضور #`, `المشاركات المستلمة مقارنة بعدد الحضور` + `%`, `ملاحظة 1..5`, `مقترح 1..5`, the three rating groups (`تقييم مقدم الورشة / محتوى الورشة / تنظيم الورشة`) with `ممتاز/محايد/ضعيف` counts, `إجمالي التقييم العام #/5`, `إجمالي التقييم بناءً على الأسئلة #%`.
- Photo-library slide: `صورة رئيسية/جماعية`, `صورة المدرب`, `صورة التكريم`, gallery images, and the "انقر هنا" link → real photo links.

Approach: rebuild the template as a print-accurate HTML/CSS layout (A4/slide pages, RTL, the template's fonts/colors/logos) whose fields are bound to data, then render it in the preview and export it to PDF so the on-screen preview and the downloaded file are identical to the template. Any placeholder with no data shows a clean empty state ("لا يوجد") — never the literal placeholder text, `undefined`, or `NaN`.

## Section 01 — الملخص التنفيذي (Executive Summary)
- **Title block:** report title = `تقرير (اسم الورشة)`, plus workshop date range.
- **Executive summary paragraph** (auto-generated sentence): "شهدت الورشة التدريبية «{workshop_name}» بتقديم {trainer_name}، تفاعلاً واضحاً من الحضور والذي بلغ عددهم {attendance_count} مشاركاً من المهتمين في المجال." Build it from data; allow an optional override field.
- **محاور الورشة التدريبية:** list of up to 6 workshop axes/topics.
- **Trainer card:** trainer photo, `اسم المدرب`, `التخصص` (specialization), `الجنسية` (nationality), and workshop details (`الموقع`/location, `المدينة`/city, `التاريخ`/date, `حضوري أو عن بعد`/type).
- **نظرة عامة على المشاركين (participants overview):** three headline numbers — `المسجلين` (registered), `المقبولين` (accepted), `الحضور` (attended); gender split `# ذكور` / `# اناث`; and **عدد الحضور بحسب العمر** grouped `18–24 / 25–30 / 30+`.
- **آراء المشاركين:** up to three participant testimonials/quotes (الرأي الأول/الثاني/الثالث).

## Section 02 — التقرير التفصيلي (Detailed Report)
- **معلومات الورشة التدريبية:** `لغة الورشة` (language), `الحي/المدينة`, `المسار`/`المجال` (track/field), `التاريخ`, `الجهة التدريبية` (training body/location_name), `اسم المدرب`, `عدد الحضور المستهدف` (target attendance = capacity), `سمات الحضور المستهدف` (target-audience traits — bulleted), and the 6 `محاور الورشة`.
- **احصائيات التسجيل والحضور (registration & attendance stats) — render as small charts/cards:**
  - `عدد الحضور بحسب الجنس` (by gender).
  - `عدد الحضور بحسب المنطقة` (by region/city).
  - **Funnel:** `إجمالي المشاركات المستلمة` (applications received) → `القائمة المقبولين` (accepted) → `الحضور` (attended).
  - `عدد الحضور بحسب العمر` (age buckets 18–24 / 25–30 / 30+).
  - `عدد الحضور بحسب الخبرة في المجال` (by experience level).
  - `المشاركات المستلمة مقارنة بعدد الحضور`: total applications vs total attendance, plus the **percentage** (e.g. "75% نسبة المشاركات من إجمالي الحضور").
- **Feedback digest (from the satisfaction survey):**
  - `أهم الملاحظات التي تم ذكرها من المتدربين` — top notes (up to 5).
  - `أهم المقترحات التي تم ذكرها من المتدربين` — top suggestions (up to 5).
  - **التقييم حسب المحاور الرئيسية:** three rating groups — `تقييم مقدم الورشة` (trainer), `تقييم محتوى الورشة` (content), `تقييم تنظيم الورشة` (organization) — each with its questions counted as `ممتاز / محايد / ضعيف`.
  - **إجمالي التقييم العام:** overall average out of 5 (e.g. `4.6 من 5`).
  - **إجمالي التقييم بناءً على الأسئلة المطروحة:** overall percentage + label (e.g. `100% ممتاز`).

## Section 03 — مكتبة الصور (Photo Library)
- Heading `مقتطفات من تفاعل المتدربين`, then a photo grid: a main/group photo (`صورة رئيسية/جماعية`), trainer photo (`صورة المدرب`), an honoring photo (`صورة التكريم`), and additional gallery images. Reuse the existing Photos tab data/component where possible.
- A "عرض جميع الصور" link/button. Close with `شكراً`.

## Data mapping (use the existing interfaces in `src/data/`)
Pull from the selected `Workshop`, its `Trainer`, its `Participant[]`, and its feedback/ratings. Compute, don't hardcode:
- workshop_name, dates, city, location_type/name, language, field/track, trainer name/photo/specialization/nationality → from `Workshop` + trainer fields.
- **Axes (محاور):** map to `workshop.objectives` (string[]).
- registered/accepted/attended → from the workshop's aggregate fields (`total_applications`, `total_accepted`, `total_attendance`/`actual_attendance`) or derive from `participants` (`status` counts, attendance fields).
- gender split → male/female counts.
- **age buckets** → compute from participants' `date_of_birth`.
- region breakdown → participants' `region`.
- experience breakdown → participants' `experienceLevel`.
- applications-vs-attendance % → totals ratio.
- **ratings by axis** → aggregate the feedback question fields (`q1..q8`, values `ممتاز/محايد/ضعيف`) grouped into trainer / content / organization; overall out of 5 → average of `overall_rating`; overall % → share of top rating.
- notes & suggestions → from feedback `reason` / `suggestions` free-text (surface the most substantive, non-empty ones).
- photos → workshop photos.

## Fields not yet in the data model
Some report items have no source field yet: `آراء المشاركين` (testimonials), `سمات الحضور المستهدف` (target-audience traits), curated notes/suggestions, and the designation of a specific `صورة التكريم`. For each: add an **optional** field to the `Workshop` interface (e.g. `testimonials?: string[]`, `targetAudienceTraits?: string[]`, `reportNotes?: string[]`, `reportSuggestions?: string[]`, `honorPhotoId?: string`), populate from feedback where a sensible derivation exists, and **degrade gracefully** (hide the block or show "لا يوجد") when empty — never crash, never show `NaN`/`undefined`.

## Requirements
- RTL Arabic throughout; reuse existing card/chart components and the app's color/font system. Small bar/donut visuals for the by-gender/region/age/experience/rating breakdowns, consistent with the rest of the dashboard.
- Empty/partial data safe: guard divisions by zero; hide sections with no data.
- **Export:** extend `src/utils/exportReportPdf.ts` so "Export/Preview report" produces a PDF that is a **pixel-faithful, filled copy of the template** (all slides), for the selected workshop — same layout the user sees in preview.
- `npm run build` and lint pass; no console errors.

## Acceptance criteria (verify with WS-003)
- The preview looks like the template PDF, filled: same slides/branding, every placeholder replaced with WS-003's real values (99 registered, accepted/attended counts, gender split, age/region/experience breakdowns, real survey rating overall /5 and %, notes & suggestions from real feedback, trainer + photos).
- No template placeholder text (`(اسم الورشة)`, `#`, `المحور 1`, `الرأي الأول` …) remains visible anywhere; empty fields show "لا يوجد", not `undefined`/`NaN`.
- Switching to another workshop repopulates every field/slide from that workshop's data.
- The exported PDF is identical to the on-screen preview.
