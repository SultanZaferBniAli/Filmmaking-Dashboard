// Low-level XML string surgery applied to the raw slide/chart XML of
// templates/workshop-report-template.pptx, BEFORE docxtemplater ever sees it. Every replacement
// pair here was verified against the real extracted template text (and, for ambiguous repeated
// "#" placeholders, against each shape's actual <a:off x/y> slide coordinates — see the
// conversation history / commit notes for the coordinate math) rather than guessed from document
// order, which does NOT reliably match visual layout order in this file.
//
// Known, deliberately out-of-scope gaps in this first version (left as template defaults rather
// than risk a wrong-number bug):
//  - The duplicated "تفاصيل الورشة" / "تفاصيل الجهة التدريبية" example card on slides 4 & 6: only
//    its title, course type, date, and city are filled in (resolved by <a:off> proximity to their
//    labels — see TYPE_DATE_CITY_CARD below). Its remaining fields (track/field/target
//    attendance/training entity) are already covered by the unambiguous معلومات الورشة التدريبية
//    table (slide 6) and are left as template example text on this specific card.
//  - detailed_report.target_audience_traits has no per-item box on slide 6 to fill (only a
//    section title exists), so it's left off the slide (still present in the generated JSON).

export type SimpleReplacement = { find: string; replaceWith: string };

// Applied as a plain global string replace across every slide XML file — safe because each
// `find` string is verified unique-in-context (either genuinely unique text, or the only "#" in
// its shape/run).
export const GLOBAL_TEXT_REPLACEMENTS: SimpleReplacement[] = [
  { find: '(اسم الورشة)', replaceWith: '{cover.workshop_name}' },
  { find: 'تاريخ الورشة', replaceWith: '{cover.workshop_date}' },

  // slide6 "معلومات الورشة التدريبية" table (clean bracket placeholders, unambiguous)
  { find: '(مسار)', replaceWith: '{detailed_report.workshop_info.track}' },
  { find: '(المدينة / حي)', replaceWith: '{detailed_report.workshop_info.city_district}' },
  { find: '(العربية)', replaceWith: '{detailed_report.workshop_info.language}' },
  { find: '(المجال)', replaceWith: '{detailed_report.workshop_info.field}' },
  { find: '(جهة لتدريبية)', replaceWith: '{detailed_report.workshop_info.training_entity}' },
  { find: '(التاريخ)', replaceWith: '{detailed_report.workshop_info.date}' },

  // slide4 trainer card
  { find: '(اسم المدرب)', replaceWith: '{executive_summary.trainer.name}' },
  { find: 'الجنسية', replaceWith: 'الجنسية: {executive_summary.trainer.nationality}' },
  { find: 'التخصص', replaceWith: 'التخصص: {executive_summary.trainer.specialty}' },

  // slide4 quotes (3, clean bracket placeholders)
  { find: '(الرأي الأول)', replaceWith: '{executive_summary.participant_quotes.0}' },
  { find: '(الرأي الثاني)', replaceWith: '{executive_summary.participant_quotes.1}' },
  { find: '(الرأي الثالث)', replaceWith: '{executive_summary.participant_quotes.2}' },

  { find: 'تم استلام إجمالي # من مسجلين', replaceWith: 'تم استلام إجمالي {executive_summary.overview.registered} من مسجلين' },

  { find: '   	', replaceWith: '' }, // trailing tab in the (المدينة) box, tidy only
];

// Replaces exactly one run's text within a named shape, leaving sibling runs (e.g. a same-shape
// "اناث"/"ذكور" label) untouched — needed wherever a "#" count shares its shape with a label,
// unlike the fully-isolated "#" shapes handled via SHAPE_TEXT_REPLACEMENTS below.
export type RunReplacement = { slide: number; shapeName: string; oldRunText: string; newRunText: string };

