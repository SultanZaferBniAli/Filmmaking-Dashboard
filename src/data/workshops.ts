export type RegionCode =
  | 'riyadh'
  | 'makkah'
  | 'madinah'
  | 'eastern'
  | 'qassim'
  | 'hail'
  | 'tabuk'
  | 'northern-borders'
  | 'jazan'
  | 'najran'
  | 'bahah'
  | 'jouf'
  | 'asir';

export type WorkshopType = 'in-person' | 'virtual' | 'masterclass' | 'specialized' | 'residency' | 'btl';

export type WorkshopStatus = 'upcoming' | 'completed';

export type WorkshopLevel = 'مبتدئ' | 'متوسط' | 'متقدم';
export type WorkshopLanguage = 'العربية' | 'الإنجليزية';
export type MeetingPlatform = 'Zoom' | 'Google Meet' | 'Microsoft Teams';
export type LocationType = 'in-person' | 'virtual';

export interface WorkshopParticipant {
  participant_id: string;
  name: string;
  phone: string;
  email: string;
  department: string;
  // One entry per workshop session (session count derived from start/end date span).
  sessionAttendance: boolean[];
}

export interface WorkshopPhoto {
  id: string;
  url: string;
  caption?: string;
}

export interface Workshop {
  workshop_id: string;
  workshop_name: string;
  workshop_type: WorkshopType;
  field: string;
  workshop_image: string | null;
  region: RegionCode;
  city: string;
  start_date: string; // ISO yyyy-mm-dd
  end_date: string; // ISO yyyy-mm-dd
  trainer_id: string | null;
  trainer_name: string;
  trainer_bio: string;
  // A 2-letter ISO-3166 code — not a narrow union, since a trainer's real nationality can be
  // anything (see src/data/trainers.ts's nationalityByCode for the app's full known list, and
  // its own defensive fallback for a code outside even that).
  trainer_nationality: string;
  trainer_image: string | null;
  level: WorkshopLevel;
  language: WorkshopLanguage;
  objectives: string[];
  location_type: LocationType;
  location_name: string;
  location_link: string | null;
  platform: MeetingPlatform | null;
  meeting_link: string | null;
  capacity: number;
  registered_participants: number;
  description: string;
  created_at: string; // ISO yyyy-mm-dd — also displayed as "تاريخ الإعلان"
  updated_at: string; // ISO yyyy-mm-dd
  trainer_notes: string;
  general_notes: string;
  recommendations: string;
  participants: WorkshopParticipant[];
  photos: WorkshopPhoto[];
  total_applications: number;
  male_applications: number;
  female_applications: number;
  total_accepted: number;
  male_accepted: number;
  female_accepted: number;
  total_attendance: number;
  male_attendance: number;
  female_attendance: number;
  actual_attendance: number;
  male_actual_attendance: number;
  female_actual_attendance: number;
  rating_1_count: number;
  rating_2_count: number;
  rating_3_count: number;
  rating_4_count: number;
  rating_5_count: number;
  status: WorkshopStatus;
  // Post-workshop report aggregates — computed server-side from accepted
  // participants / feedback, see backend/src/serialize/reportAggregates.ts.
  age_18_24_count: number;
  age_25_30_count: number;
  age_30_plus_count: number;
  attendance_by_track: { label: string; count: number }[];
  overall_rating_percent: number;
  overall_rating_label: string;
  targetAudienceTraits: string[];
  honorPhotoId?: string;
  executiveSummaryOverride?: string;
  // An org-uploaded document that overrides the app's auto-generated report/guide, if any —
  // see src/utils/workshopDocuments.ts.
  report_file: { url: string; filename: string } | null;
  guide_file: { url: string; filename: string } | null;
}

export const workshopFields = [
  'الإنتاج السينمائي',
  'الإخراج السينمائي',
  'التمثيل',
  'المشاهد الخطرة',
  'الصوت في موقع التصوير',
  'التصوير والكاميرا والإضاءة',
  'الفن والتصميم',
  'المكياج والأزياء',
  'المؤثرات البصرية',
  'ما بعد إنتاج الصوت',
  'تحرير الأفلام',
  'تنسيق وإدارة ما بعد الإنتاج',
  'الرسوم المتحركة',
] as const;

export type WorkshopField = (typeof workshopFields)[number];

export type WorkshopPhase = 'scheduled' | 'ongoing' | 'completed';

