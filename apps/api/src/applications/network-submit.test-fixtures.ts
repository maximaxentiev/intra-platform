import { randomUUID } from 'node:crypto';
import type { NormalizedNetworkApplication } from './network-submit.validation';

export function buildEcaApplicationJson(
  overrides: Partial<{
    externalApplicationId: string;
    role: 'ECA' | 'ECE/RECE' | 'Nanny';
    consentAccepted: boolean;
    gtaEligible: boolean;
    documents: NormalizedNetworkApplication['documents'];
    email: string;
  }> = {},
): NormalizedNetworkApplication {
  const externalApplicationId = overrides.externalApplicationId ?? randomUUID();
  const role = overrides.role ?? 'ECA';
  const documents =
    overrides.documents ??
    (role === 'Nanny'
      ? nannyDocuments()
      : role === 'ECA' || role === 'ECE/RECE'
        ? ecaDocuments()
        : ecaDocuments());

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
    experience: {
      duration: '2_years',
      types: role === 'Nanny' ? ['infant', 'toddler'] : undefined,
    },
    roleSpecific:
      role === 'Nanny'
        ? { training: { completed: true, description: 'Infant CPR workshop' } }
        : { qualification: { status: 'eca_canada' } },
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

function ecaDocuments(): NormalizedNetworkApplication['documents'] {
  const vscId = randomUUID();
  const cprId = randomUUID();
  const immId = randomUUID();
  const qualId = randomUUID();
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
    {
      id: qualId,
      category: 'qualification_certificate',
      originalFilename: 'qual.pdf',
      contentType: 'application/pdf',
      size: 128,
    },
  ];
}

function nannyDocuments(): NormalizedNetworkApplication['documents'] {
  const docs = ecaDocuments().filter((d) => d.category !== 'qualification_certificate');
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
