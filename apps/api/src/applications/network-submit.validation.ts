import { BadRequestException } from '@nestjs/common';
import {
  ALLOWED_SUBMIT_EXTENSIONS,
  ALLOWED_SUBMIT_MIME_TYPES,
  DOCUMENT_CATEGORY_VALUES,
  DOC_FIELD_PREFIX,
  NETWORK_SUBMIT_MAX_FILES,
  NETWORK_SUBMIT_MAX_FILE_BYTES,
  NETWORK_SUBMIT_MAX_TOTAL_BYTES,
  PUBLIC_ROLE_VALUES,
  type DocumentCategoryValue,
  type PublicRoleValue,
  qualificationStatusRequiresCertificate,
} from './network-submit.constants';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface NetworkDocumentMeta {
  id: string;
  category: DocumentCategoryValue;
  originalFilename: string;
  contentType: string;
  size: number;
}

export interface NormalizedNetworkApplication {
  metadata: {
    formId: string;
    externalApplicationId: string;
    submittedAt?: string;
    sourcePage: string;
    sourceUrl: string;
    consentAccepted: boolean;
    consentPolicyVersion: string;
  };
  role: PublicRoleValue;
  applicant: {
    firstName: string;
    middleName?: string;
    lastName: string;
    email: string;
    phone: string;
    gender: string;
  };
  eligibility: {
    gtaEligible: boolean;
    statusInCanada: string;
  };
  experience: {
    duration: string;
    types?: string[];
  };
  roleSpecific: {
    qualification?: { status: string };
    training?: { completed: boolean; description?: string };
  };
  compliance: {
    vulnerableSectorCheck: { hasDocument: boolean; issueDate?: string };
    firstAidCpr: { hasDocument: boolean; expiryDate?: string };
    immunizations: { hasRequiredImmunizations: boolean };
    covid19: { vaccinated: boolean | null; proofProvided: boolean };
  };
  languages: {
    englishProficiency: string;
    speaksAdditionalLanguages: boolean;
    additional?: Array<{ language: string; proficiency: string }>;
  };
  documents: NetworkDocumentMeta[];
}

