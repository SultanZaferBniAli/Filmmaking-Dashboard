// Shared primitives for turning a hand-built SVG page into a real, browser-viewable PDF —
// see exportReportPdf.ts for why this project hand-writes PDFs instead of using a library.

export const PAGE_W = 1240; // ~150dpi A4
export const PAGE_H = 1754;
export const PDF_MARGIN = 90;

export function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function wrapText(text: string, maxChars: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}

export function textBlock(lines: string[], xRight: number, yStart: number, lineHeight: number, fontSize: number, color: string): string {
  return `<text x="${xRight}" y="${yStart}" text-anchor="end" font-size="${fontSize}" fill="${color}" font-family="Cairo, Arial, sans-serif">${lines
    .map((line, i) => `<tspan x="${xRight}" dy="${i === 0 ? 0 : lineHeight}">${escapeXml(line)}</tspan>`)
    .join('')}</text>`;
}

function svgToJpegDataUrl(svg: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = PAGE_W;
      canvas.height = PAGE_H;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('canvas context unavailable'));
        return;
      }
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, PAGE_W, PAGE_H);
      ctx.drawImage(img, 0, 0, PAGE_W, PAGE_H);
      resolve(canvas.toDataURL('image/jpeg', 0.92));
    };
    img.onerror = () => reject(new Error('failed to rasterize SVG page'));
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  });
}

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function buildPdfFromJpeg(jpegBytes: Uint8Array, imgWidthPx: number, imgHeightPx: number): Uint8Array {
  // Render the raster at 150dpi (PAGE_W/H px) onto a standard A4 page in points.
  const pageWidthPt = 595.28;
  const pageHeightPt = 841.89;

  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const offsets: number[] = [0, 0, 0, 0, 0, 0];
  let pos = 0;

  function push(text: string) {
    const bytes = encoder.encode(text);
    chunks.push(bytes);
    pos += bytes.length;
  }
  function pushBytes(bytes: Uint8Array) {
    chunks.push(bytes);
    pos += bytes.length;
  }

  push('%PDF-1.4\n');

  offsets[1] = pos;
  push('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');

  offsets[2] = pos;
  push('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n');

  offsets[3] = pos;
  push(
    `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidthPt} ${pageHeightPt}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>\nendobj\n`,
  );

  offsets[4] = pos;
  push(
    `4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${imgWidthPx} /Height ${imgHeightPx} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBytes.length} >>\nstream\n`,
  );
  pushBytes(jpegBytes);
  push('\nendstream\nendobj\n');

  const contentStr = `q ${pageWidthPt} 0 0 ${pageHeightPt} 0 0 cm /Im0 Do Q`;
  offsets[5] = pos;
  push(`5 0 obj\n<< /Length ${contentStr.length} >>\nstream\n${contentStr}\nendstream\nendobj\n`);

  const xrefOffset = pos;
  let xref = 'xref\n0 6\n0000000000 65535 f \n';
  for (let i = 1; i <= 5; i++) {
    xref += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  push(xref);
  push(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`);

  const total = chunks.reduce((sum, c) => sum + c.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const c of chunks) {
    out.set(c, o);
    o += c.length;
  }
  return out;
}

async function svgPageToPdfBytes(svg: string): Promise<Uint8Array> {
  const jpegDataUrl = await svgToJpegDataUrl(svg);
  const jpegBytes = dataUrlToBytes(jpegDataUrl);
  return buildPdfFromJpeg(jpegBytes, PAGE_W, PAGE_H);
}

export async function openSvgPageAsPdf(svg: string): Promise<void> {
  const pdfBytes = await svgPageToPdfBytes(svg);
  const blob = new Blob([pdfBytes as BlobPart], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
}
