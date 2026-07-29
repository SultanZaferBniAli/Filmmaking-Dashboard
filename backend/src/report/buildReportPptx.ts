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
  SLIDE8_RATING_SCORE_LABELS,
  type NumberedBoxSlot,
} from './pptxEdits.js';
import { setShapeText, replaceRunInShape, deleteShapeByName, deleteShapeContainingText, setShapeTextByAnchor, escapeXml } from './pptxXml.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATE_PATH = path.join(__dirname, '..', '..', 'templates', 'workshop-report-template.pptx');

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

// --- native chart value updates (chart1.xml / chart2.xml = age doughnuts, chart3.xml = by_experience
// bar, chart4.xml / chart5.xml = star-rating bars, chart6.xml = response-rate doughnut) ---

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

// chart4/chart5's star-rating bars are PowerPoint's picture-fill trick: series 0 ("5 Stars") is a
// fixed grey 5-star background image stretched to a constant value of 5, and series 1 ("Rating")
// is a gold star image stretched to the real score out of 5, drawn on top — so only series 1's
// (the second <c:val>...</c:val> block's) cached points need updating; series 0 stays at 5.
function setStarRatingValues(xml: string, values: number[]): string {
  const valBlocks = [...xml.matchAll(/<c:val>[\s\S]*?<\/c:val>/g)];
  if (valBlocks.length < 2) return xml;
  const ratingBlock = valBlocks[1];
  let updated = ratingBlock[0];
  values.forEach((v, i) => {
    const ptPattern = new RegExp(`(<c:pt idx="${i}">\\s*<c:v>)[^<]*(</c:v>\\s*</c:pt>)`);
    updated = updated.replace(ptPattern, `$1${v}$2`);
  });
  const start = ratingBlock.index as number;
  return xml.slice(0, start) + updated + xml.slice(start + ratingBlock[0].length);
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
      // The shape's fixed-width box only ever fit the template's own 3-character sample ("5/5") —
      // "لا يوجد" overflows onto a second line, so "no responses" gets a bare dash instead. Ratings
      // that are all close together (e.g. 4.0-4.4) round to the same whole star and become visually
      // indistinguishable, so this shows the real 1-decimal average (already at most 3 characters,
      // e.g. "4.4") rather than rounding it away — dropping the "/5" suffix keeps it the same width
      // as the template's own sample text.
      content.satisfaction.numeric_ratings.forEach((r, i) => {
        xml = setShapeText(xml as string, SLIDE8_RATING_SCORE_LABELS[i], r.average !== null ? `${r.average}` : '-');
      });
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

  // Slide 8 ships 3 native charts for its rating/response-rate section: a 5-category star-rating
  // grid ("التقييم حسب المحاور الرئيسية"), a 1-category star-rating bar ("إجمالي التقييم العام"),
  // and a response-rate doughnut ("المشاركات المستلمة مقارنة بعدد الحضور"). Their XML part NUMBERS
  // (chart4.xml/chart5.xml/chart6.xml) are NOT stable identifiers — a plain re-save in PowerPoint
  // (e.g. after nudging a shape) reassigned which number backed the single-bar chart vs the
  // doughnut between two revisions of the same template, with no visible change on the slide. So
  // each part is identified here by its actual chart type + category count instead of by filename.
  for (const chartFile of ['chart4.xml', 'chart5.xml', 'chart6.xml']) {
    const xml = renderedZip.file(`ppt/charts/${chartFile}`)?.asText();
    if (xml === undefined) continue;

    if (/<c:doughnutChart>/.test(xml)) {
      // idx0 is the filled/colored slice, idx1 is the remainder — mirrors the rounded
      // satisfaction.response_rate text (Text 97) rather than recomputing an unrounded fraction,
      // so the doughnut and the "%" label next to it always agree.
      const totalAttendance = content.satisfaction.total_attendance;
      const responsesReceived = content.satisfaction.responses_received;
      const filledPct = totalAttendance > 0 ? Math.min(Math.round((responsesReceived / totalAttendance) * 100), 100) : 0;
      renderedZip.file(`ppt/charts/${chartFile}`, setDoughnutValues(xml, [filledPct / 100, 1 - filledPct / 100]));
      continue;
    }

    const catCountMatch = /<c:cat>[\s\S]*?<c:ptCount val="(\d+)"/.exec(xml);
    const catCount = catCountMatch ? Number(catCountMatch[1]) : 0;

    if (catCount === 5) {
      // The 5-question grid's category axis is hidden (<c:delete val="1"/> in the template) — the
      // row question text ("ما مستوى رضاك العام…", etc.) is a set of separate static shapes laid
      // out top-to-bottom in normal reading order, NOT the chart's own axis labels. But
      // PowerPoint's default rendering for a horizontal ("bar"-direction) chart plots category
      // idx0 at the BOTTOM row and idx(n-1) at the TOP — verified against the template's own
      // bundled sample data (4.3/3.2/1.8/1.2/5 renders as a clean 5/1/2/3/4-star top-to-bottom
      // pattern, only consistent with a bottom-up axis) and re-confirmed with fully distinct
      // synthetic values (1/2/3/4/5) landing on their exact matching row. So the values must be
      // reversed here to land on the correct row: numeric_ratings[0] (overall_rating, meant for
      // the TOP row) has to go in idx4, not idx0.
      const ratings = content.satisfaction.numeric_ratings.map((r) => r.average ?? 0).reverse();
      renderedZip.file(`ppt/charts/${chartFile}`, setStarRatingValues(xml, ratings));
    } else {
      // The single "إجمالي التقييم العام" summary star bar, mirroring the same
      // satisfaction.overall_rating shown as text elsewhere on slide8 (Text 79).
      renderedZip.file(`ppt/charts/${chartFile}`, setStarRatingValues(xml, [content.satisfaction.overall_rating]));
    }
  }

  return renderedZip.generate({ type: 'nodebuffer', compression: 'DEFLATE' });
}
