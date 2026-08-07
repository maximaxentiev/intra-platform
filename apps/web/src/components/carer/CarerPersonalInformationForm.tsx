import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { carerProfileApi } from "@/lib/carer";
import {
  personalProfileDirty,
  trimPersonalProfile,
  validatePersonalProfileFields,
  type PersonalProfileFields,
} from "@/lib/carer-personal-profile";
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export function CarerPersonalInformationForm({
  initial,
  onPersisted,
  onStepComplete,
  mode = "onboarding",
}: {
  initial: PersonalProfileFields;
  onPersisted?: (values: PersonalProfileFields) => void;
  onStepComplete?: () => void;
  mode?: "onboarding" | "profile";
}) {
  const [saved, setSaved] = useState(initial);
  const [values, setValues] = useState(initial);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof PersonalProfileFields, string>>>(
    {},
  );
  const [loading, setLoading] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [nextConfirmOpen, setNextConfirmOpen] = useState(false);

  useEffect(() => {
    setSaved(initial);
    setValues(initial);
  }, [initial]);

  const isDirty = useMemo(() => personalProfileDirty(values, saved), [values, saved]);
  const { blocker, allowNavigationOnce } = useUnsavedChangesGuard(isDirty);

  function setField<K extends keyof PersonalProfileFields>(key: K, v: string) {
    setValues((prev) => ({ ...prev, [key]: v }));
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  async function persist(showSuccessToast: boolean) {
    const trimmed = trimPersonalProfile(values);
    const errors = validatePersonalProfileFields(trimmed);
    if (Object.keys(errors).length) {
      setFieldErrors(errors);
      throw new Error("Fix the highlighted fields.");
    }
    setLoading(true);
    try {
      const result = await carerProfileApi.save(trimmed);
      const nextSaved: PersonalProfileFields = {
        legalFirstName: result.legalFirstName,
        legalLastName: result.legalLastName,
        email: result.email,
        phone: result.phone,
        address: result.address,
        city: result.city,
      };
      setSaved(nextSaved);
      setValues(nextSaved);
      onPersisted?.(nextSaved);
      if (showSuccessToast) toast.success("Saved");
      return result;
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    try {
      await persist(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save");
    }
  }

  function handleDiscardRequest() {
    if (!isDirty) {
      setValues(saved);
      return;
    }
    setDiscardOpen(true);
  }

  function confirmDiscard() {
    setValues(saved);
    setFieldErrors({});
    setDiscardOpen(false);
  }

  async function handleNext() {
    const trimmed = trimPersonalProfile(values);
    const errors = validatePersonalProfileFields(trimmed);
    if (Object.keys(errors).length) {
      setFieldErrors(errors);
      toast.error("Complete all required fields before continuing.");
      return;
    }
    if (isDirty) {
      setNextConfirmOpen(true);
      return;
    }
    await completeStep();
  }

  async function confirmNextWithSave() {
    setNextConfirmOpen(false);
    try {
      await persist(false);
      await completeStep();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not continue");
    }
  }

  async function completeStep() {
    if (mode !== "onboarding") return;
    setLoading(true);
    try {
      await carerProfileApi.completeStep1();
      allowNavigationOnce();
      onStepComplete?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not continue");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <form onSubmit={handleSave} className="space-y-4 min-w-0 overflow-x-hidden">
        <Field
          id="legalFirstName"
          label="Legal first name"
          value={values.legalFirstName}
          error={fieldErrors.legalFirstName}
          onChange={(v) => setField("legalFirstName", v)}
        />
        <Field
          id="legalLastName"
          label="Legal last name"
          value={values.legalLastName}
          error={fieldErrors.legalLastName}
          onChange={(v) => setField("legalLastName", v)}
        />
        <Field
          id="email"
          label="Email address"
          type="email"
          autoComplete="email"
          value={values.email}
          error={fieldErrors.email}
          onChange={(v) => setField("email", v)}
        />
        <Field
          id="phone"
          label="Phone number"
          type="tel"
          autoComplete="tel"
          value={values.phone}
          error={fieldErrors.phone}
          onChange={(v) => setField("phone", v)}
        />
        <Field
          id="address"
          label="Home address"
          autoComplete="street-address"
          value={values.address}
          error={fieldErrors.address}
          onChange={(v) => setField("address", v)}
        />
        <Field
          id="city"
          label="City"
          autoComplete="address-level2"
          value={values.city}
          error={fieldErrors.city}
          onChange={(v) => setField("city", v)}
        />

        <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:flex-wrap">
          <Button type="submit" className="h-11 w-full sm:w-auto" disabled={loading}>
            {loading ? "Saving…" : "Save"}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-11 w-full sm:w-auto"
            disabled={loading}
            onClick={handleDiscardRequest}
          >
            Discard
          </Button>
          {mode === "onboarding" ? (
            <Button
              type="button"
              className="h-11 w-full sm:w-auto sm:ml-auto"
              disabled={loading}
              onClick={() => void handleNext()}
            >
              Next
            </Button>
          ) : null}
        </div>
      </form>

      <AlertDialog open={discardOpen} onOpenChange={setDiscardOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard unsaved changes?</AlertDialogTitle>
            <AlertDialogDescription>
              Your edits will be lost and the last saved information will be restored.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-2 sm:flex-row">
            <AlertDialogCancel className="h-11">Keep editing</AlertDialogCancel>
            <AlertDialogAction className="h-11" onClick={confirmDiscard}>
              Discard
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={nextConfirmOpen} onOpenChange={setNextConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Save these changes and continue?</AlertDialogTitle>
            <AlertDialogDescription>
              We will save your personal information and take you to the next onboarding step.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-2 sm:flex-row">
            <AlertDialogCancel className="h-11">Stay on this step</AlertDialogCancel>
            <AlertDialogAction className="h-11" onClick={() => void confirmNextWithSave()}>
              Save and continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={blocker.status === "blocked"}
        onOpenChange={(open) => {
          if (!open) blocker.reset?.();
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave without saving?</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes to your personal information.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-2 sm:flex-row">
            <AlertDialogCancel className="h-11" onClick={() => blocker.reset?.()}>
              Keep editing
            </AlertDialogCancel>
            <AlertDialogAction
              className="h-11"
              onClick={() => {
                allowNavigationOnce();
                blocker.proceed?.();
              }}
            >
              Leave anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function Field({
  id,
  label,
  value,
  error,
  onChange,
  type = "text",
  autoComplete,
}: {
  id: string;
  label: string;
  value: string;
  error?: string;
  onChange: (v: string) => void;
  type?: string;
  autoComplete?: string;
}) {
  return (
    <div className="space-y-2 min-w-0">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={type}
        autoComplete={autoComplete}
        className="h-11 min-w-0 break-all"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={Boolean(error)}
      />
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
