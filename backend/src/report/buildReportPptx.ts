import * as fs from 'node:fs';
import * as path from 'node:path';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import { fileURLToPath } from 'node:url';
import type { ReportContent } from './reportContent.js';
import {
  GLOBAL_TEXT_REPLACEMENTS,
  SHAPE_TEXT_REPLACEMENTS,
  TYPE_DATE_CITY_CARD,
  RUN_TEXT_REPLACEMENTS,
  AXES_SLIDE4,
  AXES_SLIDE6,
  KEY_FEEDBACK_ANCHORS,
  SUGGESTIONS_ANCHORS,
  SLIDE8_TRAINER_ROWS,
  SLIDE8_CONTENT_ROWS,
  SLIDE8_ORGANIZATION_ROWS,
  type NumberedBoxSlot,
  type QuestionBarRow,
} from './pptxEdits.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATE_PATH = path.join(__dirname, '..', '..', 'templates', 'workshop-report-template.pptx');

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function findShapeBlock(xml: string, shapeName: string): { start: number; end: number; block: string } | null {
  const namePattern = new RegExp(`<p:sp>(?:(?!</p:sp>)[\\s\\S])*?name="${escapeRegExp(shapeName)}"[\\s\\S]*?</p:sp>`);
  const m = namePattern.exec(xml);
  if (!m) return null;
  return { start: m.index, end: m.index + m[0].length, block: m[0] };
}

// Slide 8's per-sub-question "poor/neutral/excellent" mini bar-charts live inside 9 repeated
// grouped shapes that all share the same shape *names* ("Text 134" etc. appear 9 times each) —
// only each shape's <p:cNvPr id="…"> is unique, resolved once via the group transform math (see
// conversation history) and hardcoded per-id in pptxEdits.ts's SLIDE8_QUESTION_BARS.
function findShapeBlockById(xml: string, shapeId: string): { start: number; end: number; block: string } | null {
  const idPattern = new RegExp(`<p:sp>(?:(?!</p:sp>)[\\s\\S])*?id="${escapeRegExp(shapeId)}"[\\s\\S]*?</p:sp>`);
  const m = idPattern.exec(xml);
  if (!m) return null;
  return { start: m.index, end: m.index + m[0].length, block: m[0] };
}

// Collapses every <a:t> run inside the shape down to a single run carrying `newText`, blanking
// the rest — used both for "one tag replaces a whole multi-run sentence" (the headline) and for
// simple single-value shapes, so surrounding template prose never leaks into the rendered output.
function setShapeText(xml: string, shapeName: string, newText: string): string {
  const found = findShapeBlock(xml, shapeName);
  if (!found) return xml;
  let seenFirst = false;
  const newBlock = found.block.replace(/<a:t>([\s\S]*?)<\/a:t>/g, () => {
    if (!seenFirst) {
      seenFirst = true;
      return `<a:t>${newText}</a:t>`;
    }
    return `<a:t></a:t>`;
  });
  return xml.slice(0, found.start) + newBlock + xml.slice(found.end);
}

// Replaces just ONE specific run's text within a named shape, leaving every sibling run
// (e.g. a "اناث"/"ذكور" label sharing the same shape as its "#" count run) untouched — unlike
// setShapeText, which intentionally blanks every other run.
function replaceRunInShape(xml: string, shapeName: string, oldRunText: string, newRunText: string): string {
  const found = findShapeBlock(xml, shapeName);
  if (!found) {
    // eslint-disable-next-line no-console
    console.warn(`[report] replaceRunInShape: shape "${shapeName}" not found — no-op`);
    return xml;
  }
  const runPattern = new RegExp(`<a:t>${escapeRegExp(oldRunText)}</a:t>`);
  if (!runPattern.test(found.block)) {
    // A silent miss here (e.g. a curly vs. straight quote mismatch) leaves the original
    // template text in place with no error — surfaced loudly so it's caught in testing, not
    // discovered later in a downloaded file.
    // eslint-disable-next-line no-console
    console.warn(`[report] replaceRunInShape: run text not found in shape "${shapeName}" — expected exact text: ${JSON.stringify(oldRunText)}`);
    return xml;
  }
  const newBlock = found.block.replace(runPattern, `<a:t>${newRunText}</a:t>`);
  return xml.slice(0, found.start) + newBlock + xml.slice(found.end);
}

