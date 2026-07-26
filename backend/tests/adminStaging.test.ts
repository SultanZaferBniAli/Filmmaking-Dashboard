import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as XLSX from 'xlsx';
import { createFixtureDataDir, removeFixtureDataDir, SAMPLE_WORKSHOP_ID } from './fixtures/setup.js';

let dataDir: string;
let baseUrl: string;
let closeServer: () => Promise<void>;

beforeAll(async () => {
  dataDir = await createFixtureDataDir();
  process.env.DATA_DIR = dataDir;

  const { buildServer } = await import('../src/server.js');
  const app = buildServer();
  await app.listen({ port: 0, host: '127.0.0.1' });
  const address = app.server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  baseUrl = `http://127.0.0.1:${port}`;
  closeServer = () => app.close();
});

afterAll(async () => {
  await closeServer();
  await removeFixtureDataDir(dataDir);
});

function buildXlsxBuffer(columns: string[], rows: Record<string, unknown>[]): Buffer {
  const aoa = [columns, ...rows.map((r) => columns.map((c) => r[c] ?? null))];
  const sheet = XLSX.utils.aoa_to_sheet(aoa);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, 'البيانات');
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

interface StagedIssue {
  rowIndex: number;
  field: string | null;
  severity: 'warning' | 'error';
  message: string;
}
interface StagedBatch {
  entity: string;
  summary: { new: number; updated: number; unchanged: number; warnings: number; errors: number };
  issues: StagedIssue[];
  rows: { data: Record<string, unknown> }[];
}
interface StagingSession {
  stagingId: string;
  batches: StagedBatch[];
}

async function upload(filename: string, buffer: Buffer): Promise<{ status: number; body: StagingSession }> {
  const form = new FormData();
  form.append('files', new Blob([buffer]), filename);
  const res = await fetch(`${baseUrl}/admin/upload`, { method: 'POST', body: form });
  return { status: res.status, body: (await res.json()) as StagingSession };
}

interface ApplyResponse {
  results: { entity: string; applied: boolean; inserted: number; updated: number; skipped: number; blockedByErrors: number }[];
  sessionDiscarded: boolean;
}

