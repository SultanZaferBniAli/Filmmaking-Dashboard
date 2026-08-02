// Shared field-normalization helpers, reused by both the write-path Zod schemas (entities/*.ts)
// and the read-path serializers (serialize/*.ts). Ports the exact mapping decisions already
// proven against the real workbooks in the prior session's scripts/import-data.ts, extended
// with this spec's flagging/warning behavior (phone_verified, national_id_valid, unmappable
// city/region left blank + warned instead of guessed).

export const VALID_REGION_CODES = [
  'riyadh',
  'makkah',
  'madinah',
  'eastern',
  'qassim',
  'hail',
  'tabuk',
  'northern-borders',
  'jazan',
  'najran',
  'bahah',
  'jouf',
  'asir',
] as const;

export type RegionCode = (typeof VALID_REGION_CODES)[number];

const VALID_REGION_SET = new Set<string>(VALID_REGION_CODES);

export function isValidRegionCode(value: unknown): value is RegionCode {
  return typeof value === 'string' && VALID_REGION_SET.has(value);
}

// A modest lookup covering the Saudi city names actually seen in the source data (Arabic and
// the occasional English transliteration) — enough to recover a region when region_code itself
// is missing/wrong, without ever guessing on genuinely ambiguous input.
const CITY_TO_REGION: Record<string, RegionCode> = {
  الرياض: 'riyadh',
  الخرج: 'riyadh',
  riyadh: 'riyadh',
  riyad: 'riyadh',
  ride: 'riyadh',
  raiydh: 'riyadh',
  'riyadh , saudi arabia': 'riyadh',
  jeddah: 'makkah',
  جدة: 'makkah',
  جده: 'makkah',
  'مكة المكرمة': 'makkah',
  مكة: 'makkah',
  makkah: 'makkah',
  mecca: 'makkah',
  الطائف: 'makkah',
  taif: 'makkah',
  'المدينة المنورة': 'madinah',
  المدينة: 'madinah',
  ينبع: 'madinah',
  medina: 'madinah',
  medinah: 'madinah',
  almadinah: 'madinah',
  madani: 'madinah',
  'al madinah al munawwarah': 'madinah',
  الدمام: 'eastern',
  dammam: 'eastern',
  الخبر: 'eastern',
  khobar: 'eastern',
  kobar: 'eastern',
  qatif: 'eastern',
  jubail: 'eastern',
  الظهران: 'eastern',
  dhahran: 'eastern',
  الأحساء: 'eastern',
  'al hasa': 'eastern',
  'al ahsa': 'eastern',
  'hafer albatin': 'eastern',
  بريدة: 'qassim',
  عنيزة: 'qassim',
  qassim: 'qassim',
  alqassim: 'qassim',
  buraydah: 'qassim',
  almjmmah: 'qassim',
  حائل: 'hail',
  hail: 'hail',
  تبوك: 'tabuk',
  tabuk: 'tabuk',
  الوجه: 'tabuk',
  عرعر: 'northern-borders',
  arras: 'northern-borders',
  جازان: 'jazan',
  jazan: 'jazan',
  'أبو عريش': 'jazan',
  'abu arish': 'jazan',
  نجران: 'najran',
  الباحة: 'bahah',
  bisha: 'bahah',
  سكاكا: 'jouf',
  'دومة الجندل': 'jouf',
  أبها: 'asir',
  asir: 'asir',
  'خميس مشيط': 'asir',
  'khamis mushayt': 'asir',
};

export type CityRegionResult = { region: RegionCode | null; warning: string | null };

export function normalizeCityToRegion(city: string | null, regionCode: string | null): CityRegionResult {
  if (isValidRegionCode(regionCode)) return { region: regionCode, warning: null };
  const key = (city ?? '').trim().toLowerCase();
  if (key && CITY_TO_REGION[key]) return { region: CITY_TO_REGION[key], warning: null };
  if (!city) return { region: null, warning: null };
  return { region: null, warning: `Could not map city "${city}" to a known region — left blank instead of guessing.` };
}

export function emptyToNull(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  return s === '' ? null : s;
}

