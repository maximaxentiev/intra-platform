// Domain types, helpers, and typed resource clients for the Intra API.
// (Replaces the former Supabase browser client.)
import { api } from "@/lib/api";
import type { StaffUpdatePayload } from "@/lib/staff-form-payload";

export type PortalAccountDisplayStatus =
  | "no_account"
  | "invited"
  | "incomplete"
  | "active"
  | "disabled";
export type CentreChannel = "whatsapp" | "goto" | "email";
export type ShiftStatus = "pending" | "filled" | "cancelled" | "completed";
export type UserRole = "admin" | "ops";

export const CENTRE_CHANNEL_OPTIONS: { value: CentreChannel; label: string }[] = [
  { value: "whatsapp", label: "WhatsApp" },
  { value: "goto", label: "GoTo" },
  { value: "email", label: "Email" },
];

export function channelLabel(channel: CentreChannel): string {
  return CENTRE_CHANNEL_OPTIONS.find((o) => o.value === channel)?.label ?? channel;
}

// ---------------------------------------------------------------------------
// Types (camelCase — matches the API contract)
// ---------------------------------------------------------------------------
export interface CurrentUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  isActive: boolean;
  mustChangePassword: boolean;
  temporaryPasswordExpiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Staff {
  id: string;
  legalName: string;
  legalFirstName: string;
  legalLastName: string;
  displayName: string;
  useDisplayName: boolean;
  phone: string;
  email: string;
  address: string;
  city: string;
  role: string;
  notes: string;
  documentsUrl: string;
  createdAt: string;
  updatedAt: string;
  portalAccountStatus?: PortalAccountDisplayStatus;
  documentStatus?: string;
}

export interface PortalAccountInfo {
  accountStatus: PortalAccountDisplayStatus;
  email: string | null;
  inviteSentAt: string | null;
  inviteExpiresAt: string | null;
  lastLoginAt: string | null;
  onboardingCompletedAt: string | null;
  onboardingStep: number | null;
  profileCompletedAt: string | null;
}

export interface StaffDetail extends Staff {
  portalAccount: PortalAccountInfo | null;
}

export interface PortalInvitationResult {
  ok: boolean;
  emailSent: boolean;
  resend: boolean;
  accountStatus: PortalAccountDisplayStatus;
  inviteSentAt: string | null;
  inviteExpiresAt: string | null;
  message?: string;
}

export type ManualStaffCreateInput = {
  displayName: string;
  legalFirstName: string;
  legalLastName: string;
  role: "ECA" | "ECE" | "Nanny";
  email: string;
  phone: string;
  address: string;
  city: string;
};

export interface Centre {
  id: string;
  name: string;
  address: string;
  city: string;
  hourlyRate: string | null;
  primaryChannel: CentreChannel;
  notes: string;
  requiresQualificationForMatching: boolean;
  eceQualificationRequirement: "ece_or_rece" | "rece_required";
  createdAt: string;
  updatedAt: string;
}

export interface CentreListItem extends Centre {
  primaryContactName: string;
}