export const RUN_TEXT_REPLACEMENTS: RunReplacement[] = [
  // slide4 gender counts (# shares a shape with its اناث/ذكور label)
  { slide: 4, shapeName: 'Rectangle 100', oldRunText: '# ', newRunText: '{executive_summary.overview.gender.female} ' },
  { slide: 4, shapeName: 'Rectangle 101', oldRunText: '#', newRunText: '{executive_summary.overview.gender.male}' },

  // slide4 headline ("Title 1"): the template's own Arabic carrier sentence stays exactly as
  // written — only the two quoted blanks ("(اسم الورشة)" and "مدرب/ة") and the "#" attendee count
  // are filled in. "مدرب/ة" spans 3 runs (a bare "/" sits in its own run), so all three are
  // edited together: run3's tail drops "مدرب" for the trainer-name tag, run4 (just "/") is
  // blanked, and run5 drops its leading "ة" before continuing the sentence.
  {
    // NOTE: the quote right after "(اسم الورشة)" in the real template is a curly U+201C ("“"),
    // not a straight quote — verified against the raw XML codepoints; a straight-quote version of
    // this string silently fails to match and falls through to the workshop_name-only global
    // replacement, leaving "مدرب" un-replaced.
    slide: 4,
    shapeName: 'Title 1',
    oldRunText: 'الجهة التدريبية  "(اسم الورشة)“، بتقديم "مدرب',
    newRunText: 'الجهة التدريبية  "{cover.workshop_name}"، بتقديم "{executive_summary.trainer.name}',
  },
  { slide: 4, shapeName: 'Title 1', oldRunText: '/', newRunText: '' },
  {
    slide: 4,
    shapeName: 'Title 1',
    oldRunText: 'ة"،  تفاعل واضح من الحضور والذي بلغ عددهم # مشاركين ',
    newRunText: '"،  تفاعل واضح من الحضور والذي بلغ عددهم {executive_summary.overview.registered} مشاركين ',
  },
];

// The "تفاصيل الورشة" / "تفاصيل الجهة التدريبية" example card (slides 4 & 6): course type, date,
// and city are the 3 fields resolved with confidence (each value shape sits close in <a:off> Y to
// its label, and the pairing is independently confirmed by matching the template's own example
// content — e.g. "حضورية" is a real location_type value, "08 - 04 فبراير 2024" is a real date).
// Uses detailed_report.workshop_info.city_district (bare city name) rather than
// executive_summary.details.city_location (city + venue) — the user asked for just the city name
// in this card.
export const TYPE_DATE_CITY_CARD: ShapeReplacement[] = [
  { slide: 4, shapeName: 'Rectangle 21', replaceWith: '{executive_summary.details.course_type}' },
  { slide: 4, shapeName: 'Google Shape;528;p4', replaceWith: '{executive_summary.details.date}' },
  { slide: 4, shapeName: 'Rectangle 45', replaceWith: '{detailed_report.workshop_info.city_district}' },
  { slide: 6, shapeName: 'Rectangle 21', replaceWith: '{detailed_report.workshop_info.course_type}' },
  { slide: 6, shapeName: 'Google Shape;528;p4', replaceWith: '{detailed_report.workshop_info.date}' },
  { slide: 6, shapeName: 'Rectangle 45', replaceWith: '{detailed_report.workshop_info.city_district}' },

  // slide4's SECOND, separate "تفاصيل الورشة" card (a compact icon+value strip, distinct from the
  // "دورة تدريبية" card above — its background is "Rectangle: Rounded Corners 19", title group is
  // "Group 1052") — TextBox 104/1044/1045 ship with the field NAME itself as placeholder text
  // (المدينة/التاريخ/الموقع) rather than a bracket placeholder, so they read as static labels at a
  // glance, but they're meant to be overwritten with the value exactly like Rectangle 21/45 above.
  { slide: 4, shapeName: 'TextBox 104', replaceWith: '{detailed_report.workshop_info.city_district}' },
  { slide: 4, shapeName: 'TextBox 1044', replaceWith: '{executive_summary.details.date}' },
  { slide: 4, shapeName: 'TextBox 1045', replaceWith: '{executive_summary.details.course_type}' },
];

