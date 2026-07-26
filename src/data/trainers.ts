import type { WorkshopField, RegionCode, WorkshopType } from './workshops';

export type TrainerCategory = 'international' | 'local' | 'regional';

export interface TrainerNationality {
  code: string; // ISO 3166-1 alpha-2
  nameAr: string;
  category: TrainerCategory;
  flagIcon: string;
}

export const nationalities: TrainerNationality[] = [
  { code: 'SA', nameAr: 'السعودية', category: 'local', flagIcon: '/assets/flags/saudi-arabia.svg' },
  { code: 'EG', nameAr: 'مصر', category: 'regional', flagIcon: '/assets/flags/egypt.svg' },
  { code: 'JO', nameAr: 'الأردن', category: 'regional', flagIcon: '/assets/flags/jordan.svg' },
  { code: 'AE', nameAr: 'الإمارات', category: 'regional', flagIcon: '/assets/flags/united-arab-emirates.svg' },
  { code: 'KW', nameAr: 'الكويت', category: 'regional', flagIcon: '/assets/flags/kuwait.svg' },
  { code: 'QA', nameAr: 'قطر', category: 'regional', flagIcon: '/assets/flags/qatar.svg' },
  { code: 'BH', nameAr: 'البحرين', category: 'regional', flagIcon: '/assets/flags/bahrain.svg' },
  { code: 'OM', nameAr: 'عُمان', category: 'regional', flagIcon: '/assets/flags/oman.svg' },
  { code: 'MA', nameAr: 'المغرب', category: 'regional', flagIcon: '/assets/flags/morocco.svg' },
  { code: 'LB', nameAr: 'لبنان', category: 'regional', flagIcon: '/assets/flags/lebanon.svg' },
  { code: 'TN', nameAr: 'تونس', category: 'regional', flagIcon: '/assets/flags/tunisia.svg' },
  { code: 'IQ', nameAr: 'العراق', category: 'regional', flagIcon: '/assets/flags/iraq.svg' },
  { code: 'TH', nameAr: 'تايلاند', category: 'international', flagIcon: '/assets/flags/thailand.svg' },
  { code: 'BG', nameAr: 'بلغاريا', category: 'international', flagIcon: '/assets/flags/bulgaria.svg' },
  { code: 'RO', nameAr: 'رومانيا', category: 'international', flagIcon: '/assets/flags/romania.svg' },
  { code: 'DK', nameAr: 'الدنمارك', category: 'international', flagIcon: '/assets/flags/denmark.svg' },
  { code: 'CM', nameAr: 'الكاميرون', category: 'international', flagIcon: '/assets/flags/cameroon.svg' },
  { code: 'PT', nameAr: 'البرتغال', category: 'international', flagIcon: '/assets/flags/portugal.svg' },
  { code: 'KH', nameAr: 'كمبوديا', category: 'international', flagIcon: '/assets/flags/cambodia.svg' },
  { code: 'MN', nameAr: 'منغوليا', category: 'international', flagIcon: '/assets/flags/mongolia.svg' },
  { code: 'KR', nameAr: 'كوريا الجنوبية', category: 'international', flagIcon: '/assets/flags/south-korea.svg' },
  { code: 'FR', nameAr: 'فرنسا', category: 'international', flagIcon: '/assets/flags/france.svg' },
  { code: 'DE', nameAr: 'ألمانيا', category: 'international', flagIcon: '/assets/flags/germany.svg' },
  { code: 'GB', nameAr: 'المملكة المتحدة', category: 'international', flagIcon: '/assets/flags/united-kingdom.svg' },
  { code: 'US', nameAr: 'الولايات المتحدة', category: 'international', flagIcon: '/assets/flags/united-states-of-america.svg' },
  { code: 'IN', nameAr: 'الهند', category: 'international', flagIcon: '/assets/flags/india.svg' },
  { code: 'PH', nameAr: 'الفلبين', category: 'international', flagIcon: '/assets/flags/philippines.svg' },
  { code: 'ZA', nameAr: 'جنوب أفريقيا', category: 'international', flagIcon: '/assets/flags/south-africa.svg' },
  { code: 'BR', nameAr: 'البرازيل', category: 'international', flagIcon: '/assets/flags/brazil.svg' },
  { code: 'CA', nameAr: 'كندا', category: 'international', flagIcon: '/assets/flags/canada.svg' },
  { code: 'SN', nameAr: 'السنغال', category: 'international', flagIcon: '/assets/flags/senegal.svg' },
];

export const nationalityByCode: Record<string, TrainerNationality> = Object.fromEntries(
  nationalities.map((n) => [n.code, n]),
);

export const positions = [
  'مصور سينمائي',
  'مساعد المخرج',
  'مدير التصوير',
  'مدير الإنتاج',
  'مصمم الإضاءة',
  'محرر الفيلم',
  'مخرج',
  'كاتب سيناريو',
  'مصممة أزياء',
  'فنان مكياج',
  'مهندس صوت',
  'منتج منفذ',
  'مصمم مؤثرات بصرية',
  'رسام ستوري بورد',
  'مدير مواقع تصوير',
] as const;

export const companies = [
  'استوديوهات المملكة',
  'مؤسسة الإبداع السينمائي',
  'شركة الرؤية للإنتاج',
  'مجموعة الأفلام العربية',
  'استوديو الخليج الإبداعي',
  'دار الإنتاج الحديثة',
  'شركة سينماتك للإنتاج',
  'مؤسسة الصورة المتحركة',
  'استوديوهات نجد',
  'مجموعة إبداع ميديا',
  'استوديو الشرق للسينما',
  'شركة الإطار الذهبي',
  'مؤسسة الفن السابع',
  'استوديوهات المسار',
] as const;

export interface TrainerProject {
  title: string;
  year?: number;
  role: string;
  type?: string; // project category badge (e.g. "فيلم روائي") — not yet captured by the source data
  poster?: string | null;
}

export interface TrainerAward {
  title: string;
  year?: number;
  organization?: string;
}

export interface TrainerWorkshopRef {
  id: string;
  name: string;
  workshopType: WorkshopType;
  field: WorkshopField;
  year: number;
  city: string;
  region: RegionCode;
}

export interface Trainer {
  id: string;
  fullName: string;
  profileImage: string | null;
  position: string;
  nationality: string; // Arabic display name
  nationalityCode: string; // ISO alpha-2
  category: TrainerCategory;
  email: string;
  phone?: string;
  company?: string;
  biography?: string;
  experienceYears?: number;
  education?: string[];
  certifications?: string[];
  expertise?: string[];
  projects?: TrainerProject[];
  awards?: TrainerAward[];
  portfolioLinks?: string[];
  accounts?: string[]; // account/platform names the trainer is listed on (e.g. "IMDb", "LinkedIn") — names only, no URLs in the source data
  cvDocument?: string;
  passportDocument?: string;
  workshops: TrainerWorkshopRef[];
}

