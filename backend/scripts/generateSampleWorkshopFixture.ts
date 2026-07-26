// One-off generator for the checked-in test fixture at tests/fixtures/sample-workshop/ — run
// manually (`npx tsx scripts/generateSampleWorkshopFixture.ts`) whenever the fixture's shape
// needs to change; the output is committed, this script is not run by the test suite itself.
// Layout mirrors the real flat DATA_DIR: workshops/workshops.xlsx, participants/participants.xlsx,
// feedback/feedback.xlsx — tests/fixtures/setup.ts copies this directly into a temp DATA_DIR
// alongside a copy of the real trainers/ folder.
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as XLSX from 'xlsx';

const SHEET_NAME = 'البيانات';
const ROOT = path.resolve(import.meta.dirname, '..', 'tests', 'fixtures', 'sample-workshop');

function writeSheet(relDir: string, filename: string, columns: string[], rows: Record<string, unknown>[]) {
  const dir = path.join(ROOT, relDir);
  fs.mkdirSync(dir, { recursive: true });
  const aoa = [columns, ...rows.map((r) => columns.map((c) => r[c] ?? null))];
  const sheet = XLSX.utils.aoa_to_sheet(aoa);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, SHEET_NAME);
  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  fs.writeFileSync(path.join(dir, filename), buffer);
}

writeSheet(
  'workshops',
  'workshops.xlsx',
  [
    'workshop_id', 'workshop_name', 'workshop_type', 'field', 'year', 'region_code', 'region_name',
    'city', 'location_type', 'location_name', 'location_link', 'start_date', 'end_date', 'start_time',
    'end_time', 'language', 'level', 'capacity', 'trainer_id', 'status', 'description', 'themes',
    'workshop_image',
  ],
  [
    {
      workshop_id: 'WS-101',
      workshop_name: 'ورشة اختبار',
      workshop_type: 'in-person',
      field: 'الإخراج السينمائي',
      year: 2026,
      region_code: 'riyadh',
      region_name: 'منطقة الرياض',
      city: 'الرياض',
      location_type: 'in-person',
      location_name: 'استوديو الاختبار',
      location_link: null,
      start_date: '2026-01-01',
      end_date: '2026-01-03',
      start_time: '10:00',
      end_time: '14:00',
      language: 'العربية',
      level: 'مبتدئ',
      capacity: 20,
      trainer_id: 'TR-001',
      status: 'completed',
      description: 'ورشة اختبار للتحقق من صحة النظام',
      themes: 'محور اختبار أول؛ محور اختبار ثاني',
    },
  ],
);

const participantColumns = [
  'participant_id', 'workshop_id', 'full_name_arabic', 'full_name_en', 'gender', 'nationality',
  'nationality_class', 'national_id', 'national_id_valid', 'phone', 'phone_verified', 'email', 'city',
  'region_code', 'date_of_birth', 'education_level', 'skill_level', 'experience_level', 'track',
  'current_role', 'has_editing_exp', 'editing_software', 'how_heard', 'application_date', 'portfolio_url',
  'evaluation_score', 'status', 'day_1', 'day_2', 'day_3', 'day_4', 'day_5', 'sessions_attended',
  'total_sessions', 'attendance_percentage', 'attendance_status',
];

function participant(overrides: Record<string, unknown>): Record<string, unknown> {
  return {
    workshop_id: 'WS-101',
    full_name_en: null,
    nationality: 'سعودي',
    nationality_class: 'SA',
    national_id_valid: true,
    phone_verified: true,
    city: 'الرياض',
    region_code: 'riyadh',
    date_of_birth: '1998-01-01',
    education_level: 'تعليم عالي (جامعة أو معهد)',
    skill_level: 'intermediate',
    experience_level: '1_to_2',
    track: 'الإخراج السينمائي',
    current_role: null,
    has_editing_exp: null,
    editing_software: null,
    how_heard: null,
    application_date: '2025-12-01',
    portfolio_url: null,
    evaluation_score: 80,
    day_1: null,
    day_2: null,
    day_3: null,
    day_4: null,
    day_5: null,
    sessions_attended: null,
    total_sessions: 5,
    attendance_percentage: null,
    attendance_status: null,
    ...overrides,
  };
}

writeSheet('participants', 'participants.xlsx', participantColumns, [
  participant({
    participant_id: 'TEST-P-001',
    full_name_arabic: 'مشارك اختبار الأول',
    gender: 'male',
    national_id: '1000000101',
    phone: '+966500000101',
    email: 'test-p-001@example.com',
    status: 'accepted',
    day_1: true, day_2: true, day_3: true, day_4: true, day_5: true,
    sessions_attended: 5,
  }),
  participant({
    participant_id: 'TEST-P-002',
    full_name_arabic: 'مشاركة اختبار الثانية',
    gender: 'female',
    national_id: '1000000102',
    phone: '+966500000102',
    email: 'test-p-002@example.com',
    status: 'accepted',
    day_1: true, day_2: true, day_3: false, day_4: false, day_5: false,
    sessions_attended: 2,
  }),
  participant({
    participant_id: 'TEST-P-003',
    full_name_arabic: 'مشارك اختبار الثالث',
    gender: 'male',
    national_id: '1000000103',
    phone: '+966500000103',
    email: 'test-p-003@example.com',
    status: 'accepted',
  }),
  participant({
    participant_id: 'TEST-P-004',
    full_name_arabic: 'مشاركة اختبار الرابعة',
    gender: 'female',
    national_id: '1000000104',
    phone: '+966500000104',
    email: 'test-p-004@example.com',
    status: 'applicant',
  }),
  participant({
    participant_id: 'TEST-P-005',
    full_name_arabic: 'مشارك اختبار الخامس',
    gender: 'male',
    national_id: '1000000105',
    phone: '+966500000105',
    email: 'test-p-005@example.com',
    status: 'waitlist',
  }),
]);

const feedbackColumns = [
  'feedback_id', 'workshop_id', 'participant_id', 'q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7', 'q8',
  'overall_rating', 'recommend_nps', 'reason', 'suggestions', 'response_status',
];

function feedback(overrides: Record<string, unknown>): Record<string, unknown> {
  return {
    workshop_id: 'WS-101',
    participant_id: null,
    q1: 'ممتاز', q2: 'ممتاز', q3: 'ممتاز', q4: 'ممتاز', q5: 'ممتاز', q6: 'ممتاز', q7: 'ممتاز', q8: 'ممتاز',
    recommend_nps: 9,
    reason: 'تجربة جيدة',
    suggestions: null,
    response_status: 'completed',
    ...overrides,
  };
}

writeSheet('feedback', 'feedback.xlsx', feedbackColumns, [
  feedback({ feedback_id: 'TEST-FB-001', overall_rating: 5 }),
  feedback({ feedback_id: 'TEST-FB-002', overall_rating: 4 }),
  feedback({ feedback_id: 'TEST-FB-003', overall_rating: 3 }),
]);

console.log(`Fixture written to ${ROOT}`);
