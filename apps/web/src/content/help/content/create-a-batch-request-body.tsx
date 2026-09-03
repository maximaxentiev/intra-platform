import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { HelpArticleProse } from "@/components/help/HelpArticleProse";
import { HelpCallout } from "@/components/help/HelpCallout";
import { HelpScreenshot } from "@/components/help/HelpScreenshot";

/**
 * Screenshot assets (add when available):
 * - /help/create-a-batch-request/create-batch.png
 * - /help/create-a-batch-request/notes.png
 */
const SCREENSHOTS = {
  createBatch: undefined as string | undefined,
  notes: undefined as string | undefined,
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

export function CreateABatchRequestBody() {
  return (
    <HelpArticleProse>
      <p>
        Use this guide when a centre has requested multiple shifts at once. You will choose one
        centre, enter each shift as a draft row, and create a batch request that becomes the
        workspace for filling those shifts.
      </p>

      <h2>When to use a Batch Request</h2>
      <p>
        Select <strong>Create Batch</strong> when entering multiple shifts requested by the{" "}
        <strong>same</strong> centre. Use <strong>Create Shift</strong> for a single shift only.
        A batch request always belongs to one centre — it cannot combine multiple centres.
      </p>
      <p>
        See{" "}
        <HelpArticleLink slug="create-an-individual-shift">Create an Individual Shift</HelpArticleLink>{" "}
        for one-off entry.
      </p>

      <h2>Before you begin</h2>
      <p>
        Have the centre&apos;s request details ready: centre name, dates, start and end times,
        required roles, Staffpoint status where applicable, shift-specific notes, and any Ops-only
        comments that should be recorded internally.
      </p>

      <h2>Start a Batch Request</h2>
      <ol>
        <li>Open <strong>Shifts</strong> from the sidebar.</li>
        <li>Select <strong>Create Batch</strong>.</li>
        <li>
          On the <strong>Create Batch Request</strong> page, the form opens with two empty shift
          draft cards.
        </li>
      </ol>

      <h2>Choose the Centre</h2>
      <p>
        Select the centre once using the searchable <strong>Centre</strong> field. Every shift in
        the batch belongs to that centre. Verify the correct centre before entering many rows.
      </p>
      <p>
        If you change the centre after entering draft shifts, the platform asks you to confirm —
        draft rows are kept, but you should review them for the new centre.
      </p>

      <h2>Add the requested Shifts</h2>
      <p>
        Each card under <strong>Shift drafts</strong> represents one future shift. Required fields
        per row:
      </p>
      <ul>
        <li>
          <strong>Date</strong>, <strong>Start</strong>, <strong>End</strong>, <strong>Role</strong>
        </li>
      </ul>
      <p>
        Optional per row: <strong>Staffpoint</strong> (defaults to <strong>No</strong>) and{" "}
        <strong>Notes</strong>.
      </p>
      <p>
        Shifts are same-day — end time must be after start time. Role options are{" "}
        <strong>ECA</strong>, <strong>ECE</strong>, and <strong>RECE</strong>. Role determines
        which carers can be considered later — see{" "}
        <HelpArticleLink slug="understand-available-staff-and-priority">
          Understand Available Staff &amp; Priority
        </HelpArticleLink>
        .
      </p>

      <HelpScreenshot
        src={SCREENSHOTS.createBatch}
        alt="Create Batch Request page with Centre and multiple shift draft cards"
        caption="Enter each requested shift as a draft row under Shift drafts."
      />

      <p>
        <strong>Staffpoint</strong> is set per shift, not for the whole batch or centre. Each row
        can be Yes or No independently.
      </p>

      <h2>Duplicate a Shift</h2>
      <p>
        Select <strong>Duplicate</strong> on a row to copy it as a new draft immediately below.
        Duplicate copies date, start, end, role, Staffpoint, and Shift Notes. It does{" "}
        <strong>not</strong> copy Internal Comment — review and adjust the copied row before
        creating, especially the date and time.
      </p>

      <h2>Add or remove Shifts</h2>
      <p>
        Select <strong>Add shift</strong> to append a blank draft row. Select <strong>Remove</strong>{" "}
        on a row when more than one draft exists — the platform asks you to confirm before removing
        it from the draft.
      </p>
      <p>
        <strong>One shift remaining:</strong> a batch request is for multiple shifts. If removing
        drafts leaves only one row and a centre is selected, the platform opens{" "}
        <strong>Create shift</strong> with the remaining values prefilled — including Internal
        Comment if you entered one. If no centre is selected yet, the page simply keeps one draft
        row.
      </p>

      <h2>Shift Notes and Internal Comments</h2>
      <p>
        Select <strong>Add notes</strong> on a row to expand <strong>Shift Notes</strong> and{" "}
        <strong>Internal Comment</strong>. Select <strong>Hide notes</strong> to collapse the
        section.
      </p>

      <HelpScreenshot
        src={SCREENSHOTS.notes}
        alt="Expanded notes area showing Shift Notes and Internal Comment fields"
        caption="Expand Notes to enter Shift Notes and Internal Comment per shift."
      />

      <p>
        <strong>Shift Notes</strong> are shift-specific information that may later appear in carer
        and centre communications — for example room assignment, arrival instructions, or
        responsibilities for that day. Do not put Ops-only information here.
      </p>
      <p>
        <strong>Internal Comment</strong> is for Ops-only information. It is not sent to the centre
        or carer. See{" "}
        <HelpArticleLink slug="communications-notes-and-important-terminology">
          Communications, Notes &amp; Important Terminology
        </HelpArticleLink>
        .
      </p>

      <HelpCallout title="Important" variant="important">
        Keep Shift Notes and Internal Comments separate. External shift details belong in Shift
        Notes; Ops-only context belongs in Internal Comment.
      </HelpCallout>

      <h2>Create the Batch</h2>
      <ol>
        <li>Review the centre and every shift draft.</li>
        <li>Fix any highlighted validation errors.</li>
        <li>Select <strong>Create Batch Request</strong>.</li>
      </ol>
      <p>
        The batch is created only after all shift entries pass validation. Invalid rows are
        highlighted before submission.
      </p>
      <p>
        Creating the batch request does not send assignment or centre confirmation emails.
        Communications happen later when carers are assigned or when the batch is completed.
      </p>
      <p>
        On success, you are taken to the batch workspace. The batch starts in <strong>Open</strong>{" "}
        status — it has been created and still needs to be filled.
      </p>

      <h2>What happens next</h2>
      <p>After creation:</p>
      <ul>
        <li>The batch workspace opens with each child shift listed</li>
        <li>Expand a shift to review Available staff, mark carers Contacted, and assign</li>
        <li>Batch progress updates automatically as shifts are filled</li>
        <li>
          While the batch is still open and not centre-confirmed, you can add more shifts using{" "}
          <strong>Add shifts</strong> from the batch workspace
        </li>
      </ul>
      <p>
        Once a batch has been completed and confirmed to the centre, new shifts cannot be added to
        that batch.
      </p>
      <p>
        Continue with{" "}
        <HelpArticleLink slug="fill-complete-and-update-a-batch-request">
          Fill, Complete &amp; Update a Batch Request
        </HelpArticleLink>
        . For matching, see{" "}
        <HelpArticleLink slug="understand-available-staff-and-priority">
          Understand Available Staff &amp; Priority
        </HelpArticleLink>
        .
      </p>
    </HelpArticleProse>
  );
}
