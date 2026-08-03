// Low-level edit maps applied to the raw slide XML of templates/workshop-report-template.pptx
// (which IS the user's "Report Template v.3" design), BEFORE docxtemplater renders the {tags}.
//
// Fill strategy (post-v.3): target every data field by its SHAPE NAME via setShapeText, not by the
// placeholder text it happens to contain. The template ships as a filled example (one sample
// workshop typed into it), so anchoring on placeholder text is unreliable — a shape's name is
// stable across template revisions, its sample text is not. The one exception is the workshop name,
// which is woven mid-sentence into several decoratively-kerned titles: a single global text swap of
// the sample name preserves that per-letter styling where a whole-shape overwrite would flatten it.

export type SimpleReplacement = { find: string; replaceWith: string };

// Global raw-string swaps across every slide. Only the sample workshop name is handled this way
// (see file header) — it appears as a contiguous run inside slide1/slide6/slide7 titles. The slide4
// headline also contains it, but that shape is fully recomposed via SHAPE_TEXT_REPLACEMENTS first,
// so the sample string is already gone by the time this runs.
export const GLOBAL_TEXT_REPLACEMENTS: SimpleReplacement[] = [
  { find: 'ورشة كتابة الفيلم القصير', replaceWith: '{cover.workshop_name}' },
];

// Whole-shape overwrites keyed by shape name (setShapeText collapses the shape to a single run
// carrying this text, then docxtemplater fills any {tags}). Safe regardless of the sample text the
// template shape currently holds.
export type ShapeReplacement = { slide: number; shapeName: string; replaceWith: string };

export const SHAPE_TEXT_REPLACEMENTS: ShapeReplacement[] = [
  // slide1 cover date
  { slide: 1, shapeName: 'Graphic 17', replaceWith: '{cover.workshop_date}' },

  // slide4 headline sentence — recomposed with the real name/trainer/registered count (the template
  // ships the carrier sentence with sample values baked in; overwriting the whole shape is simpler
  // and more robust than run-by-run substring surgery).
  {
    slide: 4,
    shapeName: 'Title 1',
    replaceWith:
      'شهدت الجهة التدريبية "{cover.workshop_name}"، بتقديم "{executive_summary.trainer.name}"، تفاعل واضح من الحضور والذي بلغ عددهم {executive_summary.overview.registered} مشاركين من المهتمين في المجال',
  },

  // slide4 trainer card
  { slide: 4, shapeName: 'TextBox 128', replaceWith: '{executive_summary.trainer.name}' },
  { slide: 4, shapeName: 'Rectangle 129', replaceWith: 'الجنسية: {executive_summary.trainer.nationality}' },
  { slide: 4, shapeName: 'TextBox 130', replaceWith: 'التخصص: {executive_summary.trainer.specialty}' },
  { slide: 4, shapeName: 'TextBox 131', replaceWith: 'تم استلام إجمالي {executive_summary.overview.registered} من مسجلين' },

  // slide4 funnel chevrons (registered > accepted > attended)
  { slide: 4, shapeName: 'Arrow: Chevron 140', replaceWith: '{executive_summary.overview.registered}' },
  { slide: 4, shapeName: 'Arrow: Chevron 141', replaceWith: '{executive_summary.overview.accepted}' },
  { slide: 4, shapeName: 'Arrow: Chevron 142', replaceWith: '{executive_summary.overview.attended}' },

  // slide4 gender counts — v.3 moved the numbers out of the label shapes into their own boxes;
  // Rectangle 4 sits under the "اناث" label, Rectangle 14 under "ذكور" (verified by x-position).
  { slide: 4, shapeName: 'Rectangle 4', replaceWith: '{executive_summary.overview.gender.female}' },
  { slide: 4, shapeName: 'Rectangle 14', replaceWith: '{executive_summary.overview.gender.male}' },

  // slide4's own copy of the "إجمالي التقييم العام" star widget
  { slide: 4, shapeName: 'Text 79', replaceWith: '{satisfaction.overall_rating}' },

  // slide6 "معلومات الورشة التدريبية" table (value shapes, paired to their labels by position)
  { slide: 6, shapeName: 'Text 44', replaceWith: '{detailed_report.workshop_info.track}' },
  { slide: 6, shapeName: 'Text 46', replaceWith: '{detailed_report.workshop_info.city_district}' },
  { slide: 6, shapeName: 'Text 48', replaceWith: '{detailed_report.workshop_info.language}' },
  { slide: 6, shapeName: 'Text 51', replaceWith: '{detailed_report.workshop_info.field}' },
  { slide: 6, shapeName: 'Text 53', replaceWith: '{detailed_report.workshop_info.training_entity}' },
  { slide: 6, shapeName: 'Text 55', replaceWith: '{detailed_report.workshop_info.date}' },
  { slide: 6, shapeName: 'Text 62', replaceWith: '{detailed_report.workshop_info.target_attendance}' },

  // slide7 by-region box (single-region slot; see buildReportPptx.ts's __by_region_* render keys).
  // Label and count are separated by fixed-width em-spaces and wrapped in Left-to-Right Marks (U+200E)
  // so a Latin region name (e.g. "Riyadh") can't bidi-merge with the
  // number into "28Riyadh" — they always render as "count␠␠␠name" with a clear gap in the RTL box.
  { slide: 7, shapeName: 'TextBox 614', replaceWith: '‎{__by_region_label}‎   {__by_region_count}' },

  // slide7 gender counts (fully-attended population — see reportContent.ts)
  { slide: 7, shapeName: 'Rectangle 626', replaceWith: '{statistics.gender.female}' },
  { slide: 7, shapeName: 'Rectangle 627', replaceWith: '{statistics.gender.male}' },

  // slide7 funnel numbers
  { slide: 7, shapeName: 'TextBox 93', replaceWith: '{statistics.funnel.accepted}' },
  { slide: 7, shapeName: 'TextBox 94', replaceWith: '{statistics.funnel.attended}' },
  { slide: 7, shapeName: 'TextBox 92', replaceWith: '{statistics.funnel.received}' },

  // slide8 top-level satisfaction numbers
  { slide: 8, shapeName: 'Text 91', replaceWith: '{satisfaction.responses_received}' },
  { slide: 8, shapeName: 'Text 86', replaceWith: '{satisfaction.total_attendance}' },
  { slide: 8, shapeName: 'Text 97', replaceWith: '{satisfaction.response_rate}' },
  { slide: 8, shapeName: 'Text 79', replaceWith: '{satisfaction.overall_rating}' },
];

