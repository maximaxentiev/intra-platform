import { describe, expect, it } from "vitest";
import {
  documentContentCacheKey,
  documentContentPath,
} from "@/lib/application-document-content";

describe("application document content helpers", () => {
  it("builds stable cache keys and API paths", () => {
    const doc = {
      applicationId: "11111111-1111-4111-8111-111111111111",
      id: "22222222-2222-4222-8222-222222222222",
    };
    expect(documentContentCacheKey(doc)).toBe(`${doc.applicationId}:${doc.id}`);
    expect(documentContentPath(doc)).toBe(
      `/applications/${doc.applicationId}/documents/${doc.id}/content`,
    );
  });
});
