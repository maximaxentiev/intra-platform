/**
 * Historical document migration (design phase — no network I/O).
 *
 * Later write phase should:
 * 1. Fetch HTTPS URLs from payload.documents.*.sourceUrl when referenceKind === https_url
 * 2. Validate size/MIME/extension against historical rules (not public nanny v2 hard stops)
 * 3. Upload via StorageService + application_documents (resume | vulnerable_sector_check)
 * 4. Idempotency: skip when application already has document for category
 */

import type { HistoricalNannyImportPayload } from './nanny-applicants-csv.map';

export interface HistoricalDocumentPlan {
  category: 'resume' | 'vulnerable_sector_check';
  fetchUrl: string;
  suggestedFilename: string | null;
  skippedReason?: string;
}

export function planHistoricalDocuments(
  payload: HistoricalNannyImportPayload,
): HistoricalDocumentPlan[] {
  const plans: HistoricalDocumentPlan[] = [];
  const resume = payload.documents.resume;
  if (resume.referenceKind === 'https_url' && resume.sourceUrl) {
    plans.push({
      category: 'resume',
      fetchUrl: resume.sourceUrl,
      suggestedFilename: resume.suggestedFilename,
    });
  }
  const vsc = payload.documents.vsc;
  if (vsc.referenceKind === 'https_url' && vsc.sourceUrl) {
    plans.push({
      category: 'vulnerable_sector_check',
      fetchUrl: vsc.sourceUrl,
      suggestedFilename: vsc.suggestedFilename,
    });
  }
  return plans;
}
