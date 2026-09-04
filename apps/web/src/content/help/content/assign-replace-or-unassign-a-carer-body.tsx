import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { HelpArticleProse } from "@/components/help/HelpArticleProse";
import { HelpCallout } from "@/components/help/HelpCallout";
import { HelpScreenshot } from "@/components/help/HelpScreenshot";

/**
 * Screenshot assets (add when available):
 * - /help/assign-replace-or-unassign-a-carer/assign.png
 * - /help/assign-replace-or-unassign-a-carer/replace.png
 * - /help/assign-replace-or-unassign-a-carer/unassign.png
 * - /help/assign-replace-or-unassign-a-carer/review-centre-email.png — Review Centre Email dialog (Required)
 */
const SCREENSHOTS = {
  assign: undefined as string | undefined,
  replace: undefined as string | undefined,
  unassign: undefined as string | undefined,
  reviewCentreEmail: undefined as string | undefined,
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

export function AssignReplaceOrUnassignACarerBody() {
  return (
    <HelpArticleProse>
      <p>
        Use this guide to assign a carer to a shift, replace an existing assignment, or unassign
        without an immediate replacement — and to understand which communications each action may
        trigger.
      </p>

      <h2>Before you assign</h2>
      <p>Before assigning, confirm:</p>
      <ul>
        <li>The shift already exists and is open for assignment</li>
        <li>The carer appears in <strong>Available staff</strong></li>
        <li>You have reviewed priority details and eligibility</li>
        <li>You have contacted the carer about this specific shift</li>
        <li>You have marked them <strong>Contacted</strong></li>
      </ul>
      <p>
        For how the Available staff list works, see{" "}
        <HelpArticleLink slug="understand-available-staff-and-priority">
          Understand Available Staff &amp; Priority
        </HelpArticleLink>
        .
      </p>

      <p>
        <strong>Assign</strong> is disabled until the selected carer is marked{" "}
        <strong>Contacted</strong>. Check Contacted only after Ops has reached out about this
        shift. Contacted does not send an email and does not assign the carer — it is recorded
        per shift and per carer.
      </p>

      <HelpCallout title="Important" variant="important">
        Review the confirmation dialog before assigning. Assignment can trigger carer and centre
        communications.
      </HelpCallout>

      <h2>Assign a Carer</h2>
      <ol>
        <li>Open the shift workspace.</li>
        <li>Review <strong>Available staff</strong> and choose an eligible carer.</li>
        <li>Contact the carer using your normal Ops process.</li>
        <li>Check <strong>Contacted</strong> for that carer.</li>
        <li>Select <strong>Assign</strong>.</li>
        <li>
          Review the <strong>Confirm Staff assignment</strong> dialog — verify the carer, centre,
          date, time, and role.
        </li>
        <li>Select <strong>Confirm assignment</strong>.</li>
      </ol>

      <HelpScreenshot
        src={SCREENSHOTS.assign}
        alt="Available staff row with Contacted checked and Assign enabled"
        caption="Mark Contacted, then Assign to open the confirmation dialog."
      />

      <p>
        On an individual shift, when Centre communication applies, Ops next sees{" "}
        <strong>Review Centre Email</strong> before the assignment is finalised. Customise{" "}
        <strong>Subject</strong> and <strong>Message</strong> if needed, review the rendered email
        preview, then select <strong>Send confirmation</strong>.
      </p>

      <HelpScreenshot
        src={SCREENSHOTS.reviewCentreEmail}
        alt="Review Centre Email dialog with editable Subject and Message and rendered preview"
        caption="Review Centre Email lets Ops customise Subject and Message before sending."
      />

      <p>
        In <strong>Review Centre Email</strong>, the Centre recipient is read-only. Shift details,
        Carer legal names, Shift Notes, and the secure document section remain system-generated.
        Closing or cancelling the email review before <strong>Send confirmation</strong> does not
        complete the assignment and does not send a Centre email.
      </p>

      <p>
        After assignment is confirmed, the carer receives a shift confirmation email with shift
        details and a portal link when available. Shift Notes and centre rules may be included
        where applicable. The centre receives a staff-confirmed email that may include secure links
        to the assigned carer&apos;s approved documents. The platform also schedules carer
        reminders before the shift.
      </p>

      <h2>What happens after assignment</h2>
      <ul>
        <li>
          The shift status becomes <strong>Filled</strong>
        </li>
        <li>
          The carer appears in the <strong>Assigned Carer</strong> area under{" "}
          <strong>Assignment</strong>
        </li>
        <li>
          Other eligible carers remain in <strong>Available staff</strong> with a{" "}
          <strong>Replace</strong> action instead of Assign
        </li>
        <li>Assignment and communication activity is recorded on the shift</li>
      </ul>

      <h2>Replace an assigned Carer</h2>
      <p>
        Use replacement when a shift is already assigned but a different carer will take it instead.
      </p>
      <ol>
        <li>
          On the individual shift workspace, find the replacement under{" "}
          <strong>Available staff</strong>.
        </li>
        <li>Contact the replacement carer and mark them <strong>Contacted</strong>.</li>
        <li>Select <strong>Replace</strong>.</li>
        <li>
          Review the <strong>Replace assigned Carer?</strong> dialog — verify current and new
          carer, plus shift details.
        </li>
        <li>
          Choose whether to email the previous carer (see below).
        </li>
        <li>Select <strong>Replace Carer</strong>.</li>
      </ol>

      <HelpScreenshot
        src={SCREENSHOTS.replace}
        alt="Replace assigned Carer confirmation dialog with previous-carer email option"
        caption="Review the replacement dialog and previous-carer notification option."
      />

      <p>
        The dialog includes a checkbox — checked by default —{" "}
        <strong>Email the previous Carer to confirm they have been unassigned</strong>. When
        selected, the previous carer receives the standard unassignment email for that shift. When
        not selected, no email is sent to the previous carer. The new carer always receives the
        normal assignment confirmation.
      </p>

      <HelpCallout title="Important" variant="important">
        When replacing or unassigning, review previous-carer and centre communication choices
        carefully before confirming.
      </HelpCallout>

      <p>
        The platform updates the assignment and manages associated carer reminders automatically
        when you replace a carer.
      </p>

      <h2>Unassign a Carer</h2>
      <p>
        Use unassign when the current carer should be removed and you are not assigning a
        replacement immediately.
      </p>
      <ol>
        <li>
          In the <strong>Assigned Carer</strong> area, open <strong>Manage assignment</strong>.
        </li>
        <li>Select <strong>Unassign</strong>.</li>
        <li>
          Review the <strong>Unassign Carer</strong> dialog — it shows the carer, centre, and
          date.
        </li>
        <li>
          Choose <strong>Save without email</strong> or <strong>Send communication</strong>.
        </li>
        <li>
          If sending communication, select <strong>Centre</strong> and/or <strong>Carer</strong>{" "}
          under <strong>Choose recipients</strong>, then select{" "}
          <strong>Confirm unassign</strong>.
        </li>
      </ol>

      <HelpScreenshot
        src={SCREENSHOTS.unassign}
        alt="Manage assignment menu with Unassign option"
        caption="Unassign from Manage assignment when no replacement is ready."
      />

      <p>After unassign:</p>
      <ul>
        <li>The assigned carer is removed</li>
        <li>
          The shift returns to <strong>Pending</strong>
        </li>
        <li>Pending reminders for the previous carer are cancelled</li>
        <li>
          <strong>Available staff</strong> can be used to assign again
        </li>
      </ul>

      <h2>Individual Shift vs Batch Request</h2>
      <p>
        Assignment controls are the same, but centre communications differ for shifts inside an
        open batch request.
      </p>
      <ul>
        <li>
          <strong>Individual shift:</strong> confirming assignment sends carer and centre
          confirmation emails as part of the assign workflow (subject to valid email addresses and
          document availability for the centre).
        </li>
        <li>
          <strong>Shift inside a Batch Request:</strong> the carer still receives per-shift
          confirmation. Centre confirmation is not sent at the child level — the dialog states that{" "}
          <strong>Centre confirmation will be sent through the Batch Request</strong>. On resend and
          unassign, the centre option shows{" "}
          <strong>Centre communication is managed through this Batch Request.</strong>
        </li>
      </ul>
      <p>
        Assigning carers updates the batch&apos;s fulfilment progress automatically.
      </p>
      <p>
        <strong>After the centre has received batch confirmation:</strong> replacing or unassigning
        a carer on a batch child still sends individual carer communications where selected, but
        does not send an immediate child-level centre email. The batch may show{" "}
        <strong>Updates required</strong> until all active shifts are filled again, then{" "}
        <strong>Ready to send updates</strong> when Ops can send the consolidated centre update.
        See{" "}
        <HelpArticleLink slug="fill-complete-and-update-a-batch-request">
          Fill, Complete &amp; Update a Batch Request
        </HelpArticleLink>
        .
      </p>
      <p>
        In the batch workspace, filled shifts do not show a Replace action — use{" "}
        <strong>Open Shift</strong> on the individual shift page, or unassign first.
      </p>

      <h2>Resend an assignment confirmation</h2>
      <p>
        If a filled shift needs another copy of the assignment confirmation, open{" "}
        <strong>Manage assignment</strong> and select <strong>Resend confirmation</strong>. This
        is available only when the shift is <strong>Filled</strong>.
      </p>
      <p>
        Confirm <strong>Send confirmation communication?</strong>, then choose{" "}
        <strong>Centre</strong> and/or <strong>Carer</strong> under <strong>Choose recipients</strong>.
        When <strong>Centre</strong> is selected on an individual shift, Ops reviews the Centre
        email in <strong>Review Centre Email</strong> before it is sent. Subject and Message may be
        customised; the recipient and system-generated shift details remain locked. Carer-only
        resend is unchanged. Resending does not change assignment state — it sends another copy of
        the confirmation.
      </p>
      <p>
        On batch child shifts, only the carer can be selected. Centre resend is deferred with the
        message <strong>Centre communication is managed through this Batch Request.</strong>
      </p>

      <h2>Shift Notes and documents</h2>
      <p>
        Current Shift Notes may appear in assignment confirmation emails. Where applicable, centre
        confirmation emails may include secure links to the assigned carer&apos;s approved
        documents. See{" "}
        <HelpArticleLink slug="communications-notes-and-important-terminology">
          Communications, Notes &amp; Important Terminology
        </HelpArticleLink>{" "}
        for terminology and note types.
      </p>

      <h2>What happens next</h2>
      <p>
        If shift details need to change after assignment, see{" "}
        <HelpArticleLink slug="edit-or-cancel-a-shift">Edit or Cancel a Shift</HelpArticleLink>.
        For batch-level centre updates after confirmed batches, see{" "}
        <HelpArticleLink slug="fill-complete-and-update-a-batch-request">
          Fill, Complete &amp; Update a Batch Request
        </HelpArticleLink>
        .
      </p>
    </HelpArticleProse>
  );
}
