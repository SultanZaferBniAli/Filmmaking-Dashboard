import * as fs from 'node:fs';
import * as path from 'node:path';
import PizZip from 'pizzip';
import { fileURLToPath } from 'node:url';
import { colLetter, formulaCell, numberCell, textCell } from './buildWorkshopXlsx.js';
import type { GenderCount, WorkshopInfoRow } from './buildWorkshopXlsx.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATE_PATH = path.join(__dirname, '..', '..', 'templates', 'workshop-export-template.xlsx');

// Same template as buildWorkshopXlsx.ts, but instead of one workshop per workbook, every workshop
// gets its own column-band ("block") on each sheet, placed next to its neighbours left-to-right
// (RTL sheet, so block 0 sits at the rightmost columns visually) with a 1-column spacer between
// blocks and its own title row on top. The 4th sheet (سجل الحضور / per-session attendance) is
// dropped entirely — the participants sheet already shows attended/missed per person, so a
// session-by-session grid isn't needed here — and along with it its Excel Table (table2.xml) and
// the participants sheet's own Excel Table (table1.xml): a single sheet can only hold one
// <tableParts> list per worksheet part in a straightforward way, and since none of the visual
// styling (header/zebra fills, the نعم/لا conditional formatting) actually depends on the Table
// object — it's all plain cell styles (see styles.xml cellXfs) plus worksheet-level
// <conditionalFormatting>, both reproduced here per block — the Tables are safe to omit.

export interface WorkshopBlockPayload {
  workshopName: string;
  infoRows: WorkshopInfoRow[]; // exactly 27 rows, same order as buildWorkshopXlsx's single-workshop export
  stats: {
    registrations: GenderCount;
    accepted: GenderCount;
    attendance: GenderCount;
    actualAttendance: GenderCount;
    ratingCounts: [number, number, number, number, number];
  };
  participants: {
    name: string;
    phone: string;
    email: string;
    department: string;
    attended: number;
    missed: number;
    eligible: boolean;
  }[];
}

export interface AllWorkshopsExportPayload {
  workshops: WorkshopBlockPayload[];
}

const P_ODD = { name: 3, text: 4, num: 5, formula: 6 };
const P_EVEN = { name: 7, text: 8, num: 9, formula: 10 };

interface Block {
  startCol: number; // 1-indexed
}

function blocks(count: number, dataCols: number): Block[] {
  return Array.from({ length: count }, (_, i) => ({ startCol: i * (dataCols + 1) + 1 }));
}

function lastDataCol(count: number, dataCols: number): number {
  return (count - 1) * (dataCols + 1) + dataCols;
}

function colsXml(count: number, dataCols: number, widths: number[]): string {
  const parts: string[] = [];
  for (let i = 0; i < count; i++) {
    const startCol = i * (dataCols + 1) + 1;
    for (let c = 0; c < dataCols; c++) {
      const col = startCol + c;
      parts.push(`<col min="${col}" max="${col}" width="${widths[c]}" style="1" customWidth="1"/>`);
    }
    if (i < count - 1) {
      const spacer = startCol + dataCols;
      parts.push(`<col min="${spacer}" max="${spacer}" width="3" style="1" customWidth="1"/>`);
    }
  }
  const tailStart = lastDataCol(count, dataCols) + 1;
  parts.push(`<col min="${tailStart}" max="16384" width="8.6640625" style="1"/>`);
  return `<cols>${parts.join('')}</cols>`;
}

const rowHeader =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" mc:Ignorable="x14ac xr xr2 xr3" xmlns:x14ac="http://schemas.microsoft.com/office/spreadsheetml/2009/9/ac" xmlns:xr="http://schemas.microsoft.com/office/spreadsheetml/2014/revision" xmlns:xr2="http://schemas.microsoft.com/office/spreadsheetml/2015/revision2" xmlns:xr3="http://schemas.microsoft.com/office/spreadsheetml/2016/revision3"';

// --- Sheet 1: معلومات الورشة — one 2-column (label/value) block per workshop, rows 1-30 fixed. ---

