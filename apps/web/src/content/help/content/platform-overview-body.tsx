import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { HelpArticleProse } from "@/components/help/HelpArticleProse";
import { HelpCallout } from "@/components/help/HelpCallout";
import { HelpScreenshot } from "@/components/help/HelpScreenshot";

/**
 * Screenshot assets (add when available):
 * - /help/platform-overview/dashboard.png — full app shell with sidebar
 */
const SCREENSHOTS = {
  dashboard: undefined as string | undefined,
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

export function PlatformOverviewBody() {
  return (
    <HelpArticleProse>
      <p>
        This guide orients you to the Intra Ops Platform. Use it to understand what each main area
        is for and where to go when you need to perform common Operations work.
      </p>

      <h2>What the platform is for</h2>
      <p>
        The Intra Ops Platform is the central place for day-to-day staffing operations. From here
        you manage centres and carers, review availability and documents, fill individual shifts
        and batch requests, and access operational reporting. It brings the information and
        actions you need into one workspace so you can move work forward without switching between
        separate tools.
      </p>

      <HelpScreenshot
        src={SCREENSHOTS.dashboard}
        alt="Intra Ops Platform showing the sidebar navigation and Dashboard"
        caption="The sidebar lists every main area. Your current page is highlighted."
      />

      <h2>Main navigation</h2>
      <p>
        The sidebar on the left is your primary navigation. Each destination below covers a
        distinct part of Operations work.
      </p>

      <h3>Dashboard</h3>
      <p>
        Your starting point for the day. The Dashboard gives an operational overview: shifts
        happening today, work coming up in the next week, items that need attention, workforce
        readiness signals, and recent activity. Use it to spot what needs action and jump into
        Shifts, Staff, or Reports from there. Quick actions and shortcuts on the Dashboard can
        take you directly to common tasks such as creating a shift or reviewing documents.
      </p>

      <h3>Shifts</h3>
      <p>
        The main area for staffing work. Shifts covers individual shift requests—single dates
        that need a carer assigned—as well as batch requests, where a centre submits multiple
        shifts at once. You will see shifts grouped by status (such as pending and filled) and
        can open any item for matching, assignment, and follow-up. Most daily scheduling work
        happens here.
      </p>

      <h3>Centres</h3>
      <p>
        Centre profiles hold the details you need when coordinating with a location: contacts,
        notes, and centre-specific rules. You can maintain Top Carers and Banned Carers for each
        centre, and review that centre&apos;s shift history. Accurate centre records help matching
        and communications run smoothly.
      </p>

      <h3>Staff</h3>
      <p>
        Carer profiles include role, contact details, location, documents, weekly availability,
        centre preferences, and shift history. From Staff you can see portal and account state,
        invite carers to the portal, and open a profile when you need to check eligibility or
        follow up on missing information. See{" "}
        <HelpArticleLink slug="manage-staff-profiles-and-availability">
          Manage Staff Profiles &amp; Availability
        </HelpArticleLink>{" "}
        for detailed guidance.
      </p>

      <h3>Availability</h3>
      <p>
        A team-wide view of carer availability. Select days and times to see who is available
        across the pool—useful when you are planning coverage or checking options before
        assigning a shift.
      </p>

      <h3>Reports</h3>
      <p>
        Operational reporting for oversight and follow-up. Reports includes Centre &amp; Shift
        Performance, Staff Usage, Document Compliance, and the Activity Log. Use these areas to
        review trends, check document status at scale, and see a record of key actions. You do
        not need to understand every metric to get value—open the report that matches your
        question and filter from there.
      </p>

      <h3>Applications</h3>
      <p>
        Incoming candidate applications from Intra&apos;s recruitment flow. Applications are
        organised by role tabs. Open an application to review details and move candidates through
        your review workflow.
      </p>

      <h3>Users</h3>
      <p>
        Ops user administration—invite and manage people who can sign in to this platform. Most
        day-to-day Operations work does not require this area; administrators use it when
        onboarding or offboarding Ops team members.
      </p>

      <h3>Help</h3>
      <p>
        Searchable step-by-step instructions for common Operations tasks. When you are unsure how
        to perform an action—assign a carer, complete a batch, approve a document—return here
        and search by keyword or browse by category.
      </p>

      <h2>Your account</h2>
      <p>
        At the bottom of the sidebar, your profile link opens account settings. From there you
        can update your profile and change your password where available. Use Sign out when you
        finish your session on a shared device.
      </p>

      <h2>Before you start</h2>
      <p>
        Three concepts are worth keeping in mind before you begin working in the platform.
      </p>

      <h3>1. Actions may send communications</h3>
      <p>
        Assignments, replacements, cancellations, batch completion, and batch updates can trigger
        emails to carers and/or centres. When a confirmation dialog appears, review the recipients
        and message summary before you proceed. For terminology and communication behaviour, see{" "}
        <HelpArticleLink slug="communications-notes-and-important-terminology">
          Communications, Notes &amp; Important Terminology
        </HelpArticleLink>
        .
      </p>

      <h3>2. Some actions are destructive or consequential</h3>
      <p>
        Operations such as banning a carer from a centre, approving or flagging documents,
        cancelling shifts or batches, deleting records, or completing a batch can have lasting
        effects. Read confirmation dialogs carefully and make sure the action matches your intent.
      </p>

      <HelpCallout title="Important" variant="important">
        If a dialog asks you to confirm recipients, a reason, or a cancellation message, treat
        that as your last check before the platform sends notifications or applies the change.
      </HelpCallout>

      <h3>3. Activity is recorded</h3>
      <p>
        Key operational actions are recorded in Activity Logs and in shift or batch history where
        available. This helps your team trace what happened, when, and by whom—useful for
        handovers and follow-up questions.
      </p>

      <h2>Where to go next</h2>
      <p>
        This overview deliberately stays high level. For step-by-step instructions, open the
        related guides below or search Help from the landing page.
      </p>
      <ul>
        <li>
          <HelpArticleLink slug="manage-centres">Manage Centres</HelpArticleLink> — centre
          profiles, contacts, and centre rules
        </li>
        <li>
          <HelpArticleLink slug="manage-staff-profiles-and-availability">
            Manage Staff Profiles &amp; Availability
          </HelpArticleLink>{" "}
          — carer records and availability
        </li>
        <li>
          <HelpArticleLink slug="create-an-individual-shift">
            Create an Individual Shift
          </HelpArticleLink>{" "}
          — single-shift requests
        </li>
        <li>
          <HelpArticleLink slug="communications-notes-and-important-terminology">
            Communications, Notes &amp; Important Terminology
          </HelpArticleLink>{" "}
          — emails, notes, and common terms
        </li>
      </ul>
    </HelpArticleProse>
  );
}
