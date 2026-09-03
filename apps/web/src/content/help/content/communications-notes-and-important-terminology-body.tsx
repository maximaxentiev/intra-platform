import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { HelpArticleProse } from "@/components/help/HelpArticleProse";
import { HelpCallout } from "@/components/help/HelpCallout";

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

export function CommunicationsNotesAndImportantTerminologyBody() {
  return (
    <HelpArticleProse>
      <p>
        Use this reference to understand Intra&apos;s communication choices, notes and comments, Shift
        and Batch statuses, and common Ops terminology. For step-by-step workflows, follow the
        linked Help articles at the end.
      </p>

      <h2>Notes and comments</h2>
      <p>
        Intra separates centre-wide information, shift-specific external details, and Ops-only
        comments. Using the right field prevents accidental external sharing.
      </p>

      <h3>Centre Rules, Policies, and Other Notes</h3>
      <p>
        Stored on the Centre record and shown in the read view as <strong>Rules &amp; notes</strong>{" "}
        when present. Use this for centre-wide information such as arrival expectations, parking,
        local policies, or general on-site procedures.
      </p>
      <p>
        Centre notes are not automatically included in every communication. They may appear in
        relevant Carer assignment confirmations when the Centre has notes recorded. See{" "}
        <HelpArticleLink slug="manage-centres">Manage Centres</HelpArticleLink>.
      </p>

      <h3>Shift Notes</h3>
      <p>
        <strong>Shift Notes</strong> are shift-specific external information. They may be included
        in relevant Carer or Centre communications — for example room assignment, arrival
        instructions, shift-specific responsibilities, or temporary instructions for that shift.
      </p>

      <HelpCallout title="Important" variant="important">
        Do not put Ops-only information in Shift Notes.
      </HelpCallout>

      <h3>Internal Comments</h3>
      <p>
        <strong>Internal Comments</strong> are for Ops-only information. They remain internal to the
        platform and are not intended for Centre or Carer communications.
      </p>
      <ul>
        <li>
          On individual shifts and expanded batch child shifts, use the{" "}
          <strong>Internal comments</strong> section to add timestamped Ops notes over time.
        </li>
        <li>
          When creating a batch, each row can include a one-time <strong>Internal Comment</strong>{" "}
          field that becomes the shift&apos;s initial internal comment.
        </li>
      </ul>

      <table>
        <thead>
          <tr>
            <th>Type</th>
            <th>Applies to</th>
            <th>External?</th>
            <th>Best used for</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Centre Rules / Notes</td>
            <td>Centre</td>
            <td>May appear in some Carer confirmations</td>
            <td>Centre-wide information</td>
          </tr>
          <tr>
            <td>Shift Notes</td>
            <td>Shift</td>
            <td>Yes, may appear in communications</td>
            <td>Shift-specific external details</td>
          </tr>
          <tr>
            <td>Internal Comment</td>
            <td>Shift / Ops workflow</td>
            <td>No</td>
            <td>Ops-only information</td>
          </tr>
        </tbody>
      </table>

      <h2>When the platform sends communications</h2>
      <p>
        External communications may be triggered or scheduled by actions such as assigning,
        replacing, or unassigning a Carer; editing communication-relevant shift details; cancelling
        a shift; completing a Batch Request; sending batch updates; cancelling a batch; or inviting a
        Carer to the portal.
      </p>
      <p>Automated communications may also be sent for:</p>
      <ul>
        <li>supported document expiry reminders</li>
        <li>Carer shift reminders before assigned shifts</li>
        <li>batch progress communication when the configured fulfillment threshold is reached</li>
      </ul>

      <HelpCallout title="Important" variant="important">
        Always review the recipient choices shown in the current dialog. The available choices depend
        on the action and the Shift or Batch state.
      </HelpCallout>

      <p>
        Many consequential actions ask Ops to choose <strong>Centre</strong>, <strong>Carer</strong>,
        both, or <strong>No communication</strong>. Not every workflow offers every option.
      </p>
      <p>
        Some communications are scheduled after the action is saved. Where the platform shows
        delivery status — such as <strong>scheduled</strong>, <strong>sending</strong>,{" "}
        <strong>sent</strong>, or <strong>failed</strong> — check it if the message is important.
        Supported batch workflows may offer <strong>Retry</strong> when a Centre progress or
        confirmation email fails.
      </p>

      <h2>Individual Shift vs Batch Request communications</h2>
      <p>
        For an individual Shift, Centre and Carer communications can generally be handled directly
        through the shift workflow where offered — for example initial assignment, edits, unassign,
        cancellation, or resend confirmation. See{" "}
        <HelpArticleLink slug="assign-replace-or-unassign-a-carer">
          Assign, Replace or Unassign a Carer
        </HelpArticleLink>{" "}
        and{" "}
        <HelpArticleLink slug="edit-or-cancel-a-shift">Edit or Cancel a Shift</HelpArticleLink>.
      </p>
      <p>
        For a child Shift inside a Batch, Carer communication can happen individually. Centre
        communication is generally consolidated through the Batch Request — the Centre does not
        receive one confirmation every time a child assignment changes. The platform shows:{" "}
        <strong>Centre communication is managed through this Batch Request.</strong>
      </p>
      <p>Major Centre batch communications:</p>
      <ul>
        <li>
          <strong>Progress update</strong> — automatic one-time progress communication around the
          configured fulfillment threshold
        </li>
        <li>
          <strong>Complete Request</strong> — consolidated confirmation of current batch assignments
        </li>
        <li>
          <strong>Send Updates Confirmation</strong> — consolidated update after material changes
          to a previously confirmed batch
        </li>
      </ul>
      <p>
        Batch cancellation communication depends on assigned Carers and whether the Centre was
        previously confirmed. See{" "}
        <HelpArticleLink slug="fill-complete-and-update-a-batch-request">
          Fill, Complete &amp; Update a Batch Request
        </HelpArticleLink>{" "}
        and{" "}
        <HelpArticleLink slug="cancel-a-batch-request">Cancel a Batch Request</HelpArticleLink>.
      </p>
      <p>
        Where appropriate, Centre confirmation emails may include secure links to approved Carer
        documents. See{" "}
        <HelpArticleLink slug="review-and-approve-staff-documents">
          Review &amp; Approve Staff Documents
        </HelpArticleLink>
        .
      </p>

      <h2>Shift statuses</h2>
      <table>
        <thead>
          <tr>
            <th>Status</th>
            <th>Meaning</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <strong>Pending</strong>
            </td>
            <td>Shift exists but has no assigned Carer.</td>
          </tr>
          <tr>
            <td>
              <strong>Filled</strong>
            </td>
            <td>Shift has an assigned Carer.</td>
          </tr>
          <tr>
            <td>
              <strong>Completed</strong>
            </td>
            <td>
              Shift has passed according to current lifecycle automation. This does not mean actual
              hours were verified.
            </td>
          </tr>
          <tr>
            <td>
              <strong>Cancelled</strong>
            </td>
            <td>
              Shift was cancelled and remains in history. A previously assigned Carer may still
              appear for context — this is not an active assignment.
            </td>
          </tr>
        </tbody>
      </table>

      <h2>Batch Request statuses</h2>
      <table>
        <thead>
          <tr>
            <th>Status</th>
            <th>Meaning</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <strong>Open</strong>
            </td>
            <td>Batch still needs fulfillment.</td>
          </tr>
          <tr>
            <td>
              <strong>Ready</strong>
            </td>
            <td>Current active Shifts are filled and the batch can be completed.</td>
          </tr>
          <tr>
            <td>
              <strong>Completed</strong>
            </td>
            <td>Current Centre batch confirmation is up to date.</td>
          </tr>
          <tr>
            <td>
              <strong>Updates required</strong>
            </td>
            <td>
              The Centre was previously confirmed, material changes occurred, and the batch is not
              yet ready to send an update.
            </td>
          </tr>
          <tr>
            <td>
              <strong>Ready to send updates</strong>
            </td>
            <td>
              Material changes exist and current active Shifts are ready for a consolidated Centre
              update.
            </td>
          </tr>
          <tr>
            <td>
              <strong>Cancelled</strong>
            </td>
            <td>Entire Batch Request has been cancelled.</td>
          </tr>
        </tbody>
      </table>

      <h2>Important staffing terms</h2>

      <h3>Staff vs Carer</h3>
      <p>
        The platform uses both <strong>Staff</strong> and <strong>Carer</strong> in different areas.
        In Ops workflows, both usually refer to the childcare professional being managed or assigned.
        Follow the label shown on the current screen.
      </p>

      <h3>Staff role vs Shift role</h3>
      <p>
        Staff profile roles are <strong>ECA</strong>, <strong>ECE</strong>, and{" "}
        <strong>Nanny</strong>. Current new Shift roles are <strong>ECA</strong>,{" "}
        <strong>ECE</strong>, and <strong>RECE</strong>.{" "}
        <strong>RECE is not a Staff profile role</strong> in the current platform. For a RECE
        Shift, matching uses ECE Staff with approved RECE Proof. See{" "}
        <HelpArticleLink slug="understand-available-staff-and-priority">
          Understand Available Staff &amp; Priority
        </HelpArticleLink>
        .
      </p>

      <h3>RECE Proof</h3>
      <p>
        <strong>RECE Proof</strong> is a qualification document, not a Staff role.
      </p>

      <h3>Contacted</h3>
      <p>
        <strong>Contacted</strong> records that Ops has contacted that Carer about that specific
        Shift. It is per Shift and Carer, does not send an email, does not assign the Carer, and is
        required before Assign or Replace. See{" "}
        <HelpArticleLink slug="assign-replace-or-unassign-a-carer">
          Assign, Replace or Unassign a Carer
        </HelpArticleLink>
        .
      </p>

      <h3>Available staff</h3>
      <p>
        <strong>Available staff</strong> lists Carers who pass the Shift&apos;s current eligibility
        rules, ordered by priority. Eligibility determines whether a Carer can be considered;
        priority determines the order among eligible Carers.
      </p>

      <h3>Top staff and Banned staff</h3>
      <p>
        <strong>Top staff</strong> is a Centre preference that improves ranking among eligible
        Carers. It does not override eligibility. <strong>Banned staff</strong> is a hard
        Centre-specific exclusion. Top and Banned are mutually exclusive for the same Centre. See{" "}
        <HelpArticleLink slug="manage-centres">Manage Centres</HelpArticleLink>.
      </p>

      <h3>Staffpoint</h3>
      <p>
        <strong>Staffpoint</strong> is the per-Shift flag indicating whether the Shift has also been
        posted to the external Staffpoint staffing marketplace. It is separate from Intra&apos;s
        Available staff matching.
      </p>

      <h3>Primary contact</h3>
      <p>
        The first Centre contact is treated as <strong>Primary</strong>. This contact and email are
        used for important Centre communications. Reordering contacts changes which contact is
        Primary.
      </p>

      <h3>Onboarding</h3>
      <p>
        Onboarding status reflects the Carer&apos;s progress through portal onboarding. A Staff
        record existing does not necessarily mean the Carer is eligible for matching. See{" "}
        <HelpArticleLink slug="manage-staff-profiles-and-availability">
          Manage Staff Profiles &amp; Availability
        </HelpArticleLink>
        .
      </p>

      <h3>Cancel vs Delete</h3>
      <p>
        <strong>Cancel</strong> is used when a real operational Shift or Batch is no longer required
        while retaining history. <strong>Delete</strong> permanently removes a record where that
        destructive action exists — generally for incorrect, duplicate, or admin cleanup on
        individual Shifts. Batch Requests do not have a delete workflow.
      </p>

      <h3>Activity</h3>
      <p>
        Activity logs record significant Ops actions and communication events where available. Use
        them to understand what happened previously on a Shift, Batch, or in reports.
      </p>

      <h2>Where to learn more</h2>

      <h3>Staffing</h3>
      <ul>
        <li>
          <HelpArticleLink slug="understand-available-staff-and-priority">
            Understand Available Staff &amp; Priority
          </HelpArticleLink>
        </li>
        <li>
          <HelpArticleLink slug="assign-replace-or-unassign-a-carer">
            Assign, Replace or Unassign a Carer
          </HelpArticleLink>
        </li>
      </ul>

      <h3>Shifts</h3>
      <ul>
        <li>
          <HelpArticleLink slug="create-an-individual-shift">Create an Individual Shift</HelpArticleLink>
        </li>
        <li>
          <HelpArticleLink slug="edit-or-cancel-a-shift">Edit or Cancel a Shift</HelpArticleLink>
        </li>
      </ul>

      <h3>Batches</h3>
      <ul>
        <li>
          <HelpArticleLink slug="create-a-batch-request">Create a Batch Request</HelpArticleLink>
        </li>
        <li>
          <HelpArticleLink slug="fill-complete-and-update-a-batch-request">
            Fill, Complete &amp; Update a Batch Request
          </HelpArticleLink>
        </li>
        <li>
          <HelpArticleLink slug="cancel-a-batch-request">Cancel a Batch Request</HelpArticleLink>
        </li>
      </ul>

      <h3>Staff and Centres</h3>
      <ul>
        <li>
          <HelpArticleLink slug="manage-centres">Manage Centres</HelpArticleLink>
        </li>
        <li>
          <HelpArticleLink slug="manage-staff-profiles-and-availability">
            Manage Staff Profiles &amp; Availability
          </HelpArticleLink>
        </li>
        <li>
          <HelpArticleLink slug="review-and-approve-staff-documents">
            Review &amp; Approve Staff Documents
          </HelpArticleLink>
        </li>
      </ul>
    </HelpArticleProse>
  );
}