function buildSheet1All(payload: AllWorkshopsExportPayload): string {
  const n = payload.workshops.length;
  const lastCol = lastDataCol(n, 2);
  const bs = blocks(n, 2);

  const header =
    `${rowHeader} xr:uid="{00000000-0001-0000-0000-000000000000}">` +
    `<dimension ref="A1:${colLetter(lastCol)}30"/>` +
    '<sheetViews><sheetView showGridLines="0" rightToLeft="1" tabSelected="1" workbookViewId="0"><selection activeCell="A1" sqref="A1"/></sheetView></sheetViews>' +
    '<sheetFormatPr defaultRowHeight="19.5" x14ac:dyDescent="0.7"/>' +
    colsXml(n, 2, [25, 71.6640625]) +
    '<sheetData>';

  const rows: string[] = [];

  const titleCells = bs
    .map((b, wi) => `${textCell(`${colLetter(b.startCol)}1`, 22, payload.workshops[wi].workshopName)}<c r="${colLetter(b.startCol + 1)}1" s="22"/>`)
    .join('');
  rows.push(`<row r="1" spans="1:${lastCol}" ht="40" customHeight="1" x14ac:dyDescent="0.7">${titleCells}</row>`);

  const subtitleCells = bs
    .map((b) => `${textCell(`${colLetter(b.startCol)}2`, 23, 'بطاقة معلومات الورشة')}<c r="${colLetter(b.startCol + 1)}2" s="23"/>`)
    .join('');
  rows.push(`<row r="2" spans="1:${lastCol}" ht="24" customHeight="1" x14ac:dyDescent="0.7">${subtitleCells}</row>`);

  const headerCells = bs
    .map((b) => `${textCell(`${colLetter(b.startCol)}3`, 11, 'الحقل')}${textCell(`${colLetter(b.startCol + 1)}3`, 11, 'القيمة')}`)
    .join('');
  rows.push(`<row r="3" spans="1:${lastCol}" ht="26" customHeight="1" x14ac:dyDescent="0.7">${headerCells}</row>`);

  for (let i = 0; i < 27; i++) {
    const r = i + 4;
    const heightAttr = r === 24 ? ' ht="39"' : '';
    const cells = bs
      .map((b, wi) => {
        const row = payload.workshops[wi].infoRows[i];
        const valueCell = typeof row.value === 'number' ? numberCell(`${colLetter(b.startCol + 1)}${r}`, 17, row.value) : textCell(`${colLetter(b.startCol + 1)}${r}`, 16, String(row.value));
        return `${textCell(`${colLetter(b.startCol)}${r}`, 15, row.label)}${valueCell}`;
      })
      .join('');
    rows.push(`<row r="${r}" spans="1:${lastCol}"${heightAttr} x14ac:dyDescent="0.7">${cells}</row>`);
  }

  const merges = bs.flatMap((b) => [`<mergeCell ref="${colLetter(b.startCol)}1:${colLetter(b.startCol + 1)}1"/>`, `<mergeCell ref="${colLetter(b.startCol)}2:${colLetter(b.startCol + 1)}2"/>`]);

  const footer =
    `</sheetData><mergeCells count="${merges.length}">${merges.join('')}</mergeCells>` +
    '<pageMargins left="0.7" right="0.7" top="0.75" bottom="0.75" header="0.3" footer="0.3"/></worksheet>';

  return header + rows.join('') + footer;
}

// --- Sheet 2: الإحصائيات — one 4-column block per workshop, rows 1-15 fixed. ---

