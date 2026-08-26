import { randomUUID } from 'node:crypto';
import type { NormalizedNetworkApplication } from './network-submit.validation';

type PublicRole = 'ECA' | 'ECE/RECE' | 'Nanny';

export function buildEcaApplicationJson(
  overrides: Partial<{
    externalApplicationId: string;
    role: PublicRole;
    consentAccepted: boolean;
    gtaEligible: boolean;
    documents: NormalizedNetworkApplication['documents'];
    email: string;
    qualificationStatus: string | null;
    experienceDescription: string;
  }> = {},
): NormalizedNetworkApplication {
  const externalApplicationId = overrides.externalApplicationId ?? randomUUID();
  const role = overrides.role ?? 'ECA';
  const qualificationStatus =
    overrides.qualificationStatus === null
      ? undefined
      : overrides.qualificationStatus ?? 'eca_canada';
  const documents =
    overrides.documents ??
    (role === 'Nanny'
      ? nannyDocuments()
      : role === 'ECA' || role === 'ECE/RECE'
        ? legacyEcaEceDocuments(includeLegacyQualificationCertificate(qualificationStatus))
        : legacyEcaEceDocuments(true));

  const experience: NormalizedNetworkApplication['experience'] = {
    duration: '2_years',
    types: role === 'Nanny' ? ['infant', 'toddler'] : undefined,
  };
  if (overrides.experienceDescription !== undefined) {
    experience.description = overrides.experienceDescription;
  }

  const roleSpecific: NormalizedNetworkApplication['roleSpecific'] =
    role === 'Nanny'
      ? { training: { completed: true, description: 'Infant CPR workshop' } }
      : qualificationStatus
        ? { qualification: { status: qualificationStatus } }
        : {};

  return {
    metadata: {
      formId: 'join-network',
      externalApplicationId,
      submittedAt: '2026-07-28T16:00:00.000Z',
      sourcePage: '/join-the-network',
      sourceUrl: 'https://intra.ca/join-the-network',
      consentAccepted: overrides.consentAccepted ?? true,
      consentPolicyVersion: '2026-07-01',
    },
    role,
    applicant: {
      firstName: 'Test',
      middleName: '',
      lastName: 'Applicant',
      email: overrides.email ?? `test-${externalApplicationId.slice(0, 8)}@example.test`,
      phone: '4165550100',
      gender: 'prefer_not_to_say',
    },
    eligibility: {
      gtaEligible: overrides.gtaEligible ?? true,
      statusInCanada: 'permanent_resident',
    },
    experience,
    roleSpecific,
    compliance: {
      vulnerableSectorCheck: { hasDocument: true, issueDate: '2026-01-15' },
      firstAidCpr: { hasDocument: true, expiryDate: '2027-06-01' },
      immunizations: { hasRequiredImmunizations: true },
      covid19: { vaccinated: true, proofProvided: false },
    },
    languages: {
      englishProficiency: 'fluent',
      speaksAdditionalLanguages: false,
    },
    documents,
  };
}

/** Current live website payload: explicit qualification status + legacy certificate. */
export function buildLegacyLiveWebsiteEcaPayload(): NormalizedNetworkApplication {
  return buildEcaApplicationJson({
    role: 'ECA',
    qualificationStatus: 'eca_canada',
  });
}

/** Current live website payload for ECE/RECE with Canadian certificate requirement. */
export function buildLegacyLiveWebsiteEcePayload(): NormalizedNetworkApplication {
  return buildEcaApplicationJson({
    role: 'ECE/RECE',
    qualificationStatus: 'ece_canada',
  });
}

function includeLegacyQualificationCertificate(status: string | undefined): boolean {
  return status === 'eca_canada' || status === 'ece_canada';
}

function complianceDocuments(): NormalizedNetworkApplication['documents'] {
  const vscId = randomUUID();
  const cprId = randomUUID();
  const immId = randomUUID();
  return [
    {
      id: vscId,
      category: 'vulnerable_sector_check',
      originalFilename: 'vsc.pdf',
      contentType: 'application/pdf',
      size: 128,
    },
    {
      id: cprId,
      category: 'first_aid_cpr',
      originalFilename: 'cpr.pdf',
      contentType: 'application/pdf',
      size: 128,
    },
    {
      id: immId,
      category: 'immunization_records',
      originalFilename: 'imm.pdf',
      contentType: 'application/pdf',
      size: 128,
    },
  ];
}

function legacyEcaEceDocuments(includeQualificationCertificate: boolean): NormalizedNetworkApplication['documents'] {
  const docs = complianceDocuments();
  if (includeQualificationCertificate) {
    const qualId = randomUUID();
    docs.push({
      id: qualId,
      category: 'qualification_certificate',
      originalFilename: 'qual.pdf',
      contentType: 'application/pdf',
      size: 128,
    });
  }
  return docs;
}

/** Compliance-only documents for new-shape applications without legacy qualification. */
export function buildNewShapeComplianceDocuments(): NormalizedNetworkApplication['documents'] {
  return complianceDocuments();
}

export function documentMeta(
  category: NormalizedNetworkApplication['documents'][number]['category'],
  filename = 'doc.pdf',
): NormalizedNetworkApplication['documents'][number] {
  const contentType =
    filename.endsWith('.png') ? 'image/png' : 'application/pdf';
  return {
    id: randomUUID(),
    category,
    originalFilename: filename,
    contentType,
    size: contentType === 'image/png' ? 64 : 128,
  };
}

function nannyDocuments(): NormalizedNetworkApplication['documents'] {
  const docs = complianceDocuments();
  const trainingId = randomUUID();
  docs.push({
    id: trainingId,
    category: 'training_proof',
    originalFilename: 'training.png',
    contentType: 'image/png',
    size: 64,
  });
  return docs;
}

export function fakePdfBuffer(label: string, size = 128): Buffer {
  const content = `%PDF-1.4 fake test document ${label}`;
  return Buffer.alloc(size, content.slice(0, 1));
}

export function fakePngBuffer(size = 64): Buffer {
  return Buffer.alloc(size, 0x89);
}

export function matchedFilesFromPayload(payload: NormalizedNetworkApplication) {
  return payload.documents.map((doc) => ({
    fieldname: `doc_${doc.id}`,
    originalname: doc.originalFilename,
    encoding: '7bit',
    mimetype: doc.contentType,
    size: doc.size,
    buffer:
      doc.contentType === 'image/png'
        ? fakePngBuffer(doc.size)
        : fakePdfBuffer(doc.originalFilename, doc.size),
  })) as Express.Multer.File[];
}
