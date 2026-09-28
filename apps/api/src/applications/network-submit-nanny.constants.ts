export const NANNY_CONSENT_POLICY_VERSION = 'join-the-network-consent-v1-2026-07-28';

export const NANNY_CITIES = [
  'Ajax',
  'Aurora',
  'Brampton',
  'Brock',
  'Burlington',
  'Caledon',
  'Clarington',
  'East Gwillimbury',
  'Georgina',
  'Halton Hills / Georgetown',
  'King',
  'Markham',
  'Milton',
  'Mississauga',
  'Newmarket',
  'Oakville',
  'Oshawa',
  'Pickering',
  'Richmond Hill',
  'Scugog',
  'Toronto',
  'Uxbridge',
  'Vaughan',
  'Whitby',
  'Whitchurch-Stouffville',
  'Other',
] as const;

export const NANNY_GENDERS = ['Woman', 'Man', 'Non-binary', 'Prefer not to say'] as const;

export const NANNY_CANADA_STATUSES = [
  'Canadian citizen',
  'Permanent resident',
  'Protected person',
  'Refugee / asylum claimant',
  'Open work permit',
  'Employer-specific work permit',
  'Study permit',
  'Visitor record',
  'Other',
] as const;

export const NANNY_LEGAL_AUTHORIZATION = ['Yes', 'No', 'Unsure'] as const;

export const NANNY_WORK_PERMIT_RESTRICTIONS = ['No', 'Yes', 'Unsure'] as const;

export const NANNY_STUDY_OFF_CAMPUS = ['Yes', 'No', 'Unsure'] as const;

export const NANNY_WORK_HOUR_LIMIT_STATUS = ['Yes', 'No', 'Unsure'] as const;

export const NANNY_EXPERIENCE_YEARS = [
  'No previous experience',
  'Less than 1 year',
  '1 to 2 years',
  '3 to 5 years',
  '6 to 10 years',
  'More than 10 years',
] as const;

export const NANNY_EXPERIENCE_TYPES = [
  'Nanny',
  'Babysitter',
  'Childcare centre / daycare',
  'RECE',
  'ECE',
  'ECA',
  'Montessori',
  'Educational Assistant',
  'Camp counsellor',
  'Before / after-school program',
  'School',
  "Children's recreation program",
  'Family / personal childcare experience',
  'Other',
  'No previous childcare experience',
] as const;

export const NANNY_EXPERIENCE_TYPE_EXCLUSIVE = 'No previous childcare experience';

export const NANNY_AGE_GROUPS = [
  'Newborn: 0 to 3 months',
  'Infant: 3 to 12 months',
  'Toddler: 1 to 2 years',
  'Preschool: 3 to 5 years',
  'School age: 6 to 12 years',
  'Teenagers: 13+',
  'No previous childcare experience',
] as const;

export const NANNY_AGE_GROUP_EXCLUSIVE = 'No previous childcare experience';

export const NANNY_SPECIAL_EXPERIENCE = [
  'Infants',
  'Multiple children',
  'Twins / multiples',
  'Children with disabilities',
  'Autism',
  'ADHD',
  'Behavioural needs',
  'Medical needs',
  'Allergies',
  'Special diets',
  'Montessori',
  'Early childhood education',
  'Speech / language development',
  'Toilet training',
  'Sleep routines',
  'Homework support',
  'None of the above',
] as const;

export const NANNY_SPECIAL_EXPERIENCE_EXCLUSIVE = 'None of the above';

export const NANNY_EDUCATION_CERTIFICATIONS = [
  'RECE',
  'ECE diploma',
  'ECA certificate',
  'Montessori training',
  'Educational Assistant training',
  'Child and Youth Care',
  'Social Service Worker',
  'Nursing / healthcare',
  'Teaching / education',
  'Other',
  'None',
] as const;

export const NANNY_EDUCATION_EXCLUSIVE = 'None';

export const NANNY_FIRST_AID_STATUSES = [
  'Yes',
  'No',
  'No, but I am willing to obtain it',
] as const;

export const NANNY_VSC_STATUSES = [
  'Yes',
  'No but I am willing to obtain one',
  'No',
] as const;

export const WORK_PERMIT_CANADA_STATUSES = new Set<string>([
  'Open work permit',
  'Employer-specific work permit',
]);

export const STUDY_PERMIT_CANADA_STATUS = 'Study permit';

export const NANNY_VSC_ALLOWED_EXTENSIONS = new Set([
  '.pdf',
  '.jpg',
  '.jpeg',
  '.png',
  '.heic',
  '.heif',
]);

export const NANNY_VSC_ALLOWED_MIMES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/heic',
  'image/heif',
]);

export const NANNY_RESUME_ALLOWED_EXTENSIONS = new Set(['.pdf', '.doc', '.docx']);

export const NANNY_RESUME_ALLOWED_MIMES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);
