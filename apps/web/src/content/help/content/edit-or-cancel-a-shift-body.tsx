import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { HelpArticleProse } from "@/components/help/HelpArticleProse";
import { HelpCallout } from "@/components/help/HelpCallout";
import { HelpBeforeYouContinueCallout } from "@/components/help/HelpBeforeYouContinueCallout";
import { HelpScreenshot } from "@/components/help/HelpScreenshot";

/**
 * Screenshot assets (add when available):
 * - /help/edit-or-cancel-a-shift/edit-shift.png
 * - /help/edit-or-cancel-a-shift/assignee-impact.png
 * - /help/edit-or-cancel-a-shift/cancel-shift.png
 */
const SCREENSHOTS = {
  editShift: undefined as string | undefined,
  assigneeImpact: undefined as string | undefined,
  cancelShift: undefined as string | undefined,
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

export function EditOrCancelAShiftBody() {
  return (
    <HelpArticleProse>
      <p>
        Use this guide when a centre request changes after a shift is created — to update schedule,
        role, or notes, or to cancel a shift that is no longer required.
      </p>

      <h2>Edit a Shift</h2>
      <ol>
        <li>Open the shift workspace.</li>
        <li>
          In <strong>Shift details</strong>, select <strong>Edit</strong>.
        </li>
        <li>Update the required fields.</li>
        <li>Select <strong>Save changes</strong>.</li>
        <li>Review any follow-up dialogs about the assigned carer or communications.</li>
      </ol>

      <p>Editable fields on an individual shift:</p>
      <ul>
        <li>
          <strong>Centre</strong>, <strong>Date</strong>, <strong>Start time</strong>,{" "}
          <strong>End time</strong>
        </li>
        <li>
          <strong>Role required</strong>, <strong>Added to Staffpoint</strong>,{" "}
          <strong>Shift Notes</strong>
        </li>
      </ul>

      <HelpScreenshot
        src={SCREENSHOTS.editShift}
        alt="Edit shift form with Date, Start time, End time, Role required, Staffpoint, and Shift Notes"
        caption="Update shift details from the Shift details section."
      />

      <p>
        Changing the date, time, or role can affect whether the currently assigned carer remains
        eligible. Review any follow-up dialog carefully before confirming.
      </p>

      <h2>If no Carer is assigned</h2>
      <p>
        When the shift has no assignee, most edits save directly. Changes to date, time, role, or
        Shift Notes that would trigger communications show a simple confirmation before saving.
        Staffpoint-only or centre-only changes save without a communication dialog. The shift
        remains <strong>Pending</strong>.
      </p>

      <h2>If a Carer is already assigned</h2>
      <p>
        When a carer is assigned and you change date, time, role, or Shift Notes, the platform
        opens the <strong>Save Shift changes</strong> dialog. It shows what changed —{" "}
        <strong>Date</strong>, <strong>Time</strong>, <strong>Role required</strong>, or{" "}
        <strong>Shift Notes</strong> — with before and after values.
      </p>
      <p>
        You are asked: <strong>Notify the Centre or Carer about these changes?</strong> Choose{" "}
        <strong>Save without email</strong> or <strong>Choose communications</strong>. If sending
        communication, select <strong>Centre</strong> and/or <strong>Carer</strong>, then choose
        which changed fields to include for each recipient.
      </p>
      <p>
        When Centre communication is selected on an individual shift, Ops next reviews{" "}
        <strong>Review Centre Email</strong> before the update is sent. The full visible email body
        and Subject are editable, including <strong>What Changed</strong> and current shift-detail
        wording shown in the draft. Edits affect the outgoing email only — they do not change the
        underlying Shift. To correct authoritative shift facts in the platform, go back and edit the
        shift itself, then select <strong>Save changes &amp; send email</strong> from the review
        dialog.
      </p>

      <HelpCallout title="Important" variant="important">
        Review the dialog before saving. Shift updates can send external communications to the
        carer and centre.
      </HelpCallout>

      <p>
        Carer update emails include what changed and the full updated shift details. Shift Notes
        changes are communication-relevant because notes may appear in confirmation emails. See{" "}
        <HelpArticleLink slug="communications-notes-and-important-terminology">
          Communications, Notes &amp; Important Terminology
        </HelpArticleLink>
        .
      </p>

      <h2>If the revised Shift no longer works for the Carer</h2>
      <p>
        When date, time, or role changes on a <strong>Filled</strong> shift, the platform
        revalidates whether the assigned carer can remain. Two outcomes are possible:
      </p>

      <p>
        <strong>Availability-only conflict:</strong> dialog title{" "}
        <strong>Assigned Staff is unavailable for the revised schedule</strong>. Options:
      </p>
      <ul>
        <li>
          <strong>Change schedule &amp; unassign Staff</strong> — saves the revised shift, removes
          the carer, returns the shift to <strong>Pending</strong>
        </li>
        <li>
          <strong>Keep Staff assigned — availability confirmed</strong> — keeps the carer when Ops
          has directly confirmed they can work the revised schedule
        </li>
        <li>
          <strong>Go back</strong> — return to editing without saving
        </li>
      </ul>

      <HelpScreenshot
        src={SCREENSHOTS.assigneeImpact}
        alt="Assigned Staff impact dialog with unassign and availability confirmed options"
        caption="Review assignee impact when schedule or role changes affect eligibility."
      />

      <HelpCallout title="Important" variant="important">
        Only choose <strong>Keep Staff assigned — availability confirmed</strong> when you have
        directly confirmed the carer can work the revised schedule. This option applies only to
        availability conflicts — not role, document, overlap, or other eligibility failures.
      </HelpCallout>

      <p>
        <strong>Hard eligibility failure:</strong> dialog title{" "}
        <strong>Assigned Staff cannot remain on the revised Shift</strong>. The platform lists why
        — such as role mismatch, shift overlap, buffer conflict, centre ban, document issues, or
        RECE requirements. Only <strong>Change schedule &amp; unassign Staff</strong> or{" "}
        <strong>Go back</strong> are available. There is no override for these failures.
      </p>
      <p>
        If you unassign through the edit flow, pending reminders for the previous carer are
        cancelled. You may still notify the centre and carer about the change. See{" "}
        <HelpArticleLink slug="assign-replace-or-unassign-a-carer">
          Assign, Replace or Unassign a Carer
        </HelpArticleLink>{" "}
        for standalone unassign steps. For matching rules, see{" "}
        <HelpArticleLink slug="understand-available-staff-and-priority">
          Understand Available Staff &amp; Priority
        </HelpArticleLink>
        .
      </p>

      <h2>Shift Notes and Staffpoint</h2>
      <ul>
        <li>
          <strong>Shift Notes</strong> are external shift-specific information and may appear in carer
          and centre communications. Changing them can trigger the communication review dialog when
          a carer is assigned.
        </li>
        <li>
          <strong>Added to Staffpoint</strong> can be updated without triggering communications or
          assignee revalidation. The change is still recorded in shift activity.
        </li>
      </ul>

      <h2>Cancel a Shift</h2>
      <p>
        Cancel when a shift is no longer required but should remain in operational history. Open the
        page menu (<strong>More shift actions</strong>) and select <strong>Cancel shift</strong>.
        Cancel is not available for completed or already cancelled shifts.
      </p>
      <ol>
        <li>
          Review the <strong>Cancel this shift?</strong> dialog — the shift stays on record as
          cancelled and a reason is required.
        </li>
        <li>
          Enter a <strong>Cancellation reason</strong> (internal record only — not included in
          external emails).
        </li>
        <li>Select <strong>Continue</strong>.</li>
        <li>
          Choose <strong>No communication</strong> or <strong>Send communication</strong>.
        </li>
        <li>
          If sending, select <strong>Centre</strong> and/or <strong>Carer</strong> under{" "}
          <strong>Choose recipients</strong>.
        </li>
        <li>Select <strong>Cancel shift</strong>.</li>
      </ol>

      <HelpScreenshot
        src={SCREENSHOTS.cancelShift}
        alt="Cancel shift dialog with cancellation reason and communication options"
        caption="Enter a cancellation reason and choose whether to notify recipients."
      />

      <HelpCallout title="Important" variant="important">
        Cancelling a shift changes its operational status and may send external communication.
        Review the reason and recipients before confirming.
      </HelpCallout>

      <p>After cancellation:</p>
      <ul>
        <li>
          The shift becomes <strong>Cancelled</strong>
        </li>
        <li>
          The cancellation reason appears in shift details and as a <strong>Reason:</strong> banner
        </li>
        <li>
          An assigned carer remains visible historically if one was assigned; unassign and further
          assignment actions are disabled
        </li>
        <li>Pending reminders are cancelled</li>
        <li>The change is recorded in the activity log</li>
      </ul>

      <h2>Editing a Shift inside a Batch Request</h2>
      <p>
        Batch child shifts use inline editing when pending or filled (not when the batch is
        cancelled). Centre cannot be changed — it is fixed by the batch. Save, assignee impact, and
        communication dialogs work the same way otherwise.
      </p>
      <p>
        Carer communication can still occur per shift. Centre communication is deferred — the
        dialog shows <strong>Centre communication is managed through this Batch Request.</strong>
      </p>
      <p>
        After the centre has received batch confirmation, material changes to date, time, role, or
        Shift Notes make the batch stale. The batch may show <strong>Updates required</strong> or{" "}
        <strong>Ready to send updates</strong>. Staffpoint-only changes do not trigger this. See{" "}
        <HelpArticleLink slug="fill-complete-and-update-a-batch-request">
          Fill, Complete &amp; Update a Batch Request
        </HelpArticleLink>
        .
      </p>

      <h2>Cancelling a Shift inside a Batch Request</h2>
      <p>
        Cancelling one child shift is not the same as cancelling the entire batch. Use the expanded
        child menu to <strong>Cancel shift</strong>. Carer communication follows your recipient
        choices; centre communication remains managed through the batch. After prior batch
        confirmation, the cancellation contributes to the next consolidated centre update.
      </p>
      <p>
        To cancel the entire batch, see{" "}
        <HelpArticleLink slug="cancel-a-batch-request">Cancel a Batch Request</HelpArticleLink>.
      </p>

      <h2>Cancel vs Delete</h2>
      <ul>
        <li>
          <strong>Cancel</strong> — use when a real shift was requested but is no longer required.
          The shift stays in operational history with <strong>Cancelled</strong> status.
        </li>
        <li>
          <strong>Delete</strong> — available from the same menu on individual shifts. Permanently
          removes the shift record and cannot be undone. Reserve delete for incorrect, test, or
          duplicate records.
        </li>
      </ul>

      <HelpBeforeYouContinueCallout title="Before you continue">
        Deleting a shift is permanent. Prefer cancellation when the shift was a genuine request
        that is no longer needed.
      </HelpBeforeYouContinueCallout>

      <h2>What happens next</h2>
      <p>
        After editing, confirm the current assignee still makes sense. If the shift returned to{" "}
        <strong>Pending</strong>, review Available staff and assign again. Changes and
        cancellations are recorded in the shift activity log.
      </p>
      <p>
        For batch child changes, return to the batch workspace and review batch status — especially
        if <strong>Updates required</strong> appears after centre confirmation.
      </p>
    </HelpArticleProse>
  );
}
