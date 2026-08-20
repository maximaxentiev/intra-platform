import { describe, expect, it } from "vitest";
import {
  buildDocumentComplianceFilterChips,
  clearAdvancedDocumentComplianceFilters,
  documentComplianceFiltersToApiQuery,
  documentComplianceFiltersToSearchParams,
  EMPTY_DOCUMENT_COMPLIANCE_FILTERS,
  isAdvancedDocumentComplianceFilterActive,
  parseDocumentComplianceFiltersFromSearch,
  validateDocumentComplianceDateRanges,
} from "./report-document-filters";

describe("report-document-filters", () => {
  it("parses legacy status and documentType into per-document state", () => {
    const parsed = parseDocumentComplianceFiltersFromSearch({
      status: "expired",
      documentType: "vulnerable_sector_check",
    });
    expect(parsed.vscStatuses).toEqual(["expired"]);
    expect(parsed.documentType).toBe("vulnerable_sector_check");
    expect(parsed.legacyStatus).toBe("");
  });

  it("preserves legacy any-document status when documentType is absent", () => {
    const parsed = parseDocumentComplianceFiltersFromSearch({
      status: "pending_review",
    });
    expect(parsed.legacyStatus).toBe("pending_review");
  });

  it("encodes multi-value OR groups as comma-separated params", () => {
    const params = documentComplianceFiltersToSearchParams({
      ...EMPTY_DOCUMENT_COMPLIANCE_FILTERS,
      vscStatuses: ["expired", "expiring_soon"],
      roles: ["ECE"],
      overallCompliance: ["needs_attention"],
    });
    expect(params.vscStatuses).toBe("expired,expiring_soon");
    expect(params.roles).toBe("ECE");
    expect(params.overallCompliance).toBe("needs_attention");
  });

  it("maps web state to API query with cross-group AND semantics", () => {
    const api = documentComplianceFiltersToApiQuery({
      ...EMPTY_DOCUMENT_COMPLIANCE_FILTERS,
      overallCompliance: ["needs_attention"],
      roles: ["ECE"],
      vscStatuses: ["expired"],
      firstAidExpiryFrom: "2026-08-01",
      firstAidExpiryTo: "2026-09-30",
      upcomingReminder: "has",
    });
    expect(api.overallCompliance).toEqual(["needs_attention"]);
    expect(api.roles).toEqual(["ECE"]);
    expect(api.vscStatuses).toEqual(["expired"]);
    expect(api.firstAidExpiryFrom).toBe("2026-08-01");
    expect(api.firstAidExpiryTo).toBe("2026-09-30");
    expect(api.upcomingReminder).toBe("has");
  });

  it("maps all advanced filter groups to API query", () => {
    const api = documentComplianceFiltersToApiQuery({
      ...EMPTY_DOCUMENT_COMPLIANCE_FILTERS,
      overallCompliance: ["compliant", "expiring_soon"],
      documentType: "first_aid_cpr",
      roles: ["ECA", "Nanny"],
      staffStatuses: ["active"],
      vscStatuses: ["expired", "expiring_soon"],
      firstAidStatuses: ["approved"],
      immunizationsStatuses: ["issue_flagged"],
      covidStatuses: ["not_submitted"],
      vscRenewalDueFrom: "2026-08-01",
      vscRenewalDueTo: "2026-12-31",
      firstAidExpiryFrom: "2026-09-01",
      firstAidExpiryTo: "2026-09-30",
      vscReminderStatuses: ["failed"],
      firstAidReminderStatuses: ["sent"],
      upcomingReminder: "none",
    });
    expect(api.overallCompliance).toEqual(["compliant", "expiring_soon"]);
    expect(api.documentType).toBe("first_aid_cpr");
    expect(api.roles).toEqual(["ECA", "Nanny"]);
    expect(api.staffStatuses).toEqual(["active"]);
    expect(api.vscStatuses).toEqual(["expired", "expiring_soon"]);
    expect(api.firstAidStatuses).toEqual(["approved"]);
    expect(api.immunizationsStatuses).toEqual(["issue_flagged"]);
    expect(api.covidStatuses).toEqual(["not_submitted"]);
    expect(api.vscRenewalDueFrom).toBe("2026-08-01");
    expect(api.vscRenewalDueTo).toBe("2026-12-31");
    expect(api.firstAidExpiryFrom).toBe("2026-09-01");
    expect(api.firstAidExpiryTo).toBe("2026-09-30");
    expect(api.vscReminderStatuses).toEqual(["failed"]);
    expect(api.firstAidReminderStatuses).toEqual(["sent"]);
    expect(api.upcomingReminder).toBe("none");
  });

  it("builds active filter chips including date and reminder labels", () => {
    const chips = buildDocumentComplianceFilterChips({
      ...EMPTY_DOCUMENT_COMPLIANCE_FILTERS,
      overallCompliance: ["needs_attention"],
      roles: ["ECE"],
      vscStatuses: ["expired"],
      vscRenewalDueFrom: "2026-08-01",
      firstAidReminderStatuses: ["failed"],
      upcomingReminder: "none",
    });
    expect(chips.some((chip) => chip.label.startsWith("Overall:"))).toBe(true);
    expect(chips.some((chip) => chip.label.startsWith("Role:"))).toBe(true);
    expect(chips.some((chip) => chip.label.startsWith("VSC:"))).toBe(true);
    expect(chips.some((chip) => chip.label.includes("VSC Renewal Due ≥"))).toBe(true);
    expect(chips.some((chip) => chip.label.startsWith("First Aid Reminder:"))).toBe(true);
    expect(chips.some((chip) => chip.label.startsWith("Upcoming Reminder:"))).toBe(true);
  });

  it("supports individual chip removal", () => {
    const filters = {
      ...EMPTY_DOCUMENT_COMPLIANCE_FILTERS,
      overallCompliance: ["needs_attention", "compliant"] as const,
      roles: ["ECE", "Nanny"],
      vscStatuses: ["expired", "expiring_soon"] as const,
    };
    const chips = buildDocumentComplianceFilterChips(filters);
    const roleChip = chips.find((chip) => chip.id === "role-ECE");
    expect(roleChip).toBeDefined();
    const afterRole = roleChip!.clear(filters);
    expect(afterRole.roles).toEqual(["Nanny"]);
    expect(afterRole.overallCompliance).toEqual(["needs_attention", "compliant"]);

    const vscChip = chips.find((chip) => chip.id === "vsc-statuses");
    expect(vscChip!.clear(filters).vscStatuses).toEqual([]);
  });

  it("clears advanced filters while preserving primary filters", () => {
    const cleared = clearAdvancedDocumentComplianceFilters({
      ...EMPTY_DOCUMENT_COMPLIANCE_FILTERS,
      overallCompliance: ["compliant"],
      documentType: "first_aid_cpr",
      roles: ["ECA"],
      vscStatuses: ["expired"],
    });
    expect(cleared.overallCompliance).toEqual(["compliant"]);
    expect(cleared.documentType).toBe("first_aid_cpr");
    expect(cleared.roles).toEqual([]);
    expect(cleared.vscStatuses).toEqual([]);
  });

  it("detects advanced filter activity", () => {
    expect(isAdvancedDocumentComplianceFilterActive(EMPTY_DOCUMENT_COMPLIANCE_FILTERS)).toBe(false);
    expect(
      isAdvancedDocumentComplianceFilterActive({
        ...EMPTY_DOCUMENT_COMPLIANCE_FILTERS,
        roles: ["ECE"],
      }),
    ).toBe(true);
    expect(
      isAdvancedDocumentComplianceFilterActive({
        ...EMPTY_DOCUMENT_COMPLIANCE_FILTERS,
        legacyStatus: "expired",
      }),
    ).toBe(true);
  });

  it("rejects invalid date ranges without swapping values", () => {
    expect(
      validateDocumentComplianceDateRanges({
        ...EMPTY_DOCUMENT_COMPLIANCE_FILTERS,
        vscRenewalDueFrom: "2026-09-01",
        vscRenewalDueTo: "2026-08-01",
      }),
    ).toContain("VSC Renewal Due From must not be after To");
    expect(
      validateDocumentComplianceDateRanges({
        ...EMPTY_DOCUMENT_COMPLIANCE_FILTERS,
        firstAidExpiryFrom: "2026-10-01",
        firstAidExpiryTo: "2026-09-01",
      }),
    ).toContain("First Aid Expiry From must not be after To");
  });

  it("round-trips parsed search through search params", () => {
    const parsed = parseDocumentComplianceFiltersFromSearch({
      overallCompliance: "needs_attention,expiring_soon",
      vscStatuses: "expired,expiring_soon",
      roles: "ECE,Nanny",
      staffStatuses: "active",
      immunizationsStatuses: "approved,issue_flagged",
      covidStatuses: "not_submitted",
      vscRenewalDueFrom: "2026-08-01",
      firstAidExpiryTo: "2026-09-30",
      vscReminderStatuses: "failed",
      upcomingReminder: "has",
    });
    const encoded = documentComplianceFiltersToSearchParams(parsed);
    expect(encoded.overallCompliance).toBe("needs_attention,expiring_soon");
    expect(encoded.vscStatuses).toBe("expired,expiring_soon");
    expect(encoded.roles).toBe("ECE,Nanny");
    expect(encoded.staffStatuses).toBe("active");
    expect(encoded.immunizationsStatuses).toBe("approved,issue_flagged");
    expect(encoded.covidStatuses).toBe("not_submitted");
    expect(encoded.vscRenewalDueFrom).toBe("2026-08-01");
    expect(encoded.firstAidExpiryTo).toBe("2026-09-30");
    expect(encoded.vscReminderStatuses).toBe("failed");
    expect(encoded.upcomingReminder).toBe("has");
  });

  it("uses optional COVID label for not_submitted in chips", () => {
    const chips = buildDocumentComplianceFilterChips({
      ...EMPTY_DOCUMENT_COMPLIANCE_FILTERS,
      covidStatuses: ["not_submitted"],
    });
    expect(chips[0].label).toContain("Optional — Not Submitted");
  });
});
