export const monthsAr = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
];

export function formatArabicDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${monthsAr[m - 1]} ${y}`;
}

export function formatDayMonth(iso: string): { day: string; month: string } {
  const [, m, d] = iso.split('-').map(Number);
  return { day: String(d).padStart(2, '0'), month: monthsAr[m - 1] };
}

export function formatRelativeTime(timestamp: number): string {
  const diffMs = Date.now() - timestamp;
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return 'الآن';
  if (minutes < 60) return `منذ ${minutes} دقيقة`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `منذ ${hours} ساعة`;
  const days = Math.round(hours / 24);
  return `منذ ${days} يوم`;
}