function buildSheet2All(payload: AllWorkshopsExportPayload): string {
  const n = payload.workshops.length;
  const lastCol = lastDataCol(n, 4);
  const bs = blocks(n, 4);

  const header =
    `${rowHeader} xr:uid="{00000000-0001-0000-0100-000000000000}">` +
    `<dimension ref="A1:${colLetter(lastCol)}15"/>` +
    '<sheetViews><sheetView showGridLines="0" rightToLeft="1" workbookViewId="0"><selection activeCell="A1" sqref="A1"/></sheetView></sheetViews>' +
    '<sheetFormatPr defaultRowHeight="19.5" x14ac:dyDescent="0.7"/>' +
    colsXml(n, 4, [28.33203125, 18.33203125, 18.33203125, 18.33203125]) +
    '<sheetData>';

  const rows: string[] = [];
  const blank = (ref: string) => `<c r="${ref}" s="1" t="inlineStr"><is><t></t></is></c>`;

  const titleCells = bs
    .map((b, wi) => {
      const [c1, c2, c3, c4] = [b.startCol, b.startCol + 1, b.startCol + 2, b.startCol + 3].map(colLetter);
      return `${textCell(`${c1}1`, 24, payload.workshops[wi].workshopName)}<c r="${c2}1" s="24"/><c r="${c3}1" s="24"/><c r="${c4}1" s="24"/>`;
    })
    .join('');
  rows.push(`<row r="1" spans="1:${lastCol}" ht="34" customHeight="1" x14ac:dyDescent="0.7">${titleCells}</row>`);

  const headerCells = bs
    .map((b) => {
      const [c1, c2, c3, c4] = [b.startCol, b.startCol + 1, b.startCol + 2, b.startCol + 3].map(colLetter);
      return `${textCell(`${c1}2`, 11, 'البيان')}${textCell(`${c2}2`, 11, 'ذكور')}${textCell(`${c3}2`, 11, 'إناث')}${textCell(`${c4}2`, 11, 'الإجمالي')}`;
    })
    .join('');
  rows.push(`<row r="2" spans="1:${lastCol}" x14ac:dyDescent="0.7">${headerCells}</row>`);

  function genderRow(r: number, label: string, pick: (w: WorkshopBlockPayload) => GenderCount): string {
    const cells = bs
      .map((b, wi) => {
        const [c1, c2, c3, c4] = [b.startCol, b.startCol + 1, b.startCol + 2, b.startCol + 3].map(colLetter);
        const count = pick(payload.workshops[wi]);
        return (
          textCell(`${c1}${r}`, 12, label) +
          numberCell(`${c2}${r}`, 13, count.male) +
          numberCell(`${c3}${r}`, 13, count.female) +
          formulaCell(`${c4}${r}`, 14, `${c2}${r}+${c3}${r}`, count.male + count.female)
        );
      })
      .join('');
    return `<row r="${r}" spans="1:${lastCol}" x14ac:dyDescent="0.7">${cells}</row>`;
  }

  rows.push(genderRow(3, 'إجمالي التسجيلات', (w) => w.stats.registrations));
  rows.push(genderRow(4, 'المقبولون', (w) => w.stats.accepted));
  rows.push(genderRow(5, 'الحضور ', (w) => w.stats.attendance));
  rows.push(genderRow(6, 'الحضور الفعلي', (w) => w.stats.actualAttendance));

  const row8Cells = bs
    .map((b) => {
      const [c1, c2, c3, c4] = [b.startCol, b.startCol + 1, b.startCol + 2, b.startCol + 3].map(colLetter);
      return `${textCell(`${c1}8`, 11, 'تقيم الورشة')}${textCell(`${c2}8`, 11, 'عدد التقييمات')}${blank(`${c3}8`)}${blank(`${c4}8`)}`;
    })
    .join('');
  rows.push(`<row r="8" spans="1:${lastCol}" x14ac:dyDescent="0.7">${row8Cells}</row>`);

  const ratingLabels = ['5 نجوم', '4 نجوم', '3 نجوم', '2 نجوم', '1 نجمة'];
  for (let i = 0; i < 5; i++) {
    const r = 9 + i;
    const cells = bs
      .map((b, wi) => {
        const [c1, c2, c3, c4] = [b.startCol, b.startCol + 1, b.startCol + 2, b.startCol + 3].map(colLetter);
        return `${textCell(`${c1}${r}`, 12, ratingLabels[i])}${numberCell(`${c2}${r}`, 13, payload.workshops[wi].stats.ratingCounts[i])}${blank(`${c3}${r}`)}${blank(`${c4}${r}`)}`;
      })
      .join('');
    rows.push(`<row r="${r}" spans="1:${lastCol}" x14ac:dyDescent="0.7">${cells}</row>`);
  }

  const row14Cells = bs
    .map((b) => {
      const [c1, c2, c3, c4] = [b.startCol, b.startCol + 1, b.startCol + 2, b.startCol + 3].map(colLetter);
      return `${textCell(`${c1}14`, 18, 'متوسط التقييم')}<c r="${c2}14" s="19"><f>SUMPRODUCT({5;4;3;2;1},${c2}9:${c2}13)/${c2}15</f></c>${blank(`${c3}14`)}${blank(`${c4}14`)}`;
    })
    .join('');
  rows.push(`<row r="14" spans="1:${lastCol}" x14ac:dyDescent="0.7">${row14Cells}</row>`);

  const row15Cells = bs
    .map((b) => {
      const [c1, c2, c3, c4] = [b.startCol, b.startCol + 1, b.startCol + 2, b.startCol + 3].map(colLetter);
      return `${textCell(`${c1}15`, 20, 'إجمالي عدد التقييمات')}<c r="${c2}15" s="21"><f>SUM(${c2}9:${c2}13)</f></c>${blank(`${c3}15`)}${blank(`${c4}15`)}`;
    })
    .join('');
  rows.push(`<row r="15" spans="1:${lastCol}" x14ac:dyDescent="0.7">${row15Cells}</row>`);

  const merges = bs.map((b) => `<mergeCell ref="${colLetter(b.startCol)}1:${colLetter(b.startCol + 3)}1"/>`);

  const footer =
    `</sheetData><mergeCells count="${merges.length}">${merges.join('')}</mergeCells>` +
    '<pageMargins left="0.7" right="0.7" top="0.75" bottom="0.75" header="0.3" footer="0.3"/></worksheet>';

  return header + rows.join('') + footer;
}

