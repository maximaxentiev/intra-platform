// Frontend action boundary for the applicant workflow.
//
// TODO(cursor): replace `defaultApplicationActionHandler` with the real API
// mutation once the backend status endpoints exist, e.g.
//   api.post(`/applications/${id}/interview` | `/reject` | `/hire`)
// The UI only depends on the `ApplicationActionHandler` contract below, so no
// component changes are needed when the real endpoint is wired.
import type { ApplicationStatus } from "@/lib/applications";

export type ApplicationAction = "interview" | "reject" | "hire";

export const ACTION_RESULT_STATUS: Record<ApplicationAction, ApplicationStatus> = {
  interview: "contacted",
  reject: "rejected",
  hire: "hired",
};

export interface ApplicationActionInput {
  id: string;
  action: ApplicationAction;
}

export type ApplicationActionHandler = (
  input: ApplicationActionInput,
) => Promise<{ id: string; status: ApplicationStatus }>;

/**
 * Frontend-only placeholder: resolves with the resulting status so the table
 * and drawer can reflect the change. It performs NO persistence.
 */
export const defaultApplicationActionHandler: ApplicationActionHandler = async ({ id, action }) => {
  await new Promise((r) => setTimeout(r, 350));
  return { id, status: ACTION_RESULT_STATUS[action] };
};

/** Which actions are offered for a given status (terminal states offer none). */
export function availableActions(status: ApplicationStatus): {
  interview: "available" | "done" | "hidden";
  reject: "available" | "hidden";
  hire: "available" | "hidden";
} {
  switch (status) {
    case "new":
      return { interview: "available", reject: "available", hire: "available" };
    case "contacted":
      return { interview: "done", reject: "available", hire: "available" };
    default:
      return { interview: "hidden", reject: "hidden", hire: "hidden" };
  }
}

export const ACTION_COPY: Record<
  ApplicationAction,
  { title: (name: string) => string; body: (name: string) => string; confirm: string }
> = {
  interview: {
    title: (n) => `Invite ${n} to Interview?`,
    body: (n) => `Are you sure you want to invite ${n} to an interview?`,
    confirm: "Yes, Interview",
  },
  reject: {
    title: (n) => `Reject ${n}?`,
    body: (n) =>
      `Are you sure you want to reject ${n}? This action will eventually send the applicant a rejection email once the backend automation is connected.`,
    confirm: "Yes, Reject",
  },
  hire: {
    title: (n) => `Hire ${n}?`,
    body: (n) =>
      `Are you sure you want to hire ${n}? This action will eventually create their Staff profile and transfer the appropriate application information once the backend workflow is connected.`,
    confirm: "Yes, Hire",
  },
};
