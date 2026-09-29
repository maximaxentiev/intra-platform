import {
  HISTORICAL_FETCH_MAX_REDIRECTS,
  HISTORICAL_FETCH_TIMEOUT_MS,
  HISTORICAL_RESUME_MAX_BYTES,
  HISTORICAL_VSC_MAX_BYTES,
} from './nanny-applicants-csv.document-types';
import { detectHistoricalDocument } from './nanny-applicants-csv.document-signature';

export type HistoricalDocumentFetchErrorCode =
  | 'network_error'
  | 'timeout'
  | 'http_error'
  | 'too_large'
  | 'empty_body'
  | 'unsupported_type'
  | 'html_error';

export interface HistoricalDocumentFetchResult {
  ok: boolean;
  httpStatus: number | null;
  errorCode: HistoricalDocumentFetchErrorCode | null;
  byteSize: number;
  contentTypeHeader: string;
  detectedFormat: string | null;
  buffer: Buffer | null;
}

export type HistoricalDocumentFetcher = (
  url: string,
  init: { signal: AbortSignal; method: 'GET' | 'HEAD' },
) => Promise<Response>;

async function readBodyWithLimit(response: Response, maxBytes: number): Promise<Buffer> {
  if (!response.body) return Buffer.alloc(0);
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > maxBytes) {
      throw new Error('too_large');
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}

export async function fetchHistoricalDocument(
  url: string,
  category: 'resume' | 'vsc',
  fetchImpl: HistoricalDocumentFetcher = (u, init) => fetch(u, init),
): Promise<HistoricalDocumentFetchResult> {
  const maxBytes = category === 'resume' ? HISTORICAL_RESUME_MAX_BYTES : HISTORICAL_VSC_MAX_BYTES;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), HISTORICAL_FETCH_TIMEOUT_MS);

  try {
    let currentUrl = url;
    let response: Response | null = null;
    for (let i = 0; i <= HISTORICAL_FETCH_MAX_REDIRECTS; i++) {
      response = await fetchImpl(currentUrl, { signal: controller.signal, method: 'GET' });
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        if (!location) break;
        currentUrl = new URL(location, currentUrl).toString();
        continue;
      }
      break;
    }
    if (!response) {
      return {
        ok: false,
        httpStatus: null,
        errorCode: 'network_error',
        byteSize: 0,
        contentTypeHeader: '',
        detectedFormat: null,
        buffer: null,
      };
    }

    const httpStatus = response.status;
    if (!response.ok) {
      return {
        ok: false,
        httpStatus,
        errorCode: 'http_error',
        byteSize: 0,
        contentTypeHeader: response.headers.get('content-type') ?? '',
        detectedFormat: null,
        buffer: null,
      };
    }

    let buffer: Buffer;
    try {
      buffer = await readBodyWithLimit(response, maxBytes);
    } catch (err) {
      if (err instanceof Error && err.message === 'too_large') {
        return {
          ok: false,
          httpStatus,
          errorCode: 'too_large',
          byteSize: maxBytes + 1,
          contentTypeHeader: response.headers.get('content-type') ?? '',
          detectedFormat: null,
          buffer: null,
        };
      }
      throw err;
    }

    if (buffer.length === 0) {
      return {
        ok: false,
        httpStatus,
        errorCode: 'empty_body',
        byteSize: 0,
        contentTypeHeader: response.headers.get('content-type') ?? '',
        detectedFormat: null,
        buffer: null,
      };
    }

    const contentTypeHeader = response.headers.get('content-type') ?? '';
    const detected = detectHistoricalDocument(buffer, contentTypeHeader, category);
    if (detected.category === 'html_error') {
      return {
        ok: false,
        httpStatus,
        errorCode: 'html_error',
        byteSize: buffer.length,
        contentTypeHeader,
        detectedFormat: null,
        buffer: null,
      };
    }
    if (detected.category === 'unsupported') {
      return {
        ok: false,
        httpStatus,
        errorCode: 'unsupported_type',
        byteSize: buffer.length,
        contentTypeHeader,
        detectedFormat: null,
        buffer: null,
      };
    }

    return {
      ok: true,
      httpStatus,
      errorCode: null,
      byteSize: buffer.length,
      contentTypeHeader,
      detectedFormat: detected.format,
      buffer,
    };
  } catch (err) {
    const isAbort = err instanceof Error && err.name === 'AbortError';
    return {
      ok: false,
      httpStatus: null,
      errorCode: isAbort ? 'timeout' : 'network_error',
      byteSize: 0,
      contentTypeHeader: '',
      detectedFormat: null,
      buffer: null,
    };
  } finally {
    clearTimeout(timeout);
  }
}
