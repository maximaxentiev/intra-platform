import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { HelpArticleProse } from "@/components/help/HelpArticleProse";
import { HelpCallout } from "@/components/help/HelpCallout";
import { HelpScreenshot } from "@/components/help/HelpScreenshot";

/**
 * Screenshot assets (add when available):
 * - /help/fill-complete-and-update-a-batch-request/batch-workspace.png
 * - /help/fill-complete-and-update-a-batch-request/complete-request.png
 * - /help/fill-complete-and-update-a-batch-request/send-updates.png
 * - /help/fill-complete-and-update-a-batch-request/review-centre-email-batch.png — Review Centre Email after Complete Request or Send Updates (Useful)
 */
const SCREENSHOTS = {
  batchWorkspace: undefined as string | undefined,
  completeRequest: undefined as string | undefined,
  sendUpdates: undefined as string | undefined,
  reviewCentreEmailBatch: undefined as string | undefined,
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

export function FillCompleteAndUpdateABatchRequestBody() {
  return (
    <HelpArticleProse>
      <p>
        After a batch request is created, use the batch workspace to fill each child shift, send
        the consolidated centre confirmation, and — if assignments or details change later — send
        one consolidated update.
      </p>

      <h2>Understand the Batch workspace</h2>
      <p>
        Open a batch from <strong>Shifts</strong> to see the centre name, a progress panel, and a
        list of child shift cards. Expand a card to work on that shift. Use <strong>Open Shift</strong>{" "}
        to open the full individual shift page when needed.
      </p>
      <p>
        The progress panel shows how many active shifts are filled, the percentage complete, and
        the current batch status. <strong>Batch Activity</strong> records significant batch-level
        events such as creation, progress communication, completion, and update confirmations.
      </p>
      <p>Operationally important statuses:</p>
      <ul>
        <li>
          <strong>Open</strong> — the batch exists and still needs filling
        </li>
        <li>
          <strong>Ready</strong> — all active shifts are filled; the batch can be completed
        </li>
        <li>
          <strong>Completed</strong> — the latest centre confirmation has been scheduled or sent
        </li>
        <li>
          <strong>Updates required</strong> — the centre was previously confirmed, something
          material changed, and the batch is not yet ready for another update
        </li>
        <li>
          <strong>Ready to send updates</strong> — outstanding changes exist and all active
          shifts are filled again; Ops can send a consolidated update
        </li>
      </ul>

      <HelpScreenshot
        src={SCREENSHOTS.batchWorkspace}
        alt="Batch workspace showing progress panel and expanded child shift"
        caption="The batch workspace combines progress, child shifts, and batch actions."
      />

      <h2>Fill the Shifts</h2>
      <p>For each child shift:</p>
      <ol>
        <li>Expand the shift card.</li>
        <li>Review shift details.</li>
        <li>Review <strong>Available staff</strong>.</li>
        <li>Contact the appropriate carer.</li>
        <li>Mark <strong>Contacted</strong>.</li>
        <li>Select <strong>Assign</strong>.</li>
        <li>Move to the next shift.</li>
      </ol>
      <p>
        See{" "}
        <HelpArticleLink slug="understand-available-staff-and-priority">
          Understand Available Staff &amp; Priority
        </HelpArticleLink>{" "}
        and{" "}
        <HelpArticleLink slug="assign-replace-or-unassign-a-carer">
          Assign, Replace or Unassign a Carer
        </HelpArticleLink>
        .
      </p>
      <p>
        While filling shifts inside a batch, carer assignment confirmation can occur per shift.
        Centre communication is managed through the batch request — Ops does not send a separate
        centre confirmation for every child assignment. Dialogs show{" "}
        <strong>Centre communication is managed through this Batch Request.</strong> when centre
        email is deferred.
      </p>

      <h2>Add more Shifts while the Batch is open</h2>
      <p>
        Before the batch is completed, select <strong>Add shifts</strong> from the batch header.
        The centre is locked to the batch&apos;s centre. New draft rows use the same core fields
        as batch creation. See{" "}
        <HelpArticleLink slug="create-a-batch-request">Create a Batch Request</HelpArticleLink>{" "}
        for draft entry details.
      </p>
      <p>
        After the batch has been completed and confirmed to the centre, new shifts cannot be added
        to that batch.
      </p>

      <h2>Understand Batch progress</h2>
      <p>
        Progress shows how many active shifts are filled out of the total active count, plus a
        percentage. Only active (non-cancelled) shifts count. Cancelled child shifts are excluded
        from progress and noted separately when present.
      </p>
      <p>
        When an open batch reaches roughly 70% filled but is not yet complete, the platform may
        automatically send a one-time progress email to the centre&apos;s primary contact. Ops does
        not trigger this manually — it is informational, not the final confirmation. It does not
        repeat after later changes, and it is not sent when the batch moves directly to full
        completion without crossing that threshold.
      </p>
      <p>
        Delivery status appears in the progress panel — for example{" "}
        <strong>Centre progress update scheduled</strong>, <strong>sent</strong>, or{" "}
        <strong>could not be sent</strong>. Use <strong>Retry progress email</strong> if a
        progress email failed.
      </p>

      <h2>Complete the Batch Request</h2>
      <p>
        When all active shifts are filled, the batch shows <strong>Ready</strong> and{" "}
        <strong>Complete Request</strong> becomes available. The button stays disabled until
        readiness checks pass. Common blockers include unfilled shifts, missing assignees, an
        invalid centre primary contact email, or unavailable carer document shares for centre
        confirmation.
      </p>
      <ol>
        <li>Confirm every active shift and assignment is correct.</li>
        <li>Select <strong>Complete Request</strong>.</li>
        <li>
          Review the <strong>Complete Batch Request</strong> dialog — it shows the centre recipient
          and how many active shift assignments will be included.
        </li>
        <li>Select <strong>Continue to email review</strong>.</li>
        <li>
          In <strong>Review Centre Email</strong>, review the read-only recipient, edit the full
          visible email body and <strong>Subject</strong> if needed, then select{" "}
          <strong>Complete Request &amp; send confirmation</strong>.
        </li>
      </ol>

      <p>
        Ops may edit written shift and assignment wording in the draft. Changes affect this email
        only — they do not modify the Batch or child Shift records. Secure document-link blocks
        remain protected. If the Batch changes materially after the draft was generated, the platform
        may require reviewing the email again before sending. See{" "}
        <HelpArticleLink slug="communications-notes-and-important-terminology">
          Communications, Notes &amp; Important Terminology
        </HelpArticleLink>{" "}
        for the full Review Centre Email reference.
      </p>

      <HelpScreenshot
        src={SCREENSHOTS.reviewCentreEmailBatch}
        alt="Review Centre Email dialog for a batch Complete Request showing assignment preview"
        caption="Batch Complete Request includes Review Centre Email before the confirmation is sent."
      />

      <HelpScreenshot
        src={SCREENSHOTS.completeRequest}
        alt="Ready batch with Complete Request dialog"
        caption="Complete Request sends the consolidated final centre confirmation."
      />

      <HelpCallout title="Important" variant="important">
        Complete Request schedules the consolidated centre confirmation for the batch. Review all
        active shifts and assignments before confirming. Delivery status is shown separately after
        scheduling.
      </HelpCallout>

      <h2>What the Centre receives</h2>
      <p>
        The final batch confirmation includes all current active shifts with date, time, role,
        assigned carer name, Shift Notes where present, and secure links to approved carer
        documents where required. Cancelled shifts are not presented as current active assignments.
      </p>
      <p>
        After completion, the batch shows <strong>Completed</strong>. The centre has been informed
        of the current assignments. Material changes afterward require a consolidated update rather
        than immediate child-level centre emails.
      </p>

      <h2>If the Batch changes after completion</h2>
      <p>
        After the centre has received a batch confirmation, material changes make the batch stale.
        Material changes include assigning or replacing a carer, unassigning, cancelling a child
        shift, and changing date, time, role, or Shift Notes on a child shift.
      </p>
      <p>
        Non-material changes — such as Staffpoint, internal comments, or Contacted state — do not
        require a new centre batch confirmation on their own.
      </p>
      <p>
        If changes leave active shifts unfilled, the batch shows <strong>Updates required</strong>{" "}
        with <strong>Centre confirmation needs updating</strong>. Fill or correct the affected
        shifts first — for example assign a replacement after an unassign.
      </p>
      <p>
        When all active shifts are filled again, the batch shows <strong>Ready to send updates</strong>.
      </p>

      <h2>Send Updates Confirmation</h2>
      <ol>
        <li>Open the batch when it shows <strong>Ready to send updates</strong>.</li>
        <li>Select <strong>Send Updates Confirmation</strong>.</li>
        <li>
          Review the centre recipient in the <strong>Send Updates Confirmation</strong> dialog.
        </li>
        <li>
          Under <strong>Changes to highlight</strong>, review detected changes — for example carer
          changed, date changed, time changed, role changed, Shift Notes updated, or shift
          cancelled. Intermediate changes are coalesced — if Carer A was replaced by B and then C
          before sending, the summary shows A to C.
        </li>
        <li>
          Select which change summaries to highlight. The full current assignment list is always
          included regardless of which boxes are selected.
        </li>
        <li>Select <strong>Continue to email review</strong>.</li>
        <li>
          In <strong>Review Centre Email</strong>, edit the full visible email body and{" "}
          <strong>Subject</strong> if needed, then send the update.
        </li>
      </ol>

      <HelpScreenshot
        src={SCREENSHOTS.sendUpdates}
        alt="Send Updates Confirmation dialog with change checkboxes"
        caption="Choose which changes to highlight; current assignments are always included."
      />

      <p>
        The update email contains the selected change summaries plus all current active
        assignments with up-to-date details and document links. Ops may edit written{" "}
        <strong>What changed</strong> and assignment wording in the draft. Email edits do not
        change Batch or child Shift records. Secure document-link blocks remain protected. If the
        batch changes while you are reviewing and the send becomes stale, the platform may ask you
        to refresh and review again before sending.
      </p>
      <p>
        After a successful update, the batch returns to <strong>Completed</strong> and the new
        confirmation becomes the current baseline. Future material changes can start another
        updates cycle.
      </p>
      <p>
        If an assigned carer changes after centre confirmation, carer communications happen at
        shift level. The centre receives the change later through this batch update workflow, not
        as an immediate child-level centre email. Cancelling one child shift after confirmation
        follows the same pattern — see{" "}
        <HelpArticleLink slug="edit-or-cancel-a-shift">Edit or Cancel a Shift</HelpArticleLink>.
      </p>

      <h2>Check communication status and activity</h2>
      <p>
        The progress panel shows delivery status for batch communications — for example{" "}
        <strong>Final Centre confirmation scheduled</strong>, <strong>sending…</strong>,{" "}
        <strong>sent</strong>, or <strong>could not be sent</strong>. Use{" "}
        <strong>Retry Centre confirmation</strong> when a final or update confirmation failed.
      </p>
      <p>
        <strong>Batch Activity</strong> records creation, progress updates, completion, update
        confirmations, and when a confirmation becomes outdated.
      </p>

      <p>
        If the entire batch request is no longer required, use <strong>Cancel batch</strong> rather
        than cancelling every child shift individually. See{" "}
        <HelpArticleLink slug="cancel-a-batch-request">Cancel a Batch Request</HelpArticleLink>.
      </p>

      <h2>What happens next</h2>
      <p>
        For ongoing child shift edits, replacements, or cancellations, see{" "}
        <HelpArticleLink slug="edit-or-cancel-a-shift">Edit or Cancel a Shift</HelpArticleLink>{" "}
        and{" "}
        <HelpArticleLink slug="assign-replace-or-unassign-a-carer">
          Assign, Replace or Unassign a Carer
        </HelpArticleLink>
        . Remember that batch child changes after centre confirmation may require a consolidated
        update through this workflow.
      </p>
    </HelpArticleProse>
  );
}