async function apply(stagingId: string): Promise<{ status: number; body: ApplyResponse }> {
  const res = await fetch(`${baseUrl}/admin/staging/${stagingId}/apply`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  return { status: res.status, body: (await res.json()) as ApplyResponse };
}

const participantColumns = [
  'participant_id', 'workshop_id', 'full_name_arabic', 'full_name_en', 'gender', 'nationality',
  'nationality_class', 'national_id', 'national_id_valid', 'phone', 'phone_verified', 'email', 'city',
  'region_code', 'date_of_birth', 'education_level', 'skill_level', 'experience_level', 'track',
  'current_role', 'has_editing_exp', 'editing_software', 'how_heard', 'application_date', 'portfolio_url',
  'evaluation_score', 'status',
];

describe('admin upload -> review -> apply pipeline', () => {
  it('upload writes nothing — the master workbook is untouched and the diff/quality report is correct', async () => {
    const before = await (await fetch(`${baseUrl}/workshops`)).json();

    const buffer = buildXlsxBuffer(
      ['workshop_id', 'workshop_name', 'workshop_type', 'field', 'region_code', 'city', 'location_type', 'start_date', 'end_date', 'trainer_id', 'status'],
      [{ workshop_id: 'WS-501', workshop_name: 'ورشة تجريبية', workshop_type: 'in-person', field: 'x', region_code: 'riyadh', city: 'الرياض', location_type: 'in-person', start_date: '2026-03-01', end_date: '2026-03-02', trainer_id: 'TR-001', status: 'upcoming' }],
    );
    const res = await upload('workshops.xlsx', buffer);
    expect(res.status).toBe(200);
    const batch = res.body.batches.find((b) => b.entity === 'workshops')!;
    expect(batch.summary).toEqual({ new: 1, updated: 0, unchanged: 0, warnings: 0, errors: 0 });

    const after = await (await fetch(`${baseUrl}/workshops`)).json();
    expect(after).toEqual(before); // nothing written by upload alone
  });

  it('a row referencing a non-existent workshop is flagged as a blocking error and apply is refused', async () => {
    const buffer = buildXlsxBuffer(participantColumns, [
      {
        participant_id: 'P-STAGE-BAD', workshop_id: 'WS-DOES-NOT-EXIST', full_name_arabic: 'مشارك',
        gender: 'ذكر', nationality: 'سعودي', national_id: '1234567890', phone: '0501234567',
        email: 'stage-bad@example.com', status: 'applicant',
      },
    ]);
    const res = await upload('participants.xlsx', buffer);
    const batch = res.body.batches.find((b) => b.entity === 'participants')!;
    expect(batch.summary.errors).toBe(1);
    expect(batch.issues[0]).toMatchObject({ field: 'workshop_id', severity: 'error' });

    const applyRes = await apply(res.body.stagingId);
    expect(applyRes.body.results[0].applied).toBe(false);
    expect(applyRes.body.results[0].blockedByErrors).toBe(1);

    const participants = await (await fetch(`${baseUrl}/participants`)).json();
    expect((participants as unknown[]).some((p) => (p as { participant_id: string }).participant_id === 'P-STAGE-BAD')).toBe(false);
  });

  it('two new participants sharing a workshop_id + email within the same upload are flagged as a duplicate and blocked', async () => {
    // Neither row matches an existing record by id or by the national_id/email fallback keys
    // (both national_ids and the participant_ids are brand-new) — so this exercises a genuine
    // in-batch duplicate, not the "re-export reassigned the id" reconciliation case.
    const buffer = buildXlsxBuffer(participantColumns, [
      {
        participant_id: 'P-STAGE-DUP-A', workshop_id: SAMPLE_WORKSHOP_ID, full_name_arabic: 'مشارك أول',
        gender: 'ذكر', nationality: 'سعودي', national_id: '1000000901', phone: '0501234567',
        email: 'dup-batch@example.com', status: 'applicant',
      },
      {
        participant_id: 'P-STAGE-DUP-B', workshop_id: SAMPLE_WORKSHOP_ID, full_name_arabic: 'مشارك ثاني',
        gender: 'ذكر', nationality: 'سعودي', national_id: '1000000902', phone: '0501234568',
        email: 'dup-batch@example.com', status: 'applicant',
      },
    ]);
    const res = await upload('participants.xlsx', buffer);
    const batch = res.body.batches.find((b) => b.entity === 'participants')!;
    expect(batch.summary.errors).toBe(1);
    expect(batch.issues.some((i) => i.severity === 'error' && i.message.includes('Duplicate'))).toBe(true);
  });

  it('discard drops the staging entry and changes nothing', async () => {
    const buffer = buildXlsxBuffer(
      ['workshop_id', 'workshop_name', 'workshop_type', 'field', 'region_code', 'city', 'location_type', 'start_date', 'end_date', 'trainer_id', 'status'],
      [{ workshop_id: 'WS-502', workshop_name: 'ورشة للتجاهل', workshop_type: 'in-person', field: 'x', region_code: 'riyadh', city: 'الرياض', location_type: 'in-person', start_date: '2026-04-01', end_date: '2026-04-02', trainer_id: 'TR-001', status: 'upcoming' }],
    );
    const res = await upload('workshops.xlsx', buffer);
    const discardRes = await fetch(`${baseUrl}/admin/staging/${res.body.stagingId}`, { method: 'DELETE' });
    expect(discardRes.status).toBe(204);

    const getRes = await fetch(`${baseUrl}/admin/staging/${res.body.stagingId}`);
    expect(getRes.status).toBe(404);

    const workshops = await (await fetch(`${baseUrl}/workshops`)).json();
    expect((workshops as unknown[]).some((w) => (w as { workshop_id: string }).workshop_id === 'WS-502')).toBe(false);
  });

  it('fixing a flagged cell (PATCH) re-validates live and clears the error, then apply succeeds', async () => {
    const buffer = buildXlsxBuffer(participantColumns, [
      {
        participant_id: 'P-STAGE-FIX', workshop_id: 'WS-DOES-NOT-EXIST-EITHER', full_name_arabic: 'مشارك',
        gender: 'ذكر', nationality: 'سعودي', national_id: '1234567891', phone: '0501234568',
        email: 'stage-fix@example.com', status: 'applicant',
      },
    ]);
    const res = await upload('participants.xlsx', buffer);
    expect(res.body.batches[0].summary.errors).toBe(1);

    const patchRes = await fetch(`${baseUrl}/admin/staging/${res.body.stagingId}/batches/participants/rows/0`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workshop_id: SAMPLE_WORKSHOP_ID }),
    });
    const patchedBatch = (await patchRes.json()) as StagedBatch;
    expect(patchedBatch.summary.errors).toBe(0);
    expect(patchedBatch.summary.new).toBe(1);

    const applyRes = await apply(res.body.stagingId);
    expect(applyRes.body.results[0].applied).toBe(true);
    expect(applyRes.body.results[0].inserted).toBe(1);

    const participants = await (await fetch(`${baseUrl}/participants`)).json();
    expect((participants as unknown[]).some((p) => (p as { participant_id: string }).participant_id === 'P-STAGE-FIX')).toBe(true);
  });

  it('a raw survey-tool feedback export (real headers, no feedback_id/workshop_id columns) is detected by header aliases, gets an auto-generated feedback_id and a workshop_id blocking error, resolved by bulk-assigning a workshop', async () => {
    const feedbackColumns = [
      'الاسم الثلاثي',
      'البريد الالكتروني',
      'ما مستوى رضاك العام عن الورشة؟',
      'ما تقييمك لجودة المدرب؟',
      'ما تقييمك لجودة المحتوى وقابليته للتطبيق؟',
      'هل اكتسبت معرفة أو مهارة جديدة من الورشة؟',
      'هل تنوي تطبيق ما تعلمته في عمل أو مشروع قريب؟',
      'كم عدد العلاقات المهنية المكتسبة من الورشة؟',
      'قيّم مهاراتك الحالية في موضوع الورشة',
      'قيّم ثقتك في تطبيق المهارات الآن',
      'Response Type',
    ];
    const buffer = buildXlsxBuffer(feedbackColumns, [
      {
        'الاسم الثلاثي': 'مشارك تجريبي',
        'البريد الالكتروني': 'test@example.com',
        'ما مستوى رضاك العام عن الورشة؟': 5,
        'ما تقييمك لجودة المدرب؟': 5,
        'ما تقييمك لجودة المحتوى وقابليته للتطبيق؟': 4,
        'هل اكتسبت معرفة أو مهارة جديدة من الورشة؟': 'نعم',
        'هل تنوي تطبيق ما تعلمته في عمل أو مشروع قريب؟': 'نعم',
        'كم عدد العلاقات المهنية المكتسبة من الورشة؟': 3,
        'قيّم مهاراتك الحالية في موضوع الورشة': 4,
        'قيّم ثقتك في تطبيق المهارات الآن': 5,
        'Response Type': 'completed',
      },
    ]);
    const res = await upload('survey-export.xlsx', buffer);
    const batch = res.body.batches.find((b) => b.entity === 'feedback')!;
    const feedbackId = batch.rows[0].data.feedback_id as string;
    expect(feedbackId).toBeTruthy();
    expect(batch.summary.errors).toBe(1);
    expect(batch.issues[0]).toMatchObject({ field: 'workshop_id', severity: 'error' });

    const assignRes = await fetch(`${baseUrl}/admin/staging/${res.body.stagingId}/batches/feedback/workshop`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workshop_id: SAMPLE_WORKSHOP_ID }),
    });
    const assignedBatch = (await assignRes.json()) as StagedBatch;
    expect(assignedBatch.summary.errors).toBe(0);
    expect(assignedBatch.summary.new).toBe(1);
    // the auto-generated feedback_id must be stable across the workshop assignment, not regenerated
    expect(assignedBatch.rows[0].data.feedback_id).toBe(feedbackId);

    const applyRes = await apply(res.body.stagingId);
    expect(applyRes.body.results[0].applied).toBe(true);
    expect(applyRes.body.results[0].inserted).toBe(1);

    const feedback = (await (await fetch(`${baseUrl}/feedback`)).json()) as { feedback_id: string; workshop_id: string }[];
    const created = feedback.find((f) => f.feedback_id === feedbackId);
    expect(created?.workshop_id).toBe(SAMPLE_WORKSHOP_ID);
  });

  it('a malformed (non-xlsx) upload returns 422 and does not crash the server', async () => {
    const form = new FormData();
    form.append('files', new Blob([Buffer.from('this is not an excel file')]), 'bad.xlsx');
    const res = await fetch(`${baseUrl}/admin/upload`, { method: 'POST', body: form });
    expect(res.status).toBe(422);

    // server still responds normally afterward
    const health = await fetch(`${baseUrl}/workshops`);
    expect(health.status).toBe(200);
  });
});