function assertObject(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new BadRequestException(`${label} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function reqString(obj: Record<string, unknown>, key: string, label: string): string {
  const value = obj[key];
  if (typeof value !== 'string' || !value.trim()) {
    throw new BadRequestException(`${label} is required.`);
  }
  return value.trim();
}

function optString(obj: Record<string, unknown>, key: string): string {
  const value = obj[key];
  return typeof value === 'string' ? value.trim() : '';
}

function reqBool(obj: Record<string, unknown>, key: string, label: string): boolean {
  const value = obj[key];
  if (typeof value !== 'boolean') {
    throw new BadRequestException(`${label} must be a boolean.`);
  }
  return value;
}

function optBool(obj: Record<string, unknown>, key: string): boolean | undefined {
  const value = obj[key];
  return typeof value === 'boolean' ? value : undefined;
}

/** Optional COVID vaccination answer: true, false, or null (unanswered). */
function parseOptionalBool(obj: Record<string, unknown>, key: string, label: string): boolean | null {
  const value = obj[key];
  if (value === null || value === undefined) return null;
  if (typeof value === 'boolean') return value;
  throw new BadRequestException(`${label} must be true, false, or null.`);
}

function assertDate(value: string | undefined, label: string): string | undefined {
  if (value === undefined || value === '') return undefined;
  if (!DATE_RE.test(value)) {
    throw new BadRequestException(`${label} must be YYYY-MM-DD.`);
  }
  return value;
}

function assertPhone(phone: string): void {
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 10 || digits.length > 15) {
    throw new BadRequestException('Phone number must contain 10–15 digits.');
  }
}

function extensionOf(filename: string): string {
  const idx = filename.lastIndexOf('.');
  return idx >= 0 ? filename.slice(idx).toLowerCase() : '';
}

export function parseNetworkApplicationJson(raw: string): NormalizedNetworkApplication {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new BadRequestException('application field must be valid JSON.');
  }

  const root = assertObject(parsed, 'application');
  const metadata = assertObject(root.metadata, 'metadata');
  const applicant = assertObject(root.applicant, 'applicant');
  const eligibility = assertObject(root.eligibility, 'eligibility');
  const experience = assertObject(root.experience, 'experience');
  const roleSpecific = assertObject(root.roleSpecific ?? {}, 'roleSpecific');
  const compliance = assertObject(root.compliance, 'compliance');
  const languages = assertObject(root.languages, 'languages');

  const externalApplicationId = reqString(metadata, 'externalApplicationId', 'metadata.externalApplicationId');
  if (!UUID_RE.test(externalApplicationId)) {
    throw new BadRequestException('metadata.externalApplicationId must be a UUID.');
  }

  const consentAccepted = reqBool(metadata, 'consentAccepted', 'metadata.consentAccepted');
  if (!consentAccepted) {
    throw new BadRequestException('Consent must be accepted.');
  }

  const consentPolicyVersion = reqString(metadata, 'consentPolicyVersion', 'metadata.consentPolicyVersion');
  const roleRaw = reqString(root, 'role', 'role');
  if (!PUBLIC_ROLE_VALUES.includes(roleRaw as PublicRoleValue)) {
    throw new BadRequestException('Invalid role.');
  }
  const role = roleRaw as PublicRoleValue;

  const firstName = reqString(applicant, 'firstName', 'applicant.firstName');
  const lastName = reqString(applicant, 'lastName', 'applicant.lastName');
  const email = reqString(applicant, 'email', 'applicant.email').toLowerCase();
  if (!EMAIL_RE.test(email)) {
    throw new BadRequestException('Invalid applicant email.');
  }
  const phone = reqString(applicant, 'phone', 'applicant.phone');
  assertPhone(phone);

  const gtaEligible = reqBool(eligibility, 'gtaEligible', 'eligibility.gtaEligible');
  if (!gtaEligible) {
    throw new BadRequestException('Applicant must be GTA eligible.');
  }

  const vsc = assertObject(compliance.vulnerableSectorCheck, 'compliance.vulnerableSectorCheck');
  const cpr = assertObject(compliance.firstAidCpr, 'compliance.firstAidCpr');
  const immunizations = assertObject(compliance.immunizations, 'compliance.immunizations');
  const covid19 = assertObject(compliance.covid19, 'compliance.covid19');

  const vscHas = reqBool(vsc, 'hasDocument', 'compliance.vulnerableSectorCheck.hasDocument');
  const cprHas = reqBool(cpr, 'hasDocument', 'compliance.firstAidCpr.hasDocument');
  const immHas = reqBool(
    immunizations,
    'hasRequiredImmunizations',
    'compliance.immunizations.hasRequiredImmunizations',
  );

  if (!vscHas) throw new BadRequestException('Vulnerable Sector Check document is required.');
  if (!cprHas) throw new BadRequestException('First Aid & CPR document is required.');
  if (!immHas) throw new BadRequestException('Immunization records are required.');

  const vscIssueDate = assertDate(optString(vsc, 'issueDate'), 'compliance.vulnerableSectorCheck.issueDate');
  const cprExpiryDate = assertDate(optString(cpr, 'expiryDate'), 'compliance.firstAidCpr.expiryDate');

  const covidVaccinated = parseOptionalBool(
    covid19,
    'vaccinated',
    'compliance.covid19.vaccinated',
  );
  const covidProofProvided = optBool(covid19, 'proofProvided') ?? false;
  if (covidVaccinated === null && covidProofProvided) {
    throw new BadRequestException(
      'compliance.covid19.proofProvided cannot be true when vaccinated is null.',
    );
  }
  if (covidVaccinated === false && covidProofProvided) {
    throw new BadRequestException(
      'compliance.covid19.proofProvided cannot be true when vaccinated is false.',
    );
  }

  if (role === 'ECA' || role === 'ECE/RECE') {
    const qualification = assertObject(roleSpecific.qualification ?? {}, 'roleSpecific.qualification');
    reqString(qualification, 'status', 'roleSpecific.qualification.status');
  }

  if (role === 'Nanny') {
    const training = assertObject(roleSpecific.training ?? {}, 'roleSpecific.training');
    reqBool(training, 'completed', 'roleSpecific.training.completed');
  }

  const speaksAdditional = reqBool(
    languages,
    'speaksAdditionalLanguages',
    'languages.speaksAdditionalLanguages',
  );
  let additional: Array<{ language: string; proficiency: string }> | undefined;
  if (speaksAdditional) {
    const rawAdditional = languages.additional;
    if (!Array.isArray(rawAdditional) || rawAdditional.length === 0) {
      throw new BadRequestException('languages.additional is required when speaksAdditionalLanguages is true.');
    }
    additional = rawAdditional.map((item, index) => {
      const row = assertObject(item, `languages.additional[${index}]`);
      return {
        language: reqString(row, 'language', `languages.additional[${index}].language`),
        proficiency: reqString(row, 'proficiency', `languages.additional[${index}].proficiency`),
      };
    });
  }

  const documentsRaw = root.documents;
  if (!Array.isArray(documentsRaw)) {
    throw new BadRequestException('documents must be an array.');
  }
  if (documentsRaw.length > NETWORK_SUBMIT_MAX_FILES) {
    throw new BadRequestException(`Too many documents (max ${NETWORK_SUBMIT_MAX_FILES}).`);
  }

  const documents: NetworkDocumentMeta[] = documentsRaw.map((item, index) => {
    const row = assertObject(item, `documents[${index}]`);
    const id = reqString(row, 'id', `documents[${index}].id`);
    if (!UUID_RE.test(id)) {
      throw new BadRequestException(`documents[${index}].id must be a UUID.`);
    }
    const categoryRaw = reqString(row, 'category', `documents[${index}].category`);
    if (!DOCUMENT_CATEGORY_VALUES.includes(categoryRaw as DocumentCategoryValue)) {
      throw new BadRequestException(`documents[${index}].category is invalid.`);
    }
    const originalFilename = reqString(row, 'originalFilename', `documents[${index}].originalFilename`);
    const contentType = reqString(row, 'contentType', `documents[${index}].contentType`).toLowerCase();
    const size = row.size;
    if (typeof size !== 'number' || !Number.isInteger(size) || size <= 0) {
      throw new BadRequestException(`documents[${index}].size must be a positive integer.`);
    }
    if (size > NETWORK_SUBMIT_MAX_FILE_BYTES) {
      throw new BadRequestException(`documents[${index}] exceeds max file size.`);
    }
    if (!ALLOWED_SUBMIT_MIME_TYPES.has(contentType)) {
      throw new BadRequestException(`documents[${index}] has a disallowed content type.`);
    }
    const ext = extensionOf(originalFilename);
    if (!ALLOWED_SUBMIT_EXTENSIONS.has(ext)) {
      throw new BadRequestException(`documents[${index}] has a disallowed file extension.`);
    }
    return {
      id,
      category: categoryRaw as DocumentCategoryValue,
      originalFilename,
      contentType,
      size,
    };
  });

  const totalBytes = documents.reduce((sum, d) => sum + d.size, 0);
  if (totalBytes > NETWORK_SUBMIT_MAX_TOTAL_BYTES) {
    throw new BadRequestException('Total upload size exceeds the allowed limit.');
  }

  return {
    metadata: {
      formId: reqString(metadata, 'formId', 'metadata.formId'),
      externalApplicationId,
      submittedAt: optString(metadata, 'submittedAt') || undefined,
      sourcePage: optString(metadata, 'sourcePage'),
      sourceUrl: optString(metadata, 'sourceUrl'),
      consentAccepted,
      consentPolicyVersion,
    },
    role,
    applicant: {
      firstName,
      middleName: optString(applicant, 'middleName'),
      lastName,
      email,
      phone,
      gender: optString(applicant, 'gender'),
    },
    eligibility: {
      gtaEligible,
      statusInCanada: reqString(eligibility, 'statusInCanada', 'eligibility.statusInCanada'),
    },
    experience: {
      duration: optString(experience, 'duration'),
      types: Array.isArray(experience.types)
        ? experience.types.filter((t): t is string => typeof t === 'string')
        : undefined,
    },
    roleSpecific: {
      qualification:
        role === 'ECA' || role === 'ECE/RECE'
          ? { status: reqString(assertObject(roleSpecific.qualification ?? {}, 'roleSpecific.qualification'), 'status', 'roleSpecific.qualification.status') }
          : undefined,
      training:
        role === 'Nanny'
          ? {
              completed: reqBool(assertObject(roleSpecific.training ?? {}, 'roleSpecific.training'), 'completed', 'roleSpecific.training.completed'),
              description: optString(assertObject(roleSpecific.training ?? {}, 'roleSpecific.training'), 'description'),
            }
          : undefined,
    },
    compliance: {
      vulnerableSectorCheck: { hasDocument: vscHas, issueDate: vscIssueDate },
      firstAidCpr: { hasDocument: cprHas, expiryDate: cprExpiryDate },
      immunizations: { hasRequiredImmunizations: immHas },
      covid19: {
        vaccinated: covidVaccinated,
        proofProvided: covidProofProvided,
      },
    },
    languages: {
      englishProficiency: reqString(languages, 'englishProficiency', 'languages.englishProficiency'),
      speaksAdditionalLanguages: speaksAdditional,
      additional,
    },
    documents,
  };
}

export interface MatchedSubmitFile {
  meta: NetworkDocumentMeta;
  buffer: Buffer;
  fieldName: string;
}

export function matchSubmitFiles(
  documents: NetworkDocumentMeta[],
  files: Express.Multer.File[],
): MatchedSubmitFile[] {
  const byField = new Map<string, Express.Multer.File>();
  for (const file of files) {
    if (!file.fieldname.startsWith(DOC_FIELD_PREFIX)) continue;
    if (byField.has(file.fieldname)) {
      throw new BadRequestException(`Duplicate upload field ${file.fieldname}.`);
    }
    byField.set(file.fieldname, file);
  }

  if (byField.size !== documents.length) {
    throw new BadRequestException('Document metadata count must match uploaded files.');
  }

  return documents.map((meta) => {
    const fieldName = `${DOC_FIELD_PREFIX}${meta.id}`;
    const file = byField.get(fieldName);
    if (!file) {
      throw new BadRequestException(`Missing uploaded file for document ${meta.id}.`);
    }
    if (file.size !== meta.size) {
      throw new BadRequestException(`Document ${meta.id} size does not match metadata.`);
    }
    const mime = (file.mimetype || '').toLowerCase();
    if (mime !== meta.contentType) {
      throw new BadRequestException(`Document ${meta.id} content type does not match metadata.`);
    }
    if (!ALLOWED_SUBMIT_MIME_TYPES.has(mime)) {
      throw new BadRequestException(`Document ${meta.id} has a disallowed content type.`);
    }
    return { meta, buffer: file.buffer, fieldName };
  });
}

export function mapCovidVaccinationStatus(covid19: NormalizedNetworkApplication['compliance']['covid19']): string {
  if (covid19.vaccinated === null) return 'not_provided';
  if (covid19.vaccinated) {
    return covid19.proofProvided ? 'vaccinated_with_proof' : 'vaccinated';
  }
  return 'not_vaccinated';
}

export function complianceToDbFields(compliance: NormalizedNetworkApplication['compliance']) {
  return {
    vscStatus: compliance.vulnerableSectorCheck.hasDocument ? 'provided' : 'missing',
    vscIssueOrRequestDate: compliance.vulnerableSectorCheck.issueDate ?? null,
    firstAidCprStatus: compliance.firstAidCpr.hasDocument ? 'provided' : 'missing',
    firstAidCprExpiry: compliance.firstAidCpr.expiryDate ?? null,
    immunizationStatus: compliance.immunizations.hasRequiredImmunizations ? 'provided' : 'missing',
    covidVaccinationStatus: mapCovidVaccinationStatus(compliance.covid19),
  };
}

export function requiredDocumentCategories(
  payload: NormalizedNetworkApplication,
): DocumentCategoryValue[] {
  const required: DocumentCategoryValue[] = [
    'vulnerable_sector_check',
    'first_aid_cpr',
    'immunization_records',
  ];
  if (payload.role === 'Nanny') required.push('training_proof');
  if (payload.role === 'ECA' || payload.role === 'ECE/RECE') {
    const status = payload.roleSpecific.qualification?.status ?? '';
    if (qualificationStatusRequiresCertificate(status)) {
      required.push('qualification_certificate');
    }
  }
  if (payload.compliance.covid19.proofProvided) required.push('covid19_vaccination');
  return required;
}

export function assertRequiredDocumentsPresent(payload: NormalizedNetworkApplication): void {
  const present = new Set(payload.documents.map((d) => d.category));
  for (const category of requiredDocumentCategories(payload)) {
    if (!present.has(category)) {
      throw new BadRequestException(`Missing required document category: ${category}.`);
    }
  }
}
