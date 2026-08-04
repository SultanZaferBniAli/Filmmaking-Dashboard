import { workshopEntity, trainerEntity, participantEntity, feedbackEntity } from '../entities/index.js';
import { findRowById, findRowsByField } from '../store.js';
import { serializeWorkshop } from '../serialize/workshop.js';
import { computeTrackBreakdown, computeAgeBuckets } from '../serialize/reportAggregates.js';
import type { Row } from '../entities/index.js';

// Deterministic (non-LLM) post-workshop report content generator. Turns a workshop's real,
// already-verified data into the report JSON consumed by buildReportPptx.ts. No API key / LLM
// provider is wired into this backend, so anything genuinely free-text in Arabic (workshop name,
// axis titles pulled from `themes`, real participant quotes/feedback/suggestions) is kept
// verbatim in Arabic rather than fabricating a translation — only the prose this module fully
// authors itself (headline sentence, labels, trainer-bio wrapper, axis description wrapper) is
// written in the requested output language. See buildReportPptx.ts docblock for the caveat this
// implies for slides expecting fully-translated free text.

export type OutputLanguage = 'en' | 'ar';

// English → Arabic place-name translation for the slide-7 "by region" label, so a city entered in
// Latin script (e.g. "Riyadh") shows in Arabic on the Arabic report. This translates the SAME place
// (Jeddah → جدة, never the administrative region "منطقة مكة المكرمة"); an already-Arabic or unknown
// value is left exactly as entered. Keys are lowercased; covers the same spellings normalize.ts's
// CITY_TO_REGION accepts. Also merges Latin/Arabic spellings of one place into a single Arabic group.
const PLACE_EN_TO_AR: Record<string, string> = {
  'riyadh': 'الرياض', 'riyad': 'الرياض', 'ride': 'الرياض', 'raiydh': 'الرياض', 'riyadh , saudi arabia': 'الرياض',
  'jeddah': 'جدة', 'jedda': 'جدة', 'jiddah': 'جدة',
  'makkah': 'مكة المكرمة', 'mecca': 'مكة المكرمة', 'taif': 'الطائف',
  'medina': 'المدينة المنورة', 'medinah': 'المدينة المنورة', 'almadinah': 'المدينة المنورة', 'madani': 'المدينة المنورة',
  'al madinah al munawwarah': 'المدينة المنورة', 'yanbu': 'ينبع',
  'dammam': 'الدمام', 'khobar': 'الخبر', 'kobar': 'الخبر', 'qatif': 'القطيف', 'jubail': 'الجبيل', 'dhahran': 'الظهران',
  'al hasa': 'الأحساء', 'al ahsa': 'الأحساء', 'hafer albatin': 'حفر الباطن',
  'qassim': 'القصيم', 'alqassim': 'القصيم', 'buraydah': 'بريدة', 'buraidah': 'بريدة', 'almjmmah': 'المجمعة',
  'hail': 'حائل', 'tabuk': 'تبوك', 'arar': 'عرعر', 'arras': 'عرعر',
  'jazan': 'جازان', 'jizan': 'جازان', 'abu arish': 'أبو عريش',
  'najran': 'نجران', 'bisha': 'بيشة', 'baha': 'الباحة', 'al baha': 'الباحة', 'al bahah': 'الباحة',
  'sakaka': 'سكاكا', 'asir': 'عسير', 'abha': 'أبها', 'khamis mushayt': 'خميس مشيط', 'khamis mushait': 'خميس مشيط',
};

function toArabicPlace(city: string): string {
  return PLACE_EN_TO_AR[city.trim().toLowerCase()] ?? city.trim();
}

const NATIONALITY_NAME_EN: Record<string, string> = {
  SA: 'Saudi',
  EG: 'Egyptian',
  JO: 'Jordanian',
  AE: 'Emirati',
  KW: 'Kuwaiti',
  MA: 'Moroccan',
  LB: 'Lebanese',
};

