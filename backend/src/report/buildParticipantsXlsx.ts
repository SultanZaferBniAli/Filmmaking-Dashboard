import * as fs from 'node:fs';
import * as path from 'node:path';
import PizZip from 'pizzip';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATE_PATH = path.join(__dirname, '..', '..', 'templates', 'participants-export-template.xlsx');

// The template (see conversation history — user-built, based on this app's own export button
// output, customized with a "المشاركين" data sheet + a "Dashboard" sheet carrying 4 native Excel
// charts) is reused as-is: we never regenerate charts/styles/theme from scratch, only surgically
// rewrite the two sheets' <sheetData> (and each chart's cached series data) inside the original
// zip, exactly like buildReportPptx.ts does for the PPTX report. This is the only way to keep the
// *real*, interactive, editable Excel chart objects — the `xlsx` package used elsewhere in this
// app (client-side) cannot write native charts at all.

export interface ParticipantExportRow {
  name: string;
  phone: string;
  email: string;
  gender: string; // 'ذكر' | 'أنثى' | ''
  jobTitle: string;
  experienceLevel: string;
  experienceYears: string | number;
  applicationStatus: string;
  acceptanceStatus: string; // 'مقبول' | 'مرفوض' | 'قيد المراجعة'
  attendanceStatus: string; // 'مسجل' | 'حضور فعلي' | 'حضور جزئي' | ''
  actualAttendance: string; // 'نعم' | 'لا' | ''
  workshopName: string;
  workshopType: string;
  workshopField: string;
  region: string;
  city: string;
  workshopDate: string;
  registeredCount: number;
  attendedCount: number;
  completedCount: number;
  certificateAvailable: string; // 'متاحة' | 'غير متاحة'
}

