import {
  HISTORICAL_RESUME_MIME,
  type HistoricalResumeFormat,
  type HistoricalVscFormat,
} from './nanny-applicants-csv.document-types';

export type DetectedHistoricalDocument =
  | { category: 'resume'; format: HistoricalResumeFormat; contentType: string }
  | { category: 'vsc'; format: HistoricalVscFormat; contentType: string }
  | { category: 'unsupported' }
  | { category: 'html_error' };

function startsWithBytes(buf: Buffer, bytes: number[]): boolean {
  if (buf.length < bytes.length) return false;
  return bytes.every((b, i) => buf[i] === b);
}

function isLikelyHtml(buf: Buffer, headerContentType: string): boolean {
  const ct = headerContentType.toLowerCase();
  if (ct.includes('text/html') || ct.includes('application/json')) return true;
  const head = buf.subarray(0, Math.min(buf.length, 256)).toString('utf8').trimStart().toLowerCase();
  return head.startsWith('<!doctype html') || head.startsWith('<html') || head.startsWith('<?xml');
}

function detectZipBasedOffice(buf: Buffer): HistoricalResumeFormat | null {
  if (!startsWithBytes(buf, [0x50, 0x4b, 0x03, 0x04])) return null;
  const text = buf.subarray(0, Math.min(buf.length, 8192)).toString('latin1');
  if (text.includes('word/')) return 'docx';
  return null;
}

export function detectHistoricalDocument(
  buf: Buffer,
  headerContentType: string,
  expectedCategory: 'resume' | 'vsc',
): DetectedHistoricalDocument {
  if (isLikelyHtml(buf, headerContentType)) {
    return { category: 'html_error' };
  }

  if (startsWithBytes(buf, [0x25, 0x50, 0x44, 0x46])) {
    return expectedCategory === 'resume'
      ? { category: 'resume', format: 'pdf', contentType: 'application/pdf' }
      : { category: 'vsc', format: 'pdf', contentType: 'application/pdf' };
  }

  if (startsWithBytes(buf, [0xff, 0xd8, 0xff])) {
    return expectedCategory === 'vsc'
      ? { category: 'vsc', format: 'jpeg', contentType: 'image/jpeg' }
      : { category: 'unsupported' };
  }

  if (startsWithBytes(buf, [0x89, 0x50, 0x4e, 0x47])) {
    return expectedCategory === 'vsc'
      ? { category: 'vsc', format: 'png', contentType: 'image/png' }
      : { category: 'unsupported' };
  }

  if (startsWithBytes(buf, [0xd0, 0xcf, 0x11, 0xe0])) {
    return expectedCategory === 'resume'
      ? { category: 'resume', format: 'doc', contentType: 'application/msword' }
      : { category: 'unsupported' };
  }

  const docx = detectZipBasedOffice(buf);
  if (docx === 'docx' && expectedCategory === 'resume') {
    return { category: 'resume', format: 'docx', contentType: HISTORICAL_RESUME_MIME.docx };
  }

  const ftyp = buf.subarray(4, 12).toString('ascii');
  if (ftyp.startsWith('ftyp')) {
    const brand = buf.subarray(8, 16).toString('ascii').toLowerCase();
    if (expectedCategory === 'vsc' && (brand.includes('heic') || brand.includes('heix'))) {
      return { category: 'vsc', format: 'heic', contentType: 'image/heic' };
    }
    if (expectedCategory === 'vsc' && (brand.includes('heif') || brand.includes('mif1'))) {
      return { category: 'vsc', format: 'heif', contentType: 'image/heif' };
    }
  }

  return { category: 'unsupported' };
}
