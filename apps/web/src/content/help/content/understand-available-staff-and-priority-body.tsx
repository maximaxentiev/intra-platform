import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { HelpArticleProse } from "@/components/help/HelpArticleProse";
import { HelpCallout } from "@/components/help/HelpCallout";
import { HelpScreenshot } from "@/components/help/HelpScreenshot";

/**
 * Screenshot assets (add when available):
 * - /help/understand-available-staff-and-priority/available-staff.png
 * - /help/understand-available-staff-and-priority/contacted.png
 */
const SCREENSHOTS = {
  availableStaff: undefined as string | undefined,
  contacted: undefined as string | undefined,
} as const;

function HelpArticleLink({ slug, children }: { slug: string; children: ReactNode }) {
  return (
    <Link
      to="/help/$slug"
      params={{ slug }}
      className="font-medium text-primary underline-offset-4 hover:underline"
    >
      {children}
    </Link>
  );
}

export function UnderstandAvailableStaffAndPriorityBody() {
  return (
    <HelpArticleProse>
      <p>
        After a shift is created, the platform builds an <strong>Available staff</strong> list on the
        shift workspace. This reference explains who appears, who does not, how rows are ordered, and
        what <strong>Contacted</strong> means before you assign.
      </p>

      <h2>What Available staff shows</h2>
      <p>
        Open a pending shift to review carers who can be considered for that shift. The{" "}
        <strong>Available staff</strong> section lists eligible carers in priority order. Each row
        shows:
      </p>
      <ul>
        <li>Carer name</li>
        <li>Priority chips (see below)</li>
        <li>
          <strong>Role</strong> — the carer&apos;s staff profile role
        </li>
        <li>
          <strong>Contacted</strong> — checkbox to record that Ops has reached out about this shift
        </li>
        <li>
          <strong>Assign</strong> — enabled only after Contacted is checked
        </li>
      </ul>
      <p>
        If the shift already has an assignee, the list shows other eligible carers with a{" "}
        <strong>Replace</strong> button instead. The currently assigned carer appears separately
        under <strong>Assigned Carer</strong>.
      </p>
      <p>
        For the full assign workflow, see{" "}
        <HelpArticleLink slug="assign-replace-or-unassign-a-carer">
          Assign, Replace or Unassign a Carer
        </HelpArticleLink>
        .
      </p>

      <HelpScreenshot
        src={SCREENSHOTS.availableStaff}
        alt="Available staff list showing priority chips, role, Contacted, and Assign"
        caption="Eligible carers appear in priority order with Contacted and Assign controls."
      />

      <h2>Eligibility comes first</h2>
      <p>
        <strong>Priority only ranks carers who are eligible for the shift.</strong> A carer who fails
        a hard eligibility requirement does not appear lower in the list — they are excluded entirely.
      </p>

      <HelpCallout title="Important" variant="important">
        Top status or a high priority number never overrides a hard eligibility requirement. Banned
        carers never appear, regardless of Top status elsewhere.
      </HelpCallout>

      <p>A carer must pass all of the following to appear:</p>
      <ul>
        <li>Active carer portal account with onboarding complete</li>
        <li>Account not disabled</li>
        <li>Not on the centre&apos;s banned list</li>
        <li>Staff role matches the shift role (see below)</li>
        <li>Availability fully covers the shift time</li>
        <li>No conflicting assigned shift on the same day</li>
        <li>Meets the two-hour buffer rule when applicable</li>
        <li>Required compliance documents current and approved</li>
        <li>Approved RECE Proof for RECE shifts</li>
      </ul>
      <p>
        Failing any one of these removes the carer from consideration. The list does not show
        individual exclusion reasons — use staff profiles and centre settings to investigate gaps.
      </p>

      <h2>Portal and onboarding</h2>
      <p>
        A staff record in Intra does not automatically mean the carer is ready to work. Matching
        requires an active portal account and completed onboarding. Carers without portal access or
        with incomplete onboarding will not appear.
      </p>
      <p>
        See{" "}
        <HelpArticleLink slug="manage-staff-profiles-and-availability">
          Manage Staff Profiles &amp; Availability
        </HelpArticleLink>{" "}
        to review portal status and availability.
      </p>

      <h2>Role and qualifications</h2>
      <p>
        <strong>Staff role</strong> (on the carer profile) is not the same as a{" "}
        <strong>qualification document</strong>. For example, a carer&apos;s role may be ECE while
        RECE Proof is a separate approved document.
      </p>
      <p>Shift role requirements:</p>
      <ul>
        <li>
          <strong>ECA shift</strong> — staff role must be ECA
        </li>
        <li>
          <strong>ECE shift</strong> — staff role must be ECE
        </li>
        <li>
          <strong>RECE shift</strong> — staff role must be ECE <em>and</em> the carer must have
          Ops-approved RECE Proof
        </li>
      </ul>
      <p>
        There is no staff profile role called RECE. RECE shifts rely on ECE staff with approved RECE
        Proof.
      </p>
      <p>
        For document review, see{" "}
        <HelpArticleLink slug="review-and-approve-staff-documents">
          Review &amp; Approve Staff Documents
        </HelpArticleLink>
        .
      </p>

      <h2>Top staff</h2>
      <p>
        Centres can mark carers as <strong>Top staff</strong> on the centre profile — preferred staff
        who are prioritised when matching shifts at that centre. Top is a ranking boost among
        eligible carers only. It does not bypass eligibility rules and does not override a ban.
      </p>
      <p>
        In the list, each row shows a <strong>Top</strong> or <strong>Non-Top</strong> chip. Top
        carers sort above Non-Top carers when both are eligible.
      </p>

      <h2>Banned staff</h2>
      <p>
        Centres can maintain a <strong>Banned staff</strong> list. Banned carers are excluded from
        matching for that centre — they will not appear in Available staff at all. This is a hard
        exclusion.
      </p>

      <HelpCallout title="Important" variant="important">
        Top and Banned are mutually exclusive for the same centre. A carer cannot be both Top and
        Banned at one location.
      </HelpCallout>

      <p>
        Manage these lists on the centre profile. See{" "}
        <HelpArticleLink slug="manage-centres">Manage Centres</HelpArticleLink>.
      </p>

      <h2>Availability and schedule conflicts</h2>
      <p>
        A carer&apos;s availability must <strong>fully cover</strong> the shift — their available
        window must start at or before the shift start and end at or after the shift end. Partial
        overlap is not enough. Availability is an eligibility requirement, not just a ranking factor.
      </p>
      <ul>
        <li>
          <strong>Shift overlap:</strong> if the carer already has another <strong>filled</strong>{" "}
          assigned shift on the same day whose times overlap, they are excluded.
        </li>
        <li>
          <strong>Two-hour buffer:</strong> even without a direct overlap, a carer may be excluded when
          a prior assigned shift on the same day ends too close to this shift&apos;s start. The
          platform requires at least two hours between the end of a prior filled or completed shift
          and the start of the requested shift. Exactly two hours is allowed — for example, a shift
          ending at 13:00 and one starting at 15:00 is fine; starting at 14:00 is not.
        </li>
      </ul>
      <p>
        Review availability on the staff profile or Team Availability. See{" "}
        <HelpArticleLink slug="manage-staff-profiles-and-availability">
          Manage Staff Profiles &amp; Availability
        </HelpArticleLink>
        .
      </p>

      <h2>Documents and onboarding</h2>
      <p>
        Required compliance documents — Vulnerable Sector Check, First Aid/CPR, and Immunizations —
        must be submitted and Ops-approved. Documents that are missing, pending review, issue
        flagged, or expired block eligibility. <strong>Expiring soon</strong> documents remain
        eligible.
      </p>
      <p>
        Qualification documents (ECA diploma, ECE diploma, RECE Proof) do not block ECA or ECE
        shifts by themselves. RECE Proof is required specifically for RECE shifts.
      </p>
      <p>
        See{" "}
        <HelpArticleLink slug="review-and-approve-staff-documents">
          Review &amp; Approve Staff Documents
        </HelpArticleLink>{" "}
        for review workflows and status meanings.
      </p>

      <h2>What affects priority</h2>
      <p>Among eligible carers, the list is ordered by:</p>
      <ol>
        <li>
          <strong>Top</strong> before Non-Top
        </li>
        <li>
          <strong>Geography</strong> — same city, then adjacent city, then second-degree adjacent
          city, then other/unknown city
        </li>
        <li>
          <strong>Qualification preference</strong> — on ECA shifts, approved ECA diploma ranks
          higher; on ECE shifts, approved RECE Proof ranks higher
        </li>
        <li>Legal name (alphabetical tiebreaker)</li>
      </ol>
      <p>
        Each row shows four chips: a <strong>Priority</strong> number, a qualification label,{" "}
        <strong>Top</strong> or <strong>Non-Top</strong>, and a geography label such as{" "}
        <strong>Same city</strong> or <strong>Adjacent city</strong>. A thicker divider between rows
        indicates a change in priority group. Lower priority numbers appear first.
      </p>
      <p>
        On ECE shifts, carers with approved RECE Proof may show a <strong>RECE</strong> qualification
        chip rather than ECE — this reflects qualification preference, not a different staff role.
      </p>

      <h2>Contacted</h2>
      <p>
        <strong>Contacted</strong> means Ops has contacted the carer about this specific shift. It
        is stored per shift and per carer. Checking Contacted does not send an email or confirm
        availability — it records your outreach step in the workflow.
      </p>
      <p>
        <strong>Assign</strong> (or <strong>Replace</strong>) is disabled until Contacted is checked.
        Unchecking Contacted disables Assign again. The platform also enforces this on the server if
        you attempt to assign without Contacted.
      </p>
      <p>
        Contacted does not mean the carer is available, assigned, confirmed, or Top — only that Ops
        has reached out about this shift.
      </p>

      <HelpScreenshot
        src={SCREENSHOTS.contacted}
        alt="Contacted checkbox checked with Assign button enabled"
        caption="Mark Contacted after reaching the carer, then Assign when ready."
      />

      <h2>When no eligible staff appear</h2>
      <p>
        If the list is empty, the message <strong>No eligible staff found for this shift.</strong>{" "}
        means no carer currently passes all eligibility rules. Common causes include role mismatch,
        availability gaps, document issues, centre bans, schedule conflicts, or the two-hour buffer.
      </p>
      <p>
        There is no override from this list — resolve eligibility through staff profiles, documents,
        availability, or centre settings. Schedule-edit availability overrides are covered in{" "}
        <HelpArticleLink slug="edit-or-cancel-a-shift">Edit or Cancel a Shift</HelpArticleLink>.
      </p>

      <h2>Staffpoint</h2>
      <p>
        Staffpoint is a per-shift flag for external marketplace posting. It is separate from
        Intra&apos;s Available staff priority list and does not change who appears or how they are
        ranked.
      </p>

      <h2>How to use the list</h2>
      <ol>
        <li>Review the highest-priority eligible carers at the top.</li>
        <li>Read the priority chips to understand why each carer ranks where they do.</li>
        <li>Contact the carer using your normal Ops process (outside the platform).</li>
        <li>Check <strong>Contacted</strong> for that carer on this shift.</li>
        <li>
          Select <strong>Assign</strong> when appropriate — see{" "}
          <HelpArticleLink slug="assign-replace-or-unassign-a-carer">
            Assign, Replace or Unassign a Carer
          </HelpArticleLink>
          .
        </li>
      </ol>
    </HelpArticleProse>
  );
}
