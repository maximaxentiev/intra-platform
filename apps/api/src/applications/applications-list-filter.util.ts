import {
  and,
  asc,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  isNotNull,
  isNull,
  lte,
  or,
  sql,
  type SQL,
} from 'drizzle-orm';
import { applicationDocuments, applications } from '../db/schema';
import type { ListApplicationsQuery } from './dto/applications.dto';

export type TriStateFilter = 'yes' | 'no' | 'any' | 'missing';

function splitCsv(value: string | undefined): string[] {
  if (!value?.trim()) return [];
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function containsPattern(value: string): string {
  return `%${value.replace(/[%_\\]/g, '\\$&')}%`;
}

type BoolColumn =
  | typeof applications.gtaEligible
  | typeof applications.nannyTrainingCompleted
  | typeof applications.accuracyConfirmed;

type TextStatusColumn =
  | typeof applications.vscStatus
  | typeof applications.firstAidCprStatus
  | typeof applications.immunizationStatus
  | typeof applications.covidVaccinationStatus;

function triStateColumn(column: BoolColumn, state: TriStateFilter | undefined): SQL | undefined {
  if (!state || state === 'any') return undefined;
  if (state === 'missing') return isNull(column);
  if (state === 'yes') return eq(column, true);
  return eq(column, false);
}

function yesNoFromStatusColumn(
  column: TextStatusColumn,
  state: TriStateFilter | undefined,
): SQL | undefined {
  if (!state || state === 'any') return undefined;
  const lower = sql`lower(trim(${column}))`;
  if (state === 'missing') {
    return or(isNull(column), eq(column, ''), sql`${lower} IN ('', 'unknown', 'not_provided', 'n/a')`)!;
  }
  const yesLike = sql`${lower} IN ('yes', 'true', 'y', '1', 'completed', 'current', 'clear', 'valid') OR ${lower} LIKE '%yes%'`;
  const noLike = sql`${lower} IN ('no', 'false', 'n', '0', 'none', 'expired', 'invalid') OR ${lower} LIKE '%no%'`;
  return state === 'yes' ? sql`(${yesLike})` : sql`(${noLike}) AND NOT (${yesLike})`;
}

function covidFilter(state: ListApplicationsQuery['covid']): SQL | undefined {
  if (!state || state === 'any') return undefined;
  if (state === 'not_provided') {
    return or(
      eq(applications.covidVaccinationStatus, ''),
      isNull(applications.covidVaccinationStatus),
      sql`lower(trim(${applications.covidVaccinationStatus})) IN ('not_provided', 'unknown', 'n/a')`,
    )!;
  }
  return yesNoFromStatusColumn(applications.covidVaccinationStatus, state);
}

/** Matches buildNannyApplicationOpsView intake classification for nanny rows. */
export function nannyIntakeVersionExpr(): SQL {
  return sql`CASE
    WHEN ${applications.payloadSnapshot}->>'intakeVersion' = 'historical_import' THEN 'historical_import'
    WHEN ${applications.payloadSnapshot}->'eligibility' ? 'canCommuteGta' THEN 'nanny_v2'
    ELSE 'legacy'
  END`;
}

function snapshotPathIlike(jsonPath: string, needle: string): SQL {
  return sql`${applications.payloadSnapshot} #>> ${jsonPath} ILIKE ${containsPattern(needle)}`;
}

function spokenEnglishRatingExpr(): SQL {
  return sql`COALESCE(
    NULLIF((${applications.payloadSnapshot}->'languages'->>'spokenEnglishRating'), '')::int,
    NULLIF(regexp_replace(${applications.englishProficiency}, '[^0-9]', '', 'g'), '')::int
  )`;
}

function jsonbStringArrayOverlap(column: SQL, values: string[], mode: 'any' | 'all'): SQL | undefined {
  if (!values.length) return undefined;
  if (mode === 'any') {
    return sql`${column} ?| array[${sql.join(
      values.map((v) => sql`${v}`),
      sql`, `,
    )}]::text[]`;
  }
  return and(
    ...values.map((v) => sql`${column} ? ${v}`),
  )!;
}

export function buildApplicationsListWhere(q: ListApplicationsQuery): SQL | undefined {
  const parts: SQL[] = [];

  if (q.role) parts.push(eq(applications.role, q.role));
  if (q.status) parts.push(eq(applications.status, q.status));

  const search = q.q?.trim();
  if (search) {
    const pattern = containsPattern(search);
    parts.push(
      or(
        ilike(applications.firstName, pattern),
        ilike(applications.lastName, pattern),
        ilike(applications.preferredName, pattern),
        ilike(applications.email, pattern),
        ilike(applications.phone, pattern),
        ilike(applications.city, pattern),
      )!,
    );
  }

  if (q.reviewed === 'yes') parts.push(isNotNull(applications.reviewedAt));
  if (q.reviewed === 'no') parts.push(isNull(applications.reviewedAt));

  const intakeVersions = splitCsv(q.intakeVersion);
  if (intakeVersions.length) {
    parts.push(
      sql`(${applications.role} = 'nanny' AND ${nannyIntakeVersionExpr()} IN (${sql.join(
        intakeVersions.map((v) => sql`${v}`),
        sql`, `,
      )}))`,
    );
  }

  if (q.firstName?.trim()) parts.push(ilike(applications.firstName, containsPattern(q.firstName.trim())));
  if (q.lastName?.trim()) parts.push(ilike(applications.lastName, containsPattern(q.lastName.trim())));
  if (q.preferredName?.trim()) {
    parts.push(ilike(applications.preferredName, containsPattern(q.preferredName.trim())));
  }
  if (q.email?.trim()) parts.push(ilike(applications.email, containsPattern(q.email.trim())));
  if (q.phone?.trim()) parts.push(ilike(applications.phone, containsPattern(q.phone.trim())));
  if (q.city?.trim()) parts.push(ilike(applications.city, containsPattern(q.city.trim())));
  if (q.postalCode?.trim()) {
    parts.push(ilike(applications.postalCode, containsPattern(q.postalCode.trim())));
  }

  if (q.statusInCanada?.trim()) parts.push(eq(applications.statusInCanada, q.statusInCanada.trim()));
  if (q.experienceDuration?.trim()) parts.push(eq(applications.experienceDuration, q.experienceDuration.trim()));
  if (q.qualificationStatus?.trim()) {
    parts.push(eq(applications.qualificationStatus, q.qualificationStatus.trim()));
  }
  if (q.gender?.trim()) parts.push(eq(applications.gender, q.gender.trim()));
  if (q.englishProficiency?.trim()) {
    parts.push(eq(applications.englishProficiency, q.englishProficiency.trim()));
  }

  const gta = triStateColumn(applications.gtaEligible, q.gtaEligible);
  if (gta) parts.push(gta);
  const training = triStateColumn(applications.nannyTrainingCompleted, q.trainingCompleted);
  if (training) parts.push(training);
  const accuracy = triStateColumn(applications.accuracyConfirmed, q.accuracyConfirmed);
  if (accuracy) parts.push(accuracy);
  if (q.consentAccepted === 'yes') parts.push(eq(applications.consentAccepted, true));
  if (q.consentAccepted === 'no') {
    parts.push(
      and(
        eq(applications.consentAccepted, false),
        sql`COALESCE(${applications.payloadSnapshot}->>'intakeVersion', '') <> 'historical_import'`,
      )!,
    );
  }
  if (q.consentAccepted === 'missing') {
    parts.push(
      or(
        sql`${applications.payloadSnapshot}->>'intakeVersion' = 'historical_import'`,
        eq(applications.consentPolicyVersion, ''),
      )!,
    );
  }

  const vscTri = yesNoFromStatusColumn(applications.vscStatus, q.vscYesNo);
  if (vscTri) parts.push(vscTri);
  const faTri = yesNoFromStatusColumn(applications.firstAidCprStatus, q.firstAidYesNo);
  if (faTri) parts.push(faTri);
  const immTri = yesNoFromStatusColumn(applications.immunizationStatus, q.immunizationYesNo);
  if (immTri) parts.push(immTri);
  const covid = covidFilter(q.covid);
  if (covid) parts.push(covid);

  for (const [values, col] of [
    [splitCsv(q.vscStatus), applications.vscStatus],
    [splitCsv(q.firstAidStatus), applications.firstAidCprStatus],
  ] as const) {
    if (values.length) parts.push(inArray(col, values));
  }

  const experienceTypes = splitCsv(q.experienceTypes);
  if (experienceTypes.length) {
    const overlap = jsonbStringArrayOverlap(
      sql`${applications.nannyExperienceTypes}`,
      experienceTypes,
      q.experienceTypesMatch === 'all' ? 'all' : 'any',
    );
    if (overlap) parts.push(overlap);
  }

  const ageGroups = splitCsv(q.ageGroups);
  if (ageGroups.length && (!q.role || q.role === 'nanny')) {
    parts.push(
      sql`(${applications.role} = 'nanny' AND ${jsonbStringArrayOverlap(
        sql`${applications.payloadSnapshot}->'experience'->'ageGroups'`,
        ageGroups,
        q.ageGroupsMatch === 'all' ? 'all' : 'any',
      )})`,
    );
  }

  const specialTypes = splitCsv(q.specialExperienceTypes);
  if (specialTypes.length && (!q.role || q.role === 'nanny')) {
    parts.push(
      sql`(${applications.role} = 'nanny' AND ${jsonbStringArrayOverlap(
        sql`${applications.payloadSnapshot}->'experience'->'specialExperienceTypes'`,
        specialTypes,
        'any',
      )})`,
    );
  }

  const educationCerts = splitCsv(q.educationCertifications);
  if (educationCerts.length && (!q.role || q.role === 'nanny')) {
    parts.push(
      sql`(${applications.role} = 'nanny' AND ${jsonbStringArrayOverlap(
        sql`${applications.payloadSnapshot}->'qualifications'->'educationCertifications'`,
        educationCerts,
        q.educationCertificationsMatch === 'all' ? 'all' : 'any',
      )})`,
    );
  }

  const languages = splitCsv(q.languages);
  if (languages.length) {
    parts.push(
      sql`EXISTS (
        SELECT 1 FROM jsonb_array_elements(${applications.additionalLanguages}) lang
        WHERE lang->>'language' IN (${sql.join(
          languages.map((l) => sql`${l}`),
          sql`, `,
        )})
      )`,
    );
  }

  if (q.hasChildcareExperience && q.hasChildcareExperience !== 'any' && (!q.role || q.role === 'nanny')) {
    parts.push(
      sql`(${applications.role} = 'nanny' AND (
        ${
          q.hasChildcareExperience === 'missing'
            ? sql`(${applications.payloadSnapshot}->'experience'->>'hasChildcareExperience') IS NULL`
            : q.hasChildcareExperience === 'yes'
              ? sql`(${applications.payloadSnapshot}->'experience'->>'hasChildcareExperience')::boolean IS TRUE`
              : sql`(${applications.payloadSnapshot}->'experience'->>'hasChildcareExperience')::boolean IS FALSE`
        }
      ))`,
    );
  }

  if (q.legallyAuthorizedToWork?.trim() && (!q.role || q.role === 'nanny')) {
    parts.push(
      sql`(${applications.role} = 'nanny' AND ${snapshotPathIlike('{eligibility,legallyAuthorizedToWork}', q.legallyAuthorizedToWork.trim())})`,
    );
  }
  if (q.workPermitChildcareRestrictions?.trim() && (!q.role || q.role === 'nanny')) {
    parts.push(
      sql`(${applications.role} = 'nanny' AND ${snapshotPathIlike('{eligibility,workPermitChildcareRestrictions}', q.workPermitChildcareRestrictions.trim())})`,
    );
  }
  if (q.authorizedOffCampus?.trim() && (!q.role || q.role === 'nanny')) {
    parts.push(
      sql`(${applications.role} = 'nanny' AND ${snapshotPathIlike('{eligibility,authorizedOffCampus}', q.authorizedOffCampus.trim())})`,
    );
  }
  if (q.workHourLimitStatus?.trim() && (!q.role || q.role === 'nanny')) {
    parts.push(
      sql`(${applications.role} = 'nanny' AND ${snapshotPathIlike('{eligibility,workHourLimitStatus}', q.workHourLimitStatus.trim())})`,
    );
  }
  if (q.educationProgramName?.trim() && (!q.role || q.role === 'nanny')) {
    parts.push(
      sql`(${applications.role} = 'nanny' AND ${snapshotPathIlike('{qualifications,educationProgramName}', q.educationProgramName.trim())})`,
    );
  }

  if (q.maxWeeklyHoursMin != null) {
    parts.push(
      sql`(${applications.role} = 'nanny' AND (${applications.payloadSnapshot}->'eligibility'->>'maxWeeklyWorkHours')::int >= ${q.maxWeeklyHoursMin})`,
    );
  }
  if (q.maxWeeklyHoursMax != null) {
    parts.push(
      sql`(${applications.role} = 'nanny' AND (${applications.payloadSnapshot}->'eligibility'->>'maxWeeklyWorkHours')::int <= ${q.maxWeeklyHoursMax})`,
    );
  }
  if (q.spokenEnglishMin != null) {
    parts.push(sql`${spokenEnglishRatingExpr()} >= ${q.spokenEnglishMin}`);
  }
  if (q.spokenEnglishMax != null) {
    parts.push(sql`${spokenEnglishRatingExpr()} <= ${q.spokenEnglishMax}`);
  }

  if (q.submittedFrom?.trim()) {
    parts.push(gte(applications.submittedAt, sql`${q.submittedFrom.trim()}::timestamptz`));
  }
  if (q.submittedTo?.trim()) {
    parts.push(lte(applications.submittedAt, sql`${q.submittedTo.trim()}::date + interval '1 day'`));
  }
  if (q.createdFrom?.trim()) {
    parts.push(gte(applications.createdAt, sql`${q.createdFrom.trim()}::timestamptz`));
  }
  if (q.createdTo?.trim()) {
    parts.push(lte(applications.createdAt, sql`${q.createdTo.trim()}::date + interval '1 day'`));
  }
  if (q.vscDateFrom?.trim()) {
    parts.push(gte(applications.vscIssueOrRequestDate, q.vscDateFrom.trim()));
  }
  if (q.vscDateTo?.trim()) {
    parts.push(lte(applications.vscIssueOrRequestDate, q.vscDateTo.trim()));
  }
  if (q.firstAidExpiryFrom?.trim()) {
    parts.push(gte(applications.firstAidCprExpiry, q.firstAidExpiryFrom.trim()));
  }
  if (q.firstAidExpiryTo?.trim()) {
    parts.push(lte(applications.firstAidCprExpiry, q.firstAidExpiryTo.trim()));
  }
  if (q.workPermitExpiryFrom?.trim()) {
    parts.push(
      sql`(${applications.payloadSnapshot}->'eligibility'->>'workPermitExpiry')::date >= ${q.workPermitExpiryFrom.trim()}::date`,
    );
  }
  if (q.workPermitExpiryTo?.trim()) {
    parts.push(
      sql`(${applications.payloadSnapshot}->'eligibility'->>'workPermitExpiry')::date <= ${q.workPermitExpiryTo.trim()}::date`,
    );
  }

  if (q.hasResume === 'yes' || q.hasResume === 'no') {
    const exists = sql`EXISTS (SELECT 1 FROM ${applicationDocuments} ad WHERE ad.application_id = ${applications.id} AND ad.category = 'resume')`;
    parts.push(q.hasResume === 'yes' ? exists : sql`NOT ${exists}`);
  }
  if (q.hasVscDocument === 'yes' || q.hasVscDocument === 'no') {
    const exists = sql`EXISTS (SELECT 1 FROM ${applicationDocuments} ad WHERE ad.application_id = ${applications.id} AND ad.category = 'vulnerable_sector_check')`;
    parts.push(q.hasVscDocument === 'yes' ? exists : sql`NOT ${exists}`);
  }

  return parts.length ? and(...parts) : undefined;
}

export function buildApplicationsListOrderBy(q: ListApplicationsQuery) {
  const dir = q.sortDir === 'asc' ? asc : desc;
  switch (q.sortBy) {
    case 'applicant':
      return [dir(applications.lastName), dir(applications.firstName)];
    case 'email':
      return [dir(applications.email)];
    case 'status':
      return [dir(applications.status)];
    case 'reviewedAt':
      return [sql`${applications.reviewedAt} ${q.sortDir === 'asc' ? sql`ASC` : sql`DESC`} NULLS LAST`];
    case 'createdAt':
      return [dir(applications.createdAt)];
    case 'submittedAt':
    default:
      return [dir(applications.submittedAt), dir(applications.createdAt)];
  }
}