const WORKSHOP_TYPE_LABEL_EN: Record<string, string> = {
  'in-person': 'In-Person Workshop',
  virtual: 'Virtual Workshop',
  masterclass: 'Masterclass',
  specialized: 'Specialized Workshop',
  residency: 'Artistic Residency',
  btl: 'BTL Workshop',
};

// Matches the frontend's own Arabic labels (src/data/workshops.ts workshopTypeMeta) — kept in
// sync manually since the backend and frontend build separately and can't share a module.
const WORKSHOP_TYPE_LABEL_AR: Record<string, string> = {
  'in-person': 'ورشة حضورية',
  virtual: 'ورشة افتراضية',
  masterclass: 'ماستر كلاس',
  specialized: 'ورش متخصصة',
  residency: 'إقامات فنية',
  btl: 'ورشة BTL',
};

const LOCATION_TYPE_LABEL_EN: Record<string, string> = { 'in-person': 'In-person', virtual: 'Remote' };
const LOCATION_TYPE_LABEL_AR: Record<string, string> = { 'in-person': 'حضورية', virtual: 'افتراضية' };

const MONTHS_EN = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const MONTHS_AR = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
];

function na(value: string | null | undefined): string {
  const v = (value ?? '').trim();
  return v ? v : 'N/A';
}

function formatDate(iso: string, outputLanguage: OutputLanguage): { day: number; month: string; year: number } {
  const [y, m, d] = iso.split('-').map(Number);
  const months = outputLanguage === 'ar' ? MONTHS_AR : MONTHS_EN;
  return { day: d, month: months[m - 1], year: y };
}

function formatDateRange(startIso: string, endIso: string, outputLanguage: OutputLanguage): string {
  const start = formatDate(startIso, outputLanguage);
  const end = formatDate(endIso, outputLanguage);
  const startDay = String(start.day).padStart(2, '0');
  const endDay = String(end.day).padStart(2, '0');
  if (start.month === end.month && start.year === end.year) {
    return `${startDay} - ${endDay} ${end.month} ${end.year}`;
  }
  return `${startDay} ${start.month} - ${endDay} ${end.month} ${end.year}`;
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10;
}

export interface ReportAxis {
  title: string;
  description: string;
}

export interface ReportContent {
  cover: { workshop_name: string; workshop_date: string };
  executive_summary: {
    headline: string;
    trainer: { name: string; nationality: string; specialty: string; bio: string };
    axes: ReportAxis[];
    details: {
      track: string;
      course_type: string;
      field: string;
      city_location: string;
      date: string;
      training_entity: string;
      target_attendance: string;
      attendance_mode: string;
    };
    participant_quotes: string[];
    overview: {
      registered: number;
      accepted: number;
      attended: number;
      gender: { female: number; male: number };
      age_distribution: { range: string; count: number }[];
    };
  };
  detailed_report: {
    workshop_info: {
      language: string;
      city_district: string;
      track: string;
      field: string;
      training_entity: string;
      date: string;
      course_type: string;
      target_attendance: string;
    };
    axes: ReportAxis[];
    target_audience_traits: string[];
  };
  statistics: {
    gender: { female: number; male: number };
    by_region: { region: string; count: number }[];
    funnel: { received: number; accepted: number; attended: number };
    by_experience: { label: string; count: number }[];
    by_age: { range: string; count: number }[];
  };
  satisfaction: {
    responses_received: number;
    total_attendance: number;
    response_rate: string;
    // The org's fixed 8-question survey (backend/src/entities/feedback.ts) is 5 independent 1-5
    // ratings, 2 yes/no/partial questions, and 1 open count — represented directly rather than
    // bucketed into categories. Slide 8's "التقييم حسب المحاور الرئيسية" star-rating chart
    // (buildReportPptx.ts's chart4) renders these 5 averages directly, in this exact order.
    numeric_ratings: { question: string; average: number | null; responses: number }[];
    yes_no_breakdown: { question: string; options: { label: string; count: number; percent: number }[] }[];
    average_professional_connections: number | null;
    overall_rating: number;
    percentage: string;
    label: string;
    overall_comment: string;
    // Free-text answers to the survey's two open-ended questions (backend/src/entities/feedback.ts
    // `comments`/`suggestions`) — real respondent text, kept verbatim (see module docblock).
    key_feedback: string[];
    suggestions: string[];
  };
}

