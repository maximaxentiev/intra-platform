import { useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ApiError } from "@/lib/api";
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
import { CityCombobox, cityValueForSubmit } from "@/components/CityCombobox";
import { CarerOnboardingForwardButton } from "@/components/carer/CarerOnboardingForwardButton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";
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
  step1Complete = false,
}: {
  initial: PersonalProfileFields;
  onPersisted?: (values: PersonalProfileFields) => void;
  onStepComplete?: () => void;
  mode?: "onboarding" | "profile";
  /** When true, Continue returns to the next step without re-marking Step 1 complete. */
  step1Complete?: boolean;
}) {
  const [saved, setSaved] = useState(initial);
  const [values, setValues] = useState(initial);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof PersonalProfileFields, string>>>(
    {},
  );
  const [formError, setFormError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [continuing, setContinuing] = useState(false);
  const [autosavePending, setAutosavePending] = useState(false);
  const [autosaveFailed, setAutosaveFailed] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [nextConfirmOpen, setNextConfirmOpen] = useState(false);

  useEffect(() => {
    setSaved(initial);
    setValues(initial);
  }, [initial]);

  const isDirty = useMemo(() => personalProfileDirty(values, saved), [values, saved]);
  const { blocker, allowNavigationOnce } = useUnsavedChangesGuard(mode === "onboarding" ? false : isDirty);
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const persistGeneration = useRef(0);

  function clearAutosaveTimer() {
    if (autosaveTimer.current) {
      clearTimeout(autosaveTimer.current);
      autosaveTimer.current = null;
    }
  }

  function invalidateInFlightPersist() {
    persistGeneration.current += 1;
  }

  function setField<K extends keyof PersonalProfileFields>(key: K, v: string) {
    setValues((prev) => ({ ...prev, [key]: v }));
    setSavedAt(null);
    setFormError(null);
    setAutosaveFailed(false);
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  async function persist(showSuccessToast: boolean) {
    const trimmed = trimPersonalProfile(values);
    const errors = validatePersonalProfileFields(trimmed, saved.city);
    const city = cityValueForSubmit(trimmed.city, saved.city);
    if (!city) {
      errors.city = errors.city ?? "City must be selected from the supported city list.";
    }
    if (Object.keys(errors).length) {
      setFieldErrors(errors);
      throw new Error("Fix the highlighted fields.");
    }
    if (!city) {
      throw new Error("Fix the highlighted fields.");
    }
    const generation = ++persistGeneration.current;
    setLoading(true);
    try {
      const result = await carerProfileApi.save({ ...trimmed, city });
      if (generation !== persistGeneration.current) {
        return result;
      }
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
      setFormError(null);
      setAutosaveFailed(false);
      setSavedAt(
        new Date().toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }),
      );
      onPersisted?.(nextSaved);
      if (showSuccessToast) toast.success("Saved");
      return result;
    } finally {
      setLoading(false);
    }
  }

  function reportError(err: unknown, fallback: string) {
    const raw = err instanceof Error ? err.message : fallback;
    const isDuplicateEmailConflict =
      err instanceof ApiError &&
      err.status === 409 &&
      (/portal account/i.test(raw) || /staff member with this email/i.test(raw));
    const message = isDuplicateEmailConflict
      ? "That email address is already used by another account. Try a different one."
      : raw;
    setSavedAt(null);
    setAutosaveFailed(true);
    setFormError(message);
    toast.error(message);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    try {
      await persist(true);
    } catch (err) {
      reportError(err, "Could not save");
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
    invalidateInFlightPersist();
    clearAutosaveTimer();
    setValues(saved);
    setFieldErrors({});
    setFormError(null);
    setDiscardOpen(false);
  }

  useEffect(() => {
    if (mode !== "onboarding" || !isDirty) {
      setAutosavePending(false);
      return;
    }
    const trimmed = trimPersonalProfile(values);
    const errors = validatePersonalProfileFields(trimmed, saved.city);
    if (Object.keys(errors).length > 0) {
      setAutosavePending(false);
      return;
    }

    setAutosavePending(true);
    clearAutosaveTimer();
    autosaveTimer.current = setTimeout(() => {
      setAutosavePending(false);
      void persist(false).catch((err) => {
        reportError(err, "Could not save");
      });
    }, 1200);

    return () => {
      clearAutosaveTimer();
    };
  }, [values, saved.city, isDirty, mode]);

  async function handleOnboardingContinue() {
    if (continuing || loading || autosavePending) return;
    clearAutosaveTimer();
    setAutosavePending(false);
    const trimmed = trimPersonalProfile(values);
    const errors = validatePersonalProfileFields(trimmed, saved.city);
    if (Object.keys(errors).length) {
      setFieldErrors(errors);
      setFormError("Complete all required fields before continuing.");
      toast.error("Complete all required fields before continuing.");
      return;
    }
    setContinuing(true);
    try {
      await persist(false);
      await completeStep();
    } catch (err) {
      reportError(err, "Could not continue");
    } finally {
      setContinuing(false);
    }
  }

  async function handleNext() {
    if (mode === "onboarding") {
      await handleOnboardingContinue();
      return;
    }
    const trimmed = trimPersonalProfile(values);
    const errors = validatePersonalProfileFields(trimmed, saved.city);
    if (Object.keys(errors).length) {
      setFieldErrors(errors);
      setFormError("Complete all required fields before continuing.");
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
      reportError(err, "Could not continue");
    }
  }

  async function completeStep() {
    if (mode !== "onboarding") return;
    if (step1Complete) {
      allowNavigationOnce();
      onStepComplete?.();
      return;
    }
    try {
      await carerProfileApi.completeStep1();
      allowNavigationOnce();
      onStepComplete?.();
    } catch (err) {
      reportError(err, "Could not continue");
      throw err;
    }
  }

  const trimmedProfile = useMemo(() => trimPersonalProfile(values), [values]);
  const profileValidationErrors = useMemo(
    () => validatePersonalProfileFields(trimmedProfile, saved.city),
    [trimmedProfile, saved.city],
  );
  const profileValid = Object.keys(profileValidationErrors).length === 0;
  const hasUnsavedValidChanges = mode === "onboarding" && isDirty && profileValid;
  const onboardingSaving =
    mode === "onboarding" &&
    (continuing || loading || autosavePending || (hasUnsavedValidChanges && !autosaveFailed));
  const onboardingCanContinue =
    mode === "onboarding" &&
    profileValid &&
    !isDirty &&
    !loading &&
    !continuing &&
    !autosavePending &&
    !autosaveFailed;

  const errorCount = Object.keys(fieldErrors).length;

  return (
    <>
      <form onSubmit={handleSave} className="space-y-4 min-w-0 overflow-x-hidden">
        {mode === "onboarding" ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              id="legalFirstName"
              label="First name"
              autoComplete="given-name"
              value={values.legalFirstName}
              error={fieldErrors.legalFirstName}
              onChange={(v) => setField("legalFirstName", v)}
              inputClassName="bg-surface"
            />
            <Field
              id="legalLastName"
              label="Last name"
              autoComplete="family-name"
              value={values.legalLastName}
              error={fieldErrors.legalLastName}
              onChange={(v) => setField("legalLastName", v)}
              inputClassName="bg-surface"
            />
            <Field
              id="email"
              label="Email"
              type="email"
              inputMode="email"
              autoComplete="email"
              value={values.email}
              error={fieldErrors.email}
              onChange={(v) => setField("email", v)}
              inputClassName="bg-surface"
            />
            <Field
              id="phone"
              label="Phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={values.phone}
              error={fieldErrors.phone}
              onChange={(v) => setField("phone", v)}
              inputClassName="bg-surface"
            />
            <Field
              id="address"
              label="Address"
              autoComplete="street-address"
              className="sm:col-span-2"
              value={values.address}
              error={fieldErrors.address}
              onChange={(v) => setField("address", v)}
              inputClassName="bg-surface"
            />
            <CityCombobox
              id="city"
              label="City"
              value={values.city}
              onChange={(v) => setField("city", v)}
              error={fieldErrors.city}
              className="sm:col-span-2"
            />
          </div>
        ) : (
        <Card className="min-w-0">
          <CardHeader className="gap-1 pb-3">
            {isDirty ? (
              <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-foreground/50" />
                Unsaved changes
              </span>
            ) : null}
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                id="legalFirstName"
                label="First name"
                autoComplete="given-name"
                value={values.legalFirstName}
                error={fieldErrors.legalFirstName}
                onChange={(v) => setField("legalFirstName", v)}
              />
              <Field
                id="legalLastName"
                label="Last name"
                autoComplete="family-name"
                value={values.legalLastName}
                error={fieldErrors.legalLastName}
                onChange={(v) => setField("legalLastName", v)}
              />
              <Field
                id="email"
                label="Email"
                type="email"
                inputMode="email"
                autoComplete="email"
                value={values.email}
                error={fieldErrors.email}
                onChange={(v) => setField("email", v)}
              />
              <Field
                id="phone"
                label="Phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={values.phone}
                error={fieldErrors.phone}
                onChange={(v) => setField("phone", v)}
              />
              <Field
                id="address"
                label="Address"
                autoComplete="street-address"
                className="sm:col-span-2"
                value={values.address}
                error={fieldErrors.address}
                onChange={(v) => setField("address", v)}
              />
              <CityCombobox
                id="city"
                label="City"
                value={values.city}
                onChange={(v) => setField("city", v)}
                error={fieldErrors.city}
                className="sm:col-span-2"
              />
            </div>
          </CardContent>
        </Card>
        )}

        <div aria-live="polite" className="space-y-2">
          {errorCount > 0 ? (
            <p className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              <AlertCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                {errorCount === 1
                  ? "1 field needs attention before you can continue."
                  : `${errorCount} fields need attention before you can continue.`}
              </span>
            </p>
          ) : null}
          {formError ? (
            <p className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              <AlertCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
              <span className="min-w-0 break-words">{formError}</span>
            </p>
          ) : null}
          {!formError && savedAt && mode !== "onboarding" ? (
            <p className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-foreground">
              <CheckCircle2 aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span>Personal information saved at {savedAt}.</span>
            </p>
          ) : null}
        </div>

        <div className="flex justify-center pt-2">
          {mode === "onboarding" ? (
            <CarerOnboardingForwardButton
              label="Continue to step 2"
              saving={onboardingSaving}
              disabled={!onboardingCanContinue}
              onClick={() => void handleNext()}
            />
          ) : null}
          {mode !== "onboarding" ? (
            <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-center">
          <Button
            type="submit"
            variant={mode === "profile" ? "default" : "outline"}
            className="h-11 w-full sm:order-1 sm:w-auto"
            disabled={loading}
          >
            {loading ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : null}
            {loading ? "Saving…" : "Save"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="h-11 w-full text-muted-foreground sm:order-2 sm:w-auto"
            disabled={loading || !isDirty}
            onClick={handleDiscardRequest}
          >
            Discard changes
          </Button>
            </div>
          ) : null}
        </div>
      </form>

      <AlertDialog open={discardOpen} onOpenChange={setDiscardOpen}>
        <AlertDialogContent className="max-w-[min(28rem,calc(100vw-2rem))]">
          <AlertDialogHeader>
            <AlertDialogTitle>Discard unsaved changes?</AlertDialogTitle>
            <AlertDialogDescription>
              Your edits on this page will be cleared and your last saved details restored. Nothing
              else about your account changes.
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
        <AlertDialogContent className="max-w-[min(28rem,calc(100vw-2rem))]">
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
        <AlertDialogContent className="max-w-[min(28rem,calc(100vw-2rem))]">
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
  inputMode,
  hint,
  className,
  inputClassName,
}: {
  id: string;
  label: string;
  value: string;
  error?: string;
  onChange: (v: string) => void;
  type?: string;
  autoComplete?: string;
  inputMode?: "email" | "tel" | "text";
  hint?: string;
  className?: string;
  inputClassName?: string;
}) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={`space-y-1.5 min-w-0 ${className ?? ""}`}>
      <Label htmlFor={id} className="text-sm">
        {label}{" "}
        <span className="text-destructive" aria-hidden="true">
          *
        </span>
        <span className="sr-only">(required)</span>
      </Label>
      <Input
        id={id}
        type={type}
        inputMode={inputMode}
        autoComplete={autoComplete}
        className={cn("h-11 min-w-0 truncate", inputClassName)}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-required="true"
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy}
      />
      {hint ? (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="flex items-start gap-1.5 text-sm text-destructive">
          <AlertCircle aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span className="min-w-0 break-words">{error}</span>
        </p>
      ) : null}
    </div>
  );
}
