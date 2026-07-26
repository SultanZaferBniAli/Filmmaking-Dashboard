import * as fs from 'node:fs';
import * as path from 'node:path';
import PizZip from 'pizzip';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATE_PATH = path.join(__dirname, '..', '..', 'templates', 'workshop-export-template.xlsx');

// Same approach as buildParticipantsXlsx.ts / buildReportPptx.ts: the user's own template (4
// sheets — معلومات الورشة / الإحصائيات / المشاركين / سجل الحضور, dark-navy/Effra styling, 2 real
// Excel Tables) is reused as-is, only its <sheetData> (and the 2 tables' row/column extent) is
// surgically rewritten with live data — everything else (fonts, fills, conditional formatting,
// table styling) comes from the template untouched.

export interface WorkshopInfoRow {
  label: string;
  value: string | number;
}

export interface GenderCount {
  male: number;
  female: number;
}

export interface WorkshopExportPayload {
  workshopName: string;
  infoRows: WorkshopInfoRow[]; // exactly 27 rows, same order as the template
  stats: {
    registrations: GenderCount;
    accepted: GenderCount;
    attendance: GenderCount; // "الحضور" (expected attendance)
    actualAttendance: GenderCount;
    ratingCounts: [number, number, number, number, number]; // [5-star, 4-star, 3-star, 2-star, 1-star]
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
  sessionCount: number;
  attendanceRows: { name: string; sessions: boolean[] }[];
}

export function escapeXml(s: string): string {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

export function textCell(ref: string, style: number, value: string): string {
  return `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`;
}

export function numberCell(ref: string, style: number, value: number): string {
  return `<c r="${ref}" s="${style}"><v>${Number.isFinite(value) ? value : 0}</v></c>`;
}

export function formulaCell(ref: string, style: number, formula: string, cached: number): string {
  return `<c r="${ref}" s="${style}"><f>${escapeXml(formula)}</f><v>${cached}</v></c>`;
}

// 1-indexed column number -> spreadsheet column letters (A, B, ..., Z, AA, AB, ...).
export function colLetter(n: number): string {
  let s = '';
  let i = n;
  while (i > 0) {
    const rem = (i - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    i = Math.floor((i - 1) / 26);
  }
  return s;
}

// --- Sheet 1: معلومات الورشة — fully fixed layout (30 rows, always), only cell VALUES change ---

function buildSheet1(payload: WorkshopExportPayload): string {
  const header =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" mc:Ignorable="x14ac xr xr2 xr3" xmlns:x14ac="http://schemas.microsoft.com/office/spreadsheetml/2009/9/ac" xmlns:xr="http://schemas.microsoft.com/office/spreadsheetml/2014/revision" xmlns:xr2="http://schemas.microsoft.com/office/spreadsheetml/2015/revision2" xmlns:xr3="http://schemas.microsoft.com/office/spreadsheetml/2016/revision3" xr:uid="{00000000-0001-0000-0000-000000000000}">' +
    '<dimension ref="A1:B30"/>' +
    '<sheetViews><sheetView showGridLines="0" rightToLeft="1" tabSelected="1" workbookViewId="0"><selection activeCell="B4" sqref="B4"/></sheetView></sheetViews>' +
    '<sheetFormatPr defaultRowHeight="19.5" x14ac:dyDescent="0.7"/>' +
    '<cols><col min="1" max="1" width="25" style="1" customWidth="1"/><col min="2" max="2" width="71.6640625" style="1" customWidth="1"/><col min="3" max="16384" width="8.6640625" style="1"/></cols>' +
    '<sheetData>';

  const row1 = `<row r="1" spans="1:2" ht="40" customHeight="1" x14ac:dyDescent="0.7">${textCell('A1', 22, payload.workshopName)}<c r="B1" s="22"/></row>`;
  const row2 = `<row r="2" spans="1:2" ht="24" customHeight="1" x14ac:dyDescent="0.7">${textCell('A2', 23, 'بطاقة معلومات الورشة')}<c r="B2" s="23"/></row>`;
  const row3 = `<row r="3" spans="1:2" ht="26" customHeight="1" x14ac:dyDescent="0.7">${textCell('A3', 11, 'الحقل')}${textCell('B3', 11, 'القيمة')}</row>`;

  const dataRows = payload.infoRows
    .map((row, i) => {
      const r = i + 4;
      const heightAttr = r === 24 ? ' ht="39"' : ''; // "الوصف" row — matches template's taller row for wrapped text
      const valueCell = typeof row.value === 'number' ? numberCell(`B${r}`, 17, row.value) : textCell(`B${r}`, 16, String(row.value));
      return `<row r="${r}" spans="1:2"${heightAttr} x14ac:dyDescent="0.7">${textCell(`A${r}`, 15, row.label)}${valueCell}</row>`;
    })
    .join('');

  const footer =
    '</sheetData><mergeCells count="2"><mergeCell ref="A1:B1"/><mergeCell ref="A2:B2"/></mergeCells>' +
    '<pageMargins left="0.7" right="0.7" top="0.75" bottom="0.75" header="0.3" footer="0.3"/>' +
    '<ignoredErrors><ignoredError sqref="A3:B21 A24:B30 A23 A22" numberStoredAsText="1"/></ignoredErrors></worksheet>';

  return header + row1 + row2 + row3 + dataRows + footer;
}

// --- Sheet 2: الإحصائيات — also fully fixed layout; the average/total-ratings formulas (rows
// 14-15) reference a fixed range (B9:B13) that never moves, so they're left as real formulas and
// only the rating counts they read are replaced — everything else is a literal computed value. ---

function buildSheet2(payload: WorkshopExportPayload): string {
  const header =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" mc:Ignorable="x14ac xr xr2 xr3" xmlns:x14ac="http://schemas.microsoft.com/office/spreadsheetml/2009/9/ac" xmlns:xr="http://schemas.microsoft.com/office/spreadsheetml/2014/revision" xmlns:xr2="http://schemas.microsoft.com/office/spreadsheetml/2015/revision2" xmlns:xr3="http://schemas.microsoft.com/office/spreadsheetml/2016/revision3" xr:uid="{00000000-0001-0000-0100-000000000000}">' +
    '<dimension ref="A1:D15"/>' +
    '<sheetViews><sheetView showGridLines="0" rightToLeft="1" workbookViewId="0"><selection activeCell="A1" sqref="A1"/></sheetView></sheetViews>' +
    '<sheetFormatPr defaultRowHeight="19.5" x14ac:dyDescent="0.7"/>' +
    '<cols><col min="1" max="1" width="28.33203125" style="1" customWidth="1"/><col min="2" max="4" width="18.33203125" style="1" customWidth="1"/><col min="5" max="16384" width="8.6640625" style="1"/></cols>' +
    '<sheetData>';

  const row1 = `<row r="1" spans="1:4" ht="34" customHeight="1" x14ac:dyDescent="0.7">${textCell('A1', 24, 'إحصائيات الورشة')}<c r="B1" s="24"/><c r="C1" s="24"/><c r="D1" s="24"/></row>`;
  const row2 = `<row r="2" spans="1:4" x14ac:dyDescent="0.7">${textCell('A2', 11, 'البيان')}${textCell('B2', 11, 'ذكور')}${textCell('C2', 11, 'إناث')}${textCell('D2', 11, 'الإجمالي')}</row>`;

  function genderRow(r: number, label: string, count: GenderCount): string {
    return (
      `<row r="${r}" spans="1:4" x14ac:dyDescent="0.7">` +
      textCell(`A${r}`, 12, label) +
      numberCell(`B${r}`, 13, count.male) +
      numberCell(`C${r}`, 13, count.female) +
      formulaCell(`D${r}`, 14, `B${r}+C${r}`, count.male + count.female) +
      '</row>'
    );
  }

  const row3 = genderRow(3, 'إجمالي التسجيلات', payload.stats.registrations);
  const row4 = genderRow(4, 'المقبولون', payload.stats.accepted);
  const row5 = genderRow(5, 'الحضور ', payload.stats.attendance);
  const row6 = genderRow(6, 'الحضور الفعلي', payload.stats.actualAttendance);

  const blank = (ref: string) => `<c r="${ref}" s="1" t="inlineStr"><is><t></t></is></c>`;
  const row8 = `<row r="8" spans="1:4" x14ac:dyDescent="0.7">${textCell('A8', 11, 'تقيم الورشة')}${textCell('B8', 11, 'عدد التقييمات')}${blank('C8')}${blank('D8')}</row>`;

  const ratingLabels = ['5 نجوم', '4 نجوم', '3 نجوم', '2 نجوم', '1 نجمة'];
  const ratingRows = ratingLabels
    .map((label, i) => {
      const r = 9 + i;
      return (
        `<row r="${r}" spans="1:4" x14ac:dyDescent="0.7">` +
        textCell(`A${r}`, 12, label) +
        numberCell(`B${r}`, 13, payload.stats.ratingCounts[i]) +
        blank(`C${r}`) +
        blank(`D${r}`) +
        '</row>'
      );
    })
    .join('');

  const row14 =
    '<row r="14" spans="1:4" x14ac:dyDescent="0.7">' +
    textCell('A14', 18, 'متوسط التقييم') +
    `<c r="B14" s="19"><f>SUMPRODUCT({5;4;3;2;1},B9:B13)/B15</f></c>` +
    blank('C14') +
    blank('D14') +
    '</row>';
  const row15 =
    '<row r="15" spans="1:4" x14ac:dyDescent="0.7">' +
    textCell('A15', 20, 'إجمالي عدد التقييمات') +
    `<c r="B15" s="21"><f>SUM(B9:B13)</f></c>` +
    blank('C15') +
    blank('D15') +
    '</row>';

  const footer =
    '</sheetData><mergeCells count="1"><mergeCell ref="A1:D1"/></mergeCells>' +
    '<pageMargins left="0.7" right="0.7" top="0.75" bottom="0.75" header="0.3" footer="0.3"/>' +
    '<ignoredErrors><ignoredError sqref="A2:D2 A7:D7 A3:C3 A4:C4 B5:C5 A6:C6 A15 C15:D15 A14 C14:D14 A9:D13 B8:D8" numberStoredAsText="1"/></ignoredErrors></worksheet>';

  return header + row1 + row2 + row3 + row4 + row5 + row6 + row8 + ratingRows + row14 + row15 + footer;
}

// --- Sheet 3: المشاركين — a real Excel Table (tblParticipants), row count driven by data; the
// zebra-striped row styling alternates between two fixed style sets exactly like the template. ---

const P_ODD = { name: 3, text: 4, num: 5, formula: 6 };
const P_EVEN = { name: 7, text: 8, num: 9, formula: 10 };

function buildSheet3(payload: WorkshopExportPayload): { xml: string; lastRow: number } {
  const lastRow = payload.participants.length + 2;

  const header =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" mc:Ignorable="x14ac xr xr2 xr3" xmlns:x14ac="http://schemas.microsoft.com/office/spreadsheetml/2009/9/ac" xmlns:xr="http://schemas.microsoft.com/office/spreadsheetml/2014/revision" xmlns:xr2="http://schemas.microsoft.com/office/spreadsheetml/2015/revision2" xmlns:xr3="http://schemas.microsoft.com/office/spreadsheetml/2016/revision3" xr:uid="{00000000-0001-0000-0200-000000000000}">' +
    `<dimension ref="A1:H${lastRow}"/>` +
    '<sheetViews><sheetView showGridLines="0" rightToLeft="1" workbookViewId="0"><selection activeCell="A1" sqref="A1"/></sheetView></sheetViews>' +
    '<sheetFormatPr defaultRowHeight="19.5" x14ac:dyDescent="0.7"/>' +
    '<cols><col min="1" max="1" width="22" style="1" customWidth="1"/><col min="2" max="2" width="16" style="1" customWidth="1"/><col min="3" max="3" width="26" style="1" customWidth="1"/><col min="4" max="4" width="18" style="1" customWidth="1"/><col min="5" max="7" width="13" style="1" customWidth="1"/><col min="8" max="8" width="14" style="1" customWidth="1"/><col min="9" max="16384" width="8.6640625" style="1"/></cols>' +
    '<sheetData>';

  const row1 = `<row r="1" spans="1:8" ht="34" customHeight="1" x14ac:dyDescent="0.7">${textCell('A1', 24, 'قائمة المشاركين')}<c r="B1" s="24"/><c r="C1" s="24"/><c r="D1" s="24"/><c r="E1" s="24"/><c r="F1" s="24"/><c r="G1" s="24"/><c r="H1" s="24"/></row>`;
  const headers = ['الاسم', 'الهاتف', 'البريد الإلكتروني', 'القسم', 'عدد الحضور', 'عدد الغياب', 'نسبة الحضور', 'مؤهل للشهادة'];
  const row2 = `<row r="2" spans="1:8" ht="26" customHeight="1" x14ac:dyDescent="0.7">${headers.map((h, i) => textCell(`${colLetter(i + 1)}2`, 2, h)).join('')}</row>`;

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
    `<conditionalFormatting sqref="H3:H${lastRow}"><cfRule type="containsText" dxfId="3" priority="1" operator="containsText" text="نعم"><formula>NOT(ISERROR(SEARCH("نعم",H3)))</formula></cfRule><cfRule type="containsText" dxfId="2" priority="2" operator="containsText" text="لا"><formula>NOT(ISERROR(SEARCH("لا",H3)))</formula></cfRule></conditionalFormatting>` +
    '<pageMargins left="0.7" right="0.7" top="0.75" bottom="0.75" header="0.3" footer="0.3"/>' +
    '<tableParts count="1"><tablePart r:id="rId1"/></tableParts></worksheet>';

  return { xml: header + row1 + row2 + dataRows + footer, lastRow };
}

function buildTable1(lastRow: number): string {
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    `<table xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" mc:Ignorable="xr xr3" xmlns:xr="http://schemas.microsoft.com/office/spreadsheetml/2014/revision" xmlns:xr3="http://schemas.microsoft.com/office/spreadsheetml/2016/revision3" id="1" xr:uid="{C49CE95D-F0A3-4CEA-B3A1-A49E2422F9EA}" name="tblParticipants" displayName="tblParticipants" ref="A2:H${lastRow}" totalsRowShown="0" headerRowDxfId="21" dataDxfId="20">` +
    `<autoFilter ref="A2:H${lastRow}" xr:uid="{C49CE95D-F0A3-4CEA-B3A1-A49E2422F9EA}"/>` +
    '<tableColumns count="8">' +
    '<tableColumn id="1" xr3:uid="{2CE3AA0A-8D7E-4E4F-AB85-5B48D1A6DDF3}" name="الاسم" dataDxfId="19"/>' +
    '<tableColumn id="2" xr3:uid="{E6AF065E-D232-4CB3-9EC9-068A148D4646}" name="الهاتف" dataDxfId="18"/>' +
    '<tableColumn id="3" xr3:uid="{177DBCE1-4544-475B-8872-F450FCACC927}" name="البريد الإلكتروني" dataDxfId="17"/>' +
    '<tableColumn id="4" xr3:uid="{66B4F2C5-A918-4F4A-96DD-BD5A8F349028}" name="القسم" dataDxfId="16"/>' +
    '<tableColumn id="5" xr3:uid="{9879F35B-A035-4648-BB2E-E9DA7C3C545B}" name="عدد الحضور" dataDxfId="15"/>' +
    '<tableColumn id="6" xr3:uid="{2097807F-666F-4419-85C5-1DD82C2E0B77}" name="عدد الغياب" dataDxfId="14"/>' +
    '<tableColumn id="7" xr3:uid="{5AD1C31C-1A6F-42FB-9952-38FCA71F5882}" name="نسبة الحضور" dataDxfId="13"><calculatedColumnFormula>IFERROR(E3/(E3+F3),0)</calculatedColumnFormula></tableColumn>' +
    '<tableColumn id="8" xr3:uid="{33C8A010-7F99-4097-A7E3-1E2135804CE6}" name="مؤهل للشهادة" dataDxfId="12"/>' +
    '</tableColumns>' +
    '<tableStyleInfo name="TableStyleLight1" showFirstColumn="0" showLastColumn="0" showRowStripes="0" showColumnStripes="0"/></table>'
  );
}

// --- Sheet 4: سجل الحضور — a real Excel Table (tblAttendance) whose COLUMN count (one per
// session) is also data-driven, on top of the row count. ---

function buildSheet4(payload: WorkshopExportPayload): { xml: string; lastRow: number; lastCol: string } {
  const lastRow = payload.attendanceRows.length + 2;
  const lastColIdx = 1 + payload.sessionCount; // A = name, then one column per session
  const lastCol = colLetter(lastColIdx);

  const header =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" mc:Ignorable="x14ac xr xr2 xr3" xmlns:x14ac="http://schemas.microsoft.com/office/spreadsheetml/2009/9/ac" xmlns:xr="http://schemas.microsoft.com/office/spreadsheetml/2014/revision" xmlns:xr2="http://schemas.microsoft.com/office/spreadsheetml/2015/revision2" xmlns:xr3="http://schemas.microsoft.com/office/spreadsheetml/2016/revision3" xr:uid="{00000000-0001-0000-0300-000000000000}">' +
    `<dimension ref="A1:${lastCol}${lastRow}"/>` +
    '<sheetViews><sheetView showGridLines="0" rightToLeft="1" workbookViewId="0"><selection activeCell="A1" sqref="A1"/></sheetView></sheetViews>' +
    '<sheetFormatPr defaultRowHeight="19.5" x14ac:dyDescent="0.7"/>' +
    `<cols><col min="1" max="1" width="30" style="1" customWidth="1"/><col min="2" max="${lastColIdx}" width="15" style="1" customWidth="1"/><col min="${lastColIdx + 1}" max="16384" width="8.6640625" style="1"/></cols>` +
    '<sheetData>';

  const titleCells = Array.from({ length: lastColIdx - 1 }, (_, i) => `<c r="${colLetter(i + 2)}1" s="24"/>`).join('');
  const row1 = `<row r="1" spans="1:${lastColIdx}" ht="34" customHeight="1" x14ac:dyDescent="0.7">${textCell('A1', 24, 'سجل الحضور')}${titleCells}</row>`;

  const sessionHeaders = Array.from({ length: payload.sessionCount }, (_, i) => `الجلسة ${i + 1}`);
  const row2 = `<row r="2" spans="1:${lastColIdx}" ht="26" customHeight="1" x14ac:dyDescent="0.7">${textCell('A2', 2, 'الاسم')}${sessionHeaders.map((h, i) => textCell(`${colLetter(i + 2)}2`, 2, h)).join('')}</row>`;

  const dataRows = payload.attendanceRows
    .map((row, i) => {
      const r = i + 3;
      const s = i % 2 === 0 ? P_ODD : P_EVEN;
      const sessionCells = Array.from({ length: payload.sessionCount }, (_, si) =>
        textCell(`${colLetter(si + 2)}${r}`, s.num, row.sessions[si] ? 'حاضر' : 'غائب'),
      ).join('');
      return `<row r="${r}" spans="1:${lastColIdx}" x14ac:dyDescent="0.7">${textCell(`A${r}`, s.name, row.name)}${sessionCells}</row>`;
    })
    .join('');

  const footer =
    `</sheetData><mergeCells count="1"><mergeCell ref="A1:${lastCol}1"/></mergeCells>` +
    `<conditionalFormatting sqref="B3:${lastCol}${lastRow}"><cfRule type="containsText" dxfId="1" priority="1" operator="containsText" text="حاضر"><formula>NOT(ISERROR(SEARCH("حاضر",B3)))</formula></cfRule><cfRule type="containsText" dxfId="0" priority="2" operator="containsText" text="غائب"><formula>NOT(ISERROR(SEARCH("غائب",B3)))</formula></cfRule></conditionalFormatting>` +
    '<pageMargins left="0.7" right="0.7" top="0.75" bottom="0.75" header="0.3" footer="0.3"/>' +
    '<tableParts count="1"><tablePart r:id="rId1"/></tableParts></worksheet>';

  return { xml: header + row1 + row2 + dataRows + footer, lastRow, lastCol };
}

function buildTable2(lastRow: number, lastCol: string, sessionCount: number): string {
  // Sessions beyond the template's original 5 reuse the 5th session's dxf (there's no per-column
  // differential format for a 6th+ session in the template's styles.xml — same visual treatment
  // as session 5 is the closest reasonable fallback for a workshop running that many days).
  const sessionColumns = Array.from({ length: sessionCount }, (_, i) => {
    const n = i + 1;
    return `<tableColumn id="${n + 1}" xr3:uid="{${randomUUID().toUpperCase()}}" name="الجلسة ${n}" dataDxfId="${9 - Math.min(n, 5)}"/>`;
  }).join('');

  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    `<table xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" mc:Ignorable="xr xr3" xmlns:xr="http://schemas.microsoft.com/office/spreadsheetml/2014/revision" xmlns:xr3="http://schemas.microsoft.com/office/spreadsheetml/2016/revision3" id="2" xr:uid="{4668BE69-3CA1-45D2-B669-FB8B0D294089}" name="tblAttendance" displayName="tblAttendance" ref="A2:${lastCol}${lastRow}" totalsRowShown="0" headerRowDxfId="11" dataDxfId="10">` +
    `<autoFilter ref="A2:${lastCol}${lastRow}" xr:uid="{4668BE69-3CA1-45D2-B669-FB8B0D294089}"/>` +
    `<tableColumns count="${sessionCount + 1}">` +
    '<tableColumn id="1" xr3:uid="{DF7C984D-B008-4C29-9C1E-E4B47AFCE9AB}" name="الاسم" dataDxfId="9"/>' +
    sessionColumns +
    '</tableColumns>' +
    '<tableStyleInfo name="TableStyleLight1" showFirstColumn="0" showLastColumn="0" showRowStripes="0" showColumnStripes="0"/></table>'
  );
}

export async function buildWorkshopXlsx(payload: WorkshopExportPayload): Promise<Buffer> {
  const templateBuffer = await fs.promises.readFile(TEMPLATE_PATH);
  const zip = new PizZip(templateBuffer);

  zip.file('xl/worksheets/sheet1.xml', buildSheet1(payload));
  zip.file('xl/worksheets/sheet2.xml', buildSheet2(payload));

  const sheet3 = buildSheet3(payload);
  zip.file('xl/worksheets/sheet3.xml', sheet3.xml);
  zip.file('xl/tables/table1.xml', buildTable1(sheet3.lastRow));

  const sheet4 = buildSheet4(payload);
  zip.file('xl/worksheets/sheet4.xml', sheet4.xml);
  zip.file('xl/tables/table2.xml', buildTable2(sheet4.lastRow, sheet4.lastCol, payload.sessionCount));

  // calcChain would otherwise reference the template's original (now-replaced) formula cells —
  // dropped so Excel rebuilds it fresh on open, same reasoning as buildParticipantsXlsx.ts.
  zip.remove('xl/calcChain.xml');
  const contentTypes = zip.file('[Content_Types].xml')?.asText();
  if (contentTypes) {
    zip.file(
      '[Content_Types].xml',
      contentTypes.replace('<Override PartName="/xl/calcChain.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.calcChain+xml"/>', ''),
    );
  }
  const workbookRels = zip.file('xl/_rels/workbook.xml.rels')?.asText();
  if (workbookRels) {
    zip.file('xl/_rels/workbook.xml.rels', workbookRels.replace(/<Relationship Id="rId\d+"[^/]*Target="calcChain\.xml"\/>/, ''));
  }

  return zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' });
}
