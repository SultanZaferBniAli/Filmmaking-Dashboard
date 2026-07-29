import * as fs from 'node:fs';
import * as path from 'node:path';
import PizZip from 'pizzip';
import { fileURLToPath } from 'node:url';
import type { CertificateContent } from './certificateContent.js';
import { setShapeText, replaceRunInShape, insertShapeBeforeSpTreeClose, escapeXml } from './pptxXml.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATE_PATHS = {
  male: path.join(__dirname, '..', '..', 'templates', 'certificate-template-male.pptx'),
  female: path.join(__dirname, '..', '..', 'templates', 'certificate-template-female.pptx'),
};

// The Talent Development Manager who co-signs every certificate — a fixed program-level role,
// not workshop-specific (confirmed with the org rather than guessed; the female template already
// ships with this name filled in under "مدير إدارة تطوير المواهب").
const MANAGER_NAME = 'المثنى كتبي';

// The male template ships with no trainer/manager name row at all (only the female template has
// one, and even there the trainer half was left as unfilled placeholder text — see
// certificateContent.ts / conversation history). Rather than requiring a manually-maintained
// template, this clones the female template's real "TextBox 1"/"TextBox 2" shapes (position 1119822/
// 5727700, y 6010976/5985576 EMU — directly under the "المدرب"/"مدير إدارة تطوير المواهب" labels)
// with ids 2/3, which are unused in the male template's own shape tree.
function signatureRowsXml(trainerName: string): string {
  const cell = (id: number, x: number, y: number, text: string) =>
    `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="TextBox ${id - 1}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>` +
    `<p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="3581400" cy="307777"/></a:xfrm>` +
    `<a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/></p:spPr>` +
    `<p:txBody><a:bodyPr wrap="square" rtlCol="0"><a:spAutoFit/></a:bodyPr><a:lstStyle/><a:p><a:pPr algn="ctr"/>` +
    `<a:r><a:rPr lang="ar-SA" sz="1400" b="1" dirty="0"><a:solidFill><a:srgbClr val="B41E34"/></a:solidFill>` +
    `<a:latin typeface="Effra" panose="020B0603020203020204" pitchFamily="34" charset="0"/>` +
    `<a:cs typeface="Effra" panose="020B0603020203020204" pitchFamily="34" charset="0"/></a:rPr>` +
    `<a:t>${escapeXml(text)}</a:t></a:r></a:p></p:txBody></p:sp>`;

  return cell(2, 1119822, 6010976, trainerName) + cell(3, 5727700, 5985576, MANAGER_NAME);
}

export async function buildCertificatePptx(content: CertificateContent): Promise<Buffer> {
  const templateBuffer = await fs.promises.readFile(TEMPLATE_PATHS[content.gender]);
  const zip = new PizZip(templateBuffer);
  let xml = zip.file('ppt/slides/slide1.xml')?.asText();
  if (xml === undefined) throw new Error(`certificate template for gender="${content.gender}" is missing ppt/slides/slide1.xml`);

  // TextBox 37's body paragraph — see conversation history for the full 16-run breakdown. Runs 4/6/8/11
  // are the sample date/hour numbers; runs 5/7 are " <month> إلى "/" <month> " (leading+trailing
  // space and the connector preserved); run 2 is the sample workshop name in quotes.
  xml = replaceRunInShape(xml, 'TextBox 37', '"إدارة المهرجانات السينمائية"', `"${content.workshopName}"`);
  xml = replaceRunInShape(xml, 'TextBox 37', '8', content.startDay);
  xml = replaceRunInShape(xml, 'TextBox 37', ' ينــــــاير إلى ', ` ${content.startMonth} إلى `);
  xml = replaceRunInShape(xml, 'TextBox 37', '11', content.endDay);
  xml = replaceRunInShape(xml, 'TextBox 37', ' ينــــــــاير ', ` ${content.endMonth} `);
  xml = replaceRunInShape(xml, 'TextBox 37', '2026', content.year);
  xml = replaceRunInShape(xml, 'TextBox 37', '16', content.totalHours);

  // TextBox 40 — the participant's name, a separate bold/red shape floating over the paragraph
  // (not an inline run within TextBox 37 itself; see conversation history for the rendered proof).
  xml = setShapeText(xml, 'TextBox 40', content.participantName);

  if (content.gender === 'female') {
    // The female template already has both signature-row shapes; only the trainer half was ever
    // left as unfilled placeholder text ("اسم الـــمــــــــــــــدرب\ة") — the manager name is
    // already correct and untouched.
    xml = setShapeText(xml, 'TextBox 1', content.trainerName);
  } else {
    xml = insertShapeBeforeSpTreeClose(xml, signatureRowsXml(content.trainerName));
  }

  zip.file('ppt/slides/slide1.xml', xml);
  return zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' });
}
