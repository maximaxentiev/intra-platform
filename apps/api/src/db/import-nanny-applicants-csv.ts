/**

 * One-time historical Nanny applicant CSV import (Fillout grid export).

 *

 * DEFAULT: dry-run only — no database or storage writes.

 *

 * Usage (repo root):

 *   node --import tsx apps/api/src/db/import-nanny-applicants-csv.ts --file private-imports/export.csv

 *   node --import tsx apps/api/src/db/import-nanny-applicants-csv.ts --file private-imports/export.csv --preflight-documents

 *   node --import tsx apps/api/src/db/import-nanny-applicants-csv.ts --file private-imports/export.csv --write

 *

 * Write requires DATABASE_URL + NANNY_APPLICANT_IMPORT_WRITE=1 + --write

 */

import { config as loadDotenv } from 'dotenv';

import { findRepoRootEnvFile } from '../config/root-env';

import { runNannyApplicantCsvImport } from './nanny-applicants-csv/nanny-applicants-csv.runner';



const rootEnvFile = findRepoRootEnvFile();

if (rootEnvFile) loadDotenv({ path: rootEnvFile });



function printDryRunSummary(

  audit: { totalRows: number; importableRows: number; blockedRows: number; blockReasonCounts: Record<string, number> },

  dryRun: {

    wouldInsert: number;

    wouldSkipExisting: number;

    blocked: number;

  },

): void {

  // eslint-disable-next-line no-console

  console.log('[nanny-import] DRY RUN — no database writes');

  // eslint-disable-next-line no-console

  console.log(

    JSON.stringify(

      {

        totalCsvRows: audit.totalRows,

        importableRows: audit.importableRows,

        blockedRows: audit.blockedRows,

        wouldInsert: dryRun.wouldInsert,

        wouldSkipExisting: dryRun.wouldSkipExisting,

        wouldBlock: dryRun.blocked,

        blockReasonCounts: audit.blockReasonCounts,

      },

      null,

      2,

    ),

  );

}



function printPreflightSummary(report: object): void {

  // eslint-disable-next-line no-console

  console.log('[nanny-import] DOCUMENT PREFLIGHT — no database writes, no storage uploads');

  // eslint-disable-next-line no-console

  console.log(JSON.stringify(report, null, 2));

}



async function main(): Promise<void> {

  const result = await runNannyApplicantCsvImport(process.argv, process.env);



  if (result.mode === 'preflight') {

    printPreflightSummary(result.report);

    return;

  }



  if (result.mode === 'dry_run') {

    printDryRunSummary(result.audit, result.dryRun);

    return;

  }



  // eslint-disable-next-line no-console

  console.log('[nanny-import] write complete (applications + documents, idempotent)');

}



main().catch((err) => {

  // eslint-disable-next-line no-console

  console.error('[nanny-import] failed:', err);

  process.exit(1);

});


