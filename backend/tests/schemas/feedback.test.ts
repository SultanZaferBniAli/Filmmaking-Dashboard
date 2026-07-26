import { describe, it, expect } from 'vitest';
import { feedbackEntity } from '../../src/entities/feedback.js';

// Mirrors the real survey-tool export's raw Arabic headers (see "responses dummy.xlsx") — the
// format admin uploads actually arrive in.
function validRawImportRow() {
  return {
    'الاسم الثلاثي': 'عبدالله العميريني',
    'البريد الالكتروني': 'a.alomerene@tamhub.com',
    'رقم الجوال': "'+966590809800",
    'الجنس': 'ذكر',
    'تاريخ الميلاد': '',
    'اسم الورشة التدريبية؟': 'ورشة كتابة الفيلم القصير',
    'ما مستوى رضاك العام عن الورشة؟': 4,
    'ما تقييمك لجودة المدرب؟': 5,
    'ما تقييمك لجودة المحتوى وقابليته للتطبيق؟': 5,
    'هل اكتسبت معرفة أو مهارة جديدة من الورشة؟': 'نعم جزئياً',
    'هل تنوي تطبيق ما تعلمته في عمل أو مشروع قريب؟': 'نعم',
    'كم عدد العلاقات المهنية المكتسبة من الورشة؟': 4,
    'قيّم مهاراتك الحالية في موضوع الورشة': 5,
    'قيّم ثقتك في تطبيق المهارات الآن': 5,
    'Response Type': 'completed',
    'Start Date (UTC)': '2026-05-21 10:03:29',
    'Submit Date (UTC)': '2026-05-21 10:04:40',
    'Network ID': 'cf6fb89e57',
    feedback_id: 'FB-003-001',
    workshop_id: 'WS-003',
  };
}

function parse(raw: Record<string, unknown>) {
  const { row } = feedbackEntity.mapRow(raw);
  return { row, result: feedbackEntity.schema.safeParse(row) };
}

describe('feedback schema', () => {
  it('accepts a valid raw import row (real survey-tool headers) and allows an anonymous (null) participant_id', () => {
    const { row, result } = parse(validRawImportRow());
    expect(result.success).toBe(true);
    expect(row.participant_id).toBeNull();
  });

  it('maps every raw survey-tool column to its canonical field', () => {
    const { row } = parse(validRawImportRow());
    expect(row.respondent_name).toBe('عبدالله العميريني');
    expect(row.respondent_email).toBe('a.alomerene@tamhub.com');
    expect(row.respondent_phone).toBe('+966590809800'); // leading Excel text-quote stripped
    expect(row.respondent_gender).toBe('male');
    expect(row.workshop_name_raw).toBe('ورشة كتابة الفيلم القصير');
    expect(row.overall_rating).toBe(4);
    expect(row.trainer_quality).toBe(5);
    expect(row.content_quality).toBe(5);
    expect(row.gained_knowledge).toBe('نعم جزئياً');
    expect(row.intends_to_apply).toBe('نعم');
    expect(row.professional_connections).toBe(4);
    expect(row.current_skill_level).toBe(5);
    expect(row.confidence_level).toBe(5);
    expect(row.response_status).toBe('completed');
    expect(row.external_response_id).toBe('cf6fb89e57');
  });

  it('is idempotent against its own already-normalized output (re-reading the stored master workbook)', () => {
    const { row: firstPass } = parse(validRawImportRow());
    const { row: secondPass, result } = parse(firstPass);
    expect(result.success).toBe(true);
    expect(secondPass).toEqual(firstPass);
  });

  it('accepts the 1-5 numeric fields at their boundaries, rejects out-of-range values', () => {
    expect(parse({ ...validRawImportRow(), 'ما مستوى رضاك العام عن الورشة؟': 1 }).result.success).toBe(true);
    expect(parse({ ...validRawImportRow(), 'ما مستوى رضاك العام عن الورشة؟': 5 }).result.success).toBe(true);
    expect(parse({ ...validRawImportRow(), 'ما مستوى رضاك العام عن الورشة؟': 0 }).result.success).toBe(false);
    expect(parse({ ...validRawImportRow(), 'ما مستوى رضاك العام عن الورشة؟': 6 }).result.success).toBe(false);
  });

  it('drops an out-of-set yes/no/partial answer to null rather than rejecting the whole row', () => {
    const { row, result } = parse({ ...validRawImportRow(), 'هل اكتسبت معرفة أو مهارة جديدة من الورشة؟': 'ربما' });
    expect(row.gained_knowledge).toBeNull(); // 'ربما' isn't in gained_knowledge's own value set
    expect(result.success).toBe(true); // ...which is a valid nullable field
  });

  it('accepts professional_connections as a non-negative count, rejects negative', () => {
    expect(parse({ ...validRawImportRow(), 'كم عدد العلاقات المهنية المكتسبة من الورشة؟': 0 }).result.success).toBe(true);
    expect(parse({ ...validRawImportRow(), 'كم عدد العلاقات المهنية المكتسبة من الورشة؟': -1 }).result.success).toBe(false);
  });

  it('rejects a missing feedback_id', () => {
    expect(parse({ ...validRawImportRow(), feedback_id: '' }).result.success).toBe(false);
  });
});