export interface CentreContact {
  id: string;
  centreId: string;
  name: string;
  title: string;
  email: string;
  phone: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface Availability {
  id: string;
  staffId: string;
  weekStartDate: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

export interface Shift {
  id: string;
  centreId: string;
  batchId?: string | null;
  batchRequestCompletedAt?: string | null;
  centreCommunicationDeferred?: boolean;
  shiftDate: string;
  startTime: string;
  endTime: string;
  roleNeeded: string;
  notes: string;
  confirmationNotes?: string | null;
  status: ShiftStatus;
  assignedStaffId: string | null;
  cancellationReason: string;
  addedToStaffpoint: boolean;
  centreName?: string | null;
  assignedLegalName?: string | null;
  assignedDisplayName?: string | null;
  assignedUseDisplayName?: boolean | null;
}

export interface ShiftComment {
  id: string;
  shiftId: string;
  authorId: string;
  authorName: string | null;
  authorEmail: string | null;
  body: string;
  createdAt: string;
}

export interface StaffMatchingPriority {
  group: number;
  label: string;
  isTop: boolean;
  geographicTier: number;
  geographicLabel: string;
  qualificationType: string;
}

export interface AvailableStaff {
  id: string;
  legalName: string;
  displayName: string;
  useDisplayName: boolean;
  role: string;
  isTop: boolean;
  contacted: boolean;
  matchingPriority: StaffMatchingPriority;
}

export type ShiftAssignmentRecipientResult = {
  attempted: boolean;
  sent: boolean;
  skippedReason?: string;
  deferred?: boolean;
};

export type ShiftAssignmentNotificationsResult = {
  centre: ShiftAssignmentRecipientResult;
  carer: ShiftAssignmentRecipientResult;
};

export type ShiftAssignmentOutcome = {
  changed: boolean;
  alreadyAssigned: boolean;
};

export type ShiftAssignResponse = {
  shift: Shift;
  assignment: ShiftAssignmentOutcome;
  notifications: ShiftAssignmentNotificationsResult | null;
};

export type ShiftResendConfirmationsResponse = {
  notifications: ShiftAssignmentNotificationsResult;
};

export type ShiftCommunicationRecipientsPayload = {
  centre?: boolean;
  carer?: boolean;
};

export type UnassignShiftResponse = {
  shift: Shift;
  notifications: {
    centre: ShiftAssignmentRecipientResult | null;
    carer: ShiftAssignmentRecipientResult | null;
  } | null;
};

export type ShiftUpdateCommunicationsResult = {
  centre: ShiftAssignmentRecipientResult | null;
  carer: ShiftAssignmentRecipientResult | null;
} | null;

export type ShiftUpdateCommunicationsPayload = {
  centre?: { send: boolean; include: { date?: boolean; time?: boolean; role?: boolean; shiftNotes?: boolean } };
  carer?: { send: boolean; include: { date?: boolean; time?: boolean; role?: boolean; shiftNotes?: boolean } };
};

export type ShiftAssignmentResolution = "unassign" | "availability_override";

export type ShiftUpdateAssignmentImpactResult = {
  action: "unchanged" | "unassigned" | "availability_override";
  previousStaffId?: string | null;
};

export type ShiftUpdateResponse = Shift & {
  communications: ShiftUpdateCommunicationsResult;
  assignmentImpact: ShiftUpdateAssignmentImpactResult;
};

export interface LinkedStaff {
  staffId: string;
  id: string;
  legalName: string;
  displayName: string;
  useDisplayName: boolean;
}

// ---------------------------------------------------------------------------
// Resource clients
// ---------------------------------------------------------------------------
export const authApi = {
  session: () => api.get<CurrentUser>("/auth/session"),
  login: (email: string, password: string) =>
    api.post<CurrentUser>("/auth/login", { email, password }),
  logout: () => api.post<{ ok: true }>("/auth/logout"),
  changePassword: (currentPassword: string, newPassword: string) =>
    api.post<{ ok: true }>("/auth/change-password", { currentPassword, newPassword }),
  replacePassword: (newPassword: string) =>
    api.post<CurrentUser>("/auth/replace-password", { newPassword }),
  me: () => api.get<CurrentUser>("/me"),
  updateMe: (fullName: string) => api.patch<CurrentUser>("/me", { fullName }),
};

export type AdminPasswordResetResult = {
  temporaryPassword: string;
  expiresAt: string;
};

export const usersApi = {
  list: () => api.get<CurrentUser[]>("/users"),
  invite: (values: { email: string; fullName: string; role: UserRole; password: string }) =>
    api.post<CurrentUser>("/users", values),
  update: (id: string, values: Partial<Pick<CurrentUser, "fullName" | "role" | "isActive">>) =>
    api.patch<CurrentUser>(`/users/${id}`, values),
  resetPassword: (id: string) => api.post<AdminPasswordResetResult>(`/users/${id}/reset-password`),
};

export type StaffCsvPreviewRowStatus = "valid" | "invalid" | "duplicate";

export type StaffCsvPreviewRow = {
  rowNumber: number;
  displayName: string;
  legalFirstName: string;
  legalLastName: string;
  role: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  status: StaffCsvPreviewRowStatus;
  issues: string[];
};

export type StaffCsvPreviewResult = {
  summary: { total: number; valid: number; invalid: number; duplicate: number };
  rows: StaffCsvPreviewRow[];
  limits: { maxBytes: number; maxRows: number };
};

export type StaffCsvImportRowResult = {
  rowNumber: number;
  email: string;
  displayName: string;
  phone: string;
  outcome: string;
  staffId?: string;
  message?: string;
};

export type StaffCsvImportResult = {
  batchId: string;
  summary: {
    totalProcessed: number;
    staffCreated: number;
    skipped: number;
    duplicates: number;
    failed: number;
    invitationsSent: number;
    invitationEmailFailures: number;
  };
  rows: StaffCsvImportRowResult[];
};

export const staffApi = {
  list: () => api.get<Staff[]>("/staff"),
  get: (id: string) => api.get<StaffDetail>(`/staff/${id}`),
  createManual: (values: ManualStaffCreateInput) => api.post<Staff>("/staff", values),
  create: (values: Partial<Staff>) => api.post<Staff>("/staff", values),
  update: (id: string, values: StaffUpdatePayload) => api.patch<Staff>(`/staff/${id}`, values),
  remove: (id: string) => api.del<{ ok: true }>(`/staff/${id}`),
  sendPortalInvitation: (id: string, body: { resend?: boolean }) =>
    api.post<PortalInvitationResult>(`/staff/${id}/portal-invitations`, body),
  disablePortalAccess: (id: string) =>
    api.post<PortalAccountInfo>(`/staff/${id}/portal-access/disable`),
  enablePortalAccess: (id: string) =>
    api.post<PortalAccountInfo>(`/staff/${id}/portal-access/enable`),
  previewCsvImport: (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return api.postForm<StaffCsvPreviewResult>("/staff/import/preview", fd);
  },
  confirmCsvImport: (file: File, sendPortalInvitations: boolean) => {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("sendPortalInvitations", sendPortalInvitations ? "true" : "false");
    return api.postForm<StaffCsvImportResult>("/staff/import", fd);
  },
  topCentres: (id: string) => api.get<string[]>(`/staff/${id}/top-centres`),
  bannedCentres: (id: string) => api.get<string[]>(`/staff/${id}/banned-centres`),
  setTopCentres: (id: string, centreIds: string[]) =>
    api.put<string[]>(`/staff/${id}/top-centres`, { centreIds }),
  setBannedCentres: (id: string, centreIds: string[]) =>
    api.put<string[]>(`/staff/${id}/banned-centres`, { centreIds }),
  shifts: (id: string) =>
    api.get<
      Array<{
        id: string;
        shiftDate: string;
        startTime: string;
        endTime: string;
        status: ShiftStatus;
        roleNeeded: string;
        centreId: string;
        centreName: string | null;
      }>
    >(`/staff/${id}/shifts`),
};

export const centresApi = {
  list: () => api.get<CentreListItem[]>("/centres"),
  get: (id: string) => api.get<Centre>(`/centres/${id}`),
  create: (values: Partial<Centre>) => api.post<Centre>("/centres", values),
  update: (id: string, values: Partial<Centre>) => api.patch<Centre>(`/centres/${id}`, values),
  remove: (id: string) => api.del<{ ok: true }>(`/centres/${id}`),
  secondaryChannels: (id: string) => api.get<CentreChannel[]>(`/centres/${id}/secondary-channels`),
  setSecondaryChannels: (id: string, channels: CentreChannel[]) =>
    api.put<CentreChannel[]>(`/centres/${id}/secondary-channels`, { channels }),
  contacts: (id: string) => api.get<CentreContact[]>(`/centres/${id}/contacts`),
  addContact: (id: string, values: Partial<CentreContact>) =>
    api.post<CentreContact>(`/centres/${id}/contacts`, values),
  updateContact: (contactId: string, values: Partial<CentreContact>) =>
    api.patch<CentreContact>(`/centres/contacts/${contactId}`, values),
  removeContact: (contactId: string) => api.del<{ ok: true }>(`/centres/contacts/${contactId}`),
  reorderContacts: (id: string, ids: string[]) =>
    api.put<CentreContact[]>(`/centres/${id}/contacts/reorder`, { ids }),
  topStaff: (id: string) => api.get<LinkedStaff[]>(`/centres/${id}/top-staff`),
  bannedStaff: (id: string) => api.get<LinkedStaff[]>(`/centres/${id}/banned-staff`),
  setTopStaff: (id: string, staffIds: string[]) =>
    api.put<LinkedStaff[]>(`/centres/${id}/top-staff`, { staffIds }),
  setBannedStaff: (id: string, staffIds: string[]) =>
    api.put<LinkedStaff[]>(`/centres/${id}/banned-staff`, { staffIds }),
  shifts: (id: string) =>
    api.get<
      Array<{
        id: string;
        shiftDate: string;
        startTime: string;
        endTime: string;
        status: ShiftStatus;
        roleNeeded: string;
        assignedStaffId: string | null;
        assignedLegalName: string | null;
        assignedDisplayName: string | null;
        assignedUseDisplayName: boolean | null;
      }>
    >(`/centres/${id}/shifts`),
};

export async function saveCentreSecondaryChannels(centreId: string, channels: CentreChannel[]) {
  await centresApi.setSecondaryChannels(centreId, channels);
}

export const availabilityApi = {
  list: (weekStart: string, staffId?: string) =>
    api.get<Availability[]>("/availability", { weekStart, staffId }),
  create: (values: {
    staffId: string;
    weekStartDate: string;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
  }) => api.post<Availability>("/availability", values),
  update: (id: string, values: { startTime?: string; endTime?: string }) =>
    api.patch<Availability>(`/availability/${id}`, values),
  remove: (id: string) => api.del<{ ok: true }>(`/availability/${id}`),
};

export type ShiftFeedShiftSummary = {
  id: string;
  centreId: string;
  centreName: string | null;
  shiftDate: string;
  startTime: string;
  endTime: string;
  roleNeeded: string;
  addedToStaffpoint: boolean;
  status: ShiftStatus;
  assignedStaffId: string | null;
  assignedLegalName: string | null;
  assignedDisplayName: string | null;
  assignedUseDisplayName: boolean | null;
};

export type ShiftFeedBatchItem = {
  type: "batch";
  batch: {
    id: string;
    centreId: string;
    centreName: string;
    requestCompletedAt: string | null;
    dateRange: string | null;
    displayState: "open" | "ready" | "completed";
  };
  matchingChildren: ShiftFeedShiftSummary[];
  totalChildCount: number;
  activeChildCount: number;
  fulfilledChildCount: number;
  cancelledChildCount: number;
  matchingChildCount: number;
};

export type ShiftFeedShiftItem = {
  type: "shift";
  shift: ShiftFeedShiftSummary;
};

export type ShiftFeedItem = ShiftFeedShiftItem | ShiftFeedBatchItem;

export type ShiftFeedResponse = {
  items: ShiftFeedItem[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
};

export const shiftsApi = {
  list: (q: {
    centreId?: string;
    centreIds?: string[];
    staffId?: string;
    status?: string;
    from?: string;
    to?: string;
  }) => api.get<Shift[]>("/shifts", q),
  feed: (q: {
    centreId?: string;
    centreIds?: string[];
    staffId?: string;
    status?: string;
    from?: string;
    to?: string;
    staffpoint?: "yes" | "no";
    page?: number;
    pageSize?: number;
  }) => api.get<ShiftFeedResponse>("/shifts/feed", q),
  get: (id: string) => api.get<Shift>(`/shifts/${id}`),
  create: (values: Partial<Shift>) => api.post<{ id: string }>("/shifts", values),
  update: (
    id: string,
    values: Partial<Shift> & {
      communications?: ShiftUpdateCommunicationsPayload;
      assignmentResolution?: ShiftAssignmentResolution;
    },
  ) => api.patch<ShiftUpdateResponse>(`/shifts/${id}`, values),
  previewUpdate: (
    id: string,
    values: Partial<Pick<Shift, "shiftDate" | "startTime" | "endTime" | "roleNeeded">>,
  ) => api.post<import("@/lib/shift-assignee-impact").ShiftUpdatePreviewResponse>(
    `/shifts/${id}/preview-update`,
    values,
  ),
  remove: (id: string) => api.del<{ ok: true }>(`/shifts/${id}`),
  assign: (id: string, staffId: string) =>
    api.post<ShiftAssignResponse>(`/shifts/${id}/assign`, { staffId }),
  resendAssignmentConfirmation: (
    id: string,
    recipients: ShiftCommunicationRecipientsPayload,
  ) =>
    api.post<ShiftResendConfirmationsResponse>(`/shifts/${id}/send-assignment-confirmation`, {
      recipients,
    }),
  assignmentConfirmationRecipients: (id: string) =>
    api.get<{
      centre: { available: boolean; reason?: string; unavailableCode?: string };
      carer: { available: boolean; reason?: string };
    }>(`/shifts/${id}/assignment-confirmation-recipients`),
  unassign: (id: string, communications?: ShiftCommunicationRecipientsPayload) =>
    api.post<UnassignShiftResponse>(`/shifts/${id}/unassign`, communications ? { communications } : {}),
  changeStatus: (
    id: string,
    status: ShiftStatus,
    options?: { cancellationReason?: string; communications?: ShiftCommunicationRecipientsPayload },
  ) =>
    api.post<Shift>(`/shifts/${id}/status`, {
      status,
      cancellationReason: options?.cancellationReason,
      communications: options?.communications,
    }),
  availableStaff: (id: string) => api.get<AvailableStaff[]>(`/shifts/${id}/available-staff`),
  markContacted: (id: string, staffId: string) =>
    api.post<{ ok: true }>(`/shifts/${id}/contacted`, { staffId }),
  unmarkContacted: (id: string, staffId: string) =>
    api.del<{ ok: true }>(`/shifts/${id}/contacted/${staffId}`),
  comments: (id: string) => api.get<ShiftComment[]>(`/shifts/${id}/comments`),
  addComment: (id: string, body: string) =>
    api.post<ShiftComment>(`/shifts/${id}/comments`, { body }),
};

export type ShiftBatchChildSummary = {
  id: string;
  shiftDate: string;
  startTime: string;
  endTime: string;
  roleNeeded: string;
  addedToStaffpoint: boolean;
  status: ShiftStatus;
  confirmationNotes: string | null;
  assignedStaffId: string | null;
  assignedLegalName: string | null;
  assignedDisplayName: string | null;
  assignedUseDisplayName: boolean | null;
};

export type ShiftBatchWorkspace = {
  id: string;
  centreId: string;
  centreName: string;
  requestCompletedAt: string | null;
  requestCompletedByUserId: string | null;
  createdByUserId: string | null;
  createdAt: string;
  updatedAt: string;
  shifts: ShiftBatchChildSummary[];
};

export type CreateBatchChildShiftInput = {
  shiftDate: string;
  startTime: string;
  endTime: string;
  roleNeeded?: string;
  addedToStaffpoint?: boolean;
  confirmationNotes?: string;
  internalComment?: string;
};

export const shiftBatchesApi = {
  getWorkspace: (id: string) => api.get<ShiftBatchWorkspace>(`/shift-batches/${id}`),
  createWithShifts: (payload: { centreId: string; shifts: CreateBatchChildShiftInput[] }) =>
    api.post<{ batch: { id: string }; created: { id: string; shiftDate: string }[] }>(
      "/shift-batches/with-shifts",
      payload,
    ),
};

export const dashboardApi = {
  summary: (weekStart: string, weekEnd: string, dayOfWeek: number) =>
    api.get<{
      week: number;
      pending: number;
      filled: number;
      availableToday: Array<{
        id: string;
        legalName: string;
        displayName: string;
        useDisplayName: boolean;
      }>;
    }>("/dashboard/summary", { weekStart, weekEnd, dayOfWeek }),
};

// ---------------------------------------------------------------------------
// Pure helpers (unchanged behaviour; now camelCase-aware)
// ---------------------------------------------------------------------------
export const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export const DAY_FULL = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export function displayStaff(
  s: Pick<Staff, "legalName" | "displayName" | "useDisplayName">,
): string {
  return s.useDisplayName && s.displayName ? s.displayName : s.legalName;
}

export function mondayOf(d: Date): Date {
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const m = new Date(d);
  m.setHours(0, 0, 0, 0);
  m.setDate(m.getDate() + diff);
  return m;
}

export function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function fromDateStr(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function fmtTime(t: string | null | undefined): string {
  if (!t) return "—";
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

export function addDays(d: Date, n: number): Date {
  const nd = new Date(d);
  nd.setDate(nd.getDate() + n);
  return nd;
}

export function dowFromDate(d: Date): number {
  const js = d.getDay();
  return js === 0 ? 6 : js - 1;
}

// Safe href for optional user-provided document links (defense-in-depth, M2).
export function safeDocumentHref(url: string): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
}
