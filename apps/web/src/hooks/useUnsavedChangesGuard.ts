import { useEffect, useRef } from "react";
import { useBlocker } from "@tanstack/react-router";

/** Warn on dirty form navigation and browser unload. */
export function useUnsavedChangesGuard(isDirty: boolean, enabled = true) {
  const allowNextNavigation = useRef(false);

  useEffect(() => {
    if (!enabled || !isDirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (allowNextNavigation.current) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [enabled, isDirty]);

  const blocker = useBlocker({
    shouldBlockFn: () => enabled && isDirty && !allowNextNavigation.current,
    withResolver: true,
    enableBeforeUnload: enabled && isDirty,
  });

  function allowNavigationOnce() {
    allowNextNavigation.current = true;
    window.setTimeout(() => {
      allowNextNavigation.current = false;
    }, 0);
  }

  return { blocker, allowNavigationOnce };
}
