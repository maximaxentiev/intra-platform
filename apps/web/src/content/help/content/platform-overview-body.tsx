import { HelpArticleProse } from "@/components/help/HelpArticleProse";
import { HelpBeforeYouContinueCallout } from "@/components/help/HelpBeforeYouContinueCallout";
import { HelpCallout } from "@/components/help/HelpCallout";
import { HelpScreenshot } from "@/components/help/HelpScreenshot";

/** Demo article exercising all Help presentation components. */
export function PlatformOverviewBody() {
  return (
    <HelpArticleProse>
      <p>
        Detailed instructions and screenshots for this topic are being prepared. This article
        demonstrates how future Help content will look in the platform.
      </p>

      <h2>When to use the platform</h2>
      <p>
        Use the Intra Ops Platform to manage centres, staff, shifts, and batch requests for daily
        scheduling operations.
      </p>

      <h2>Typical workflow</h2>
      <ol>
        <li>Review the Dashboard for items that need attention.</li>
        <li>Open Shifts or a Batch Request to fill pending work.</li>
        <li>Return to Help when you need step-by-step guidance.</li>
      </ol>

      <h2>Helpful areas</h2>
      <ul>
        <li>Centres and Staff for directory setup</li>
        <li>Individual Shifts for single-shift fulfillment</li>
        <li>Batch Requests for multi-shift centre confirmations</li>
      </ul>

      <HelpCallout title="Important" variant="important">
        Some actions send emails to centres or carers. Check the communications reference before
        confirming high-impact changes.
      </HelpCallout>

      <HelpBeforeYouContinueCallout title="Before you continue">
        Destructive actions such as cancellation or batch completion cannot be undone from Help.
        Always confirm recipients and reasons in the product dialogs.
      </HelpBeforeYouContinueCallout>

      <HelpCallout title="Tip" variant="info">
        Use Help search on the landing page to jump directly to assign, cancel, or document topics.
      </HelpCallout>

      <HelpScreenshot
        src="/help/placeholder-screenshot.svg"
        alt="Placeholder screenshot showing the Help article layout"
        caption="Example screenshot placement with caption support."
      />
    </HelpArticleProse>
  );
}
