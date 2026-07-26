export interface FeedbackResponse {
  feedbackId: string;
  workshopId: string;
  participantId?: string;
  responseStatus?: string;

  respondentName?: string;
  respondentEmail?: string;
  respondentPhone?: string;
  respondentGender?: 'male' | 'female';

  overallRating?: number;
  trainerQuality?: number;
  contentQuality?: number;
  gainedKnowledge?: string; // 'نعم' | 'نعم جزئياً' | 'لا'
  intendsToApply?: string; // 'نعم' | 'ربما' | 'لا'
  professionalConnections?: number;
  currentSkillLevel?: number;
  confidenceLevel?: number;

  comments?: string;
  suggestions?: string;

  submittedAt?: string;
}

// The org's fixed 8-question post-workshop survey — 5 direct 1-5 ratings, 2 yes/no/partial
// questions, and 1 open count (professionalConnections, handled separately below since it isn't
// a 1-5 rating). Kept in sync with backend/src/entities/feedback.ts and
// backend/src/report/reportContent.ts (numeric_ratings / yes_no_breakdown).

export type NumericQuestionKey = 'overallRating' | 'trainerQuality' | 'contentQuality' | 'currentSkillLevel' | 'confidenceLevel';

export const numericQuestions: { key: NumericQuestionKey; label: string }[] = [
  { key: 'overallRating', label: 'ما مستوى رضاك العام عن الورشة؟' },
  { key: 'trainerQuality', label: 'ما تقييمك لجودة المدرب؟' },
  { key: 'contentQuality', label: 'ما تقييمك لجودة المحتوى وقابليته للتطبيق؟' },
  { key: 'currentSkillLevel', label: 'قيّم مهاراتك الحالية في موضوع الورشة' },
  { key: 'confidenceLevel', label: 'قيّم ثقتك في تطبيق المهارات الآن' },
];

export interface QuestionRating {
  key: NumericQuestionKey;
  label: string;
  average: number | null;
  count: number;
}

export function computeQuestionRatings(feedback: FeedbackResponse[]): QuestionRating[] {
  return numericQuestions.map(({ key, label }) => {
    const scores = feedback.map((f) => f[key]).filter((v): v is number => typeof v === 'number');
    const average = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
    return { key, label, average, count: scores.length };
  });
}

export type YesNoQuestionKey = 'gainedKnowledge' | 'intendsToApply';

export const yesNoQuestions: { key: YesNoQuestionKey; label: string }[] = [
  { key: 'gainedKnowledge', label: 'هل اكتسبت معرفة أو مهارة جديدة من الورشة؟' },
  { key: 'intendsToApply', label: 'هل تنوي تطبيق ما تعلمته في عمل أو مشروع قريب؟' },
];

export interface YesNoBreakdownOption {
  label: string;
  count: number;
  percent: number;
}

export interface YesNoBreakdown {
  key: YesNoQuestionKey;
  label: string;
  options: YesNoBreakdownOption[];
  total: number;
}

export function computeYesNoBreakdown(feedback: FeedbackResponse[]): YesNoBreakdown[] {
  return yesNoQuestions.map(({ key, label }) => {
    const answers = feedback.map((f) => f[key]).filter((v): v is string => !!v);
    const counts = new Map<string, number>();
    for (const a of answers) counts.set(a, (counts.get(a) ?? 0) + 1);
    const total = answers.length;
    const options = [...counts.entries()].map(([optLabel, count]) => ({
      label: optLabel,
      count,
      percent: total === 0 ? 0 : Math.round((count / total) * 100),
    }));
    return { key, label, options, total };
  });
}