function escapeXml(s: string): string {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

// --- "المشاركين" sheet (sheet1.xml) — column layout, fixed 1:1 with the template ------------------

const BODY_STYLE = 6; // plain text/number body cell
const GENDER_STYLE = 12; // centered, dark-navy text — matches template's column D styling

const TEXT_COLUMNS: (keyof ParticipantExportRow)[] = [
  'name', 'phone', 'email', 'jobTitle', 'experienceLevel', 'applicationStatus', 'acceptanceStatus',
  'attendanceStatus', 'actualAttendance', 'workshopName', 'workshopType', 'workshopField', 'region',
  'city', 'workshopDate', 'certificateAvailable',
];
const COLUMN_LETTERS: Record<keyof ParticipantExportRow, string> = {
  name: 'A', phone: 'B', email: 'C', gender: 'D', jobTitle: 'E', experienceLevel: 'F',
  experienceYears: 'G', applicationStatus: 'H', acceptanceStatus: 'I', attendanceStatus: 'J',
  actualAttendance: 'K', workshopName: 'L', workshopType: 'M', workshopField: 'N', region: 'O',
  city: 'P', workshopDate: 'Q', registeredCount: 'R', attendedCount: 'S', completedCount: 'T',
  certificateAvailable: 'U',
};

function textCell(ref: string, style: number, value: string): string {
  const v = value ?? '';
  return `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(v)}</t></is></c>`;
}

function numberCell(ref: string, style: number, value: number): string {
  return `<c r="${ref}" s="${style}"><v>${Number.isFinite(value) ? value : 0}</v></c>`;
}

// Verbatim fragments for the small "دليل الألوان" (color legend) block that sits in columns W/X
// of rows 2-5 only — a static reference key, unrelated to participant data, so it's simply
// re-stamped onto whichever real data row now occupies rows 2-5 rather than regenerated.
const LEGEND_BY_ROW: Record<number, string> = {
  2: '<c r="W2" s="1" t="s"><v>435</v></c><c r="X2" s="2" t="s"><v>436</v></c>',
  3: '<c r="W3" s="3" t="s"><v>435</v></c><c r="X3" s="2" t="s"><v>437</v></c>',
  4: '<c r="W4" s="4" t="s"><v>435</v></c><c r="X4" s="2" t="s"><v>438</v></c>',
  5: '<c r="W5" s="5" t="s"><v>435</v></c><c r="X5" s="2" t="s"><v>439</v></c>',
};

// Row 1 (header, already includes "الجنس") is reused byte-for-byte from the template — it already
// carries the exact styling (dark navy fill, white bold Effra) this export must match.
const HEADER_ROW_1 =
  '<row r="1" spans="1:24" ht="28" customHeight="1" x14ac:dyDescent="0.35">' +
  '<c r="A1" s="11" t="s"><v>0</v></c><c r="B1" s="11" t="s"><v>1</v></c><c r="C1" s="11" t="s"><v>2</v></c>' +
  '<c r="D1" s="11" t="s"><v>440</v></c><c r="E1" s="11" t="s"><v>3</v></c><c r="F1" s="11" t="s"><v>4</v></c>' +
  '<c r="G1" s="11" t="s"><v>5</v></c><c r="H1" s="11" t="s"><v>6</v></c><c r="I1" s="11" t="s"><v>7</v></c>' +
  '<c r="J1" s="11" t="s"><v>8</v></c><c r="K1" s="11" t="s"><v>9</v></c><c r="L1" s="11" t="s"><v>10</v></c>' +
  '<c r="M1" s="11" t="s"><v>11</v></c><c r="N1" s="11" t="s"><v>12</v></c><c r="O1" s="11" t="s"><v>13</v></c>' +
  '<c r="P1" s="11" t="s"><v>14</v></c><c r="Q1" s="11" t="s"><v>15</v></c><c r="R1" s="11" t="s"><v>16</v></c>' +
  '<c r="S1" s="11" t="s"><v>17</v></c><c r="T1" s="11" t="s"><v>18</v></c><c r="U1" s="11" t="s"><v>19</v></c>' +
  '<c r="W1" s="13" t="s"><v>434</v></c><c r="X1" s="13"/></row>';

function buildParticipantRow(rowNum: number, row: ParticipantExportRow): string {
  const cells: string[] = [];
  for (const key of TEXT_COLUMNS) {
    cells.push(textCell(`${COLUMN_LETTERS[key]}${rowNum}`, BODY_STYLE, String(row[key] ?? '')));
  }
  cells.push(textCell(`D${rowNum}`, GENDER_STYLE, row.gender ?? ''));
  cells.push(numberCell(`R${rowNum}`, BODY_STYLE, row.registeredCount));
  cells.push(numberCell(`S${rowNum}`, BODY_STYLE, row.attendedCount));
  cells.push(numberCell(`T${rowNum}`, BODY_STYLE, row.completedCount));
  // Re-sort A..U in column order (pushed above in two passes for clarity) — cells within a <row>
  // must appear in column order for a strictly-conformant OOXML reader.
  cells.sort((a, b) => {
    const colOf = (c: string) => c.match(/r="([A-Z]+)\d+"/)![1];
    return colOf(a).localeCompare(colOf(b), undefined, { numeric: true }) || colOf(a).length - colOf(b).length;
  });
  const legend = LEGEND_BY_ROW[rowNum] ?? '';
  return `<row r="${rowNum}" spans="1:24" ht="19.5" x14ac:dyDescent="0.7">${cells.join('')}${legend}</row>`;
}

const SHEET1_HEADER =
  '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:x14="http://schemas.microsoft.com/office/spreadsheetml/2009/9/main" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" mc:Ignorable="x14ac xr xr2 xr3" xmlns:x14ac="http://schemas.microsoft.com/office/spreadsheetml/2009/9/ac" xmlns:xr="http://schemas.microsoft.com/office/spreadsheetml/2014/revision" xmlns:xr2="http://schemas.microsoft.com/office/spreadsheetml/2015/revision2" xmlns:xr3="http://schemas.microsoft.com/office/spreadsheetml/2016/revision3" xr:uid="{00000000-0001-0000-0000-000000000000}">' +
  '<dimension ref="A1:X__LASTROW__"/>' +
  '<sheetViews><sheetView rightToLeft="1" workbookViewId="0"><selection activeCell="A2" sqref="A2"/></sheetView></sheetViews>' +
  '<sheetFormatPr defaultRowHeight="15.5" x14ac:dyDescent="0.35"/>' +
  '<cols><col min="1" max="2" width="20.83203125" customWidth="1"/><col min="3" max="3" width="32.75" customWidth="1"/><col min="5" max="21" width="20.83203125" customWidth="1"/><col min="23" max="23" width="6.6640625" customWidth="1"/><col min="24" max="24" width="38.33203125" customWidth="1"/></cols>' +
  '<sheetData>';

// Conditional formatting (the real color-coded legend behavior) + ignoredErrors are kept verbatim
// from the template except their row-128 upper bound, widened to the actual row count so every
// real data row gets the same live, value-driven coloring the template's dummy rows had.
function sheet1Footer(lastRow: number): string {
  const raw =
    '</sheetData><mergeCells count="1"><mergeCell ref="W1:X1"/></mergeCells>' +
    '<conditionalFormatting sqref="H2:H128"><cfRule type="expression" dxfId="21" priority="1"><formula>$H2="مقبول"</formula></cfRule><cfRule type="expression" dxfId="20" priority="2"><formula>$H2="مقدّم طلب"</formula></cfRule><cfRule type="expression" dxfId="19" priority="3"><formula>$H2="مرفوض"</formula></cfRule></conditionalFormatting>' +
    '<conditionalFormatting sqref="I2:I128"><cfRule type="expression" dxfId="18" priority="4"><formula>$I2="مقبول"</formula></cfRule><cfRule type="expression" dxfId="17" priority="5"><formula>$I2="قيد المراجعة"</formula></cfRule><cfRule type="expression" dxfId="16" priority="6"><formula>$I2="مرفوض"</formula></cfRule></conditionalFormatting>' +
    '<conditionalFormatting sqref="J2:J128"><cfRule type="expression" dxfId="15" priority="7"><formula>$J2="حضور فعلي"</formula></cfRule><cfRule type="expression" dxfId="14" priority="8"><formula>$J2="حضور جزئي"</formula></cfRule><cfRule type="expression" dxfId="13" priority="9"><formula>$J2="مسجل"</formula></cfRule><cfRule type="expression" dxfId="12" priority="10"><formula>$J2=""</formula></cfRule></conditionalFormatting>' +
    '<conditionalFormatting sqref="K2:K128"><cfRule type="expression" dxfId="11" priority="11"><formula>$K2="نعم"</formula></cfRule><cfRule type="expression" dxfId="10" priority="12"><formula>$K2="لا"</formula></cfRule><cfRule type="expression" dxfId="9" priority="13"><formula>$K2=""</formula></cfRule></conditionalFormatting>' +
    '<conditionalFormatting sqref="R2:R128"><cfRule type="expression" dxfId="8" priority="14"><formula>OR($R2="",$R2="غير متاحة")</formula></cfRule><cfRule type="expression" dxfId="7" priority="15"><formula>AND(ISNUMBER($R2),$R2&gt;0)</formula></cfRule><cfRule type="expression" dxfId="6" priority="16"><formula>AND(ISNUMBER($R2),$R2=0)</formula></cfRule></conditionalFormatting>' +
    '<conditionalFormatting sqref="S2:S128"><cfRule type="expression" dxfId="5" priority="17"><formula>OR($S2="",$S2="غير متاحة")</formula></cfRule><cfRule type="expression" dxfId="4" priority="18"><formula>AND(ISNUMBER($S2),$S2&gt;0)</formula></cfRule><cfRule type="expression" dxfId="3" priority="19"><formula>AND(ISNUMBER($S2),$S2=0)</formula></cfRule></conditionalFormatting>' +
    '<conditionalFormatting sqref="T2:T128"><cfRule type="expression" dxfId="2" priority="20"><formula>OR($T2="",$T2="غير متاحة")</formula></cfRule><cfRule type="expression" dxfId="1" priority="21"><formula>AND(ISNUMBER($T2),$T2&gt;0)</formula></cfRule><cfRule type="expression" dxfId="0" priority="22"><formula>AND(ISNUMBER($T2),$T2=0)</formula></cfRule></conditionalFormatting>' +
    '<pageMargins left="0.7" right="0.7" top="0.75" bottom="0.75" header="0.3" footer="0.3"/>' +
    '<ignoredErrors><ignoredError sqref="E2:U128 E1:G1 I1:U1 A1:C128" numberStoredAsText="1"/></ignoredErrors>' +
    '<legacyDrawing r:id="rId1"/></worksheet>';
  return raw.split('128').join(String(lastRow));
}

function buildSheet1Xml(rows: ParticipantExportRow[]): string {
  const lastRow = rows.length + 1;
  const dataRows = rows.map((row, i) => buildParticipantRow(i + 2, row)).join('');
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    SHEET1_HEADER.replace('__LASTROW__', String(lastRow)) +
    HEADER_ROW_1 +
    dataRows +
    sheet1Footer(lastRow)
  );
}