// Position/shape-name-targeted replacements for placeholders whose literal text repeats
// elsewhere on the same slide (bare "#" symbols with no distinguishing label in the same run) —
// resolved by matching each shape's real <a:off> coordinates against its nearest label, not by
// document order (which does not track layout order in this file). See buildReportPptx.ts.
export type ShapeReplacement = { slide: number; shapeName: string; replaceWith: string };

export const SHAPE_TEXT_REPLACEMENTS: ShapeReplacement[] = [
  // slide4 funnel chevrons — verified by nearest-Y match to their (differently-ordered) labels
  // AND cross-checked against the RTL funnel's right-to-left narrowing (registered > accepted > attended).
  { slide: 4, shapeName: 'Arrow: Chevron 140', replaceWith: '{executive_summary.overview.registered}' },
  { slide: 4, shapeName: 'Arrow: Chevron 141', replaceWith: '{executive_summary.overview.accepted}' },
  { slide: 4, shapeName: 'Arrow: Chevron 142', replaceWith: '{executive_summary.overview.attended}' },

  // slide6 target attendance (single unambiguous "#")
  { slide: 6, shapeName: 'Text 62', replaceWith: '{detailed_report.workshop_info.target_attendance}' },

  // slide7 by_region box: the ONE "(المدينة)" + "#" pair (single-region template slot — see
  // buildReportPptx.ts for the "multiple regions" fallback behavior)
  { slide: 7, shapeName: 'TextBox 614', replaceWith: '{__by_region_label} {__by_region_count}' },

  // slide7 gender counts — verified by nearest-Y match to their (separate-shape) أنثى/ذكور labels
  { slide: 7, shapeName: 'Rectangle 626', replaceWith: '{statistics.gender.female}' },
  { slide: 7, shapeName: 'Rectangle 627', replaceWith: '{statistics.gender.male}' },

  // slide7 funnel numbers — verified by nearest-X match to their labels
  { slide: 7, shapeName: 'TextBox 93', replaceWith: '{statistics.funnel.accepted}' },
  { slide: 7, shapeName: 'TextBox 94', replaceWith: '{statistics.funnel.attended}' },
  { slide: 7, shapeName: 'TextBox 92', replaceWith: '{statistics.funnel.received}' },

  // slide8 top-level (non-grouped) satisfaction numbers
  { slide: 8, shapeName: 'Text 91', replaceWith: '{satisfaction.responses_received}' },
  { slide: 8, shapeName: 'Text 86', replaceWith: '{satisfaction.total_attendance}' },
  { slide: 8, shapeName: 'Text 97', replaceWith: '{satisfaction.response_rate}' },
  { slide: 8, shapeName: 'Text 79', replaceWith: '{satisfaction.overall_rating}' },
  { slide: 8, shapeName: 'Text 151', replaceWith: '{satisfaction.percentage}' },

  // slide4's own copy of the "إجمالي التقييم العام" star-rating widget (added alongside chart7 in
  // buildReportPptx.ts — see its docblock for why this is a distinct chart part from slide8's).
  { slide: 4, shapeName: 'Text 79', replaceWith: '{satisfaction.overall_rating}' },
];

