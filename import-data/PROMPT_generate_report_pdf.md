# Prompt — "إنشاء التقرير" button: analyze the workshop & preview a filled A4 report PDF

Paste everything below into Claude Code. (This supersedes the visual/slide approach in `PROMPT_report_tab.md` for the report output — the target is now the A4 document below.)

---

## Goal
In the existing **React 19 + TypeScript + Vite** dashboard (RTL Arabic), make the **"إنشاء التقرير"** button on the workshop detail page do one thing: **analyze the entire selected workshop and open a preview of a filled A4 PDF report** that reproduces the structure of the reference document `تقرير_الورشة_التدريبية_ن4_نسخة_نصية_A4.pdf`, populated with that workshop's real data. From the preview the user can download the PDF. Extend the existing `src/components/workshop-detail/ReportTab.tsx` and `src/utils/exportReportPdf.ts`.

## Reference & what "remove the options" means
- The reference PDF is the **official post-workshop report, v4 (ن4)**, in **A4 portrait, RTL, Film Commission / صناع الأفلام branding**, three sections. Place a copy at `docs/report-template-A4.pdf` and build to match its layout and content.
- The reference is a blank **template**: it contains placeholder tokens `(اسم الورشة)`, `(المحور 1)`, `#`, sample/example values (`جدة / استوديو مليمتر`, `Creative Media Skills – UK`, `18 / 24 / 75%`, `16 / 6 / 1`), and — in the text version — descriptive annotation boxes (`الغرض`, `العناصر البصرية (وصف مكتوب)`). **Remove ALL of this scaffolding.** The generated report must show only the real filled report: no bracketed placeholders, no `#`, no example values, no design-description boxes. Any field with no data shows `لا يوجد` (or hides), never the placeholder or `undefined`/`NaN`.
- **No configuration UI / options** on the button. Clicking `إنشاء التقرير` immediately analyzes the workshop and shows the filled preview — no dialogs, format pickers, or template choices.

## The report structure to generate (fill every field from data)

**Cover** — title `تقرير {workshop_name}` + `تاريخ الورشة: {start_date} – {end_date}`; Film Commission + صناع الأفلام identity.

**Contents** — `01 الملخص التنفيذي` · `02 التقرير التفصيلي` · `03 مكتبة الصور`.

### 01 — الملخص التنفيذي (one page)
- **Intro line:** `شهدت الورشة التدريبية «{workshop_name}»، بتقديم {trainer_name}، تفاعلاً واضحاً من الحضور والذي بلغ عددهم {attended_count} مشاركاً من المهتمين في المجال.`
- **تفاصيل الورشة** (7 fields): المسار, نوع الدورة التدريبية (حضوري/عن بُعد), المجال الذي تغطيه, المدينة/الموقع, التاريخ, الجهة التدريبية, عدد الحضور المستهدف.
- **محاور الورشة التدريبية:** the workshop's axes (up to 6).
- **بطاقة المدرب:** صورة المدرب, اسم المدرب, الجنسية, التخصص, المدينة, التاريخ, الموقع (حضوري/عن بُعد).
- **آراء المشاركين:** up to 3 testimonials.
- **نظرة عامة على المشاركين:** `تم استلام إجمالي {registered} من مسجلين`; three figures المسجلين / المقبولين / الحضور; gender إناث / ذكور; and an **age chart** (18–24 / 25–30 / 30+).

### 02 — التقرير التفصيلي (three pages)
**تفاصيل الجهة التدريبية: {workshop_name}**
- **معلومات الورشة** (8 fields): المدينة/الحي, لغة الورشة, المسار, المجال الذي تغطيه, الجهة التدريبية, التاريخ, اسم المدرب/ة, عدد الحضور المستهدف.
- **محاور الورشة** (list) and **سمات الحضور المستهدف** (up to 4 traits).