// --- Sheet 3: المشاركين — one 8-column block per workshop; row extent varies per block
// (each workshop has its own participant count), so rows are assembled per-row across all blocks
// rather than per-block. No Excel Table wrapper (see file header comment) — plain cell styles +
// a per-block <conditionalFormatting> range reproduce the template's look exactly. ---

function buildSheet3All(payload: AllWorkshopsExportPayload): string {
  const n = payload.workshops.length;
  const lastCol = lastDataCol(n, 8);
  const bs = blocks(n, 8);
  const blockLastRow = payload.workshops.map((w) => w.participants.length + 2);
  const maxRow = Math.max(2, ...blockLastRow);

  const header =
    `${rowHeader} xr:uid="{00000000-0001-0000-0200-000000000000}">` +
    `<dimension ref="A1:${colLetter(lastCol)}${maxRow}"/>` +
    '<sheetViews><sheetView showGridLines="0" rightToLeft="1" workbookViewId="0"><selection activeCell="A1" sqref="A1"/></sheetView></sheetViews>' +
    '<sheetFormatPr defaultRowHeight="19.5" x14ac:dyDescent="0.7"/>' +
    colsXml(n, 8, [22, 16, 26, 18, 13, 13, 13, 14]) +
    '<sheetData>';

  const rows: string[] = [];
  const headers = ['الاسم', 'الهاتف', 'البريد الإلكتروني', 'القسم', 'عدد الحضور', 'عدد الغياب', 'نسبة الحضور', 'مؤهل للشهادة'];

  const titleCells = bs
    .map((b, wi) => {
      const cols = Array.from({ length: 8 }, (_, i) => colLetter(b.startCol + i));
      return `${textCell(`${cols[0]}1`, 24, payload.workshops[wi].workshopName)}${cols.slice(1).map((c) => `<c r="${c}1" s="24"/>`).join('')}`;
    })
    .join('');
  rows.push(`<row r="1" spans="1:${lastCol}" ht="34" customHeight="1" x14ac:dyDescent="0.7">${titleCells}</row>`);

  const headerCells = bs
    .map((b) => {
      const cols = Array.from({ length: 8 }, (_, i) => colLetter(b.startCol + i));
      return headers.map((h, i) => textCell(`${cols[i]}2`, 2, h)).join('');
    })
    .join('');
  rows.push(`<row r="2" spans="1:${lastCol}" ht="26" customHeight="1" x14ac:dyDescent="0.7">${headerCells}</row>`);

  for (let r = 3; r <= maxRow; r++) {
    const cells = bs
      .map((b, wi) => {
        const idx = r - 3;
        if (idx >= payload.workshops[wi].participants.length) return '';
        const p = payload.workshops[wi].participants[idx];
        const s = idx % 2 === 0 ? P_ODD : P_EVEN;
        const cols = Array.from({ length: 8 }, (_, i) => colLetter(b.startCol + i));
        const pct = p.attended + p.missed > 0 ? p.attended / (p.attended + p.missed) : 0;
        return (
          textCell(`${cols[0]}${r}`, s.name, p.name) +
          textCell(`${cols[1]}${r}`, s.text, p.phone) +
          textCell(`${cols[2]}${r}`, s.text, p.email) +
          textCell(`${cols[3]}${r}`, s.text, p.department) +
          numberCell(`${cols[4]}${r}`, s.num, p.attended) +
          numberCell(`${cols[5]}${r}`, s.num, p.missed) +
          formulaCell(`${cols[6]}${r}`, s.formula, `IFERROR(${cols[4]}${r}/(${cols[4]}${r}+${cols[5]}${r}),0)`, pct) +
          textCell(`${cols[7]}${r}`, s.num, p.eligible ? 'نعم' : 'لا')
        );
      })
      .join('');
    if (cells) rows.push(`<row r="${r}" spans="1:${lastCol}" x14ac:dyDescent="0.7">${cells}</row>`);
  }

  const merges = bs.map((b) => `<mergeCell ref="${colLetter(b.startCol)}1:${colLetter(b.startCol + 7)}1"/>`);
  const condFormats = bs
    .map((b, wi) => {
      if (blockLastRow[wi] <= 2) return '';
      const col = colLetter(b.startCol + 7);
      const first = `${col}3`;
      return (
        `<conditionalFormatting sqref="${col}3:${col}${blockLastRow[wi]}">` +
        `<cfRule type="containsText" dxfId="3" priority="1" operator="containsText" text="نعم"><formula>NOT(ISERROR(SEARCH("نعم",${first})))</formula></cfRule>` +
        `<cfRule type="containsText" dxfId="2" priority="2" operator="containsText" text="لا"><formula>NOT(ISERROR(SEARCH("لا",${first})))</formula></cfRule>` +
        '</conditionalFormatting>'
      );
    })
    .join('');

  const footer =
    `</sheetData><mergeCells count="${merges.length}">${merges.join('')}</mergeCells>${condFormats}` +
    '<pageMargins left="0.7" right="0.7" top="0.75" bottom="0.75" header="0.3" footer="0.3"/></worksheet>';

  return header + rows.join('') + footer;
}

