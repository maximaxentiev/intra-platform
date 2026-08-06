export type PortalAccountDisplayStatus =
  | "no_account"
  | "invited"
  | "incomplete"
  | "active"
  | "disabled";

export const PORTAL_ACCOUNT_STATUS_LABELS: Record<PortalAccountDisplayStatus, string> = {
  no_account: "No Account",
  invited: "Invited",
  incomplete: "Incomplete",
  active: "Active",
  disabled: "Disabled",
};

export function portalStatusBadgeVariant(
  status: PortalAccountDisplayStatus,
): "default" | "secondary" | "outline" | "destructive" {
  switch (status) {
    case "active":
      return "default";
    case "invited":
    case "incomplete":
      return "secondary";
    case "disabled":
      return "destructive";
    default:
      return "outline";
  }
}