// Excel/Sheets sometimes leaks literal carriage-return artifacts into cell text on export.
export function cleanText(value: unknown): string | null {
  const s = emptyToNull(value);
  if (s === null) return null;
  return s.replace(/_x000[dD]_/g, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
}

export type PhoneResult = { phone: string; phoneVerified: boolean; warning: string | null };

// Detects the specific corruption pattern seen in the source data: a phone number that was
// stored as an Excel *number* and lost trailing digits (padded/truncated to zeros), e.g.
// "9660540000000". A leading "~" is this project's own prior convention for flagging the same
// issue and is preserved rather than "fixed".
export function normalizePhone(raw: unknown): PhoneResult {
  const s = emptyToNull(raw) ?? '';
  const looksCorrupted = /0{4,}$/.test(s.replace(/[^0-9]/g, '')) || s.startsWith('~');
  const digits = s.replace(/^~/, '').replace(/[^0-9]/g, '');
  let normalized = s.startsWith('~') ? s : digits;
  if (!looksCorrupted && digits.length > 0) {
    const local = digits.replace(/^966/, '').replace(/^0/, '');
    normalized = `+966${local}`;
  }
  return {
    phone: normalized,
    phoneVerified: !looksCorrupted,
    warning: looksCorrupted ? 'Phone number looks corrupted (Excel numeric truncation) — kept as-is, not auto-corrected.' : null,
  };
}

export function mapGender(raw: unknown): 'male' | 'female' | null {
  const s = emptyToNull(raw);
  if (!s) return null;
  if (s === 'male' || s === 'ذكر') return 'male';
  if (s === 'female' || s === 'انثى' || s === 'أنثى') return 'female';
  return null;
}

export type NationalityClass = { class: 'SA' | 'non-SA'; raw: string | null };

export function classifyNationality(raw: unknown): NationalityClass {
  const s = emptyToNull(raw);
  if (!s) return { class: 'non-SA', raw: null };
  const isSaudi = s.includes('سعودي') || s.includes('مواطنة');
  return { class: isSaudi ? 'SA' : 'non-SA', raw: s };
}

export const EXPERIENCE_LEVELS = ['none', 'less_than_1', '1_to_2', '3_to_5', '6_to_10', 'more_than_10'] as const;
export type ExperienceLevel = (typeof EXPERIENCE_LEVELS)[number];

const EXPERIENCE_LEVEL_MAP: Record<string, ExperienceLevel> = {
  'بدون خبرة': 'none',
  'سنتين وأقل': '1_to_2',
  '3 سنوات فأكثر': '3_to_5',
};

export function mapExperienceLevel(raw: unknown): ExperienceLevel {
  const s = emptyToNull(raw);
  if (!s) return 'none';
  // Idempotent: a row already carrying a normalized enum token (e.g. re-processed on a PATCH
  // merge) passes through unchanged instead of falling through to the Arabic-label map, which
  // would otherwise silently reset it to 'none'.
  if ((EXPERIENCE_LEVELS as readonly string[]).includes(s)) return s as ExperienceLevel;
  return EXPERIENCE_LEVEL_MAP[s] ?? 'none';
}

export type ParticipantStatus = 'applicant' | 'accepted' | 'waitlist' | 'rejected';

export function mapParticipantStatus(raw: unknown): ParticipantStatus {
  const s = emptyToNull(raw);
  if (s === 'accepted' || s === 'waitlist' || s === 'rejected') return s;
  return 'applicant';
}

const EXCEL_EPOCH_MS = Date.UTC(1899, 11, 30);

export type DobResult = { dateOfBirth: string | null; warning: string | null };

export function normalizeDateOfBirth(raw: unknown): DobResult {
  if (raw === null || raw === undefined || raw === '') return { dateOfBirth: null, warning: null };

  let iso: string | null = null;
  if (typeof raw === 'number') {
    iso = new Date(EXCEL_EPOCH_MS + raw * 86400000).toISOString().slice(0, 10);
  } else {
    const s = String(raw).trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) iso = s.slice(0, 10);
  }
  if (!iso) return { dateOfBirth: null, warning: `Unrecognized date_of_birth value "${String(raw)}" — left blank.` };

  const age = (Date.now() - new Date(iso + 'T00:00:00Z').getTime()) / (365.25 * 86400000);
  if (age < 10 || age > 90) {
    return { dateOfBirth: null, warning: `date_of_birth "${iso}" implies an implausible age (${age.toFixed(0)}) — left blank.` };
  }
  return { dateOfBirth: iso, warning: null };
}

export type NationalIdResult = { nationalId: string | null; nationalIdValid: boolean };

export function normalizeNationalId(raw: unknown): NationalIdResult {
  const s = emptyToNull(raw);
  if (!s) return { nationalId: null, nationalIdValid: true };
  const valid = /^\d{10}$/.test(s);
  return { nationalId: s, nationalIdValid: valid };
}

export function computeAttendance(
  sessionsAttended: number | null,
  totalSessions: number | null,
): { attendancePercentage: number | null; attendanceStatus: 'لم يحضر' | 'حضور جزئي' | 'حضور فعلي' | null } {
  if (sessionsAttended === null || totalSessions === null || totalSessions === 0) {
    return { attendancePercentage: null, attendanceStatus: null };
  }
  const pct = (sessionsAttended / totalSessions) * 100;
  const status = sessionsAttended === 0 ? 'لم يحضر' : pct >= 80 ? 'حضور فعلي' : 'حضور جزئي';
  return { attendancePercentage: Math.round(pct * 100) / 100, attendanceStatus: status };
}
