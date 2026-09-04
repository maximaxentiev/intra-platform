import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  serializeCentreEmailBodySegments,
  splitCentreEmailBodySegments,
} from "@/components/shifts/CentreEmailBodyEditor";
import { CentreEmailReviewDialog } from "@/components/shifts/CentreEmailReviewDialog";
import { useCentreEmailReview } from "@/lib/use-centre-email-review";
import { previewBatchCentreEmail, previewShiftAssignmentCentreEmail } from "@/lib/centre-email-review";

const STAFF_ID = "11111111-1111-4111-8111-111111111111";

describe("centre email review web wiring", () => {
  it("exports shared review dialog, body editor helpers, and hook", () => {
    expect(CentreEmailReviewDialog).toBeTypeOf("function");
    expect(useCentreEmailReview).toBeTypeOf("function");
  });

  it("defines preview API helpers", () => {
    expect(previewShiftAssignmentCentreEmail).toBeTypeOf("function");
    expect(previewBatchCentreEmail).toBeTypeOf("function");
  });

  it("does not debounce preview reload on every body keystroke", () => {
    const hookSource = readFileSync(join(process.cwd(), "src/lib/use-centre-email-review.ts"), "utf8");
    expect(hookSource).not.toContain("debounceRef");
    expect(hookSource).toContain("centreEmailPayload: { subject: subject.trim(), body }");
  });

  it("uses full email body editor instead of a Message-only field", () => {
    const dialogSource = readFileSync(
      join(process.cwd(), "src/components/shifts/CentreEmailReviewDialog.tsx"),
      "utf8",
    );
    expect(dialogSource).toContain("CentreEmailBodyEditor");
    expect(readFileSync(join(process.cwd(), "src/components/shifts/CentreEmailBodyEditor.tsx"), "utf8")).toContain(
      "Email body",
    );
    expect(dialogSource).not.toContain('Label htmlFor={messageId}>Message</Label>');
    expect(dialogSource).toContain("Changes made here affect this email only");
  });

  it("routes Back/Cancel through onBack without submitting", () => {
    const dialogSource = readFileSync(
      join(process.cwd(), "src/components/shifts/CentreEmailReviewDialog.tsx"),
      "utf8",
    );
    expect(dialogSource).toContain("onBack ? onBack() : onOpenChange(false)");
    expect(dialogSource).toContain("{onBack ? \"Back\" : \"Cancel\"}");
  });
});

describe("CentreEmailBodyEditor segment serialization", () => {
  it("preserves secure document markers when editing surrounding text", () => {
    const segments = splitCentreEmailBodySegments(
      `Hello Centre\n\nDocuments:\n[[INTRA_SECURE_DOC:${STAFF_ID}]]`,
    );
    const edited = segments.map((segment) =>
      segment.type === "text" ? { ...segment, content: "Updated greeting\n\nDocuments:\n" } : segment,
    );
    const body = serializeCentreEmailBodySegments(edited);
    expect(body).toContain("Updated greeting");
    expect(body).toContain(`[[INTRA_SECURE_DOC:${STAFF_ID}]]`);
  });
});