export async function buildAllWorkshopsXlsx(payload: AllWorkshopsExportPayload): Promise<Buffer> {
  const templateBuffer = await fs.promises.readFile(TEMPLATE_PATH);
  const zip = new PizZip(templateBuffer);

  zip.file('xl/worksheets/sheet1.xml', buildSheet1All(payload));
  zip.file('xl/worksheets/sheet2.xml', buildSheet2All(payload));
  zip.file('xl/worksheets/sheet3.xml', buildSheet3All(payload));

  // Drop the 4th sheet (سجل الحضور) and both Excel Tables — see file header comment — plus
  // calcChain.xml, same reasoning as buildWorkshopXlsx.ts (it would reference cells that no
  // longer hold the template's original formulas).
  zip.remove('xl/worksheets/sheet4.xml');
  zip.remove('xl/worksheets/_rels/sheet3.xml.rels');
  zip.remove('xl/worksheets/_rels/sheet4.xml.rels');
  zip.remove('xl/tables/table1.xml');
  zip.remove('xl/tables/table2.xml');
  zip.remove('xl/calcChain.xml');

  const workbook = zip.file('xl/workbook.xml')?.asText();
  if (workbook) {
    zip.file('xl/workbook.xml', workbook.replace(/<sheet name="سجل الحضور" sheetId="4" r:id="rId4"\/>/, ''));
  }

  const workbookRels = zip.file('xl/_rels/workbook.xml.rels')?.asText();
  if (workbookRels) {
    zip.file(
      'xl/_rels/workbook.xml.rels',
      workbookRels.replace(/<Relationship Id="rId4"[^>]*\/>/, '').replace(/<Relationship Id="rId8"[^>]*\/>/, ''),
    );
  }

  // docProps/app.xml's HeadingPairs/TitlesOfParts still claim 4 worksheets including the dropped
  // "سجل الحضور" sheet — stale metadata Excel doesn't strictly need, but leaving the count
  // mismatched against the actual 3 sheets risks a "repair this file?" prompt on open.
  const appProps = zip.file('docProps/app.xml')?.asText();
  if (appProps) {
    zip.file(
      'docProps/app.xml',
      appProps
        .replace('<vt:variant><vt:i4>4</vt:i4></vt:variant>', '<vt:variant><vt:i4>3</vt:i4></vt:variant>')
        .replace('<vt:vector size="4" baseType="lpstr"><vt:lpstr>معلومات الورشة</vt:lpstr><vt:lpstr>الإحصائيات</vt:lpstr><vt:lpstr>المشاركين</vt:lpstr><vt:lpstr>سجل الحضور</vt:lpstr></vt:vector>', '<vt:vector size="3" baseType="lpstr"><vt:lpstr>معلومات الورشة</vt:lpstr><vt:lpstr>الإحصائيات</vt:lpstr><vt:lpstr>المشاركين</vt:lpstr></vt:vector>'),
    );
  }

  const contentTypes = zip.file('[Content_Types].xml')?.asText();
  if (contentTypes) {
    zip.file(
      '[Content_Types].xml',
      contentTypes
        .replace('<Override PartName="/xl/worksheets/sheet4.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>', '')
        .replace('<Override PartName="/xl/tables/table1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.table+xml"/>', '')
        .replace('<Override PartName="/xl/tables/table2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.table+xml"/>', '')
        .replace('<Override PartName="/xl/calcChain.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.calcChain+xml"/>', ''),
    );
  }

  return zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' });
}