function deleteShapeByName(xml: string, shapeName: string): string {
  const found = findShapeBlock(xml, shapeName);
  if (!found) return xml;
  return xml.slice(0, found.start) + xml.slice(found.end);
}

function deleteShapeById(xml: string, shapeId: string): string {
  const found = findShapeBlockById(xml, shapeId);
  if (!found) return xml;
  return xml.slice(0, found.start) + xml.slice(found.end);
}

// Same "collapse every run down to one" behavior as setShapeText, but resolved by <p:cNvPr id>
// instead of name — needed for slide 8's poor/neutral/excellent value boxes, which all share the
// generic name "Text 134" (see pptxEdits.ts).
function setShapeTextById(xml: string, shapeId: string, newText: string): string {
  const found = findShapeBlockById(xml, shapeId);
  if (!found) return xml;
  let seenFirst = false;
  const newBlock = found.block.replace(/<a:t>([\s\S]*?)<\/a:t>/g, () => {
    if (!seenFirst) {
      seenFirst = true;
      return `<a:t>${newText}</a:t>`;
    }
    return `<a:t></a:t>`;
  });
  return xml.slice(0, found.start) + newBlock + xml.slice(found.end);
}

function findShapeBlockContainingText(xml: string, anchorText: string): { start: number; end: number; block: string } | null {
  const pattern = new RegExp(`<p:sp>(?:(?!</p:sp>)[\\s\\S])*?${escapeRegExp(anchorText)}[\\s\\S]*?</p:sp>`);
  const m = pattern.exec(xml);
  if (!m) return null;
  return { start: m.index, end: m.index + m[0].length, block: m[0] };
}

function deleteShapeContainingText(xml: string, anchorText: string): string {
  const found = findShapeBlockContainingText(xml, anchorText);
  if (!found) return xml;
  return xml.slice(0, found.start) + xml.slice(found.end);
}

// Same "collapse every run down to one" behavior as setShapeText, but the shape is located by the
// literal placeholder text it currently contains rather than by shape name — needed for the
// "أهم الملاحظات"/"أهم المقترحات" slots, which repeat the same shape *name* across slots 3-5.
// Real respondent free text (unlike every other setShapeText caller, which only ever inserts a
// docxtemplater {tag}) can contain XML-unsafe characters, so it's escaped here.
function setShapeTextByAnchor(xml: string, anchorText: string, newText: string): string {
  const found = findShapeBlockContainingText(xml, anchorText);
  if (!found) return xml;
  let seenFirst = false;
  const newBlock = found.block.replace(/<a:t>([\s\S]*?)<\/a:t>/g, () => {
    if (!seenFirst) {
      seenFirst = true;
      return `<a:t>${escapeXml(newText)}</a:t>`;
    }
    return `<a:t></a:t>`;
  });
  return xml.slice(0, found.start) + newBlock + xml.slice(found.end);
}

// Fills as many anchor-text slots as real data provides (in order) and deletes the rest — the
// same "Stage-2 code deletes unused boxes" behavior as fillNumberedBoxes, just keyed by anchor
// text instead of shape name.
function fillAnchorTextSlots(xml: string, anchors: string[], items: string[]): string {
  let out = xml;
  anchors.forEach((anchor, i) => {
    if (i < items.length) {
      out = setShapeTextByAnchor(out, anchor, items[i]);
    } else {
      out = deleteShapeContainingText(out, anchor);
    }
  });
  return out;
}

// Fills as many (title, badge) slots as real data provides and deletes the rest entirely —
// the "Stage-2 code deletes unused boxes" behavior. Badge numbers (1, 2, 3...) are left
// untouched since slot order already matches their printed sequence.
function fillNumberedBoxes(xml: string, slots: NumberedBoxSlot[], count: number, titleTag: (i: number) => string): string {
  let out = xml;
  slots.forEach((slot, i) => {
    if (i < count) {
      out = setShapeText(out, slot.titleShape, titleTag(i));
    } else {
      out = deleteShapeByName(out, slot.titleShape);
      if (slot.badgeShape) out = deleteShapeByName(out, slot.badgeShape);
    }
  });
  return out;
}

