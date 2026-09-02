import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { HelpArticleProse } from "@/components/help/HelpArticleProse";
import { HelpBeforeYouContinueCallout } from "@/components/help/HelpBeforeYouContinueCallout";
import { HelpScreenshot } from "@/components/help/HelpScreenshot";

/**
 * Screenshot assets (add when available):
 * - /help/cancel-a-batch-request/cancel-before-confirmation.png
 * - /help/cancel-a-batch-request/cancel-after-confirmation.png
 */
const SCREENSHOTS = {
  cancelBeforeConfirmation: undefined as string | undefined,
  cancelAfterConfirmation: undefined as string | undefined,
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

export function CancelABatchRequestBody() {
  return (
    <HelpArticleProse>
      <p>
        Use this guide when a centre&apos;s entire batch request is no longer required. You will
        cancel all remaining active child shifts in one action and choose the appropriate Carer and
        Centre communications based on the batch&apos;s current history.
      </p>

      <h2>When to cancel the entire Batch</h2>
      <p>
        Use <strong>Cancel batch</strong> when the centre&apos;s whole batch request is being
        withdrawn. Use child-level <strong>Cancel shift</strong> when only one requested shift is
        no longer required — see{" "}
        <HelpArticleLink slug="edit-or-cancel-a-shift">Edit or Cancel a Shift</HelpArticleLink>.
        Do not cancel every child shift manually when the entire batch is being withdrawn.
      </p>

      <HelpBeforeYouContinueCallout>
        <p>
          Cancelling a Batch cancels all remaining active Shifts in that Batch. Review the Batch and
          communication choices before confirming. This is a consequential operational action — once
          cancelled, the batch cannot be restored to an active fulfilment state.
        </p>
      </HelpBeforeYouContinueCallout>

      <h2>Cancel the Batch</h2>
      <ol>
        <li>Open the Batch Request workspace.</li>
        <li>
          Select the batch-level <strong>More batch actions</strong> menu (three dots).
        </li>
        <li>Select <strong>Cancel batch</strong>.</li>
        <li>
          In <strong>Cancel this Batch Request?</strong>, enter a{" "}
          <strong>Cancellation reason</strong>. This is required and applies to the batch
          cancellation and each affected child shift. It is stored for operational history. If a
          Centre cancellation email is sent, the reason may be included when it is suitable for
          external sharing — reasons marked as internal are not sent externally.
        </li>
        <li>
          Select <strong>Continue</strong> when communication choices are available, or{" "}
          <strong>Cancel batch</strong> when they are not.
        </li>
        <li>Choose whether to send cancellation communication, then select <strong>Cancel batch</strong>.</li>
      </ol>

      <p>
        Communication options depend on whether assigned Carers exist and whether the Centre has
        previously received a batch confirmation:
      </p>

      <table>
        <thead>
          <tr>
            <th>Situation</th>
            <th>Carer email available?</th>
            <th>Centre email available?</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>No assigned Carers, Centre not previously confirmed</td>
            <td>No</td>
            <td>No</td>
          </tr>
          <tr>
            <td>Assigned Carers, Centre not previously confirmed</td>
            <td>Yes</td>
            <td>No</td>
          </tr>
          <tr>
            <td>Centre previously confirmed</td>
            <td>Yes, when affected Carers exist</td>
            <td>Yes</td>
          </tr>
        </tbody>
      </table>

      <h2>If no Carers have been assigned</h2>
      <p>
        When no active child shift has an assigned Carer and the Centre has never received a batch
        confirmation, no communication step appears. Enter the cancellation reason and select{" "}
        <strong>Cancel batch</strong>. The batch cancels immediately after confirmation.
      </p>

      <h2>If Carers are assigned but the Centre has not been confirmed</h2>
      <p>
        When one or more active child shifts have assigned Carers but the Centre has not yet
        received a batch confirmation, you can choose <strong>No communication</strong> or{" "}
        <strong>Email assigned Carers about the cancellation</strong>. Centre communication is not
        available — the Centre has not yet received the batch confirmation, so there is no batch
        confirmation to cancel or correct for the Centre on the platform.
      </p>

      <HelpScreenshot
        src={SCREENSHOTS.cancelBeforeConfirmation}
        alt="Cancel batch dialog before Centre confirmation showing Carer email option"
        caption="Before Centre confirmation, only Carer communication may be offered."
      />

      <p>
        When Carer communication is selected, each affected assigned Carer receives one consolidated
        cancellation email listing their affected shifts. Carer emails do not include the
        cancellation reason.
      </p>

      <h2>If the Centre has already received a Batch confirmation</h2>
      <p>
        When the Centre has previously received at least one batch confirmation — including batches
        currently showing <strong>Updates required</strong> or <strong>Ready to send updates</strong>{" "}
        — you can choose <strong>No communication</strong> or <strong>Send communication</strong>.
        If sending, select <strong>Centre</strong> and/or <strong>Carer</strong> under{" "}
        <strong>Choose recipients</strong>.
      </p>

      <HelpScreenshot
        src={SCREENSHOTS.cancelAfterConfirmation}
        alt="Cancel batch dialog after Centre confirmation showing Centre and Carer recipient checkboxes"
        caption="After Centre confirmation, choose Centre and/or Carer recipients."
      />

      <p>
        When Centre communication is selected, one consolidated batch cancellation email is sent to
        the Centre listing the affected shifts. When Carer communication is selected, each affected
        Carer receives one consolidated email for their shifts.
      </p>

      <h2>What happens to the child Shifts</h2>
      <ul>
        <li>
          Active <strong>Pending</strong> or <strong>Filled</strong> child shifts are cancelled with
          the batch reason
        </li>
        <li>
          Child shifts already <strong>Cancelled</strong> remain cancelled — the platform does not
          cancel them again
        </li>
        <li>
          <strong>Completed</strong> child shifts are not re-cancelled; their history remains
        </li>
        <li>
          Assigned Carer information remains visible historically on affected shifts; further
          assignment and edit actions are disabled
        </li>
      </ul>

      <h2>What happens to communications and reminders</h2>
      <p>
        Pending reminders for cancelled child shifts are cancelled automatically. Cancelling the
        batch supersedes normal pending batch communications such as progress communication, final
        batch confirmation, and batch update confirmation — once cancelled, the platform prevents
        those from being sent afterward.
      </p>

      <h2>After the Batch is cancelled</h2>
      <ul>
        <li>
          The batch workspace shows <strong>Cancelled</strong> with the cancellation reason and
          timestamp
        </li>
        <li>
          The batch also appears as <strong>Cancelled</strong> in the Shifts feed
        </li>
        <li>
          <strong>Add shifts</strong>, assignment, and edit operations are no longer available; the
          batch remains viewable for history
        </li>
        <li>
          <strong>Cancel batch</strong> is no longer available from the batch menu
        </li>
        <li>
          <strong>Batch Activity</strong> records the cancellation and any scheduled communication
          events
        </li>
      </ul>

      <p>
        For batch fulfilment workflows, see{" "}
        <HelpArticleLink slug="fill-complete-and-update-a-batch-request">
          Fill, Complete &amp; Update a Batch Request
        </HelpArticleLink>
        . For Carer assignment, see{" "}
        <HelpArticleLink slug="assign-replace-or-unassign-a-carer">
          Assign, Replace or Unassign a Carer
        </HelpArticleLink>
        . For communication terminology, see{" "}
        <HelpArticleLink slug="communications-notes-and-important-terminology">
          Communications, Notes &amp; Important Terminology
        </HelpArticleLink>
        .
      </p>
    </HelpArticleProse>
  );
}
