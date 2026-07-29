import * as fs from 'node:fs';
import * as path from 'node:path';
import PizZip from 'pizzip';
import { fileURLToPath } from 'node:url';
import type { CertificateContent } from './certificateContent.js';
import { setShapeText, replaceRunInShape } from './pptxXml.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATE_PATHS = {
  male: path.join(__dirname, '..', '..', 'templates', 'certificate-template-male.pptx'),
  female: path.join(__dirname, '..', '..', 'templates', 'certificate-template-female.pptx'),
};

// The Talent Development Manager's co-sign is now a static signature image baked into both
// templates (Picture 4, under "مدير إدارة تطوير المواهب") — no longer text, nothing to fill in per
// certificate. The trainer-name shape under "المدرب" exists natively in both templates too, just
// under a different shape name in each (a template-authoring artifact, not a semantic difference).
const TRAINER_NAME_SHAPE: Record<CertificateContent['gender'], string> = { female: 'TextBox 1', male: 'TextBox 2' };

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

  xml = setShapeText(xml, TRAINER_NAME_SHAPE[content.gender], content.trainerName);

  zip.file('ppt/slides/slide1.xml', xml);
  return zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' });
}