// Slide 8's per-question poor/neutral/excellent column (see pptxEdits.ts docblock above
// SLIDE8_TRAINER_ROWS): fills row 1 with the real bucketed percentages when data exists, and
// always deletes every other row (there's only ever 1 real sub-question per column now, not the
// template's original up-to-3) — a `null` breakdown (no data source, e.g. the organization
// column) deletes the whole column, row 1 included.
function fillQuestionBreakdownColumn(xml: string, rows: QuestionBarRow[], breakdown: { poor: number; neutral: number; excellent: number } | null): string {
  let out = xml;
  rows.forEach((row, i) => {
    if (i === 0 && breakdown) {
      out = setShapeTextById(out, row.bars.poorId, String(breakdown.poor));
      out = setShapeTextById(out, row.bars.neutralId, String(breakdown.neutral));
      out = setShapeTextById(out, row.bars.excellentId, String(breakdown.excellent));
    } else {
      out = deleteShapeById(out, row.bars.poorId);
      out = deleteShapeById(out, row.bars.neutralId);
      out = deleteShapeById(out, row.bars.excellentId);
      out = deleteShapeByName(out, row.label);
    }
  });
  return out;
}

// --- native chart value updates (chart1.xml / chart2.xml = age doughnuts, chart3.xml = by_experience bar) ---

function setDoughnutValues(xml: string, values: number[]): string {
  const numCacheMatch = /<c:val>[\s\S]*?<c:numCache>([\s\S]*?)<\/c:numCache>[\s\S]*?<\/c:val>/.exec(xml);
  if (!numCacheMatch) return xml;
  let cache = numCacheMatch[1];
  values.forEach((v, i) => {
    const ptPattern = new RegExp(`(<c:pt idx="${i}">\\s*<c:v>)[^<]*(</c:v>\\s*</c:pt>)`);
    cache = cache.replace(ptPattern, `$1${v}$2`);
  });
  return xml.replace(numCacheMatch[1], cache);
}

// Rebuilds the bar chart's category/value point lists to match however many real entries exist
// (the template ships with exactly 1 placeholder category), updating both ptCount attributes.
function setBarChartSeries(xml: string, entries: { label: string; count: number }[]): string {
  let out = xml;
  const catPts = entries.map((e, i) => `<c:pt idx="${i}"><c:v>${escapeXml(e.label)}</c:v></c:pt>`).join('');
  const valPts = entries.map((e, i) => `<c:pt idx="${i}"><c:v>${e.count}</c:v></c:pt>`).join('');

  out = out.replace(/(<c:cat>[\s\S]*?<c:strCache>\s*<c:ptCount val=")\d+("\/>)[\s\S]*?(<\/c:strCache>)/, (_m, pre, post, close) => {
    return `${pre}${entries.length}${post}${catPts}${close}`;
  });
  out = out.replace(/(<c:val>[\s\S]*?<c:numCache>\s*<c:formatCode>[^<]*<\/c:formatCode>\s*<c:ptCount val=")\d+("\/>)[\s\S]*?(<\/c:numCache>)/, (_m, pre, post, close) => {
    return `${pre}${entries.length}${post}${valPts}${close}`;
  });
  return out;
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

// docxtemplater's core parser does NOT resolve dotted paths against a nested object by default
// (that requires the angular-expressions parser module) — every {a.b.c} tag is looked up as a
// literal top-level key. Rather than add that dependency, the render data is flattened here so
// its keys are exactly the dot-paths used throughout pptxEdits.ts (e.g. "executive_summary.headline",
// "executive_summary.axes.0.title").
function flatten(value: unknown, prefix: string, out: Record<string, unknown>): void {
  if (Array.isArray(value)) {
    value.forEach((v, i) => flatten(v, prefix ? `${prefix}.${i}` : String(i), out));
    return;
  }
  if (value !== null && typeof value === 'object') {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      flatten(v, prefix ? `${prefix}.${k}` : k, out);
    }
    return;
  }
  out[prefix] = value;
}