export const workshopPhaseLabel: Record<WorkshopPhase, string> = {
  scheduled: 'المجدولة',
  ongoing: 'الجارية',
  completed: 'المكتملة',
};

// Single source of truth for region colors — reused by both the KSA map and the region bar
// chart so a given region always renders with the same color everywhere (including when selected).
export const regionColors: Record<RegionCode, string> = {
  riyadh: '#B41932',
  makkah: '#EB5A3C',
  eastern: '#FF9619',
  madinah: '#FF9619',
  asir: '#112B63',
  tabuk: '#91B9B4',
  qassim: '#B41932',
  hail: '#9B3A72',
  'northern-borders': '#6E1946',
  jouf: '#0F2837',
  jazan: '#009988',
  najran: '#8A5B2B',
  bahah: '#FF2638',
};

export const regionMeta: { code: RegionCode; name: string; color: string }[] = [
  { code: 'riyadh', name: 'منطقة الرياض', color: regionColors.riyadh },
  { code: 'makkah', name: 'منطقة مكة المكرمة', color: regionColors.makkah },
  { code: 'eastern', name: 'المنطقة الشرقية', color: regionColors.eastern },
  { code: 'madinah', name: 'منطقة المدينة المنورة', color: regionColors.madinah },
  { code: 'qassim', name: 'منطقة القصيم', color: regionColors.qassim },
  { code: 'asir', name: 'منطقة عسير', color: regionColors.asir },
  { code: 'tabuk', name: 'منطقة تبوك', color: regionColors.tabuk },
  { code: 'jazan', name: 'منطقة جازان', color: regionColors.jazan },
  { code: 'hail', name: 'منطقة حائل', color: regionColors.hail },
  { code: 'najran', name: 'منطقة نجران', color: regionColors.najran },
  { code: 'jouf', name: 'منطقة الجوف', color: regionColors.jouf },
  { code: 'bahah', name: 'منطقة الباحة', color: regionColors.bahah },
  { code: 'northern-borders', name: 'منطقة الحدود الشمالية', color: regionColors['northern-borders'] },
];

export const regionNameByCode: Record<RegionCode, string> = Object.fromEntries(
  regionMeta.map((r) => [r.code, r.name]),
) as Record<RegionCode, string>;

// Per management direction, the program currently tracks only these 4 regions — every region
// filter and the overview map's data/interactivity is scoped to this set; the rest still render
// on the map (for geographic context) but inert/grayed-out, and never appear as filter options.
export const focusRegionCodes: RegionCode[] = ['eastern', 'riyadh', 'makkah', 'tabuk'];

export const focusRegionMeta = focusRegionCodes.map((code) => regionMeta.find((r) => r.code === code)!);

export const workshopTypeMeta: { key: WorkshopType; label: string; color: string; weight: number }[] = [
  { key: 'in-person', label: 'ورشة حضورية', color: 'var(--color-coral-red)', weight: 45 },
  { key: 'virtual', label: 'ورشة افتراضية', color: 'var(--color-teal)', weight: 35 },
  { key: 'masterclass', label: 'ماستر كلاس', color: 'var(--color-deep-red)', weight: 6 },
  { key: 'specialized', label: 'ورش متخصصة', color: 'var(--color-orange)', weight: 6 },
  { key: 'residency', label: 'إقامات فنية', color: 'var(--color-burgundy)', weight: 8 },
  { key: 'btl', label: 'ورشة BTL', color: 'var(--color-male)', weight: 14 },
];

export const workshopTypeLabel: Record<WorkshopType, string> = Object.fromEntries(
  workshopTypeMeta.map((t) => [t.key, t.label]),
) as Record<WorkshopType, string>;

// Management-set yearly target per workshop type — the "مسارات الورش التدريبية" card shows
// each type's actual progress against this goal instead of against how many happen to exist yet.
export const workshopTypeTarget: Record<WorkshopType, number> = {
  'in-person': 15,
  virtual: 20,
  masterclass: 2,
  specialized: 2,
  residency: 2,
  btl: 14,
};

// No default bound — the dashboard shows every workshop regardless of date until the user
// narrows it down via the date-range picker. A fixed calendar-month default would silently hide
// any workshop dated outside that window (this is exactly what happened when workshops with
// 2026 dates were added while the default was still pinned to August 2024).
export const defaultDateRange: { start: string | null; end: string | null } = { start: null, end: null };
