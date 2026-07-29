// Low-level XML string surgery shared by every *.pptx generator (buildReportPptx.ts,
// buildCertificatePptx.ts) — edits are applied directly to the raw slide XML, before/without
// docxtemplater, so a shape's real template text (not a {tag}) can be targeted by its shape name
// or by literal text it currently contains.

export function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

export function findShapeBlock(xml: string, shapeName: string): { start: number; end: number; block: string } | null {
  const namePattern = new RegExp(`<p:sp>(?:(?!</p:sp>)[\\s\\S])*?name="${escapeRegExp(shapeName)}"[\\s\\S]*?</p:sp>`);
  const m = namePattern.exec(xml);
  if (!m) return null;
  return { start: m.index, end: m.index + m[0].length, block: m[0] };
}

// Collapses every <a:t> run inside the shape down to a single run carrying `newText`, blanking
// the rest — used both for "one tag replaces a whole multi-run sentence" and for simple
// single-value shapes, so surrounding template prose never leaks into the rendered output.
export function setShapeText(xml: string, shapeName: string, newText: string): string {
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

// Replaces just ONE specific run's text within a named shape, leaving every sibling run (e.g. a
// label sharing the same shape as its value run) untouched — unlike setShapeText, which
// intentionally blanks every other run.
export function replaceRunInShape(xml: string, shapeName: string, oldRunText: string, newRunText: string): string {
  const found = findShapeBlock(xml, shapeName);
  if (!found) {
    // eslint-disable-next-line no-console
    console.warn(`[pptx] replaceRunInShape: shape "${shapeName}" not found — no-op`);
    return xml;
  }
  const runPattern = new RegExp(`<a:t>${escapeRegExp(oldRunText)}</a:t>`);
  if (!runPattern.test(found.block)) {
    // A silent miss here (e.g. a curly vs. straight quote mismatch) leaves the original
    // template text in place with no error — surfaced loudly so it's caught in testing, not
    // discovered later in a downloaded file.
    // eslint-disable-next-line no-console
    console.warn(`[pptx] replaceRunInShape: run text not found in shape "${shapeName}" — expected exact text: ${JSON.stringify(oldRunText)}`);
    return xml;
  }
  const newBlock = found.block.replace(runPattern, `<a:t>${newRunText}</a:t>`);
  return xml.slice(0, found.start) + newBlock + xml.slice(found.end);
}

export function deleteShapeByName(xml: string, shapeName: string): string {
  const found = findShapeBlock(xml, shapeName);
  if (!found) return xml;
  return xml.slice(0, found.start) + xml.slice(found.end);
}

export function findShapeBlockContainingText(xml: string, anchorText: string): { start: number; end: number; block: string } | null {
  const pattern = new RegExp(`<p:sp>(?:(?!</p:sp>)[\\s\\S])*?${escapeRegExp(anchorText)}[\\s\\S]*?</p:sp>`);
  const m = pattern.exec(xml);
  if (!m) return null;
  return { start: m.index, end: m.index + m[0].length, block: m[0] };
}

export function deleteShapeContainingText(xml: string, anchorText: string): string {
  const found = findShapeBlockContainingText(xml, anchorText);
  if (!found) return xml;
  return xml.slice(0, found.start) + xml.slice(found.end);
}

// Same "collapse every run down to one" behavior as setShapeText, but the shape is located by the
// literal placeholder text it currently contains rather than by shape name — needed wherever a
// shape *name* repeats across multiple slots. Real respondent/participant free text (unlike a
// docxtemplater {tag}) can contain XML-unsafe characters, so it's escaped here.
export function setShapeTextByAnchor(xml: string, anchorText: string, newText: string): string {
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

// Inserts a raw shape (or any raw <p:...> XML fragment) as the last child of the slide's shape
// tree — used to add a shape a template is missing entirely (see buildCertificatePptx.ts's male
// template, which ships without a trainer/manager signature row the female template has).
export function insertShapeBeforeSpTreeClose(xml: string, shapeXml: string): string {
  const marker = '</p:spTree>';
  const idx = xml.indexOf(marker);
  if (idx === -1) return xml;
  return xml.slice(0, idx) + shapeXml + xml.slice(idx);
}