**إحصائيات التسجيل والحضور في الجهة التدريبية: {workshop_name}**
- **Funnel** `عدد المشاركات المستلمة وفلترتها والقائمة المقبولين`: إجمالي المشاركات المستلمة → القائمة المقبولين → الحضور.
- **عدد الحضور بحسب الجنس:** أنثى / ذكور.
- **عدد الحضور بحسب المنطقة:** one `{city} — {count}` row per region.
- **عدد الحضور بحسب العمر** (chart 18–24 / 25–30 / 30+).
- **عدد الحضور بحسب الخبرة في المجال** (chart by specialization/experience — one bar per field, e.g. كتابة السيناريو, الإخراج, التصوير, المونتاج, الإنتاج…).

**نتائج استبيان رضا المتدربين**
- Intro: `وحرصاً على تطوير الورش القادمة، تم مشاركة استبيان رضا المتدربين بنهاية الورشة`.
- **المشاركات المستلمة مقارنة بعدد الحضور:** إجمالي المشاركات المستلمة (survey responses), إجمالي الحضور, نسبة المشاركات من إجمالي الحضور (%).
- **التقييم حسب المحاور الرئيسية:** three groups — `تقييم مقدم الورشة`, `تقييم محتوى الورشة`, `تقييم تنظيم الورشة` — each with its questions, each question shown as a distribution over `ممتاز / محايد / ضعيف`.
- **إجمالي التقييم العام:** `{avg} من 5` + label (ممتاز/جيد/…).
- **إجمالي التقييم بناءً على الأسئلة المطروحة:** `{percent}%`.
- **أهم الملاحظات التي تم ذكرها من المتدربين** (up to 5) and **أهم المقترحات** (up to 5).

### 03 — مكتبة الصور
- `مقتطفات من تفاعل المتدربين`, photo grid: صورة رئيسية/جماعية, صورة المدرب, صورة التكريم, plus gallery images; a `عرض جميع الصور` link. Close with a `شكراً` page.

## Real-data mapping (compute, never hardcode)
Analyze the selected `Workshop` + its `Trainer`, `Participant[]`, and feedback:
- names/dates/city/type/language/field/track/location/target = capacity → `Workshop` + trainer fields; axes → `workshop.objectives`.
- registered/accepted/attended → workshop aggregates or derived from participants (`status` counts, attendance).
- gender, region, age (from `date_of_birth`), experience/specialization breakdowns → from `participants`.
- funnel + `%` (surveys÷attendance, accepted÷applications) → computed ratios.
- ratings: map the workshop's survey questions (`q1..q8`, values ممتاز/محايد/ضعيف) into the three groups (trainer / content / organization) — define the grouping in one clearly-commented config so it can be adjusted; overall `/5` = average of `overall_rating`; overall `%` = share rated ممتاز.
- notes & suggestions → the substantive non-empty `reason` / `suggestions` from feedback.
- photos → the workshop's photos.
- Fields with no source (testimonials, target-audience traits, honor photo) → optional `Workshop` fields, derive from feedback where sensible, else `لا يوجد`/hide.

## Requirements
- A4 portrait, RTL Arabic, matching the reference's branding, fonts, and section order; small bar/donut charts consistent with the dashboard.
- Build the report as a print-accurate HTML/CSS layout bound to data, so the on-screen preview and the exported PDF are identical.
- Empty/partial data safe: guard zero-division; hide empty blocks; no placeholder text ever leaks through.
- `npm run build` and lint pass; no console errors.

## Acceptance criteria (verify with WS-003)
- Clicking `إنشاء التقرير` (no dialog) opens a preview that looks like the reference A4 report, filled with WS-003's real values: 99 registered, real accepted/attended, gender/age/region/experience breakdowns, real survey rating out of 5 and %, real notes/suggestions, trainer card, and photos.
- No placeholder tokens (`(اسم الورشة)`, `#`, `المحور 1`, `الرأي الأول`, sample values, `الغرض`/`العناصر البصرية` boxes) appear anywhere.
- Downloading produces a PDF identical to the preview.
- Selecting a different workshop regenerates the whole report from that workshop's data.
