import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as XLSX from 'xlsx';
import { createFixtureDataDir, removeFixtureDataDir, SAMPLE_WORKSHOP_ID } from './fixtures/setup.js';

let dataDir: string;
let baseUrl: string;
let closeServer: () => Promise<void>;
let store: typeof import('../src/store.js');
let entities: typeof import('../src/entities/index.js');

beforeAll(async () => {
  dataDir = await createFixtureDataDir();
  process.env.DATA_DIR = dataDir;

  store = await import('../src/store.js');
  entities = await import('../src/entities/index.js');
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

interface StagedBatch {
  entity: string;
  summary: { new: number; updated: number; unchanged: number; warnings: number; errors: number };
  rows: unknown[];
  issues: unknown[];
}
interface StagingSession {
  stagingId: string;
  batches: StagedBatch[];
}
interface ApplyResponse {
  results: { entity: string; applied: boolean; inserted: number; updated: number; skipped: number; blockedByErrors: number }[];
  sessionDiscarded: boolean;
}

// Builds an in-memory xlsx buffer (matching the "البيانات" sheet shape every entity file uses)
// so admin-upload tests can construct exactly the rows they need without maintaining separate
// checked-in fixture files.
function buildXlsxBuffer(columns: string[], rows: Record<string, unknown>[]): Buffer {
  const aoa = [columns, ...rows.map((r) => columns.map((c) => r[c] ?? null))];
  const sheet = XLSX.utils.aoa_to_sheet(aoa);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, 'البيانات');
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

async function adminUpload(filename: string, buffer: Buffer): Promise<{ status: number; body: StagingSession }> {
  const form = new FormData();
  form.append('files', new Blob([buffer]), filename);
  const res = await fetch(`${baseUrl}/admin/upload`, { method: 'POST', body: form });
  return { status: res.status, body: (await res.json()) as StagingSession };
}

async function adminApply(stagingId: string): Promise<{ status: number; body: ApplyResponse }> {
  const res = await fetch(`${baseUrl}/admin/staging/${stagingId}/apply`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  return { status: res.status, body: (await res.json()) as ApplyResponse };
}

describe('integration: real workbooks (temp-copied fixture, never the real files)', () => {
  it('serves the exact expected counts from the four canonical workbooks', async () => {
    const workshops = (await (await fetch(`${baseUrl}/workshops`)).json()) as Record<string, unknown>[];
    const trainers = (await (await fetch(`${baseUrl}/trainers`)).json()) as Record<string, unknown>[];
    const participants = (await (await fetch(`${baseUrl}/participants`)).json()) as Record<string, unknown>[];
    const feedback = (await (await fetch(`${baseUrl}/feedback`)).json()) as Record<string, unknown>[];

    expect(workshops.length).toBe(1);
    expect(workshops[0].workshop_id).toBe(SAMPLE_WORKSHOP_ID);
    // trainers/ is copied from the real, live-edited shared file (by design — see plan), so its
    // count isn't asserted exactly; only that the trainer the fixture workshop references exists.
    expect(trainers.some((t) => t.trainer_id === 'TR-001')).toBe(true);
    expect(participants.length).toBe(5);
    expect(feedback.length).toBe(3);

    const byStatus = new Map<string, number>();
    for (const p of participants) {
      const key = String(p.status);
      byStatus.set(key, (byStatus.get(key) ?? 0) + 1);
    }
    expect(byStatus.get('accepted')).toBe(3);
    expect(byStatus.get('waitlist')).toBe(1);
    expect(byStatus.get('applicant')).toBe(1);

    const ratings = feedback.map((f) => Number(f.overall_rating));
    const average = ratings.reduce((a, b) => a + b, 0) / ratings.length;
    expect(average).toBeCloseTo(4.0, 5);
  });

  it('the dashboard-shaped /view/workshops matches the fixture (WS-101, أحمد حافظ, 4.0/5)', async () => {
    const workshops = (await (await fetch(`${baseUrl}/view/workshops`)).json()) as Record<string, unknown>[];
    const w = workshops.find((x) => x.workshop_id === SAMPLE_WORKSHOP_ID)!;
    expect(w.workshop_name).toBe('ورشة اختبار');
    expect(w.trainer_name).toBe('أحمد حافظ');
    expect(w.total_accepted).toBe(3);
    const totalRatings = (w.rating_1_count as number) + (w.rating_2_count as number) + (w.rating_3_count as number) + (w.rating_4_count as number) + (w.rating_5_count as number);
    expect(totalRatings).toBe(3);
    const weighted =
      1 * (w.rating_1_count as number) +
      2 * (w.rating_2_count as number) +
      3 * (w.rating_3_count as number) +
      4 * (w.rating_4_count as number) +
      5 * (w.rating_5_count as number);
    expect(weighted / totalRatings).toBeCloseTo(4.0, 5);
  });

  it('re-uploading the current live workshops workbook unchanged stages 0 new / 0 updated for every row (idempotent)', async () => {
    const liveWorkshopsFile = await store.fullPath(entities.workshopEntity);
    const buffer = await (await import('node:fs')).promises.readFile(liveWorkshopsFile);
    const upload = await adminUpload('workshops.xlsx', buffer);
    expect(upload.status).toBe(200);
    const batch = upload.body.batches.find((b) => b.entity === 'workshops')!;
    expect(batch.summary.new).toBe(0);
    expect(batch.summary.updated).toBe(0);
    expect(batch.summary.unchanged).toBe(batch.rows.length);
  });

  it('uploads and applies brand-new trainer + workshop rows into the flat master workbooks, without touching the original', async () => {
    const before = (await (await fetch(`${baseUrl}/workshops`)).json()) as Record<string, unknown>[];

    const trainerBuffer = buildXlsxBuffer(
      ['trainer_id', 'name_ar', 'name_en', 'nationality', 'nationality_code', 'field', 'years_experience', 'professional_membership', 'accounts', 'bio', 'notable_works', 'festival_recognition', 'award', 'contact'],
      [{ trainer_id: 'TR-999', name_ar: 'مدرب اختبار', nationality_code: 'SA' }],
    );
    const trainerUpload = await adminUpload('trainers.xlsx', trainerBuffer);
    expect(trainerUpload.body.batches[0].issues.filter((i) => (i as { severity: string }).severity === 'error')).toEqual([]);
    const trainerApply = await adminApply(trainerUpload.body.stagingId);
    expect(trainerApply.body.results[0].applied).toBe(true);
    expect(trainerApply.body.results[0].inserted).toBeGreaterThanOrEqual(1);

    const workshopBuffer = buildXlsxBuffer(
      ['workshop_id', 'workshop_name', 'workshop_type', 'field', 'region_code', 'city', 'location_type', 'start_date', 'end_date', 'trainer_id', 'status'],
      [{ workshop_id: 'WS-002', workshop_name: 'ورشة اختبار ثانية', workshop_type: 'in-person', field: 'x', region_code: 'riyadh', city: 'الرياض', location_type: 'in-person', start_date: '2026-02-01', end_date: '2026-02-02', trainer_id: 'TR-001', status: 'upcoming' }],
    );
    const workshopUpload = await adminUpload('workshops.xlsx', workshopBuffer);
    expect(workshopUpload.body.batches[0].issues.filter((i) => (i as { severity: string }).severity === 'error')).toEqual([]);
    const workshopApply = await adminApply(workshopUpload.body.stagingId);
    expect(workshopApply.body.results[0].applied).toBe(true);
    expect(workshopApply.body.results[0].inserted).toBeGreaterThanOrEqual(1);

    const after = (await (await fetch(`${baseUrl}/workshops`)).json()) as Record<string, unknown>[];
    const original = after.find((w) => w.workshop_id === SAMPLE_WORKSHOP_ID);
    expect(original).toBeTruthy();
    expect(original?.workshop_name).toBe('ورشة اختبار');
    expect(after.length).toBeGreaterThan(before.length);
    expect(after.some((w) => w.workshop_id === 'WS-002')).toBe(true);

    // Re-uploading + applying the same new-workshop file again must not create further duplicates.
    const repeatUpload = await adminUpload('workshops.xlsx', workshopBuffer);
    const repeatApply = await adminApply(repeatUpload.body.stagingId);
    expect(repeatApply.body.results[0].inserted).toBe(0);
  });

  it('rejects an invalid payload and writes nothing (bad region on POST /workshops)', async () => {
    const before = (await (await fetch(`${baseUrl}/workshops`)).json()) as Record<string, unknown>[];
    const res = await fetch(`${baseUrl}/workshops`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workshop_id: 'WS-777',
        workshop_name: 'test',
        workshop_type: 'in-person',
        field: 'x',
        region_code: 'not-a-region',
        city: 'x',
        location_type: 'in-person',
        start_date: '2025-01-01',
        end_date: '2025-01-02',
        trainer_id: 'TR-001',
        status: 'upcoming',
      }),
    });
    expect(res.status).toBe(422);
    const after = (await (await fetch(`${baseUrl}/workshops`)).json()) as Record<string, unknown>[];
    expect(after.length).toBe(before.length);
  });

  it('blocks deleting a workshop that still has participants', async () => {
    const res = await fetch(`${baseUrl}/workshops/${SAMPLE_WORKSHOP_ID}`, { method: 'DELETE' });
    expect(res.status).toBe(409);
  });

  it('saves attendance via the batch endpoint and reflects it in both the workshop and participant views', async () => {
    const workshop = (await (await fetch(`${baseUrl}/view/workshops/${SAMPLE_WORKSHOP_ID}`)).json()) as Record<string, unknown>;
    const roster = workshop.participants as { participant_id: string }[];
    const target = roster.find((p) => p.participant_id === 'TEST-P-003')!.participant_id; // no attendance recorded yet, guarantees a real diff

    const res = await fetch(`${baseUrl}/workshops/${SAMPLE_WORKSHOP_ID}/attendance`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        participantAttendance: [{ participant_id: target, day_1: true, day_2: true, day_3: true, day_4: true, day_5: true }],
      }),
    });
    expect(res.status).toBe(200);
    const updatedWorkshop = (await res.json()) as Record<string, unknown>;
    expect(updatedWorkshop.actual_attendance).toBeGreaterThanOrEqual(1);

    const participants = (await (await fetch(`${baseUrl}/view/participants`)).json()) as { id: string; workshops: { attendanceStatus: string; completed: boolean }[] }[];
    const p = participants.find((x) => x.id === target);
    expect(p?.workshops[0]?.attendanceStatus).toBe('actual_attendance');
    expect(p?.workshops[0]?.completed).toBe(true);

    const history = (await (await fetch(`${baseUrl}/participants/${target}/history`)).json()) as unknown[];
    expect(history.length).toBeGreaterThan(0);
  });
});