// --- "Dashboard" sheet (sheet2.xml) — KPI cards (static formulas replaced with the literal,
// already-computed values/percentages) + 4 native charts' backing category tables -----------------

interface CategoryEntry {
  label: string;
  count: number;
}

// header row style, label(S) style, value(T) style — identical across all 4 blocks in the template.
const CAT_HEADER_STYLE = 8;
const CAT_LABEL_STYLE = 9;
const CAT_VALUE_STYLE = 10;

interface CategoryBlock {
  headerRow: number;
  firstDataRow: number;
  lastDataRow: number;
  entries: CategoryEntry[];
}

function countBy(rows: ParticipantExportRow[], pick: (r: ParticipantExportRow) => string): CategoryEntry[] {
  const counts = new Map<string, number>();
  for (const r of rows) {
    const label = pick(r);
    if (!label) continue;
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return [...counts.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);
}

// Gender is always shown as both fixed categories (even 0) since chart3 is a 2-slice pie whose
// slice colors are hardcoded per-index in the template — see buildChart's `fixedGender` path.
function genderBreakdown(rows: ParticipantExportRow[]): CategoryEntry[] {
  const counts = new Map<string, number>([['ذكر', 0], ['أنثى', 0]]);
  for (const r of rows) {
    if (r.gender && counts.has(r.gender)) counts.set(r.gender, (counts.get(r.gender) ?? 0) + 1);
  }
  return [...counts.entries()].map(([label, count]) => ({ label, count }));
}

function categoryRows(block: CategoryBlock, headerLabel: string): string {
  const header = `<row r="${block.headerRow}" spans="19:20" x14ac:dyDescent="0.7"><c r="S${block.headerRow}" s="${CAT_HEADER_STYLE}" t="inlineStr"><is><t>${escapeXml(headerLabel)}</t></is></c><c r="T${block.headerRow}" s="${CAT_HEADER_STYLE}" t="inlineStr"><is><t>العدد</t></is></c></row>`;
  const data = block.entries
    .map((e, i) => {
      const r = block.firstDataRow + i;
      return `<row r="${r}" spans="19:20" x14ac:dyDescent="0.7"><c r="S${r}" s="${CAT_LABEL_STYLE}" t="inlineStr"><is><t>${escapeXml(e.label)}</t></is></c><c r="T${r}" s="${CAT_VALUE_STYLE}"><v>${e.count}</v></c></row>`;
    })
    .join('');
  return header + data;
}

// Lays out the 4 category blocks sequentially (header + N data rows + 1 blank-row gap, exactly the
// template's own convention), starting at row 41 — every block's position depends on how many
// entries the *previous* blocks needed, so charts' cell references are recomputed to match (see
// buildChart) rather than assumed fixed.
function layoutCategoryBlocks(entriesList: CategoryEntry[][]): CategoryBlock[] {
  let row = 41;
  return entriesList.map((entries) => {
    const headerRow = row;
    const firstDataRow = row + 1;
    const safeEntries = entries.length > 0 ? entries : [{ label: 'لا يوجد بيانات', count: 0 }];
    const lastDataRow = firstDataRow + safeEntries.length - 1;
    row = lastDataRow + 2; // one blank row before the next block
    return { headerRow, firstDataRow, lastDataRow, entries: safeEntries };
  });
}

function pct(numerator: number, denominator: number): string {
  if (denominator <= 0) return '0.0%';
  return `${((numerator / denominator) * 100).toFixed(1)}%`;
}

const DASH_HEADER =
  '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" mc:Ignorable="x14ac xr xr2 xr3" xmlns:x14ac="http://schemas.microsoft.com/office/spreadsheetml/2009/9/ac" xmlns:xr="http://schemas.microsoft.com/office/spreadsheetml/2014/revision" xmlns:xr2="http://schemas.microsoft.com/office/spreadsheetml/2015/revision2" xmlns:xr3="http://schemas.microsoft.com/office/spreadsheetml/2016/revision3" xr:uid="{495C92FE-059A-484A-8008-774ACCD5F298}">' +
  '<dimension ref="B2:T__LASTROW__"/>' +
  '<sheetViews><sheetView showGridLines="0" rightToLeft="1" tabSelected="1" workbookViewId="0"><selection activeCell="B2" sqref="B2"/></sheetView></sheetViews>' +
  '<sheetFormatPr defaultRowHeight="19.5" x14ac:dyDescent="0.7"/>' +
  '<cols><col min="1" max="1" width="3" style="6" customWidth="1"/><col min="2" max="4" width="8.6640625" style="6"/><col min="5" max="5" width="2.33203125" style="6" customWidth="1"/><col min="6" max="8" width="8.6640625" style="6"/><col min="9" max="9" width="2.33203125" style="6" customWidth="1"/><col min="10" max="12" width="8.6640625" style="6"/><col min="13" max="13" width="2.33203125" style="6" customWidth="1"/><col min="14" max="16" width="8.6640625" style="6"/><col min="17" max="17" width="3" style="6" customWidth="1"/><col min="18" max="18" width="8.6640625" style="6"/><col min="19" max="19" width="23.33203125" style="6" customWidth="1"/><col min="20" max="20" width="8" style="6" customWidth="1"/><col min="21" max="16384" width="8.6640625" style="6"/></cols>' +
  '<sheetData>';

const DASH_ROW_2 = '<row r="2" spans="2:16" ht="40" customHeight="1" x14ac:dyDescent="0.7"><c r="B2" s="18" t="s"><v>443</v></c><c r="C2" s="19"/><c r="D2" s="19"/><c r="E2" s="19"/><c r="F2" s="19"/><c r="G2" s="19"/><c r="H2" s="19"/><c r="I2" s="19"/><c r="J2" s="19"/><c r="K2" s="19"/><c r="L2" s="19"/><c r="M2" s="19"/><c r="N2" s="19"/><c r="O2" s="19"/><c r="P2" s="19"/></row>';

const DASH_ROW_4 =
  '<row r="4" spans="2:16" ht="26" customHeight="1" x14ac:dyDescent="0.7">' +
  '<c r="B4" s="20" t="s"><v>444</v></c><c r="C4" s="20"/><c r="D4" s="20"/>' +
  '<c r="F4" s="23" t="s"><v>446</v></c><c r="G4" s="23"/><c r="H4" s="23"/>' +
  '<c r="J4" s="27" t="s"><v>447</v></c><c r="K4" s="27"/><c r="L4" s="27"/>' +
  '<c r="N4" s="14" t="s"><v>9</v></c><c r="O4" s="14"/><c r="P4" s="14"/></row>';

const DASH_ROW_39 = '<row r="39" spans="19:20" x14ac:dyDescent="0.7"><c r="S39" s="7" t="s"><v>450</v></c></row>';

function buildDashRow5(registered: number, accepted: number, attendance: number, actualAttendance: number): string {
  return (
    '<row r="5" spans="2:16" ht="54" customHeight="1" x14ac:dyDescent="0.7">' +
    `<c r="B5" s="21"><v>${registered}</v></c><c r="C5" s="21"/><c r="D5" s="21"/>` +
    `<c r="F5" s="24"><v>${accepted}</v></c><c r="G5" s="24"/><c r="H5" s="24"/>` +
    `<c r="J5" s="28"><v>${attendance}</v></c><c r="K5" s="28"/><c r="L5" s="28"/>` +
    `<c r="N5" s="15"><v>${actualAttendance}</v></c><c r="O5" s="15"/><c r="P5" s="15"/></row>`
  );
}

function buildDashRow6(registered: number, accepted: number, attendance: number, actualAttendance: number): string {
  const acceptedPct = `${pct(accepted, registered)} من المتقدمين`;
  const attendancePct = `${pct(attendance, accepted)} من المقبولين`;
  const actualPct = `${pct(actualAttendance, attendance)} من الحضور`;
  return (
    '<row r="6" spans="2:16" ht="20" customHeight="1" x14ac:dyDescent="0.7">' +
    '<c r="B6" s="22" t="s"><v>445</v></c><c r="C6" s="22"/><c r="D6" s="22"/>' +
    `<c r="F6" s="25" t="inlineStr"><is><t>${escapeXml(acceptedPct)}</t></is></c><c r="G6" s="26"/><c r="H6" s="26"/>` +
    `<c r="J6" s="29" t="inlineStr"><is><t>${escapeXml(attendancePct)}</t></is></c><c r="K6" s="30"/><c r="L6" s="30"/>` +
    `<c r="N6" s="16" t="inlineStr"><is><t>${escapeXml(actualPct)}</t></is></c><c r="O6" s="17"/><c r="P6" s="17"/></row>`
  );
}

const DASH_FOOTER =
  '</sheetData><mergeCells count="13"><mergeCell ref="N4:P4"/><mergeCell ref="N5:P5"/><mergeCell ref="N6:P6"/><mergeCell ref="B2:P2"/><mergeCell ref="B4:D4"/><mergeCell ref="B5:D5"/><mergeCell ref="B6:D6"/><mergeCell ref="F4:H4"/><mergeCell ref="F5:H5"/><mergeCell ref="F6:H6"/><mergeCell ref="J4:L4"/><mergeCell ref="J5:L5"/><mergeCell ref="J6:L6"/></mergeCells>' +
  '<pageMargins left="0.7" right="0.7" top="0.75" bottom="0.75" header="0.3" footer="0.3"/><drawing r:id="rId1"/></worksheet>';

interface DashboardResult {
  xml: string;
  blocks: { type: CategoryBlock; region: CategoryBlock; gender: CategoryBlock; field: CategoryBlock };
}

function buildSheet2Xml(rows: ParticipantExportRow[]): DashboardResult {
  const registered = rows.length;
  const accepted = rows.filter((r) => r.acceptanceStatus === 'مقبول').length;
  const attendance = rows.filter((r) => r.attendanceStatus === 'حضور فعلي' || r.attendanceStatus === 'حضور جزئي').length;
  const actualAttendance = rows.filter((r) => r.actualAttendance === 'نعم').length;

  const typeEntries = countBy(rows, (r) => r.workshopType);
  const regionEntries = countBy(rows, (r) => r.region);
  const genderEntries = genderBreakdown(rows);
  const fieldEntries = countBy(rows, (r) => r.workshopField);

  const [typeBlock, regionBlock, genderBlock, fieldBlock] = layoutCategoryBlocks([
    typeEntries,
    regionEntries,
    genderEntries,
    fieldEntries,
  ]);

  const lastRow = fieldBlock.lastDataRow;

  const body =
    DASH_ROW_2 +
    DASH_ROW_4 +
    buildDashRow5(registered, accepted, attendance, actualAttendance) +
    buildDashRow6(registered, accepted, attendance, actualAttendance) +
    DASH_ROW_39 +
    categoryRows(typeBlock, 'نوع الورشة') +
    categoryRows(regionBlock, 'المنطقة') +
    categoryRows(genderBlock, 'الجنس') +
    categoryRows(fieldBlock, 'مجال الورشة');

  const xml =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    DASH_HEADER.replace('__LASTROW__', String(lastRow)) +
    body +
    DASH_FOOTER;

  return { xml, blocks: { type: typeBlock, region: regionBlock, gender: genderBlock, field: fieldBlock } };
}

// --- native chart rebuilds (chart1=type doughnut, chart2=region bar, chart3=gender pie, chart4=field bar) ---

// Rebuilds a chart series' name/category/value cell references + cached data to match a
// (possibly resized) category block. `stripDpt` removes the template's hardcoded per-slice
// <c:dPt> color overrides (sized for the template's original 2-category dummy data) so the chart
// falls back to Excel's automatic varied coloring instead of only coloring the first N slices.
function rebuildChartSeries(xml: string, nameCellRef: string, catRange: string, valRange: string, entries: CategoryEntry[], stripDpt: boolean): string {
  let out = xml;

  out = out.replace(/(<c:tx><c:strRef><c:f>)[^<]*(<\/c:f>)/, `$1${nameCellRef}$2`);

  const catPts = entries.map((e, i) => `<c:pt idx="${i}"><c:v>${escapeXml(e.label)}</c:v></c:pt>`).join('');
  out = out.replace(
    /<c:cat><c:strRef><c:f>[^<]*<\/c:f><c:strCache>[\s\S]*?<\/c:strCache><\/c:strRef><\/c:cat>/,
    `<c:cat><c:strRef><c:f>${catRange}</c:f><c:strCache><c:ptCount val="${entries.length}"/>${catPts}</c:strCache></c:strRef></c:cat>`,
  );

  const valPts = entries.map((e, i) => `<c:pt idx="${i}"><c:v>${e.count}</c:v></c:pt>`).join('');
  out = out.replace(
    /<c:val><c:numRef><c:f>[^<]*<\/c:f><c:numCache>\s*<c:formatCode>[^<]*<\/c:formatCode>[\s\S]*?<\/c:numCache><\/c:numRef><\/c:val>/,
    `<c:val><c:numRef><c:f>${valRange}</c:f><c:numCache><c:formatCode>General</c:formatCode><c:ptCount val="${entries.length}"/>${valPts}</c:numCache></c:numRef></c:val>`,
  );

  if (stripDpt) {
    out = out.replace(/<c:dPt>[\s\S]*?<\/c:dPt>/g, '');
  }

  return out;
}

// chart3 (gender pie) keeps its 2 hardcoded <c:dPt> color slices untouched (gender is always
// exactly 2 categories) — only its cell references move if earlier blocks resized, and its 2
// cached values are refreshed in place, mirroring buildReportPptx.ts's setDoughnutValues. The
// value swap is done on the <c:val>...<c:numCache> substring in isolation (not the whole
// document) — an idx="0"/"1" <c:pt> pattern also appears in the series-name and category caches,
// so an unscoped replace corrupts whichever of those happens to come first in document order.
function updateFixedCategoryChart(xml: string, nameCellRef: string, catRange: string, valRange: string, entries: CategoryEntry[]): string {
  let out = xml;
  out = out.replace(/(<c:tx><c:strRef><c:f>)[^<]*(<\/c:f>)/, `$1${nameCellRef}$2`);
  out = out.replace(/(<c:cat><c:strRef><c:f>)[^<]*(<\/c:f>)/, `$1${catRange}$2`);
  out = out.replace(/(<c:val><c:numRef><c:f>)[^<]*(<\/c:f>)/, `$1${valRange}$2`);

  const numCacheMatch = /<c:val>[\s\S]*?<c:numCache>([\s\S]*?)<\/c:numCache>[\s\S]*?<\/c:val>/.exec(out);
  if (numCacheMatch) {
    let cache = numCacheMatch[1];
    entries.forEach((e, i) => {
      const ptPattern = new RegExp(`(<c:pt idx="${i}">\\s*<c:v>)[^<]*(</c:v>\\s*</c:pt>)`);
      cache = cache.replace(ptPattern, `$1${e.count}$2`);
    });
    out = out.replace(numCacheMatch[1], cache);
  }

  return out;
}

function chartRefs(block: CategoryBlock) {
  return {
    nameCellRef: `Dashboard!$T$${block.headerRow}`,
    catRange: `Dashboard!$S$${block.firstDataRow}:$S$${block.lastDataRow}`,
    valRange: `Dashboard!$T$${block.firstDataRow}:$T$${block.lastDataRow}`,
  };
}

export async function buildParticipantsXlsx(rows: ParticipantExportRow[]): Promise<Buffer> {
  const templateBuffer = await fs.promises.readFile(TEMPLATE_PATH);
  const zip = new PizZip(templateBuffer);

  zip.file('xl/worksheets/sheet1.xml', buildSheet1Xml(rows));

  const { xml: sheet2Xml, blocks } = buildSheet2Xml(rows);
  zip.file('xl/worksheets/sheet2.xml', sheet2Xml);

  const typeRefs = chartRefs(blocks.type);
  const regionRefs = chartRefs(blocks.region);
  const genderRefs = chartRefs(blocks.gender);
  const fieldRefs = chartRefs(blocks.field);

  const chart1 = zip.file('xl/charts/chart1.xml')?.asText();
  if (chart1) zip.file('xl/charts/chart1.xml', rebuildChartSeries(chart1, typeRefs.nameCellRef, typeRefs.catRange, typeRefs.valRange, blocks.type.entries, true));

  const chart2 = zip.file('xl/charts/chart2.xml')?.asText();
  if (chart2) zip.file('xl/charts/chart2.xml', rebuildChartSeries(chart2, regionRefs.nameCellRef, regionRefs.catRange, regionRefs.valRange, blocks.region.entries, false));

  const chart3 = zip.file('xl/charts/chart3.xml')?.asText();
  if (chart3) zip.file('xl/charts/chart3.xml', updateFixedCategoryChart(chart3, genderRefs.nameCellRef, genderRefs.catRange, genderRefs.valRange, blocks.gender.entries));

  const chart4 = zip.file('xl/charts/chart4.xml')?.asText();
  if (chart4) zip.file('xl/charts/chart4.xml', rebuildChartSeries(chart4, fieldRefs.nameCellRef, fieldRefs.catRange, fieldRefs.valRange, blocks.field.entries, false));

  // The template's cached formulas (KPI COUNTA/COUNTIF, category COUNTIFs) are gone — replaced by
  // literal values above — so the stale calcChain (and its now-dangling content-type/relationship
  // entries) is dropped rather than left to reference cells that no longer carry formulas; Excel
  // rebuilds a calc chain on open automatically when one is absent.
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
    zip.file(
      'xl/_rels/workbook.xml.rels',
      workbookRels.replace(/<Relationship Id="rId7"[^/]*Target="calcChain\.xml"\/>/, ''),
    );
  }

  return zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' });
}
