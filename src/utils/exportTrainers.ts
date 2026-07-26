import * as XLSX from 'xlsx';
import type { Trainer } from '../data/trainers';

const categoryLabel: Record<Trainer['category'], string> = {
  local: 'محلي',
  regional: 'إقليمي',
  international: 'دولي',
};

const headers = [
  'اسم المدرب',
  'المسمى الوظيفي',
  'الجنسية',
  'فئة المدرب',
  'البريد الإلكتروني',
  'اسم الورشة',
  'مجال الورشة',
  'سنة الورشة',
  'مدينة/منطقة الورشة',
  'الجهة/الشركة',
];

function trainerRows(t: Trainer): (string | number)[][] {
  const base = [t.fullName, t.position, t.nationality, categoryLabel[t.category], t.email];
  const company = t.company ?? '';
  if (t.workshops.length === 0) {
    return [[...base, '', '', '', '', company]];
  }
  return t.workshops.map((w) => [...base, w.name, w.field, w.year, `${w.city}`, company]);
}

export function exportTrainersToExcel(trainers: Trainer[], filename?: string) {
  const rows = [headers, ...trainers.flatMap((t) => trainerRows(t))];
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  sheet['!cols'] = headers.map(() => ({ wch: 20 }));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, 'المدربون');
  const today = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(workbook, filename ?? `trainers-season-5-${today}.xlsx`);
}
