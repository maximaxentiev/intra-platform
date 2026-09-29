export type HistoricalResumeFormat = 'pdf' | 'doc' | 'docx';
export type HistoricalVscFormat = 'pdf' | 'jpeg' | 'png' | 'heic' | 'heif';

export const HISTORICAL_RESUME_MAX_BYTES = 10 * 1024 * 1024;
export const HISTORICAL_VSC_MAX_BYTES = 10 * 1024 * 1024;
export const HISTORICAL_FETCH_TIMEOUT_MS = 30_000;
export const HISTORICAL_FETCH_MAX_REDIRECTS = 5;

export const HISTORICAL_RESUME_MIME: Record<HistoricalResumeFormat, string> = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

export const HISTORICAL_VSC_MIME: Record<HistoricalVscFormat, string> = {
  pdf: 'application/pdf',
  jpeg: 'image/jpeg',
  png: 'image/png',
  heic: 'image/heic',
  heif: 'image/heif',
};
