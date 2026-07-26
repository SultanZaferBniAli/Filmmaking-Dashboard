// Minimal dependency-free ZIP writer (store method — no compression), used for bundling
// certificates (see exportCertificate.ts). An uncompressed ZIP is a small, well-defined
// binary format that's simple to hand-write correctly without pulling in a library.

let crcTable: Uint32Array | null = null;

function getCrcTable(): Uint32Array {
  if (crcTable) return crcTable;
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  crcTable = table;
  return table;
}

function crc32(bytes: Uint8Array): number {
  const table = getCrcTable();
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc = table[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function writeUint32LE(view: DataView, offset: number, value: number) {
  view.setUint32(offset, value, true);
}
function writeUint16LE(view: DataView, offset: number, value: number) {
  view.setUint16(offset, value, true);
}

// MS-DOS date/time fields are required by the ZIP format but not meaningfully used here.
const DOS_TIME = 0;
const DOS_DATE = 0x21; // 1980-01-01

export type ZipFile = { name: string; content: string };

export function createZipBlob(files: ZipFile[]): Blob {
  const encoder = new TextEncoder();
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  for (const file of files) {
    const nameBytes = encoder.encode(file.name);
    const dataBytes = encoder.encode(file.content);
    const crc = crc32(dataBytes);

    const localHeader = new Uint8Array(30 + nameBytes.length);
    const localView = new DataView(localHeader.buffer);
    writeUint32LE(localView, 0, 0x04034b50);
    writeUint16LE(localView, 4, 20); // version needed
    writeUint16LE(localView, 6, 0x0800); // flags: bit 11 = UTF-8 filename/comment
    writeUint16LE(localView, 8, 0); // method: store
    writeUint16LE(localView, 10, DOS_TIME);
    writeUint16LE(localView, 12, DOS_DATE);
    writeUint32LE(localView, 14, crc);
    writeUint32LE(localView, 18, dataBytes.length); // compressed size
    writeUint32LE(localView, 22, dataBytes.length); // uncompressed size
    writeUint16LE(localView, 26, nameBytes.length);
    writeUint16LE(localView, 28, 0); // extra field length
    localHeader.set(nameBytes, 30);

    localParts.push(localHeader, dataBytes);

    const centralHeader = new Uint8Array(46 + nameBytes.length);
    const centralView = new DataView(centralHeader.buffer);
    writeUint32LE(centralView, 0, 0x02014b50);
    writeUint16LE(centralView, 4, 20); // version made by
    writeUint16LE(centralView, 6, 20); // version needed
    writeUint16LE(centralView, 8, 0x0800); // flags: bit 11 = UTF-8 filename/comment
    writeUint16LE(centralView, 10, 0); // method: store
    writeUint16LE(centralView, 12, DOS_TIME);
    writeUint16LE(centralView, 14, DOS_DATE);
    writeUint32LE(centralView, 16, crc);
    writeUint32LE(centralView, 20, dataBytes.length);
    writeUint32LE(centralView, 24, dataBytes.length);
    writeUint16LE(centralView, 28, nameBytes.length);
    writeUint16LE(centralView, 30, 0); // extra length
    writeUint16LE(centralView, 32, 0); // comment length
    writeUint16LE(centralView, 34, 0); // disk number start
    writeUint16LE(centralView, 36, 0); // internal attributes
    writeUint32LE(centralView, 38, 0); // external attributes
    writeUint32LE(centralView, 42, offset); // local header offset
    centralHeader.set(nameBytes, 46);

    centralParts.push(centralHeader);

    offset += localHeader.length + dataBytes.length;
  }

  const centralSize = centralParts.reduce((sum, c) => sum + c.length, 0);
  const centralOffset = offset;

  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  writeUint32LE(endView, 0, 0x06054b50);
  writeUint16LE(endView, 4, 0); // disk number
  writeUint16LE(endView, 6, 0); // disk with central dir
  writeUint16LE(endView, 8, files.length); // entries on this disk
  writeUint16LE(endView, 10, files.length); // total entries
  writeUint32LE(endView, 12, centralSize);
  writeUint32LE(endView, 16, centralOffset);
  writeUint16LE(endView, 20, 0); // comment length

  return new Blob([...localParts, ...centralParts, end] as BlobPart[], { type: 'application/zip' });
}

export function downloadZip(files: ZipFile[], filename: string) {
  const blob = createZipBlob(files);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
