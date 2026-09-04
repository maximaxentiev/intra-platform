import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { HelpArticleProse } from "@/components/help/HelpArticleProse";
import { HelpCallout } from "@/components/help/HelpCallout";
import { HelpScreenshot } from "@/components/help/HelpScreenshot";

/**
 * Screenshot assets (add when available):
 * - /help/create-an-individual-shift/create-shift-form.png
 * - /help/create-an-individual-shift/pending-shift.png
 * - /help/create-an-individual-shift/internal-ops-notes.png — Centre selected with Internal Ops Notes panel (Useful)
 */
const SCREENSHOTS = {
  createForm: undefined as string | undefined,
  pendingShift: undefined as string | undefined,
  internalOpsNotes: undefined as string | undefined,
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

export function CreateAnIndividualShiftBody() {
  return (
    <HelpArticleProse>
      <p>
        Use this guide when you need to enter a single shift request from a centre. You will choose
        the centre, schedule, role, and any notes — then move on to matching and assignment on the
        next screen.
      </p>

      <h2>Before you begin</h2>
      <p>
        Have the centre&apos;s request details ready: centre name, date, start and end times,
        required role, whether the shift was posted to Staffpoint, and any shift-specific notes
        that should travel with confirmations.
      </p>

      <HelpCallout title="Important" variant="important">
        Double-check the centre, date, time, and role before you create the shift. These details
        affect which carers are eligible and may later appear in assignment communications.
      </HelpCallout>

      <h2>Create the shift</h2>
      <ol>
        <li>Open <strong>Shifts</strong> from the sidebar.</li>
        <li>
          Select <strong>Create Shift</strong>. (Use <strong>Create Batch</strong> only when entering
          multiple shifts for the same centre — see{" "}
          <HelpArticleLink slug="create-a-batch-request">Create a Batch Request</HelpArticleLink>
          .)
        </li>
        <li>
          Complete the form on the <strong>Create shift</strong> page and select{" "}
          <strong>Create shift</strong>.
        </li>
      </ol>
      <p>
        The page subtitle reminds you: create the shift first, then find and assign staff on the
        next screen.
      </p>

      <HelpScreenshot
        src={SCREENSHOTS.createForm}
        alt="Create shift form with Centre, Date, Start, End, Role, Staffpoint, and Shift Notes"
        caption="Complete the create form, then continue to the shift workspace to assign staff."
      />

      <h2>Choose the Centre</h2>
      <p>
        Select the centre this shift belongs to using the searchable <strong>Centre</strong> field.
        Verify you have the correct location — centre details and preferences affect later matching
        and communications.
      </p>
      <p>
        When the selected centre has <strong>Internal Ops Notes</strong>, they appear as a read-only
        information panel below the Centre selector. Review them before creating the shift. They are
        internal to Ops, cannot be edited from Create Shift, and are not Shift Notes. Edit them from
        the centre profile — see{" "}
        <HelpArticleLink slug="manage-centres">Manage Centres</HelpArticleLink>.
      </p>

      <HelpScreenshot
        src={SCREENSHOTS.internalOpsNotes}
        alt="Create shift form showing read-only Internal Ops Notes below the Centre selector"
        caption="Internal Ops Notes appear read-only when the selected Centre has them recorded."
      />

      <h2>Enter the date and time</h2>
      <ul>
        <li>
          <strong>Date</strong> — the calendar date of the shift (defaults to today)
        </li>
        <li>
          <strong>Start</strong> and <strong>End</strong> — shift start and end times (defaults are
          08:00 and 16:00)
        </li>
      </ul>
      <p>
        Shifts are same-day: end time must be after start time. If times are invalid, creation fails
        with an error message. Check AM/PM carefully when reading centre requests.
      </p>

      <h2>Choose the role</h2>
      <p>
        Select the <strong>Role</strong> required for this shift: <strong>ECA</strong>,{" "}
        <strong>ECE</strong>, or <strong>RECE</strong>. This is the shift role — not the
        carer&apos;s staff profile role — and it determines which carers can be considered when you
        match the shift.
      </p>
      <p>
        Nanny is not offered for new shifts. For how role affects matching, see{" "}
        <HelpArticleLink slug="understand-available-staff-and-priority">
          Understand Available Staff &amp; Priority
        </HelpArticleLink>
        .
      </p>

      <h2>Staffpoint</h2>
      <p>
        <strong>Staffpoint</strong> records whether this shift has also been posted to Staffpoint,
        the external staffing marketplace. Choose <strong>Yes</strong> or <strong>No</strong>. An
        info icon beside the label explains this in the form.
      </p>
      <p>Staffpoint is set per shift, not on the centre profile.</p>

      <h2>Add Shift Notes</h2>
      <p>
        <strong>Shift Notes</strong> are optional. Use them for shift-specific information that may
        be included in shift confirmation communications to the assigned carer and the centre —
        for example room assignment, arrival instructions, or responsibilities for that day.
      </p>
      <p>
        Do not use Shift Notes for internal Ops-only information. The create form does not include
        an internal comment field; add internal comments on the shift workspace after creation if
        needed. See{" "}
        <HelpArticleLink slug="communications-notes-and-important-terminology">
          Communications, Notes &amp; Important Terminology
        </HelpArticleLink>{" "}
        for the full distinction.
      </p>

      <h2>Save and open the shift</h2>
      <p>
        Review your entries, then select <strong>Create shift</strong>. The form requires a centre
        and role; other validation errors appear as toast messages if something fails.
      </p>
      <p>
        On success, you are taken to the new shift&apos;s workspace. The shift is created in{" "}
        <strong>Pending</strong> status — it exists but does not yet have an assigned carer.
      </p>
      <p>
        Creating the shift does not assign a carer or send assignment confirmation emails.
        Communications happen later when you assign or update the shift.
      </p>

      <HelpScreenshot
        src={SCREENSHOTS.pendingShift}
        alt="Pending shift workspace showing Available Staff"
        caption="After creation, review Available Staff on the shift workspace."
      />

      <h2>What happens next</h2>
      <ol>
        <li>Review <strong>Available Staff</strong> on the shift workspace.</li>
        <li>
          Use matching results to identify suitable carers — see{" "}
          <HelpArticleLink slug="understand-available-staff-and-priority">
            Understand Available Staff &amp; Priority
          </HelpArticleLink>
          .
        </li>
        <li>
          Mark the carer as <strong>Contacted</strong> before assignment.
        </li>
        <li>
          Assign the carer — see{" "}
          <HelpArticleLink slug="assign-replace-or-unassign-a-carer">
            Assign, Replace or Unassign a Carer
          </HelpArticleLink>
          .
        </li>
      </ol>
    </HelpArticleProse>
  );
}
