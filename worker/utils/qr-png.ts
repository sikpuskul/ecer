import { encode } from 'uqr';
import { bytesToBase64 } from '../security/crypto';

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) {
    crc = (CRC32_TABLE[(crc ^ (bytes[i] ?? 0)) & 0xff] ?? 0) ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function uint32Be(value: number): Uint8Array {
  return new Uint8Array([
    (value >>> 24) & 0xff,
    (value >>> 16) & 0xff,
    (value >>> 8) & 0xff,
    value & 0xff,
  ]);
}

function makePngChunk(type: string, data: Uint8Array): Uint8Array {
  const typeBytes = new TextEncoder().encode(type);
  const crcInput = new Uint8Array(typeBytes.length + data.length);
  crcInput.set(typeBytes, 0);
  crcInput.set(data, typeBytes.length);

  const out = new Uint8Array(4 + typeBytes.length + data.length + 4);
  out.set(uint32Be(data.length), 0);
  out.set(typeBytes, 4);
  out.set(data, 4 + typeBytes.length);
  out.set(uint32Be(crc32(crcInput)), 4 + typeBytes.length + data.length);
  return out;
}

async function zlibDeflate(input: Uint8Array): Promise<Uint8Array> {
  const stream = new Response(input).body!.pipeThrough(new CompressionStream('deflate'));
  const buffer = await new Response(stream).arrayBuffer();
  return new Uint8Array(buffer);
}

/**
 * Generates a crisp grayscale PNG QR code locally inside Cloudflare Workers
 * without any external QR service or Canvas dependency (PRD §17.2).
 */
export async function generateQrPngBytes(
  content: string,
  scale = 6,
  border = 2,
): Promise<Uint8Array> {
  const qr = encode(content, { ecc: 'M', border });
  const modules = qr.size;
  const imgSize = modules * scale;

  // Grayscale 8-bit PNG: each scanline = 1 filter byte (0) + imgSize pixel bytes
  const rawScanlines = new Uint8Array(imgSize * (imgSize + 1));
  for (let y = 0; y < imgSize; y += 1) {
    const rowStart = y * (imgSize + 1);
    rawScanlines[rowStart] = 0; // filter type: None
    const modY = Math.floor(y / scale);
    const modRow = qr.data[modY];
    for (let x = 0; x < imgSize; x += 1) {
      const modX = Math.floor(x / scale);
      const isDark = modRow?.[modX] === true;
      rawScanlines[rowStart + 1 + x] = isDark ? 0x00 : 0xff;
    }
  }

  const compressed = await zlibDeflate(rawScanlines);

  const ihdr = new Uint8Array(13);
  ihdr.set(uint32Be(imgSize), 0);
  ihdr.set(uint32Be(imgSize), 4);
  ihdr[8] = 8; // bit depth: 8
  ihdr[9] = 0; // color type: grayscale
  ihdr[10] = 0; // compression: deflate
  ihdr[11] = 0; // filter: adaptive
  ihdr[12] = 0; // interlace: none

  const signature = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdrChunk = makePngChunk('IHDR', ihdr);
  const idatChunk = makePngChunk('IDAT', compressed);
  const iendChunk = makePngChunk('IEND', new Uint8Array(0));

  const png = new Uint8Array(
    signature.length + ihdrChunk.length + idatChunk.length + iendChunk.length,
  );
  let offset = 0;
  png.set(signature, offset);
  offset += signature.length;
  png.set(ihdrChunk, offset);
  offset += ihdrChunk.length;
  png.set(idatChunk, offset);
  offset += idatChunk.length;
  png.set(iendChunk, offset);

  return png;
}

export async function generateQrPngBase64(content: string): Promise<string> {
  const bytes = await generateQrPngBytes(content);
  return bytesToBase64(bytes);
}
