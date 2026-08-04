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
  QUOTE_SLOTS,
  KEY_FEEDBACK_SLOTS,
  SUGGESTIONS_SLOTS,
  SLIDE8_RATING_SCORE_LABELS,
  YES_NO_PERCENT_SLOTS,
  type NumberedBoxSlot,
  type ShapeSlot,
} from './pptxEdits.js';
import { setShapeText, replaceRunInShape, deleteShapeByName, setNthShapeText, deleteNthShapeByName, escapeXml } from './pptxXml.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATE_PATH = path.join(__dirname, '..', '..', 'templates', 'workshop-report-template.pptx');

// Builds the slide-7 region box's single line as "count␠␠␠name" (name on the right, count on the
// left) in the right-to-left box. A Latin name (e.g. "Riyadh") is wrapped in Left-to-Right Marks
// (U+200E) so it doesn't bidi-merge with the count into "28Riyadh"; an Arabic name is left bare (a
// mark around RTL text absorbs the gap). Three em-spaces (U+2003) give a fixed, non-collapsing gap.
function formatRegionDisplay(name: string, count: number): string {
  const gap = '   ';
  const label = /[A-Za-z]/.test(name) ? `‎${name}‎` : name;
  return `${label}${gap}${count}`;
}

// Fills a list-box group in order with real data, then deletes any unused trailing box. Each slot
// addresses a specific occurrence of a shape name (v.3's suggestion boxes reuse "Text 73"), so
// deletions run last and in reverse so earlier occurrences' indices stay valid while later ones are
// removed.
function fillShapeSlots(xml: string, slots: ShapeSlot[], items: string[]): string {
  let out = xml;
  slots.forEach((slot, i) => {
    if (i < items.length) out = setNthShapeText(out, slot.shapeName, slot.nth, items[i]);
  });
  for (let i = slots.length - 1; i >= 0; i--) {
    if (i >= items.length) out = deleteNthShapeByName(out, slots[i].shapeName, slots[i].nth);
  }
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
      // slide4 "آراء المشاركين" quote boxes: fill with real comments, delete any unused box (so an
      // under-supplied workshop doesn't show a bare "N/A" tag) — same rule as the slide8 lists.
      xml = fillShapeSlots(xml, QUOTE_SLOTS, content.executive_summary.participant_quotes);
    }
    if (slideNum === 6) {
      xml = fillNumberedBoxes(xml, AXES_SLIDE6, content.detailed_report.axes.length, (i) => `{detailed_report.axes.${i}.title}`);
    }
    if (slideNum === 8) {
      xml = fillShapeSlots(xml, KEY_FEEDBACK_SLOTS, content.satisfaction.key_feedback);
      xml = fillShapeSlots(xml, SUGGESTIONS_SLOTS, content.satisfaction.suggestions);
      // The shape's fixed-width box only ever fit the template's own 3-character sample ("5/5") —
      // "لا يوجد" overflows onto a second line, so "no responses" gets a bare dash instead. Ratings
      // that are all close together (e.g. 4.0-4.4) round to the same whole star and become visually
      // indistinguishable, so this shows the real 1-decimal average (already at most 3 characters,
      // e.g. "4.4") rather than rounding it away — dropping the "/5" suffix keeps it the same width
      // as the template's own sample text.
      content.satisfaction.numeric_ratings.forEach((r, i) => {
        xml = setShapeText(xml as string, SLIDE8_RATING_SCORE_LABELS[i], r.average !== null ? `${r.average}` : '-');
      });

      // yes/no/partial breakdown bars: yes_no_breakdown is in YES_NO_QUESTIONS order
      // (reportContent.ts) — [0] gained_knowledge, [1] intends_to_apply.
      const yesNoByField = { gained_knowledge: content.satisfaction.yes_no_breakdown[0], intends_to_apply: content.satisfaction.yes_no_breakdown[1] };
      for (const slot of YES_NO_PERCENT_SLOTS) {
        const percent = yesNoByField[slot.field]?.options.find((o) => o.label === slot.option)?.percent ?? 0;
        xml = setShapeText(xml as string, slot.shapeName, `${percent}%`);
      }
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
  renderData.__by_region_display = formatRegionDisplay(byRegionTop.region, byRegionTop.count);

  const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true, delimiters: { start: '{', end: '}' }, nullGetter: () => 'N/A' });
  doc.render(renderData);
  const renderedZip = doc.getZip();

  // --- 3. native chart data ------------------------------------------------------------------
  // Chart XML part NUMBERS are NOT stable identifiers — any PowerPoint re-save of the template can
  // reshuffle which chartN.xml backs which widget (verified: v.3 assigns entirely different numbers
  // than the previous revision). So instead of hardcoding filenames, each chart part is classified
  // by (a) the slide that references it — read from that slide's rels — and (b) its own chart type,
  // then filled by ROLE. The seven roles across this deck:
  //   • age doughnut (slides 4 & 7)                → age distribution of the fully-attended cohort
  //   • by-experience bar (slide 7)                → statistics.by_experience
  //   • response-rate doughnut (slide 8)           → responses received / total attendance
  //   • 5-category star grid (slide 8)             → the five numeric_ratings
  //   • 1-category star bar (slides 4 & 8)         → overall_rating
  const ageValues = content.executive_summary.overview.age_distribution.map((a) => a.count);
  const totalAttendance = content.satisfaction.total_attendance;
  const responsesReceived = content.satisfaction.responses_received;
  const responseFilledPct = totalAttendance > 0 ? Math.min(Math.round((responsesReceived / totalAttendance) * 100), 100) : 0;

  // Map each chart part (chartN.xml) to the slide number that references it.
  const chartToSlide = new Map<string, number>();
  for (let slideNum = 1; slideNum <= 30; slideNum++) {
    const rels = renderedZip.file(`ppt/slides/_rels/slide${slideNum}.xml.rels`)?.asText();
    if (!rels) continue;
    for (const m of rels.matchAll(/charts\/(chart\d+\.xml)/g)) chartToSlide.set(m[1], slideNum);
  }

  for (const [chartFile, slideNum] of chartToSlide) {
    const xml = renderedZip.file(`ppt/charts/${chartFile}`)?.asText();
    if (xml === undefined) continue;
    let updated = xml;

    if (/<c:doughnutChart>/.test(xml)) {
      if (slideNum === 8) {
        // Response-rate doughnut: idx0 filled slice, idx1 remainder — mirrors the rounded
        // satisfaction.response_rate text so the doughnut and its "%" label always agree.
        updated = setDoughnutValues(xml, [responseFilledPct / 100, 1 - responseFilledPct / 100]);
      } else {
        // Age doughnut (slide 4 or 7) — both show the same attended-cohort age buckets.
        updated = setDoughnutValues(xml, ageValues);
      }
    } else if (/5 Stars|<c:v>Rating<\/c:v>/.test(xml)) {
      const catCountMatch = /<c:cat>[\s\S]*?<c:ptCount val="(\d+)"/.exec(xml);
      const catCount = catCountMatch ? Number(catCountMatch[1]) : 0;
      if (catCount === 5) {
        // The 5-question grid renders category idx0 at the BOTTOM row and idx(n-1) at the TOP, so
        // the ratings (top-to-bottom: overall, trainer, content, skill, confidence) are reversed to
        // land on their matching rows.
        const ratings = content.satisfaction.numeric_ratings.map((r) => r.average ?? 0).reverse();
        updated = setStarRatingValues(xml, ratings);
      } else {
        // Single "إجمالي التقييم العام" summary star bar (a copy sits on both slide 4 and slide 8).
        updated = setStarRatingValues(xml, [content.satisfaction.overall_rating]);
      }
    } else {
      // The only remaining native chart is the "عدد الحضور بحسب الخبرة في المجال" bar (slide 7).
      updated = setBarChartSeries(xml, content.statistics.by_experience);
    }

    renderedZip.file(`ppt/charts/${chartFile}`, updated);
  }

  // --- 4. drop every chart's link to its embedded workbook, now that every chart's cache holds
  // the real values written above. Each chart's <c:externalData> only ever pointed PowerPoint at
  // its own embedded Excel sheet for a manual "Edit Data" refresh — removing it (rather than just
  // leaving autoUpdate="0") means there is no longer any linked source for a stale re-sync to pull
  // from, even if a future PowerPoint save/reimport tries. The embeddings themselves are left in
  // the zip (now-orphaned relationships are harmless) rather than also editing every chart's own
  // _rels file to drop the reference.
  for (const chartPath of Object.keys(renderedZip.files)) {
    if (!/^ppt\/charts\/chart\d+\.xml$/.test(chartPath)) continue;
    const xml = renderedZip.file(chartPath)?.asText();
    if (xml === undefined) continue;
    renderedZip.file(chartPath, xml.replace(/<c:externalData[^>]*>[\s\S]*?<\/c:externalData>/, ''));
  }

  return renderedZip.generate({ type: 'nodebuffer', compression: 'DEFLATE' });
}