export async function buildReportPptx(content: ReportContent): Promise<Buffer> {
  const templateBuffer = await fs.promises.readFile(TEMPLATE_PATH);
  const zip = new PizZip(templateBuffer);

  // --- 1. numbered-box fill/delete + shape-targeted + global text edits, per slide -----------
  const slidePaths: Record<number, string> = {
    1: 'ppt/slides/slide1.xml',
    4: 'ppt/slides/slide4.xml',
    6: 'ppt/slides/slide6.xml',
    7: 'ppt/slides/slide7.xml',
    8: 'ppt/slides/slide8.xml',
  };

  for (const [slideNumStr, slidePath] of Object.entries(slidePaths)) {
    const slideNum = Number(slideNumStr);
    let xml = zip.file(slidePath)?.asText();
    if (xml === undefined) continue;

    if (slideNum === 4) {
      xml = fillNumberedBoxes(xml, AXES_SLIDE4, content.executive_summary.axes.length, (i) => `{executive_summary.axes.${i}.title}`);
      const quoteCount = content.executive_summary.participant_quotes.length;
      // Quote boxes are handled by the same fill/delete rule as axes, but their tags are already
      // registered as global bracket-placeholder replacements — only deletion for unused slots
      // needs handling here.
      const quoteAnchors = ['(الرأي الأول)', '(الرأي الثاني)', '(الرأي الثالث)'];
      quoteAnchors.forEach((anchor, i) => {
        if (i >= quoteCount) xml = deleteShapeContainingText(xml as string, anchor);
      });
    }
    if (slideNum === 6) {
      xml = fillNumberedBoxes(xml, AXES_SLIDE6, content.detailed_report.axes.length, (i) => `{detailed_report.axes.${i}.title}`);
    }
    if (slideNum === 8) {
      xml = fillAnchorTextSlots(xml, KEY_FEEDBACK_ANCHORS, content.satisfaction.key_feedback);
      xml = fillAnchorTextSlots(xml, SUGGESTIONS_ANCHORS, content.satisfaction.suggestions);
      // "التقييم حسب المحاور الرئيسية" sub-question grid — see pptxEdits.ts docblock.
      xml = fillQuestionBreakdownColumn(xml, SLIDE8_TRAINER_ROWS, content.satisfaction.question_breakdown.trainer);
      xml = fillQuestionBreakdownColumn(xml, SLIDE8_CONTENT_ROWS, content.satisfaction.question_breakdown.content);
      xml = fillQuestionBreakdownColumn(xml, SLIDE8_ORGANIZATION_ROWS, null);
    }

    for (const rep of SHAPE_TEXT_REPLACEMENTS) {
      if (rep.slide !== slideNum) continue;
      xml = setShapeText(xml, rep.shapeName, rep.replaceWith);
    }
    for (const rep of TYPE_DATE_CITY_CARD) {
      if (rep.slide !== slideNum) continue;
      xml = setShapeText(xml, rep.shapeName, rep.replaceWith);
    }
    for (const run of RUN_TEXT_REPLACEMENTS) {
      if (run.slide !== slideNum) continue;
      xml = replaceRunInShape(xml, run.shapeName, run.oldRunText, run.newRunText);
    }
    for (const rep of GLOBAL_TEXT_REPLACEMENTS) {
      xml = xml.split(rep.find).join(rep.replaceWith);
    }

    zip.file(slidePath, xml);
  }

  // --- 2. render tags via docxtemplater -------------------------------------------------------
  const byRegionTop = content.statistics.by_region[0] ?? { region: 'N/A', count: 0 };
  const renderData: Record<string, unknown> = {};
  flatten(content, '', renderData);
  renderData.__by_region_label = byRegionTop.region;
  renderData.__by_region_count = byRegionTop.count;

  const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true, delimiters: { start: '{', end: '}' }, nullGetter: () => 'N/A' });
  doc.render(renderData);
  const renderedZip = doc.getZip();

  // --- 3. native chart data (age doughnuts + by_experience bar) --------------------------------
  const ageValues = content.executive_summary.overview.age_distribution.map((a) => a.count);
  const statsAgeValues = content.statistics.by_age.map((a) => a.count);

  const chart1 = renderedZip.file('ppt/charts/chart1.xml')?.asText();
  if (chart1) renderedZip.file('ppt/charts/chart1.xml', setDoughnutValues(chart1, ageValues));

  const chart2 = renderedZip.file('ppt/charts/chart2.xml')?.asText();
  if (chart2) renderedZip.file('ppt/charts/chart2.xml', setDoughnutValues(chart2, statsAgeValues));

  const chart3 = renderedZip.file('ppt/charts/chart3.xml')?.asText();
  if (chart3) renderedZip.file('ppt/charts/chart3.xml', setBarChartSeries(chart3, content.statistics.by_experience));

  return renderedZip.generate({ type: 'nodebuffer', compression: 'DEFLATE' });
}
