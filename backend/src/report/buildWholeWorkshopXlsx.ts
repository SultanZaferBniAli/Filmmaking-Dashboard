import * as fs from 'node:fs';
import * as path from 'node:path';
import PizZip from 'pizzip';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { colLetter, escapeXml, formulaCell, numberCell, textCell } from './buildWorkshopXlsx.js';
import type { GenderCount, WorkshopInfoRow } from './buildWorkshopXlsx.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATE_PATH = path.join(__dirname, '..', '..', 'templates', 'whole-workshop-template.xlsx');

// Reproduces the user's "Whole Workshop Template.xlsx" exactly (see backend/templates/
// whole-workshop-template.xlsx): sheet 1 "الورشات" and sheet 2 "الإحصائيات" are real Excel Tables
// with one ROW per workshop (unlike the old buildAllWorkshopsXlsx.ts, which placed one COLUMN-band
// per workshop) — sheet 1's summary columns are live formulas reading back from sheet 2, and sheet
// 2's name column is a live formula reading from sheet 1, exactly as the template wires them. Sheet
// 3 onward is one full "المشاركين" sheet per workshop (no Table — same plain-cell zebra styling as
// buildAllWorkshopsXlsx.ts used), since the template only ships a single-workshop-shaped example of
// that sheet.

