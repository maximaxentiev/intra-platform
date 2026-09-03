import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { HelpArticleProse } from "@/components/help/HelpArticleProse";
import { HelpCallout } from "@/components/help/HelpCallout";
import { HelpScreenshot } from "@/components/help/HelpScreenshot";

/**
 * Screenshot assets (add when available):
 * - /help/review-and-approve-staff-documents/documents-tab.png
 * - /help/review-and-approve-staff-documents/approve-document.png
 */
const SCREENSHOTS = {
  documentsTab: undefined as string | undefined,
  approveDocument: undefined as string | undefined,
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

export function ReviewAndApproveStaffDocumentsBody() {
  return (
    <HelpArticleProse>
      <p>
        Staff documents affect whether a carer can be matched to shifts. This guide covers finding
        submissions that need review, approving valid documents, flagging issues, and understanding
        how document status affects eligibility.
      </p>

      <h2>Find documents that need review</h2>
      <p>Two common entry points:</p>
      <ol>
        <li>
          <strong>Staff list</strong> — open <strong>Staff</strong> and filter by{" "}
          <strong>Document status</strong> (for example <strong>Pending Review</strong>). Open a
          staff member from the results.
        </li>
        <li>
          <strong>Staff profile</strong> — open <strong>Staff</strong>, select a carer, and go to
          the <strong>Documents</strong> tab.
        </li>
      </ol>
      <p>
        At the top of the Documents tab, a summary shows whether the carer is{" "}
        <strong>Eligible for shift matching</strong> or <strong>Not eligible for shift matching</strong>,
        with reasons when they are blocked.
      </p>

      <HelpScreenshot
        src={SCREENSHOTS.documentsTab}
        alt="Staff Documents tab showing document categories and statuses"
        caption="Each document category shows its current status and a primary action such as Review or View."
      />

      <h2>Understand document statuses</h2>
      <p>Each document category row shows one of these statuses:</p>
      <ul>
        <li>
          <strong>Missing</strong> — no current submission on file
        </li>
        <li>
          <strong>Pending Review</strong> — files submitted and waiting for Ops review
        </li>
        <li>
          <strong>Issue Flagged</strong> — Ops flagged a problem; the carer needs to address it
        </li>
        <li>
          <strong>Approved</strong> — current submission accepted
        </li>
        <li>
          <strong>Expiring Soon</strong> — approved document with an expiry date within the
          platform&apos;s upcoming window (still current, but renewal is approaching)
        </li>
        <li>
          <strong>Expired</strong> — approved document past its expiry date
        </li>
      </ul>
      <p>
        The staff list <strong>Document status</strong> filter summarises required compliance
        documents (Vulnerable Sector Check, First Aid &amp; CPR, and Immunizations). Optional
        categories such as COVID-19 Vaccination and qualification documents are managed separately
        on the Documents tab.
      </p>

      <h2>Document categories</h2>
      <p>The Documents tab lists these categories:</p>
      <p>
        <strong>Compliance documents</strong>
      </p>
      <ul>
        <li>Vulnerable Sector Check</li>
        <li>First Aid &amp; CPR Certification</li>
        <li>Immunizations</li>
        <li>COVID-19 Vaccination (optional)</li>
      </ul>
      <p>
        <strong>Qualifications</strong>
      </p>
      <ul>
        <li>ECA Diploma</li>
        <li>ECE Diploma</li>
        <li>RECE Proof</li>
      </ul>
      <p>
        Required compliance documents must be submitted and approved for baseline shift matching.
        Qualification documents are optional on the profile but may be required for specific shifts
        or centres.
      </p>

      <h2>Review a submitted document</h2>
      <ol>
        <li>Open the staff profile and select the <strong>Documents</strong> tab.</li>
        <li>
          Find a category marked <strong>Pending Review</strong> or <strong>Review Issue</strong>{" "}
          and select <strong>Review</strong> (or <strong>Review Issue</strong> for flagged items).
        </li>
        <li>
          Review submission details — submitted date, processed/expiry dates where recorded, and
          the file list.
        </li>
        <li>
          Select <strong>View document</strong> (or <strong>Download</strong>) to open each file.
          Confirm the document belongs to the carer and is suitable to approve.
        </li>
        <li>
          Choose <strong>Approve</strong>, <strong>Flag an Issue</strong>, or <strong>Replace</strong>{" "}
          if files or dates need correction.
        </li>
      </ol>
      <p>
        Ops can also <strong>Upload</strong> or <strong>Replace</strong> documents from the category
        menu when a carer has not submitted files or a corrected submission is needed.
      </p>

      <h2>Approve a document</h2>
      <ol>
        <li>From the review panel, select <strong>Approve</strong>.</li>
        <li>
          Confirm in the dialog: <strong>Approve this document submission?</strong>
        </li>
        <li>Select <strong>Approve</strong> to accept the current submission.</li>
      </ol>
      <p>
        Approval marks the submission as accepted. For categories with expiry dates, confirm the
        dates shown in the review panel are correct before approving — especially{" "}
        <strong>Processed Date</strong> for Vulnerable Sector Check and <strong>Expiry Date</strong>{" "}
        for First Aid &amp; CPR.
      </p>

      <HelpCallout title="Important" variant="important">
        Approving a document can change whether the carer is eligible for shift matching. Verify the
        file and any processed or expiry dates before you approve.
      </HelpCallout>

      <HelpScreenshot
        src={SCREENSHOTS.approveDocument}
        alt="Document review panel with Approve and Flag an Issue actions"
        caption="Use Review to open files, then Approve or Flag an Issue."
      />

      <h2>Flag an issue</h2>
      <ol>
        <li>From the review panel, select <strong>Flag an Issue</strong>.</li>
        <li>
          Enter an <strong>Issue note</strong> describing what the carer needs to fix (required,
          up to 2,000 characters).
        </li>
        <li>Select <strong>Flag Issue</strong>.</li>
      </ol>
      <p>
        The submission is marked <strong>Issue Flagged</strong> and is not treated as approved. The
        issue note is visible on the current submission in Ops and in the carer portal so the carer
        can see what to correct. Flagging does not send an email by itself — follow up through your
        normal Ops process if needed.
      </p>
      <p>
        To submit a corrected version, the carer (or Ops via <strong>Replace</strong>) uploads new
        files. Replacing an approved document returns it to <strong>Pending Review</strong>.
      </p>

      <h2>Vulnerable Sector Check</h2>
      <p>
        When Ops uploads or replaces a Vulnerable Sector Check, a <strong>Processed Date</strong> is
        required. The platform calculates renewal from that date — one calendar year after the
        processed date — and displays <strong>Renewal due</strong> in the upload panel.
      </p>
      <p>
        You do not need to calculate the expiry manually. After approval, the category may show{" "}
        <strong>Expiring Soon</strong> as the renewal date approaches, or <strong>Expired</strong>{" "}
        once past due.
      </p>

      <h2>First Aid &amp; CPR</h2>
      <p>
        When Ops uploads or replaces First Aid &amp; CPR Certification, an <strong>Expiry Date</strong>{" "}
        is required. Enter the expiry shown on the certificate. The platform uses that date for{" "}
        <strong>Expiring Soon</strong> and <strong>Expired</strong> status and for expiry reminders
        where supported.
      </p>

      <h2>Immunizations</h2>
      <p>
        Immunizations require files but no processed or expiry date in the Ops upload form. Review
        the submission, then approve or flag an issue using the same review workflow. Immunizations
        still count toward required compliance for shift matching once approved.
      </p>

      <h2>COVID-19 Vaccination</h2>
      <p>
        COVID-19 Vaccination is <strong>optional</strong>. It appears on the Documents tab and can
        be reviewed and approved when submitted, but it is not required for baseline shift matching.
        When approved and on file, it may be included in shared document links (see below).
      </p>

      <h2>Qualification documents</h2>
      <p>
        ECA Diploma, ECE Diploma, and RECE Proof are optional qualification documents. They are not
        globally required for every carer, but they can affect eligibility for role- or
        centre-specific shifts.
      </p>
      <ul>
        <li>
          <strong>ECA Diploma</strong> — relevant for ECA role context
        </li>
        <li>
          <strong>ECE Diploma</strong> — relevant for ECE role context
        </li>
        <li>
          <strong>RECE Proof</strong> — proof of RECE registration; important when a centre or shift
          requires RECE qualification
        </li>
      </ul>
      <p>
        Staff profile roles are <strong>ECA</strong>, <strong>ECE</strong>, and <strong>Nanny</strong>{" "}
        — there is no separate &ldquo;RECE&rdquo; role. RECE Proof is a qualification document used
        when RECE registration must be verified for matching.
      </p>

      <h2>How documents affect Shift eligibility</h2>
      <p>
        The Documents tab summary shows whether the carer is eligible for shift matching. Common
        blockers include:
      </p>
      <ul>
        <li>Missing required compliance submission</li>
        <li>Document pending review</li>
        <li>Issue flagged on a required document</li>
        <li>Required document expired</li>
        <li>Centre qualification requirement not met</li>
        <li>RECE proof required for this centre</li>
      </ul>
      <p>
        <strong>Expiring Soon</strong> is different from <strong>Expired</strong>: an approved
        document that is expiring soon generally remains eligible for matching, but you should plan
        renewal before it expires.
      </p>
      <p>
        Qualification and RECE requirements apply when a specific shift or centre needs them — not
        for every assignment. For full matching behaviour, see{" "}
        <HelpArticleLink slug="understand-available-staff-and-priority">
          Understand Available Staff &amp; Priority
        </HelpArticleLink>{" "}
        and{" "}
        <HelpArticleLink slug="assign-replace-or-unassign-a-carer">
          Assign, Replace or Unassign a Carer
        </HelpArticleLink>
        .
      </p>

      <h2>Expiry reminders</h2>
      <p>
        For supported document types with expiry dates (such as Vulnerable Sector Check and First
        Aid &amp; CPR), the platform may schedule expiry reminders after approval. You do not need to
        manage reminder timing manually in Ops — focus on keeping dates accurate when uploading and
        approving.
      </p>

      <h2>Share documents</h2>
      <p>
        At the bottom of the Documents tab, <strong>Share documents</strong> lets Ops generate a
        secure link to the carer&apos;s current approved documents. Approved Vulnerable Sector
        Check, First Aid &amp; CPR, and Immunizations are included; COVID-19 Vaccination is included
        only when on file and approved.
      </p>
      <ul>
        <li>
          <strong>Generate share link</strong> — create a new link (copied to clipboard when
          available)
        </li>
        <li>
          <strong>Copy link</strong> — copy the active link again
        </li>
        <li>
          <strong>Rotate</strong> — invalidate the current link and create a new one
        </li>
        <li>
          <strong>Revoke</strong> — disable the link immediately
        </li>
      </ul>

      <HelpCallout title="Important" variant="important">
        Rotating or revoking a share link stops the previous link from working immediately. Confirm
        you are ready before rotating or revoking if someone may still be using the old link.
      </HelpCallout>

      <p>
        Where required, the platform may also include secure document links in centre confirmation
        communications. See{" "}
        <HelpArticleLink slug="communications-notes-and-important-terminology">
          Communications, Notes &amp; Important Terminology
        </HelpArticleLink>{" "}
        for communication behaviour.
      </p>
    </HelpArticleProse>
  );
}