// The compact "تفاصيل الورشة" card on slides 4 & 6: course type / date / city value shapes, keyed
// by name (unchanged from the earlier template — these shapes kept their names in v.3).
export const TYPE_DATE_CITY_CARD: ShapeReplacement[] = [
  { slide: 4, shapeName: 'Rectangle 21', replaceWith: '{executive_summary.details.course_type}' },
  { slide: 4, shapeName: 'Google Shape;528;p4', replaceWith: '{executive_summary.details.date}' },
  { slide: 4, shapeName: 'Rectangle 45', replaceWith: '{detailed_report.workshop_info.city_district}' },
  { slide: 6, shapeName: 'Rectangle 21', replaceWith: '{detailed_report.workshop_info.course_type}' },
  { slide: 6, shapeName: 'Google Shape;528;p4', replaceWith: '{detailed_report.workshop_info.date}' },
  { slide: 6, shapeName: 'Rectangle 45', replaceWith: '{detailed_report.workshop_info.city_district}' },
  { slide: 4, shapeName: 'TextBox 104', replaceWith: '{detailed_report.workshop_info.city_district}' },
  { slide: 4, shapeName: 'TextBox 1044', replaceWith: '{executive_summary.details.date}' },
  { slide: 4, shapeName: 'TextBox 1045', replaceWith: '{executive_summary.details.course_type}' },
];

// Retained for buildReportPptx's loop; every fill that used run-substring surgery is now a
// whole-shape overwrite above, so this is intentionally empty.
export type RunReplacement = { slide: number; shapeName: string; oldRunText: string; newRunText: string };
export const RUN_TEXT_REPLACEMENTS: RunReplacement[] = [];

// Fixed-count "numbered box" groups: each slot is (title shape name, badge shape name | null).
// Slots beyond the real data length have BOTH shapes deleted. v.3 trimmed the axis lists to 3
// boxes; extra slots below are harmless no-ops (their shapes no longer exist in the template).
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

// A slot addressing a specific occurrence of a shape name (nth is 0-based). Used for lists whose
// boxes may share a name — v.3's three "Text 73" suggestion boxes. Filled in order with real data;
// unused trailing slots are deleted (see buildReportPptx.fillShapeSlots).
export type ShapeSlot = { shapeName: string; nth: number };

// slide4 "آراء المشاركين" participant-quote boxes (3, unique names).
export const QUOTE_SLOTS: ShapeSlot[] = [
  { shapeName: 'Rectangle 1068', nth: 0 },
  { shapeName: 'Rectangle 1074', nth: 0 },
  { shapeName: 'Rectangle 1079', nth: 0 },
];

// slide8 "أهم الملاحظات" (up to 5, unique names).
export const KEY_FEEDBACK_SLOTS: ShapeSlot[] = [
  { shapeName: 'Text 41', nth: 0 },
  { shapeName: 'Text 45', nth: 0 },
  { shapeName: 'Text 49', nth: 0 },
  { shapeName: 'Text 53', nth: 0 },
  { shapeName: 'Text 57', nth: 0 },
];

// slide8 "أهم المقترحات" (up to 5). Slots 3-5 share the name "Text 73", so they address occurrences.
export const SUGGESTIONS_SLOTS: ShapeSlot[] = [
  { shapeName: 'Text 65', nth: 0 },
  { shapeName: 'Text 69', nth: 0 },
  { shapeName: 'Text 73', nth: 0 },
  { shapeName: 'Text 73', nth: 1 },
  { shapeName: 'Text 73', nth: 2 },
];

// slide8 "التقييم حسب المحاور الرئيسية" per-row score labels ("X/5"), top-to-bottom.
export const SLIDE8_RATING_SCORE_LABELS = ['TextBox 106', 'TextBox 107', 'TextBox 109', 'TextBox 110', 'TextBox 111'];

// slide8 yes/no/partial breakdown percentage boxes (3 option slots per question).
export const YES_NO_PERCENT_SLOTS: { field: 'gained_knowledge' | 'intends_to_apply'; option: string; shapeName: string }[] = [
  { field: 'gained_knowledge', option: 'لا', shapeName: 'TextBox 2332' },
  { field: 'gained_knowledge', option: 'نعم جزئياً', shapeName: 'TextBox 2331' },
  { field: 'gained_knowledge', option: 'نعم', shapeName: 'TextBox 2330' },
  { field: 'intends_to_apply', option: 'لا', shapeName: 'TextBox 2329' },
  { field: 'intends_to_apply', option: 'ربما', shapeName: 'TextBox 2328' },
  { field: 'intends_to_apply', option: 'نعم', shapeName: 'TextBox 2327' },
];