export interface WorkshopRowPayload {
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

export interface WholeWorkshopExportPayload {
  workshops: WorkshopRowPayload[];
}

const SHEET1_ROW1 =
  '<row r="1" spans="1:29" ht="34" customHeight="1" x14ac:dyDescent="0.35">' +
  `${textCell('A1', 12, 'ورش العمل')}${Array.from({ length: 28 }, (_, i) => `<c r="${colLetter(i + 2)}1" s="12"/>`).join('')}</row>`;

const SHEET1_HEADERS = [
  'اسم الورشة',
  'نوع الورشة',
  'المجال',
  'الحالة',
  'المنطقة',
  'المدينة',
  'تاريخ البداية',
  'تاريخ النهاية',
  'المدرب',
  'جنسية المدرب',
  'نبذة عن المدرب',
  'المستوى',
  'اللغة',
  'طريقة الحضور',
  'اسم الموقع',
  'رابط الموقع',
  'منصة الاجتماع',
  'رابط الاجتماع',
  'السعة',
  'عدد المسجلين',
  'الوصف',
  'الأهداف',
  'تاريخ الإعلان',
  'تاريخ آخر تحديث',
  'إجمالي التسجيلات',
  'المقبولون',
  'الحضور الفعلي',
  'متوسط التقييم',
  'إجمالي عدد التقييمات',
];

// column -> header-row style id, matching row 2 of the template exactly (A=13, B-X=14, Y-AB=15, AC=16)
const SHEET1_HEADER_STYLE = (i: number): number => (i === 0 ? 13 : i < 24 ? 14 : i < 28 ? 15 : 16);

const SHEET1_ROW2 = `<row r="2" spans="1:29" ht="25.5" customHeight="1" x14ac:dyDescent="0.35">${SHEET1_HEADERS.map((h, i) => textCell(`${colLetter(i + 1)}2`, SHEET1_HEADER_STYLE(i), h)).join('')}</row>`;

// column -> cell style id, matching row 3 of the template's sample workshop exactly
const SHEET1_STYLE = [17, 18, 18, 18, 18, 18, 24, 24, 18, 18, 18, 18, 18, 18, 18, 18, 18, 18, 19, 19, 18, 23, 18, 18, 20, 20, 20, 21, 22];

function buildSheet1Row(payload: WorkshopRowPayload, r: number): string {
  // infoRows[0..21] (اسم الورشة..الأهداف) + infoRows[25..26] (تاريخ الإعلان/تحديث) — skips the 3
  // free-text notes fields (indices 22-24) that this template's summary table has no room for.
  const values: (string | number)[] = [...payload.infoRows.slice(0, 22).map((row) => row.value), ...payload.infoRows.slice(25, 27).map((row) => row.value)];

  const { registrations, accepted, actualAttendance, ratingCounts } = payload.stats;
  const totalRatings = ratingCounts.reduce((a, b) => a + b, 0);
  const avgRating = totalRatings > 0 ? (5 * ratingCounts[0] + 4 * ratingCounts[1] + 3 * ratingCounts[2] + 2 * ratingCounts[3] + ratingCounts[4]) / totalRatings : 0;

  const cells = values
    .map((v, i) => {
      const ref = `${colLetter(i + 1)}${r}`;
      return typeof v === 'number' ? numberCell(ref, SHEET1_STYLE[i], v) : textCell(ref, SHEET1_STYLE[i], String(v));
    })
    .join('');

  const yzaa =
    formulaCell(`Y${r}`, 20, `الإحصائيات!D${r}`, registrations.male + registrations.female) +
    formulaCell(`Z${r}`, 20, `الإحصائيات!G${r}`, accepted.male + accepted.female) +
    formulaCell(`AA${r}`, 20, `الإحصائيات!M${r}`, actualAttendance.male + actualAttendance.female);
  const ab = totalRatings > 0 ? formulaCell(`AB${r}`, 21, `الإحصائيات!S${r}`, avgRating) : `<c r="AB${r}" s="21"><f>الإحصائيات!S${r}</f></c>`;
  const ac = formulaCell(`AC${r}`, 22, `الإحصائيات!T${r}`, totalRatings);

  return `<row r="${r}" spans="1:29" ht="36.5" customHeight="1" x14ac:dyDescent="0.35">${cells}${yzaa}${ab}${ac}</row>`;
}

function buildSheet1(payload: WholeWorkshopExportPayload): string {
  const n = payload.workshops.length;
  const lastRow = 2 + n;

  const header =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" mc:Ignorable="x14ac xr xr2 xr3" xmlns:x14ac="http://schemas.microsoft.com/office/spreadsheetml/2009/9/ac" xmlns:xr="http://schemas.microsoft.com/office/spreadsheetml/2014/revision" xmlns:xr2="http://schemas.microsoft.com/office/spreadsheetml/2015/revision2" xmlns:xr3="http://schemas.microsoft.com/office/spreadsheetml/2016/revision3" xr:uid="{E2CB422C-20F6-47FB-99CB-20036C09DBF2}">' +
    `<dimension ref="A1:AC${lastRow}"/>` +
    '<sheetViews><sheetView showGridLines="0" rightToLeft="1" topLeftCell="A1" workbookViewId="0"><pane ySplit="2" topLeftCell="A3" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A3" sqref="A3"/></sheetView></sheetViews>' +
    '<sheetFormatPr defaultRowHeight="15.5" x14ac:dyDescent="0.35"/>' +
    '<cols><col min="1" max="1" width="31.6640625" customWidth="1"/><col min="2" max="10" width="18.33203125" customWidth="1"/><col min="11" max="11" width="38.33203125" customWidth="1"/><col min="12" max="15" width="18.33203125" customWidth="1"/><col min="16" max="16" width="29.75" bestFit="1" customWidth="1"/><col min="17" max="17" width="18.33203125" customWidth="1"/><col min="18" max="18" width="25" customWidth="1"/><col min="19" max="20" width="18.33203125" customWidth="1"/><col min="21" max="21" width="43.33203125" customWidth="1"/><col min="22" max="22" width="36.6640625" customWidth="1"/><col min="23" max="24" width="18.33203125" customWidth="1"/><col min="25" max="25" width="17.6640625" bestFit="1" customWidth="1"/><col min="26" max="26" width="18.33203125" customWidth="1"/><col min="27" max="27" width="14.83203125" bestFit="1" customWidth="1"/><col min="28" max="29" width="18.33203125" customWidth="1"/></cols>' +
    '<sheetData>';

  const dataRows = payload.workshops.map((w, i) => buildSheet1Row(w, i + 3)).join('');

  const footer =
    `</sheetData><mergeCells count="1"><mergeCell ref="A1:AC1"/></mergeCells>` +
    '<pageMargins left="0.7" right="0.7" top="0.75" bottom="0.75" header="0.3" footer="0.3"/>' +
    '<tableParts count="1"><tablePart r:id="rId1"/></tableParts></worksheet>';

  return header + SHEET1_ROW1 + SHEET1_ROW2 + dataRows + footer;
}

const SHEET2_ROW1 =
  '<row r="1" spans="1:20" ht="34" customHeight="1" x14ac:dyDescent="0.7">' +
  `${textCell('A1', 12, 'إحصائيات الورش')}${Array.from({ length: 19 }, (_, i) => `<c r="${colLetter(i + 2)}1" s="12"/>`).join('')}</row>`;

const SHEET2_HEADERS = [
  'اسم الورشة',
  'التسجيلات - ذكور',
  'التسجيلات - إناث',
  'التسجيلات - الإجمالي',
  'المقبولون - ذكور',
  'المقبولون - إناث',
  'المقبولون - الإجمالي',
  'الحضور - ذكور',
  'الحضور - إناث',
  'الحضور - الإجمالي',
  'الحضور الفعلي - ذكور',
  'الحضور الفعلي - إناث',
  'الحضور الفعلي - الإجمالي',
  '5 نجوم',
  '4 نجوم',
  '3 نجوم',
  '2 نجوم',
  '1 نجمة',
  'متوسط التقييم',
  'إجمالي عدد التقييمات',
];

// column -> header-row style id, matching row 2 of the template exactly (A=31, B-M=32, N-R=30, S=33, T=34)
const SHEET2_HEADER_STYLE = (i: number): number => (i === 0 ? 31 : i <= 12 ? 32 : i <= 17 ? 30 : i === 18 ? 33 : 34);

const SHEET2_ROW2 = `<row r="2" spans="1:20" ht="44" customHeight="1" x14ac:dyDescent="0.7">${SHEET2_HEADERS.map((h, i) => textCell(`${colLetter(i + 1)}2`, SHEET2_HEADER_STYLE(i), h)).join('')}</row>`;

function buildSheet2Row(payload: WorkshopRowPayload, r: number): string {
  const { registrations, accepted, attendance, actualAttendance, ratingCounts } = payload.stats;
  const totalRatings = ratingCounts.reduce((a, b) => a + b, 0);
  const avgRating = totalRatings > 0 ? (5 * ratingCounts[0] + 4 * ratingCounts[1] + 3 * ratingCounts[2] + 2 * ratingCounts[3] + ratingCounts[4]) / totalRatings : 0;

  const nameCell = `<c r="A${r}" s="25" t="str"><f>الورشات!A${r}</f><v>${escapeXml(payload.workshopName)}</v></c>`;

  function genderTriple(startCol: number, count: GenderCount): string {
    const [c1, c2, c3] = [startCol, startCol + 1, startCol + 2].map(colLetter);
    return numberCell(`${c1}${r}`, 26, count.male) + numberCell(`${c2}${r}`, 26, count.female) + formulaCell(`${c3}${r}`, 27, `${c1}${r}+${c2}${r}`, count.male + count.female);
  }

  const ratingCells = ratingCounts.map((c, i) => numberCell(`${colLetter(14 + i)}${r}`, 26, c)).join('');
  const s = totalRatings > 0 ? formulaCell(`S${r}`, 28, `(5*N${r}+4*O${r}+3*P${r}+2*Q${r}+R${r})/T${r}`, avgRating) : `<c r="S${r}" s="28"><f>(5*N${r}+4*O${r}+3*P${r}+2*Q${r}+R${r})/T${r}</f></c>`;
  const t = formulaCell(`T${r}`, 29, `SUM(N${r}:R${r})`, totalRatings);

  return (
    `<row r="${r}" spans="1:20" ht="34" customHeight="1" x14ac:dyDescent="0.7">` +
    nameCell +
    genderTriple(2, registrations) +
    genderTriple(5, accepted) +
    genderTriple(8, attendance) +
    genderTriple(11, actualAttendance) +
    ratingCells +
    s +
    t +
    '</row>'
  );
}

function buildSheet2(payload: WholeWorkshopExportPayload): string {
  const n = payload.workshops.length;
  const lastRow = 2 + n;

  const header =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" mc:Ignorable="x14ac xr xr2 xr3" xmlns:x14ac="http://schemas.microsoft.com/office/spreadsheetml/2009/9/ac" xmlns:xr="http://schemas.microsoft.com/office/spreadsheetml/2014/revision" xmlns:xr2="http://schemas.microsoft.com/office/spreadsheetml/2015/revision2" xmlns:xr3="http://schemas.microsoft.com/office/spreadsheetml/2016/revision3" xr:uid="{00000000-0001-0000-0100-000000000000}">' +
    `<dimension ref="A1:T${lastRow}"/>` +
    '<sheetViews><sheetView showGridLines="0" rightToLeft="1" zoomScale="70" zoomScaleNormal="70" workbookViewId="0"><pane ySplit="2" topLeftCell="A3" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A3" sqref="A3"/></sheetView></sheetViews>' +
    '<sheetFormatPr defaultRowHeight="19.5" x14ac:dyDescent="0.7"/>' +
    '<cols><col min="1" max="1" width="31.6640625" style="1" customWidth="1"/><col min="2" max="12" width="17.5" style="1" customWidth="1"/><col min="13" max="13" width="19.58203125" style="1" customWidth="1"/><col min="14" max="20" width="17.5" style="1" customWidth="1"/><col min="21" max="16384" width="8.6640625" style="1"/></cols>' +
    '<sheetData>';

  const dataRows = payload.workshops.map((w, i) => buildSheet2Row(w, i + 3)).join('');

  const footer =
    `</sheetData><mergeCells count="1"><mergeCell ref="A1:T1"/></mergeCells>` +
    '<pageMargins left="0.7" right="0.7" top="0.75" bottom="0.75" header="0.3" footer="0.3"/>' +
    '<tableParts count="1"><tablePart r:id="rId1"/></tableParts></worksheet>';

  return header + SHEET2_ROW1 + SHEET2_ROW2 + dataRows + footer;
}

// --- Participants sheet — one full sheet per workshop; identical zebra-striped plain-cell styling
// (no Excel Table) as the template's single sample "المشاركين" sheet. ---

const P_ODD = { name: 3, text: 4, num: 5, formula: 6 };
const P_EVEN = { name: 7, text: 8, num: 9, formula: 10 };
const PARTICIPANT_HEADERS = ['الاسم', 'الهاتف', 'البريد الإلكتروني', 'القسم', 'عدد الحضور', 'عدد الغياب', 'نسبة الحضور', 'مؤهل للشهادة'];

function buildParticipantsSheet(payload: WorkshopRowPayload, sheetUid: string): { xml: string; lastRow: number } {
  const lastRow = payload.participants.length + 2;

  const header =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" mc:Ignorable="x14ac xr xr2 xr3" xmlns:x14ac="http://schemas.microsoft.com/office/spreadsheetml/2009/9/ac" xmlns:xr="http://schemas.microsoft.com/office/spreadsheetml/2014/revision" xmlns:xr2="http://schemas.microsoft.com/office/spreadsheetml/2015/revision2" xmlns:xr3="http://schemas.microsoft.com/office/spreadsheetml/2016/revision3" xr:uid="{${sheetUid}}">` +
    `<dimension ref="A1:H${lastRow}"/>` +
    '<sheetViews><sheetView showGridLines="0" rightToLeft="1" zoomScale="70" zoomScaleNormal="70" workbookViewId="0"><selection sqref="A1:H1"/></sheetView></sheetViews>' +
    '<sheetFormatPr defaultRowHeight="19.5" x14ac:dyDescent="0.7"/>' +
    '<cols><col min="1" max="1" width="22" style="1" customWidth="1"/><col min="2" max="2" width="16" style="1" customWidth="1"/><col min="3" max="3" width="26" style="1" customWidth="1"/><col min="4" max="4" width="18" style="1" customWidth="1"/><col min="5" max="7" width="13" style="1" customWidth="1"/><col min="8" max="8" width="14" style="1" customWidth="1"/><col min="9" max="16384" width="8.6640625" style="1"/></cols>' +
    '<sheetData>';

  const row1 = `<row r="1" spans="1:8" ht="34" customHeight="1" x14ac:dyDescent="0.7">${textCell('A1', 11, payload.workshopName)}${Array.from({ length: 7 }, (_, i) => `<c r="${colLetter(i + 2)}1" s="11"/>`).join('')}</row>`;
  const row2 = `<row r="2" spans="1:8" ht="26" customHeight="1" x14ac:dyDescent="0.7">${PARTICIPANT_HEADERS.map((h, i) => textCell(`${colLetter(i + 1)}2`, 2, h)).join('')}</row>`;

  const dataRows = payload.participants
    .map((p, i) => {
      const r = i + 3;
      const s = i % 2 === 0 ? P_ODD : P_EVEN;
      const pct = p.attended + p.missed > 0 ? p.attended / (p.attended + p.missed) : 0;
      return (
        `<row r="${r}" spans="1:8" x14ac:dyDescent="0.7">` +
        textCell(`A${r}`, s.name, p.name) +
        textCell(`B${r}`, s.text, p.phone) +
        textCell(`C${r}`, s.text, p.email) +
        textCell(`D${r}`, s.text, p.department) +
        numberCell(`E${r}`, s.num, p.attended) +
        numberCell(`F${r}`, s.num, p.missed) +
        formulaCell(`G${r}`, s.formula, `IFERROR(E${r}/(E${r}+F${r}),0)`, pct) +
        textCell(`H${r}`, s.num, p.eligible ? 'نعم' : 'لا') +
        '</row>'
      );
    })
    .join('');

  const footer =
    '</sheetData><mergeCells count="1"><mergeCell ref="A1:H1"/></mergeCells>' +
    `<conditionalFormatting sqref="H3:H${lastRow}"><cfRule type="containsText" dxfId="30" priority="1" operator="containsText" text="نعم"><formula>NOT(ISERROR(SEARCH("نعم",H3)))</formula></cfRule><cfRule type="containsText" dxfId="29" priority="2" operator="containsText" text="لا"><formula>NOT(ISERROR(SEARCH("لا",H3)))</formula></cfRule></conditionalFormatting>` +
    '<pageMargins left="0.7" right="0.7" top="0.75" bottom="0.75" header="0.3" footer="0.3"/></worksheet>';

  return { xml: header + row1 + row2 + dataRows + footer, lastRow };
}

function sanitizeSheetName(name: string, used: Set<string>): string {
  let base = name
    .replace(/[\\/?*[\]:]/g, ' ')
    .replace(/^'+|'+$/g, '')
    .trim();
  if (!base) base = 'ورشة';
  base = base.slice(0, 31);

  let candidate = base;
  let suffix = 2;
  while (used.has(candidate.toLowerCase())) {
    const tail = ` (${suffix})`;
    candidate = base.slice(0, 31 - tail.length) + tail;
    suffix++;
  }
  used.add(candidate.toLowerCase());
  return candidate;
}

export async function buildWholeWorkshopXlsx(payload: WholeWorkshopExportPayload): Promise<Buffer> {
  const n = payload.workshops.length;
  const templateBuffer = await fs.promises.readFile(TEMPLATE_PATH);
  const zip = new PizZip(templateBuffer);

  zip.file('xl/worksheets/sheet1.xml', buildSheet1(payload));
  zip.file('xl/worksheets/sheet2.xml', buildSheet2(payload));

  const usedNames = new Set(['الورشات', 'الإحصائيات']);
  const participantSheetNames: string[] = [];
  for (let i = 0; i < n; i++) {
    const sheetFile = `sheet${3 + i}.xml`;
    const { xml } = buildParticipantsSheet(payload.workshops[i], randomUUID().toUpperCase());
    zip.file(`xl/worksheets/${sheetFile}`, xml);
    participantSheetNames.push(sanitizeSheetName(payload.workshops[i].workshopName, usedNames));
  }

  const lastRow = 2 + n;
  const table1 = zip.file('xl/tables/table1.xml')?.asText();
  if (table1) zip.file('xl/tables/table1.xml', table1.replace(/A2:AC3/g, `A2:AC${lastRow}`));
  const table2 = zip.file('xl/tables/table2.xml')?.asText();
  if (table2) zip.file('xl/tables/table2.xml', table2.replace(/A2:T3/g, `A2:T${lastRow}`));

  const sheetEntries = ['<sheet name="الورشات" sheetId="1" r:id="rId1"/>', '<sheet name="الإحصائيات" sheetId="2" r:id="rId2"/>'];
  for (let i = 0; i < n; i++) {
    sheetEntries.push(`<sheet name="${escapeXml(participantSheetNames[i])}" sheetId="${3 + i}" r:id="rId${3 + i}"/>`);
  }
  const workbook = zip.file('xl/workbook.xml')?.asText();
  if (workbook) {
    zip.file('xl/workbook.xml', workbook.replace(/<sheets>.*?<\/sheets>/, `<sheets>${sheetEntries.join('')}</sheets>`));
  }

  let nextRid = 3 + n;
  const themeRid = nextRid++;
  const stylesRid = nextRid++;
  const sharedStringsRid = nextRid++;
  const relEntries = [
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>',
    '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/>',
    ...Array.from({ length: n }, (_, i) => `<Relationship Id="rId${3 + i}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${3 + i}.xml"/>`),
    `<Relationship Id="rId${themeRid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="theme/theme1.xml"/>`,
    `<Relationship Id="rId${stylesRid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>`,
    `<Relationship Id="rId${sharedStringsRid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>`,
  ];
  zip.file('xl/_rels/workbook.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${relEntries.join('')}</Relationships>`);

  // calcChain would otherwise reference the template's original (now-replaced) formula cells —
  // dropped so Excel rebuilds it fresh on open, same reasoning as buildWorkshopXlsx.ts.
  zip.remove('xl/calcChain.xml');
  // sheet3.xml.rels/sheet4.xml.rels etc. never existed for participants sheets (no Table), but
  // sheet1/sheet2's own table rels stay untouched — only worksheet count changed, not their wiring.

  const contentTypes = zip.file('[Content_Types].xml')?.asText();
  if (contentTypes) {
    const newOverrides = Array.from(
      { length: n },
      (_, i) => `<Override PartName="/xl/worksheets/sheet${3 + i}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
    ).join('');
    zip.file(
      '[Content_Types].xml',
      contentTypes
        .replace(
          '<Override PartName="/xl/worksheets/sheet3.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>',
          newOverrides,
        )
        .replace('<Override PartName="/xl/calcChain.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.calcChain+xml"/>', ''),
    );
  }

  const appProps = zip.file('docProps/app.xml')?.asText();
  if (appProps) {
    const total = 2 + n;
    const titles = ['الورشات', 'الإحصائيات', ...participantSheetNames].map((t) => `<vt:lpstr>${escapeXml(t)}</vt:lpstr>`).join('');
    zip.file(
      'docProps/app.xml',
      appProps
        .replace(/<HeadingPairs>.*?<\/HeadingPairs>/, `<HeadingPairs><vt:vector size="2" baseType="variant"><vt:variant><vt:lpstr>Worksheets</vt:lpstr></vt:variant><vt:variant><vt:i4>${total}</vt:i4></vt:variant></vt:vector></HeadingPairs>`)
        .replace(/<TitlesOfParts>.*?<\/TitlesOfParts>/, `<TitlesOfParts><vt:vector size="${total}" baseType="lpstr">${titles}</vt:vector></TitlesOfParts>`),
    );
  }

  return zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' });
}
