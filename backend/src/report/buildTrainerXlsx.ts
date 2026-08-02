import * as fs from 'node:fs';
import * as path from 'node:path';
import PizZip from 'pizzip';
import { fileURLToPath } from 'node:url';
import { colLetter, textCell, numberCell } from './buildWorkshopXlsx.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATE_PATH = path.join(__dirname, '..', '..', 'templates', 'workshop-export-template.xlsx');

// Reuses the org's real workshop-export-template.xlsx purely as a *style donor* (Effra font,
// dark-navy/orange/gold fills, borders — the same visual identity as every other export in this
// app) since there's no dedicated trainer template. All 4 sheets are replaced with trainer-shaped
// content: one info-card sheet (same layout as buildWorkshopXlsx.ts's Sheet1) and three data-table
// sheets (same zebra-striped cell styles as its Sheet3, but without the Excel Table wrapper — none
// of the visual styling depends on the Table object, it's all plain cell styles plus worksheet-
// level conditional formatting, so the Table is safe to omit).

export interface TrainerInfoRow {
  label: string;
  value: string | number;
}

export interface TrainerExportPayload {
  trainerName: string;
  infoRows: TrainerInfoRow[];
  workshops: { name: string; type: string; field: string; year: string | number; city: string; region: string }[];
  projects: { title: string; year: string | number; role: string; type: string }[];
  awards: { title: string; year: string | number }[];
}

const P_ODD = { name: 3, text: 4, num: 5 };
const P_EVEN = { name: 7, text: 8, num: 9 };

const sheetHeader = (uid: string, dimension: string) =>
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" mc:Ignorable="x14ac xr xr2 xr3" xmlns:x14ac="http://schemas.microsoft.com/office/spreadsheetml/2009/9/ac" xmlns:xr="http://schemas.microsoft.com/office/spreadsheetml/2014/revision" xmlns:xr2="http://schemas.microsoft.com/office/spreadsheetml/2015/revision2" xmlns:xr3="http://schemas.microsoft.com/office/spreadsheetml/2016/revision3" xr:uid="${uid}">` +
  `<dimension ref="${dimension}"/>`;

// --- Sheet 1: بطاقة معلومات المدرب — same layout as buildWorkshopXlsx.ts's Sheet1, row count driven by data. ---

function buildInfoSheet(payload: TrainerExportPayload): string {
  const lastRow = payload.infoRows.length + 3;
  const header =
    sheetHeader('{00000000-0001-0000-0000-000000000000}', `A1:B${lastRow}`) +
    '<sheetViews><sheetView showGridLines="0" rightToLeft="1" tabSelected="1" workbookViewId="0"><selection activeCell="B4" sqref="B4"/></sheetView></sheetViews>' +
    '<sheetFormatPr defaultRowHeight="19.5" x14ac:dyDescent="0.7"/>' +
    '<cols><col min="1" max="1" width="25" style="1" customWidth="1"/><col min="2" max="2" width="71.6640625" style="1" customWidth="1"/><col min="3" max="16384" width="8.6640625" style="1"/></cols>' +
    '<sheetData>';

  const row1 = `<row r="1" spans="1:2" ht="40" customHeight="1" x14ac:dyDescent="0.7">${textCell('A1', 22, payload.trainerName)}<c r="B1" s="22"/></row>`;
  const row2 = `<row r="2" spans="1:2" ht="24" customHeight="1" x14ac:dyDescent="0.7">${textCell('A2', 23, 'بطاقة معلومات المدرب')}<c r="B2" s="23"/></row>`;
  const row3 = `<row r="3" spans="1:2" ht="26" customHeight="1" x14ac:dyDescent="0.7">${textCell('A3', 11, 'الحقل')}${textCell('B3', 11, 'القيمة')}</row>`;

  const dataRows = payload.infoRows
    .map((row, i) => {
      const r = i + 4;
      const isLast = i === payload.infoRows.length - 1; // نبذة مهنية — same taller row treatment as the workshop template's "الوصف" row
      const heightAttr = isLast ? ' ht="39"' : '';
      const valueCell = typeof row.value === 'number' ? numberCell(`B${r}`, 17, row.value) : textCell(`B${r}`, 16, String(row.value));
      return `<row r="${r}" spans="1:2"${heightAttr} x14ac:dyDescent="0.7">${textCell(`A${r}`, 15, row.label)}${valueCell}</row>`;
    })
    .join('');

  const footer =
    '</sheetData><mergeCells count="2"><mergeCell ref="A1:B1"/><mergeCell ref="A2:B2"/></mergeCells>' +
    '<pageMargins left="0.7" right="0.7" top="0.75" bottom="0.75" header="0.3" footer="0.3"/></worksheet>';

  return header + row1 + row2 + row3 + dataRows + footer;
}

// --- Table sheets (الورش المسندة / الأعمال والمشاريع / الجوائز والترشيحات) — same zebra cell
// styles as buildWorkshopXlsx.ts's participants table, without the Excel Table wrapper. ---

