import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { HelpArticleProse } from "@/components/help/HelpArticleProse";
import { HelpBeforeYouContinueCallout } from "@/components/help/HelpBeforeYouContinueCallout";
import { HelpCallout } from "@/components/help/HelpCallout";
import { HelpScreenshot } from "@/components/help/HelpScreenshot";

/**
 * Screenshot assets (add when available):
 * - /help/manage-centres/centre-detail.png — Centre profile with tabs
 * - /help/manage-centres/contacts.png — Contacts section
 * - /help/manage-centres/staff-preferences.png — Top staff and Banned staff
 */
const SCREENSHOTS = {
  centreDetail: undefined as string | undefined,
  contacts: undefined as string | undefined,
  staffPreferences: undefined as string | undefined,
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

export function ManageCentresBody() {
  return (
    <HelpArticleProse>
      <p>
        Centres are the locations you staff through Intra. This guide covers finding and creating
        centres, updating details and contacts, and maintaining staff preferences for each centre.
      </p>

      <h2>Find a Centre</h2>
      <ol>
        <li>Open <strong>Centres</strong> from the sidebar.</li>
        <li>
          Use <strong>Search</strong> to filter the list by centre name. Results update as you
          type.
        </li>
        <li>Select a centre from the table or card list to open its profile.</li>
      </ol>
      <p>
        Each centre profile has three tabs: <strong>Details</strong> (centre information and
        contacts), <strong>Staff preferences</strong> (Top and Banned staff), and{" "}
        <strong>Shifts</strong> (shift history for that centre).
      </p>

      <HelpScreenshot
        src={SCREENSHOTS.centreDetail}
        alt="Centre profile showing Details, Staff preferences, and Shifts tabs"
        caption="The centre profile is organised into Details, Staff preferences, and Shifts."
      />

      <h2>Create a new Centre</h2>
      <ol>
        <li>
          From <strong>Centres</strong>, select <strong>Add centre</strong>.
        </li>
        <li>
          Complete the form:
          <ul>
            <li>
              <strong>Centre name</strong> (required)
            </li>
            <li>
              <strong>Address</strong> and <strong>City</strong>
            </li>
            <li>
              <strong>Primary communication channel</strong> — WhatsApp, GoTo, or Email
            </li>
            <li>
              <strong>Secondary communication channels</strong> — optional additional channels
            </li>
            <li>
              <strong>Rules, Policies, and Other Notes</strong> — centre-specific information for
              staff (see below)
            </li>
          </ul>
        </li>
        <li>
          Select <strong>Create centre</strong>. You are taken to the new centre&apos;s{" "}
          <strong>Staff preferences</strong> tab.
        </li>
        <li>
          Return to the <strong>Details</strong> tab to add contacts. New centres do not include
          contacts until you add them.
        </li>
      </ol>

      <h2>Edit Centre details</h2>
      <p>
        On the centre&apos;s <strong>Details</strong> tab, the <strong>Centre Details</strong>{" "}
        card shows the current record in read-only form.
      </p>
      <ol>
        <li>Select <strong>Edit details</strong>.</li>
        <li>
          Update any of the same fields available when creating a centre: name, address, city,
          communication channels, and rules/notes.
        </li>
        <li>
          Select <strong>Save changes</strong>, or <strong>Cancel</strong> to discard.
        </li>
      </ol>
      <p>
        Saved changes appear immediately in the read view under <strong>Rules &amp; notes</strong>{" "}
        when notes are present.
      </p>

      <h2>Rules, policies, and notes</h2>
      <p>
        The <strong>Rules, Policies, and Other Notes</strong> field stores centre-specific
        information that assigned carers should see — for example parking, entry instructions, age
        groups, or local expectations. This is not the same as{" "}
        <HelpArticleLink slug="communications-notes-and-important-terminology">
          Shift Notes or Internal Comments
        </HelpArticleLink>
        , which belong to individual shifts.
      </p>
      <p>
        If no notes are recorded, assigned carers see nothing extra for that centre. Keep this field
        current when a centre&apos;s on-site requirements change.
      </p>

      <h2>Manage Centre contacts</h2>
      <p>
        The <strong>Contacts</strong> section on the <strong>Details</strong> tab lists people
        associated with the centre.
      </p>

      <HelpScreenshot
        src={SCREENSHOTS.contacts}
        alt="Centre Contacts section with primary contact badge"
        caption="The first contact in the list is the primary contact."
      />

      <h3>Add a contact</h3>
      <ol>
        <li>Select <strong>Add contact</strong>.</li>
        <li>
          Enter at least one of: name, role/title, email, or phone.
        </li>
        <li>
          Select <strong>Save contact</strong>, or <strong>Discard</strong> to cancel.
        </li>
      </ol>

      <h3>Edit or remove a contact</h3>
      <ul>
        <li>
          Select the pencil icon on a contact to expand edit fields. Changes save automatically
          when you leave each field.
        </li>
        <li>
          Use the up and down arrows to change contact order.
        </li>
        <li>
          Select the trash icon to remove a contact. You must confirm removal in the dialog.
        </li>
      </ul>

      <h3>Primary contact</h3>
      <p>
        The contact at the top of the list is the <strong>Primary</strong> contact. There is no
        separate &ldquo;set primary&rdquo; action — reorder contacts to change who is primary. If
        you remove the primary contact, the next contact in the list becomes primary.
      </p>

      <HelpCallout title="Important" variant="important">
        Make sure the primary contact has a valid email address when one is needed. Centre
        confirmations, batch completion, shift cancellations, and other operational communications
        may use the primary contact&apos;s email. Some actions are blocked or warned when no valid
        email is configured.
      </HelpCallout>

      <h2>Staffpoint</h2>
      <p>
        Staffpoint is not configured on the Centre profile. It is set per shift when you create or
        edit a shift (whether the shift has also been posted to Staffpoint, the external staffing
        marketplace). See{" "}
        <HelpArticleLink slug="create-an-individual-shift">Create an Individual Shift</HelpArticleLink>{" "}
        for shift-level Staffpoint.
      </p>

      <h2>Add or remove Top staff</h2>
      <p>
        On the <strong>Staff preferences</strong> tab, the <strong>Top staff</strong> section lists
        carers preferred for shifts at this centre. Top staff are prioritised when matching shifts
        here, but Top does not bypass hard eligibility requirements such as availability,
        documents, or bans.
      </p>
      <ol>
        <li>Open the centre and select the <strong>Staff preferences</strong> tab.</li>
        <li>
          Under <strong>Top staff</strong>, select <strong>Add staff</strong>.
        </li>
        <li>Search for and select a staff member to add them to the list.</li>
        <li>
          To remove someone, select the <strong>X</strong> beside their name.
        </li>
      </ol>
      <p>
        For how priority affects matching results, see{" "}
        <HelpArticleLink slug="understand-available-staff-and-priority">
          Understand Available Staff &amp; Priority
        </HelpArticleLink>
        .
      </p>

      <HelpScreenshot
        src={SCREENSHOTS.staffPreferences}
        alt="Staff preferences tab showing Top staff and Banned staff sections"
        caption="Top staff and Banned staff are managed separately on the Staff preferences tab."
      />

      <h2>Ban or unban a staff member</h2>
      <p>
        The <strong>Banned staff</strong> section on the same tab lists carers who must not be
        matched to shifts at this centre. Banning is a hard exclusion — very different from simply
        not being on the Top staff list.
      </p>
      <ol>
        <li>
          Under <strong>Banned staff</strong>, select <strong>Add staff</strong> and choose the
          staff member.
        </li>
        <li>
          To unban, select the <strong>X</strong> beside their name.
        </li>
      </ol>

      <HelpCallout title="Important" variant="important">
        A staff member cannot appear on both Top staff and Banned staff for the same centre. Adding
        someone to one list removes them from the other.
      </HelpCallout>

      <h2>View a Centre&apos;s Shifts</h2>
      <ol>
        <li>Open the centre profile.</li>
        <li>Select the <strong>Shifts</strong> tab.</li>
        <li>
          Review shifts for this centre — date, time, role, assigned staff, and status. Past
          shifts appear slightly muted.
        </li>
        <li>Select a shift row to open its full shift details.</li>
      </ol>
      <p>
        For creating or assigning shifts, see{" "}
        <HelpArticleLink slug="create-an-individual-shift">Create an Individual Shift</HelpArticleLink>{" "}
        and related shift guides.
      </p>

      <h2>Delete a Centre</h2>
      <p>
        Deleting a centre is rare and should not replace correcting details or updating contacts.
      </p>
      <ol>
        <li>
          Open the centre profile and select the <strong>More centre actions</strong> menu (⋯).
        </li>
        <li>Select <strong>Delete centre</strong>.</li>
        <li>Read the confirmation dialog and select <strong>Delete centre</strong> to proceed.</li>
      </ol>
      <p>
        Deletion permanently removes the centre, its contacts, and its Top/Banned staff lists.
        Deletion is blocked while shifts still reference the centre.
      </p>

      <HelpBeforeYouContinueCallout title="Before you continue">
        Only delete a centre when it should no longer exist in Intra. Prefer editing the profile or
        updating contacts for day-to-day corrections.
      </HelpBeforeYouContinueCallout>
    </HelpArticleProse>
  );
}