// slide8 "هل تنوي تطبيق..." / "هل اكتسبت معرفة..." yes/no/partial breakdown — 3 fixed option slots
// per question (matching backend/src/entities/feedback.ts's YES_NO_MAYBE / YES_NO_PARTIAL enums),
// each pairing a static option-label shape with the percentage shape directly below it. Filled in
// code (not via SHAPE_TEXT_REPLACEMENTS/docxtemplater) because the percent has to be looked up by
// matching option label against satisfaction.yes_no_breakdown, not read off a fixed dot-path.
export const YES_NO_PERCENT_SLOTS: { field: 'gained_knowledge' | 'intends_to_apply'; option: string; shapeName: string }[] = [
  { field: 'gained_knowledge', option: 'لا', shapeName: 'TextBox 2332' },
  { field: 'gained_knowledge', option: 'نعم جزئياً', shapeName: 'TextBox 2331' },
  { field: 'gained_knowledge', option: 'نعم', shapeName: 'TextBox 2330' },
  { field: 'intends_to_apply', option: 'لا', shapeName: 'TextBox 2329' },
  { field: 'intends_to_apply', option: 'ربما', shapeName: 'TextBox 2328' },
  { field: 'intends_to_apply', option: 'نعم', shapeName: 'TextBox 2327' },
];

// slide8 "التقييم حسب المحاور الرئيسية" row score labels ("X/5") — five static text shapes the
// template ships with a literal "5/5" in every row, entirely unwired to the star-rating chart
// next to them (chart4 in buildReportPptx.ts). Listed top-to-bottom in the same order as the row
// question text (and as NUMERIC_QUESTIONS/numeric_ratings in reportContent.ts) — unlike chart4's
// own values, these do NOT need reversing, since they're plain top-to-bottom shapes, not a
// bottom-up chart category axis. Filled in code (not via SHAPE_TEXT_REPLACEMENTS' generic
// docxtemplater tag) because a null average needs its own short label — "N/A/5" overflows the
// shape's fixed-width box and wraps onto two lines.
export const SLIDE8_RATING_SCORE_LABELS = ['TextBox 106', 'TextBox 107', 'TextBox 109', 'TextBox 110', 'TextBox 111'];

// Fixed-count "numbered box" groups: each slot is (title shape name, badge shape name | null).
// At render time, slots beyond the real data length have BOTH shapes deleted outright (not just
// left blank) — matching the "Stage-2 code deletes unused boxes" requirement.
export type NumberedBoxSlot = { titleShape: string; badgeShape: string | null };

export const AXES_SLIDE4: NumberedBoxSlot[] = [
  { titleShape: 'Rectangle 1108', badgeShape: 'Rectangle 1085' },
  { titleShape: 'Rectangle 1111', badgeShape: 'Rectangle 1086' },
  { titleShape: 'Rectangle 1112', badgeShape: 'Rectangle 1087' },
  { titleShape: 'Rectangle 1113', badgeShape: 'Rectangle 1089' },
  { titleShape: 'Rectangle 1114', badgeShape: 'Rectangle 1090' },
  { titleShape: 'Rectangle 149', badgeShape: 'Rectangle 150' },
];

export const AXES_SLIDE6: NumberedBoxSlot[] = [
  { titleShape: 'Rectangle 14', badgeShape: 'Rectangle 15' },
  { titleShape: 'Rectangle 19', badgeShape: 'Rectangle 24' },
  { titleShape: 'Rectangle 20', badgeShape: 'Rectangle 26' },
  { titleShape: 'Rectangle 22', badgeShape: 'Rectangle 27' },
  { titleShape: 'Rectangle 33', badgeShape: 'Rectangle 35' },
];

// "أهم الملاحظات"/"أهم المقترحات" boxes, matched by their own literal placeholder text (unique
// per slot) rather than shape name, since PowerPoint allows (and this file has) duplicate shape
// names across slots 3/4/5. Filled with real respondent comments/suggestions
// (content.satisfaction.key_feedback / .suggestions) up to 5 each; slots beyond the real count are
// deleted outright rather than left showing stale template text (see buildReportPptx.ts).
export const KEY_FEEDBACK_ANCHORS = ['ملاحظة 1', 'ملاحظة 2 ', 'ملاحظة 3 ', 'ملاحظة 4', 'ملاحظة 5 '];
export const SUGGESTIONS_ANCHORS = ['مقترح 1', 'مقترح 2', 'مقترح 3', 'مقترح 4', 'مقترح 5'];