function buildTableSheet(opts: {
  uid: string;
  title: string;
  headers: string[];
  colWidths: number[];
  rows: (string | number)[][];
}): string {
  const lastCol = colLetter(opts.headers.length);
  const lastRow = opts.rows.length + 2;

  const cols = opts.colWidths
    .map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" style="1" customWidth="1"/>`)
    .join('');

  const header =
    sheetHeader(opts.uid, `A1:${lastCol}${lastRow}`) +
    '<sheetViews><sheetView showGridLines="0" rightToLeft="1" workbookViewId="0"><selection activeCell="A1" sqref="A1"/></sheetView></sheetViews>' +
    '<sheetFormatPr defaultRowHeight="19.5" x14ac:dyDescent="0.7"/>' +
    `<cols>${cols}<col min="${opts.headers.length + 1}" max="16384" width="8.6640625" style="1"/></cols>` +
    '<sheetData>';

  const titleCells = Array.from({ length: opts.headers.length - 1 }, (_, i) => `<c r="${colLetter(i + 2)}1" s="24"/>`).join('');
  const row1 = `<row r="1" spans="1:${opts.headers.length}" ht="34" customHeight="1" x14ac:dyDescent="0.7">${textCell('A1', 24, opts.title)}${titleCells}</row>`;
  const row2 = `<row r="2" spans="1:${opts.headers.length}" ht="26" customHeight="1" x14ac:dyDescent="0.7">${opts.headers.map((h, i) => textCell(`${colLetter(i + 1)}2`, 2, h)).join('')}</row>`;

  const dataRows =
    opts.rows.length === 0
      ? ''
      : opts.rows
          .map((row, i) => {
            const r = i + 3;
            const s = i % 2 === 0 ? P_ODD : P_EVEN;
            const cells = row
              .map((value, ci) => {
                const ref = `${colLetter(ci + 1)}${r}`;
                if (typeof value === 'number') return numberCell(ref, s.num, value);
                return textCell(ref, ci === 0 ? s.name : s.text, String(value));
              })
              .join('');
            return `<row r="${r}" spans="1:${opts.headers.length}" x14ac:dyDescent="0.7">${cells}</row>`;
          })
          .join('');

  const footer =
    `</sheetData><mergeCells count="1"><mergeCell ref="A1:${lastCol}1"/></mergeCells>` +
    '<pageMargins left="0.7" right="0.7" top="0.75" bottom="0.75" header="0.3" footer="0.3"/></worksheet>';

  return header + row1 + row2 + dataRows + footer;
}

const SHEET_NAMES = ['معلومات الورشة', 'الإحصائيات', 'المشاركين', 'سجل الحضور'];
const TRAINER_SHEET_NAMES = ['معلومات المدرب', 'الورش المسندة', 'الأعمال والمشاريع', 'الجوائز والترشيحات'];

export async function buildTrainerXlsx(payload: TrainerExportPayload): Promise<Buffer> {
  const templateBuffer = await fs.promises.readFile(TEMPLATE_PATH);
  const zip = new PizZip(templateBuffer);

  zip.file('xl/worksheets/sheet1.xml', buildInfoSheet(payload));
  zip.file(
    'xl/worksheets/sheet2.xml',
    buildTableSheet({
      uid: '{00000000-0001-0000-0100-000000000000}',
      title: 'الورش المسندة',
      headers: ['اسم الورشة', 'النوع', 'المجال', 'السنة', 'المدينة', 'المنطقة'],
      colWidths: [30, 18, 22, 10, 16, 18],
      rows: payload.workshops.map((w) => [w.name, w.type, w.field, w.year, w.city, w.region]),
    }),
  );
  zip.file(
    'xl/worksheets/sheet3.xml',
    buildTableSheet({
      uid: '{00000000-0001-0000-0200-000000000000}',
      title: 'الأعمال والمشاريع',
      headers: ['العنوان', 'السنة', 'الدور', 'النوع'],
      colWidths: [30, 10, 22, 18],
      rows: payload.projects.map((p) => [p.title, p.year, p.role, p.type]),
    }),
  );
  zip.file(
    'xl/worksheets/sheet4.xml',
    buildTableSheet({
      uid: '{00000000-0001-0000-0300-000000000000}',
      title: 'الجوائز والترشيحات',
      headers: ['الجائزة', 'السنة'],
      colWidths: [50, 10],
      rows: payload.awards.map((a) => [a.title, a.year]),
    }),
  );

  // Neither the info sheet nor the 3 table sheets use an Excel Table object (see file header
  // comment), so the template's original 2 Excel Tables (tied to its old sheet3/sheet4) and
  // calcChain are now all dangling references — drop them and their part relationships.
  zip.remove('xl/tables/table1.xml');
  zip.remove('xl/tables/table2.xml');
  zip.remove('xl/worksheets/_rels/sheet3.xml.rels');
  zip.remove('xl/worksheets/_rels/sheet4.xml.rels');
  zip.remove('xl/calcChain.xml');

  const workbook = zip.file('xl/workbook.xml')?.asText();
  if (workbook) {
    let next = workbook;
    SHEET_NAMES.forEach((oldName, i) => {
      next = next.replace(`name="${oldName}"`, `name="${TRAINER_SHEET_NAMES[i]}"`);
    });
    zip.file('xl/workbook.xml', next);
  }

  const workbookRels = zip.file('xl/_rels/workbook.xml.rels')?.asText();
  if (workbookRels) {
    zip.file('xl/_rels/workbook.xml.rels', workbookRels.replace(/<Relationship Id="rId8"[^>]*\/>/, ''));
  }

  const contentTypes = zip.file('[Content_Types].xml')?.asText();
  if (contentTypes) {
    zip.file(
      '[Content_Types].xml',
      contentTypes
        .replace('<Override PartName="/xl/tables/table1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.table+xml"/>', '')
        .replace('<Override PartName="/xl/tables/table2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.table+xml"/>', '')
        .replace('<Override PartName="/xl/calcChain.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.calcChain+xml"/>', ''),
    );
  }

  const appProps = zip.file('docProps/app.xml')?.asText();
  if (appProps) {
    let next = appProps;
    SHEET_NAMES.forEach((oldName, i) => {
      next = next.replace(`<vt:lpstr>${oldName}</vt:lpstr>`, `<vt:lpstr>${TRAINER_SHEET_NAMES[i]}</vt:lpstr>`);
    });
    zip.file('docProps/app.xml', next);
  }

  return zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' });
}
