import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { HelpArticleProse } from "@/components/help/HelpArticleProse";
import { HelpBeforeYouContinueCallout } from "@/components/help/HelpBeforeYouContinueCallout";
import { HelpCallout } from "@/components/help/HelpCallout";
import { HelpScreenshot } from "@/components/help/HelpScreenshot";

/**
 * Screenshot assets (add when available):
 * - /help/manage-staff-profiles-and-availability/staff-profile.png
 * - /help/manage-staff-profiles-and-availability/availability.png
 */
const SCREENSHOTS = {
  staffProfile: undefined as string | undefined,
  availability: undefined as string | undefined,
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

export function ManageStaffProfilesAndAvailabilityBody() {
  return (
    <HelpArticleProse>
      <p>
        Staff profiles hold the information Ops uses to match and assign carers. This guide covers
        finding carers, maintaining profiles, managing portal access, and working with availability.
      </p>

      <h2>Find a Carer</h2>
      <ol>
        <li>Open <strong>Staff</strong> from the sidebar.</li>
        <li>
          Use live filters — results update immediately:
          <ul>
            <li>
              <strong>Search</strong> — filter by name
            </li>
            <li>
              <strong>Role</strong> — filter by assigned role
            </li>
            <li>
              <strong>Document status</strong> — filter by document compliance state (for example
              Pending Review or Approved)
            </li>
            <li>
              <strong>Portal account</strong> — filter by portal status (No Account, Invited,
              Incomplete, Active, or Disabled)
            </li>
          </ul>
        </li>
        <li>Select a staff member from the list to open their profile.</li>
      </ol>
      <p>
        Active filter chips appear below the filters. Use <strong>Clear filters</strong> to reset
        the directory view.
      </p>

      <h2>Understand the Staff profile</h2>
      <p>
        Each staff profile has five tabs. The summary panel at the top shows portal status,
        onboarding progress, and document status at a glance.
      </p>
      <ul>
        <li>
          <strong>Profile</strong> — contact details, role, location, and internal notes
        </li>
        <li>
          <strong>Documents</strong> — document submissions and compliance (see linked guide below)
        </li>
        <li>
          <strong>Availability</strong> — weekly availability windows for this carer
        </li>
        <li>
          <strong>Centre preferences</strong> — centres where this carer is Top or Banned
        </li>
        <li>
          <strong>Shifts</strong> — shifts assigned to this carer
        </li>
      </ul>

      <HelpScreenshot
        src={SCREENSHOTS.staffProfile}
        alt="Staff profile showing tabs, summary panel, and profile details"
        caption="The profile summary shows portal, onboarding, and document status alongside the main tabs."
      />

      <h2>Create Staff manually</h2>
      <ol>
        <li>
          From <strong>Staff</strong>, select <strong>Add staff</strong>.
        </li>
        <li>
          Complete the form:
          <ul>
            <li>
              <strong>Display name</strong> — shown across shifts and centre lists
            </li>
            <li>
              <strong>Legal first name</strong> and <strong>Legal last name</strong>
            </li>
            <li>
              <strong>Role</strong> — ECA, ECE, or Nanny
            </li>
            <li>
              <strong>Email address</strong> — used for their portal invitation
            </li>
            <li>
              <strong>Phone number</strong>
            </li>
            <li>
              <strong>Home address</strong> and <strong>City</strong>
            </li>
          </ul>
        </li>
        <li>
          Select <strong>Create staff member</strong>. You are taken to the new profile.
        </li>
      </ol>
      <p>
        Creating a staff record does not send a portal invitation. Send the invitation from the
        profile when you are ready (see below). Bulk Staff import is an administrative workflow
        and is not covered in this guide.
      </p>

      <h2>Edit profile information</h2>
      <p>
        On the <strong>Profile</strong> tab, select <strong>Edit</strong> to update the record.
      </p>
      <ul>
        <li>
          <strong>Legal full name</strong>
        </li>
        <li>
          Optional <strong>display name</strong> — check the box to use a different display name
        </li>
        <li>
          <strong>Phone</strong> and <strong>Email</strong>
        </li>
        <li>
          <strong>Role</strong>
        </li>
        <li>
          <strong>Home address</strong>, <strong>City</strong>, and <strong>Notes</strong>
        </li>
      </ul>
      <p>
        Select <strong>Save staff</strong> to apply changes, or <strong>Cancel</strong> to discard.
      </p>

      <h2>Role changes</h2>
      <p>
        A carer&apos;s role affects which shifts they can be considered for. If you change a
        role, check that upcoming assignments still make sense. For how role and priority affect
        matching, see{" "}
        <HelpArticleLink slug="understand-available-staff-and-priority">
          Understand Available Staff &amp; Priority
        </HelpArticleLink>
        .
      </p>

      <h2>Manage Carer portal access</h2>
      <p>
        A staff record can exist without a portal account. Portal access is separate — it lets the
        carer sign in to submit documents, set availability, and view assigned shifts.
      </p>
      <p>
        The <strong>Portal account</strong> section on the Profile tab shows the current status and
        available actions:
      </p>
      <ul>
        <li>
          <strong>No Account</strong> — no portal account yet; use <strong>Send invitation</strong>
        </li>
        <li>
          <strong>Invited</strong> — invitation sent; use <strong>Resend invitation</strong> if
          needed
        </li>
        <li>
          <strong>Incomplete</strong> — carer started onboarding but has not finished
        </li>
        <li>
          <strong>Active</strong> — carer can sign in; invitation can be resent if needed
        </li>
        <li>
          <strong>Disabled</strong> — access blocked; use <strong>Re-enable access</strong> to
          restore sign-in
        </li>
      </ul>
      <p>When a portal account exists, the section may also show invitation dates, last login, and onboarding progress.</p>

      <HelpCallout title="Important" variant="important">
        Portal invitations and account-access actions may send an email to the carer. Confirm the
        email address on the Profile tab before sending an invitation or resending a link.
      </HelpCallout>

      <h3>Onboarding status</h3>
      <p>
        The summary panel and Portal account section show onboarding progress — for example{" "}
        <strong>Not started</strong>, <strong>Step 2 of 3</strong>, or <strong>Complete</strong>.
        A carer who has not finished onboarding cannot receive shifts through Intra matching and
        assignment. Use onboarding status as a signal to follow up.
      </p>
      <p>
        After a portal invitation exists, the platform sends automated reminder emails on day{" "}
        <strong>1</strong>, <strong>3</strong>, <strong>7</strong>, <strong>14</strong>, and{" "}
        <strong>30</strong> while onboarding remains incomplete. Reminders stop when onboarding is
        completed. Disabling portal access prevents future reminders.
      </p>
      <p>
        To block sign-in without deleting the staff record, use <strong>Disable access</strong>.
        The carer cannot sign in until access is re-enabled.
      </p>

      <h3>Rolling availability during onboarding Step 3</h3>
      <p>
        If a carer returns to onboarding Step 3 several days after starting, availability always
        begins from the current day. They see the next <strong>14 days</strong> — past onboarding
        dates drop away automatically, while previously saved future availability is preserved.
        This helps Ops understand what the carer sees without needing full Carer Portal
        documentation.
      </p>

      <h2>Review and update a Carer&apos;s availability</h2>
      <p>
        Open the staff profile and select the <strong>Availability</strong> tab. Availability is
        managed week by week.
      </p>
      <ol>
        <li>
          Use the week controls to move between weeks, or select <strong>Jump to date</strong> to
          open a specific week.
        </li>
        <li>
          Each day column shows existing time windows. Select <strong>Add time</strong> on a day
          to add a window (defaults to 9:00–17:00).
        </li>
        <li>
          Edit <strong>Start</strong> or <strong>End</strong> times; changes save when you leave
          the field.
        </li>
        <li>
          Select <strong>Remove</strong> on a window to delete it.
        </li>
      </ol>
      <p>Past days and past time windows appear muted. They remain visible for reference but are clearly marked as past.</p>

      <HelpScreenshot
        src={SCREENSHOTS.availability}
        alt="Weekly availability editor showing day columns and time windows"
        caption="Availability is edited per week, with one or more time windows per day."
      />

      <HelpCallout title="Important" variant="important">
        A carer&apos;s availability affects whether they appear as available for a shift. It does
        not override other eligibility rules such as documents, bans, or role requirements. See{" "}
        <HelpArticleLink slug="understand-available-staff-and-priority">
          Understand Available Staff &amp; Priority
        </HelpArticleLink>{" "}
        for matching details.
      </HelpCallout>

      <h2>Use Team Availability</h2>
      <p>
        Open <strong>Availability</strong> from the sidebar to see availability across the whole
        team for a selected week. This is useful when you need a quick view of who is available on
        particular days or times before assigning work.
      </p>
      <ol>
        <li>
          Navigate weeks with the previous/next controls, or select <strong>This week</strong>.
        </li>
        <li>
          Optional filters: <strong>Filter by day</strong>, a specific date, or{" "}
          <strong>Available during time</strong> (from/to).
        </li>
        <li>
          Review each staff member&apos;s availability chips. Select <strong>View more</strong> to
          expand a long list, or their name to open the staff profile.
        </li>
      </ol>

      <h2>View Centre preferences</h2>
      <p>
        On the <strong>Centre preferences</strong> tab, you can see and manage which centres prefer
        or exclude this carer:
      </p>
      <ul>
        <li>
          <strong>Top centres</strong> — preferred placements; prioritised when matching this carer
          to shifts
        </li>
        <li>
          <strong>Banned centres</strong> — hard exclusion; this carer will not be matched to
          shifts at these centres
        </li>
      </ul>
      <p>
        Use <strong>Add centre</strong> to add a centre to either list, or the <strong>X</strong>{" "}
        beside a centre to remove it. A carer cannot be Top at a centre and Banned at the same
        centre — the lists are mutually exclusive.
      </p>
      <p>
        These preferences mirror the Top staff and Banned staff lists on each centre&apos;s profile.
        See{" "}
        <HelpArticleLink slug="manage-centres">Manage Centres</HelpArticleLink> and{" "}
        <HelpArticleLink slug="understand-available-staff-and-priority">
          Understand Available Staff &amp; Priority
        </HelpArticleLink>
        .
      </p>

      <h2>View a Carer&apos;s Shifts</h2>
      <p>
        The <strong>Shifts</strong> tab lists shifts assigned to this carer — date, centre, time,
        role, and status. Select a row to open the full shift details. Completed and cancelled
        shifts appear slightly muted.
      </p>
      <p>
        To create or assign shifts, see{" "}
        <HelpArticleLink slug="create-an-individual-shift">Create an Individual Shift</HelpArticleLink>.
      </p>

      <h2>Documents tab</h2>
      <p>
        The <strong>Documents</strong> tab shows submission and compliance status for this carer.
        Use it to see whether documents need attention, but follow the dedicated guide for review
        and approval steps:
      </p>
      <p>
        <HelpArticleLink slug="review-and-approve-staff-documents">
          Review &amp; Approve Staff Documents
        </HelpArticleLink>
      </p>

      <h2>Rare administrative actions</h2>
      <h3>Delete Staff</h3>
      <p>
        Deleting a staff member is permanent and uncommon. Normal corrections should use profile
        edit or portal access controls instead.
      </p>
      <ol>
        <li>
          Open the staff profile and select the <strong>More staff actions</strong> menu (⋯).
        </li>
        <li>Select <strong>Delete staff</strong>.</li>
        <li>Read the confirmation dialog and select <strong>Delete staff</strong> to proceed.</li>
      </ol>
      <p>
        Deletion permanently removes the profile, availability, and centre preferences. Assigned
        shifts remain but lose this assignment. Deletion is only available before a carer portal
        account or invitation history exists — if they have portal access, disable it first and
        contact an administrator if removal is still required.
      </p>

      <HelpBeforeYouContinueCallout title="Before you continue">
        Deleting a staff member cannot be undone from the platform. Prefer disabling portal access
        or updating the profile for day-to-day corrections.
      </HelpBeforeYouContinueCallout>
    </HelpArticleProse>
  );
}