export async function generateReportContent(workshopId: string, outputLanguage: OutputLanguage = 'en'): Promise<ReportContent> {
  const workshopRow = await findRowById(workshopEntity, workshopId);
  if (!workshopRow) throw new Error(`workshop ${workshopId} not found`);
  const workshop = await serializeWorkshop(workshopRow);

  const trainerRow = workshopRow.trainer_id ? await findRowById(trainerEntity, String(workshopRow.trainer_id)) : undefined;
  const allParticipants = await findRowsByField(participantEntity, 'workshop_id', workshopId);
  const accepted = allParticipants.filter((p) => p.status === 'accepted');
  const feedbackRows = await findRowsByField(feedbackEntity, 'workshop_id', workshopId);

  const dateRange = formatDateRange(workshop.start_date as string, workshop.end_date as string, outputLanguage);
  const objectives = (workshop.objectives ?? []) as string[];

  const axes: ReportAxis[] = objectives.map((title) => ({
    title,
    description:
      outputLanguage === 'ar'
        ? `تناولت هذه الجلسة "${title}" كأحد المحاور الأساسية في برنامج الورشة التخصصي.`
        : `This session addressed "${title}" as one of the workshop's core specialized topics.`,
  }));

  const nationalityCode = (trainerRow?.nationality_code as string | null) ?? null;
  const nationalityName =
    outputLanguage === 'ar' ? na(trainerRow?.nationality as string | null) : nationalityCode ? (NATIONALITY_NAME_EN[nationalityCode] ?? na(trainerRow?.nationality as string | null)) : 'N/A';

  const yearsExp = (trainerRow?.years_experience as string | null) ?? null;
  const notableWorks = (trainerRow?.notable_works as string | null) ?? null;
  const award = (trainerRow?.award as string | null) ?? null;
  const trainerBioRaw = (trainerRow?.bio as string | null) ?? null;

  let trainerBio = 'N/A';
  if (trainerBioRaw) {
    if (outputLanguage === 'ar') {
      const parts = [trainerBioRaw];
      if (yearsExp) parts.push(`يمتلك خبرة ${yearsExp} في المجال`);
      if (notableWorks) parts.push(`من أبرز أعماله: ${notableWorks}`);
      if (award) parts.push(`وحائز على ${award}`);
      trainerBio = parts.join('؛ ') + '.';
    } else {
      let sentence = trainerBioRaw;
      if (yearsExp) sentence += ` With ${yearsExp} of experience in the field`;
      if (notableWorks) sentence += `, notable works include ${notableWorks}`;
      if (award) sentence += `, and a recipient of ${award}`;
      trainerBio = sentence + '.';
    }
  }

  // Trainer name is always shown in Arabic (a proper noun, not translated), regardless of
  // output_language.
  const trainerName = na(trainerRow?.name_ar as string | null);
  const specialty = na(workshop.field as string | null);
  const workshopName = workshop.workshop_name as string;
  const totalApplications = workshop.total_applications as number;
  const locationType = workshop.location_type as string;
  const workshopType = workshop.workshop_type as string;
  const city = workshop.city as string;
  const locationName = workshop.location_name as string | null;
  const capacity = workshop.capacity as number;
  const language = workshop.language as string | null;

  const headline =
    outputLanguage === 'ar'
      ? `قدّمت الجهة التدريبية "${workshopName}"، بتقديم "${trainerName}"، وسط تفاعل واضح من الحضور بلغ عددهم ${totalApplications} مشاركًا من المهتمين بمجال ${specialty}. قدّم البرنامج محتوى تخصصيًا يركّز على ${objectives.join('، ') || 'موضوعات الورشة الأساسية'}.`
      : `The training entity delivered "${workshopName}", presented by ${trainerName}, to clear engagement from an audience of ${totalApplications} participants drawn from professionals interested in the field of ${specialty}. The program offered a focused, specialized curriculum centered on ${objectives.join(', ') || "the workshop's core topics"}.`;

  const courseType = (outputLanguage === 'ar' ? LOCATION_TYPE_LABEL_AR[locationType] : LOCATION_TYPE_LABEL_EN[locationType]) ?? na(locationType);
  const track = (outputLanguage === 'ar' ? WORKSHOP_TYPE_LABEL_AR[workshopType] : WORKSHOP_TYPE_LABEL_EN[workshopType]) ?? na(workshopType);
  const cityLocation = locationName ? `${city} — ${locationName}` : na(city);

  // The survey's two open-text questions (comments/suggestions) are real respondent answers —
  // slide4's 3 "quote" boxes get the first 3 comments; slide8's 5-slot "أهم الملاحظات"/"أهم
  // المقترحات" lists get up to 5 of each (Stage-2/pptx deletes any remaining unused boxes for a
  // shorter list, same as any other under-filled numbered-box group).
  const rawComments = feedbackRows.map((r) => (r.comments as string | null)?.trim()).filter((v): v is string => !!v);
  const rawSuggestions = feedbackRows.map((r) => (r.suggestions as string | null)?.trim()).filter((v): v is string => !!v);
  const quotes: string[] = rawComments.slice(0, 3);
  const keyFeedback: string[] = rawComments.slice(0, 5);
  const suggestionsList: string[] = rawSuggestions.slice(0, 5);

  // Gender + age breakdowns are computed over the participants who ATTENDED THE FULL WORKSHOP
  // (100% attendance), NOT the accepted population — slides 4 & 7 both label these "عدد الحضور
  // بحسب الجنس/العمر" (attendance by gender/age), so they must reflect who actually showed up for
  // the whole workshop. "Full attendance" = attendance_percentage 100 when recorded, else
  // sessions_attended === total_sessions.
  function attendedFullWorkshop(p: Row): boolean {
    const pct = p.attendance_percentage as number | null;
    if (typeof pct === 'number') return pct >= 100;
    const sessionsAttended = p.sessions_attended as number | null;
    const totalSessions = p.total_sessions as number | null;
    if (typeof sessionsAttended === 'number' && typeof totalSessions === 'number' && totalSessions > 0) {
      return sessionsAttended >= totalSessions;
    }
    return false;
  }
  const fullyAttended = allParticipants.filter(attendedFullWorkshop);

  const genderAttended = {
    female: fullyAttended.filter((p) => p.gender === 'female').length,
    male: fullyAttended.filter((p) => p.gender === 'male').length,
  };

  const ageAsOf = new Date(String(workshop.end_date) + 'T00:00:00Z');
  const attendedAge = computeAgeBuckets(fullyAttended, Number.isNaN(ageAsOf.getTime()) ? new Date() : ageAsOf);
  const ageBuckets = [
    { range: '18 - 24', count: attendedAge.age_18_24_count },
    { range: '25 - 30', count: attendedAge.age_25_30_count },
    { range: '30+', count: attendedAge.age_30_plus_count },
  ];

  // --- statistics: by_region / by_experience among the ACCEPTED population -----------------
  // Group by the region/city EXACTLY AS ENTERED on each participant (raw `city` text), with no
  // city→administrative-region normalization: the user asked slide 7 to show the same region they
  // typed, never a canonical region name they never entered. Blank values fall back to "غير محدد".
  const regionCounts = new Map<string, number>();
  for (const p of accepted) {
    const entered = (p.city as string | null)?.trim();
    let label: string;
    if (!entered) label = outputLanguage === 'ar' ? 'غير محدد' : 'Unspecified';
    else label = outputLanguage === 'ar' ? toArabicPlace(entered) : entered;
    regionCounts.set(label, (regionCounts.get(label) ?? 0) + 1);
  }
  const byRegion = [...regionCounts.entries()].map(([region, count]) => ({ region, count })).sort((a, b) => b.count - a.count);

  const trackBreakdown = computeTrackBreakdown(accepted);
  const byExperience =
    trackBreakdown.length > 0
      ? trackBreakdown.map((t) => ({ label: t.label, count: t.count }))
      : [{ label: outputLanguage === 'ar' ? 'غير محدد' : 'Unspecified', count: accepted.length }];

  // --- satisfaction: derive real averages/percentages from the org's fixed 8-question survey ---
  const NUMERIC_QUESTIONS: { field: string; label_en: string; label_ar: string }[] = [
    { field: 'overall_rating', label_en: 'Overall satisfaction with the workshop', label_ar: 'مستوى الرضا العام عن الورشة' },
    { field: 'trainer_quality', label_en: "Trainer's quality", label_ar: 'جودة المدرب' },
    { field: 'content_quality', label_en: 'Content quality and applicability', label_ar: 'جودة المحتوى وقابليته للتطبيق' },
    { field: 'current_skill_level', label_en: 'Current skill level in the workshop topic', label_ar: 'المهارات الحالية في موضوع الورشة' },
    { field: 'confidence_level', label_en: 'Confidence applying the skills now', label_ar: 'الثقة في تطبيق المهارات الآن' },
  ];

  function numericScores(field: string): number[] {
    return feedbackRows.map((r) => r[field] as number | null).filter((v): v is number => typeof v === 'number');
  }

  const numericRatings = NUMERIC_QUESTIONS.map((q) => {
    const scores = numericScores(q.field);
    return { question: outputLanguage === 'ar' ? q.label_ar : q.label_en, average: average(scores), responses: scores.length };
  });

  const YES_NO_QUESTIONS: { field: string; label_en: string; label_ar: string }[] = [
    { field: 'gained_knowledge', label_en: 'Gained new knowledge or skill from the workshop', label_ar: 'اكتسب معرفة أو مهارة جديدة من الورشة' },
    { field: 'intends_to_apply', label_en: 'Intends to apply what was learned soon', label_ar: 'ينوي تطبيق ما تعلمه في عمل أو مشروع قريب' },
  ];

  const yesNoBreakdown = YES_NO_QUESTIONS.map((q) => {
    const answers = feedbackRows.map((r) => r[q.field] as string | null).filter((v): v is string => !!v);
    const counts = new Map<string, number>();
    for (const a of answers) counts.set(a, (counts.get(a) ?? 0) + 1);
    const total = answers.length;
    const options = [...counts.entries()].map(([label, count]) => ({
      label,
      count,
      percent: total === 0 ? 0 : Math.round((count / total) * 100),
    }));
    return { question: outputLanguage === 'ar' ? q.label_ar : q.label_en, options };
  });

  const connectionsScores = feedbackRows.map((r) => r.professional_connections as number | null).filter((v): v is number => typeof v === 'number');
  const averageConnections = average(connectionsScores);

  // overall_rating ("ما مستوى رضاك العام عن الورشة؟") is still a direct 1-5 scale — same
  // percent/label derivation as the server's own computeOverallRating (reportAggregates.ts),
  // cross-checked against it for consistency.
  const overallScores = numericScores('overall_rating');
  const overallRating = average(overallScores) ?? 0;
  const overallPercent = overallScores.length === 0 ? 0 : Math.round((overallRating / 5) * 100);
  const overallLabelAr = overallScores.length === 0 ? 'لا يوجد' : overallPercent >= 80 ? 'ممتاز' : overallPercent >= 60 ? 'جيد' : overallPercent >= 40 ? 'مقبول' : 'يحتاج تحسين';
  const overallLabelEn = overallScores.length === 0 ? 'N/A' : overallPercent >= 80 ? 'Excellent' : overallPercent >= 60 ? 'Good' : overallPercent >= 40 ? 'Fair' : 'Needs Improvement';
  const overallLabel = outputLanguage === 'ar' ? overallLabelAr : overallLabelEn;

  const totalAttendance = workshop.total_attendance as number;
  const totalAccepted = workshop.total_accepted as number;

  const responsesReceived = feedbackRows.length;
  // Clamped at 100 — a respondent can submit feedback without their attendance having been
  // recorded yet, which would otherwise push this past 100% (e.g. 10 responses vs. 3 recorded
  // attendees), a nonsensical rate to display.
  const responseRatePct = totalAttendance === 0 ? null : Math.min(Math.round((responsesReceived / totalAttendance) * 100), 100);
  const responseRate = responsesReceived === 0 ? 'N/A' : responseRatePct === null ? 'N/A' : `${responseRatePct}%`;

  const targetAudienceTraits: string[] = [];
  const allNone = accepted.length > 0 && accepted.every((p) => p.experience_level === 'none');
  if (allNone) {
    targetAudienceTraits.push(
      outputLanguage === 'ar'
        ? `مشاركون مهتمون بمجال ${specialty} دون خبرة مهنية سابقة في المجال.`
        : `Participants interested in ${specialty} with little to no prior professional experience in the field.`,
    );
  }
  if (byRegion.length === 1) {
    targetAudienceTraits.push(
      outputLanguage === 'ar' ? `مقيمون في منطقة ${byRegion[0].region}.` : `Based in the ${byRegion[0].region} area.`,
    );
  }

  const targetAttendanceText = capacity ? String(capacity) : 'N/A';
  const existingTraits = (workshop.targetAudienceTraits ?? []) as string[];

  const content: ReportContent = {
    cover: { workshop_name: workshopName, workshop_date: dateRange },
    executive_summary: {
      headline,
      trainer: { name: trainerName, nationality: nationalityName, specialty, bio: trainerBio },
      axes,
      details: {
        track,
        course_type: courseType,
        field: specialty,
        city_location: cityLocation,
        date: dateRange,
        training_entity: 'N/A',
        target_attendance: targetAttendanceText,
        attendance_mode: courseType,
      },
      participant_quotes: quotes.length > 0 ? quotes : [],
      overview: {
        registered: totalApplications,
        accepted: totalAccepted,
        attended: totalAttendance,
        gender: genderAttended,
        age_distribution: ageBuckets,
      },
    },
    detailed_report: {
      workshop_info: {
        language: language === 'العربية' ? (outputLanguage === 'ar' ? 'العربية' : 'Arabic') : language === 'الإنجليزية' ? (outputLanguage === 'ar' ? 'الإنجليزية' : 'English') : na(language),
        city_district: na(city),
        track,
        field: specialty,
        training_entity: 'N/A',
        date: dateRange,
        course_type: courseType,
        target_attendance: targetAttendanceText,
      },
      axes,
      target_audience_traits: existingTraits.length > 0 ? existingTraits : targetAudienceTraits,
    },
    statistics: {
      gender: genderAttended,
      by_region: byRegion,
      funnel: { received: totalApplications, accepted: totalAccepted, attended: totalAttendance },
      by_experience: byExperience,
      by_age: ageBuckets,
    },
    satisfaction: {
      responses_received: responsesReceived,
      total_attendance: totalAttendance,
      response_rate: responseRate,
      numeric_ratings: numericRatings,
      yes_no_breakdown: yesNoBreakdown,
      average_professional_connections: averageConnections,
      overall_rating: overallRating,
      percentage: overallScores.length === 0 ? 'N/A' : `${overallPercent}%`,
      label: overallLabel,
      overall_comment:
        overallScores.length === 0
          ? 'N/A'
          : outputLanguage === 'ar'
            ? `أعرب المتدربون بشكل عام عن رضا ${overallLabelAr} تجاه الورشة، بما يعكس تقديرًا واضحًا لأداء المدرب ومحتوى الورشة.`
            : `Overall, trainees rated the workshop very positively, with ${/^[aeiou]/i.test(overallLabelEn) ? 'an' : 'a'} ${overallLabelEn.toLowerCase()} overall satisfaction score reflecting strong appreciation for the trainer's delivery and the course content.`,
      key_feedback: keyFeedback,
      suggestions: suggestionsList,
    },
  };

  return content;
}
