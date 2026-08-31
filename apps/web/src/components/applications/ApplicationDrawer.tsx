import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  CalendarCheck2,
  FileCheck2,
  Inbox,
  ThumbsDown,
  UserCheck,
  Loader2,
} from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ApplicationStatusBadge, Chips, Dash, FieldRow, YesNo } from "@/components/applications/primitives";
import { DocumentCard } from "@/components/applications/documents";
import {
  applicationsApi,
  asYesNo,
  fmtDate,
  fmtDateTime,
  fullName,
  label as toLabel,
  roleLabel,
  type ApplicationActivityEvent,
  type ApplicationDocument,
  type ApplicationRow,
} from "@/lib/applications";
import { cn } from "@/lib/utils";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-1">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
      <dl className="rounded-lg border border-border bg-card px-3">{children}</dl>
    </section>
  );
}

type TimelineItem = {
  id: string;
  kind: "received" | "interview" | "rejected" | "hired" | "other";
  title: string;
  at: string | null;
  detail?: string;
};

const TIMELINE_STYLE: Record<TimelineItem["kind"], { icon: any; cls: string }> = {
  received: { icon: Inbox, cls: "bg-info-soft text-info border-info/25" },
  interview: { icon: CalendarCheck2, cls: "bg-warning-soft text-warning border-warning/25" },
  rejected: { icon: ThumbsDown, cls: "bg-destructive/10 text-destructive border-destructive/25" },
  hired: { icon: UserCheck, cls: "bg-success-soft text-success border-success/25" },
  other: { icon: FileCheck2, cls: "bg-muted text-muted-foreground border-border" },
};

function kindFor(event: ApplicationActivityEvent): TimelineItem["kind"] {
  const t = `${event.eventType} ${event.toStatus ?? ""}`.toLowerCase();
  if (t.includes("hired")) return "hired";
  if (t.includes("reject")) return "rejected";
  if (t.includes("contacted") || t.includes("interview")) return "interview";
  if (t.includes("submit") || t.includes("received") || t.includes("created")) return "received";
  return "other";
}

function buildTimeline(row: ApplicationRow, events: ApplicationActivityEvent[]): TimelineItem[] {
  if (events.length) {
    return events.map((e) => ({
      id: e.id,
      kind: kindFor(e),
      title: toLabel(e.eventType),
      at: e.createdAt,
      detail:
        e.fromStatus || e.toStatus
          ? `${e.fromStatus ? toLabel(e.fromStatus) : "—"} → ${e.toStatus ? toLabel(e.toStatus) : "—"}`
          : undefined,
    }));
  }
  // Derived from the record's own timestamps — no activity is written by the UI.
  const derived: TimelineItem[] = [
    { id: "received", kind: "received", title: "Application received", at: row.submittedAt },
  ];
  if (row.workflow.contactedAt)
    derived.push({ id: "interview", kind: "interview", title: "Selected for interview", at: row.workflow.contactedAt });
  if (row.workflow.rejectedAt)
    derived.push({ id: "rejected", kind: "rejected", title: "Rejected", at: row.workflow.rejectedAt });
  if (row.workflow.hiredAt)
    derived.push({ id: "hired", kind: "hired", title: "Hired", at: row.workflow.hiredAt });
  return derived.filter((d) => d.at).sort((a, b) => (b.at ?? "").localeCompare(a.at ?? ""));
}

function Timeline({ items }: { items: TimelineItem[] }) {
  if (!items.length)
    return <p className="text-sm text-muted-foreground">No activity recorded yet.</p>;
  return (
    <ol className="relative space-y-4 pl-6">
      <span aria-hidden className="absolute left-[11px] top-2 bottom-2 w-px bg-border" />
      {items.map((it) => {
        const style = TIMELINE_STYLE[it.kind];
        const Icon = style.icon;
        return (
          <li key={it.id} className="relative">
            <span
              className={cn(
                "absolute -left-6 grid h-6 w-6 place-items-center rounded-full border",
                style.cls,
              )}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden />
            </span>
            <div className="text-sm font-medium">{it.title}</div>
            <div className="text-xs text-muted-foreground">
              {fmtDateTime(it.at)}
              {it.detail ? ` · ${it.detail}` : ""}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function ApplicationDrawer({
  row,
  open,
  onOpenChange,
  onOpenDoc,
}: {
  row: ApplicationRow | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onOpenDoc: (doc: ApplicationDocument) => void;
}) {
  const { data: events, isLoading: activityLoading } = useQuery({
    queryKey: ["application-activity", row?.id],
    queryFn: () => applicationsApi.activity(row!.id),
    enabled: open && !!row,
    staleTime: 60_000,
  });

  const timeline = useMemo(
    () => (row ? buildTimeline(row, events ?? []) : []),
    [row, events],
  );

  if (!row) return <Sheet open={open} onOpenChange={onOpenChange}><SheetContent /></Sheet>;

  const name = fullName(row);
  const isNanny = row.applicant.role === "nanny";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-2xl lg:max-w-3xl p-0 flex flex-col gap-0"
      >
        <header className="border-b border-border px-5 py-4 space-y-3">
          <div className="space-y-1 pr-8">
            <h2 className="text-lg font-semibold leading-tight">{name}</h2>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="rounded-md border border-border bg-muted/60 px-1.5 py-0.5 font-medium text-foreground/80">
                {roleLabel(row.applicant.role)}
              </span>
              <ApplicationStatusBadge status={row.status} />
              <span>Submitted {fmtDate(row.submittedAt)}</span>
            </div>
          </div>
        </header>

        <ScrollArea className="flex-1">
          <div className="space-y-5 px-5 py-5">
            <Section title="Applicant">
              <FieldRow label="Full name">{name}</FieldRow>
              <FieldRow label="Role">{roleLabel(row.applicant.role)}</FieldRow>
              <FieldRow label="Email">
                <a className="text-primary hover:underline" href={`mailto:${row.applicant.email}`}>
                  {row.applicant.email}
                </a>
              </FieldRow>
              <FieldRow label="Phone">
                <a className="text-primary hover:underline" href={`tel:${row.applicant.phone}`}>
                  {row.applicant.phone}
                </a>
              </FieldRow>
              <FieldRow label="Gender">{toLabel(row.applicant.gender)}</FieldRow>
            </Section>

            <Section title="Eligibility">
              <FieldRow label="GTA eligible">
                <YesNo value={row.eligibility.gtaEligible} />
              </FieldRow>
              <FieldRow label="Status in Canada">{toLabel(row.eligibility.statusInCanada)}</FieldRow>
            </Section>

            <Section title="Experience">
              <FieldRow label="Experience duration">{toLabel(row.experience.duration)}</FieldRow>
              <FieldRow label="Childcare experience">
                {row.experience.description?.trim() ? (
                  <span className="whitespace-pre-wrap break-words">{row.experience.description}</span>
                ) : (
                  <span className="text-muted-foreground">Not provided</span>
                )}
              </FieldRow>
              {isNanny && (
                <FieldRow label="Experience types">
                  <Chips values={row.experience.nannyExperienceTypes.map(toLabel)} max={6} />
                </FieldRow>
              )}
            </Section>

            {(isNanny || row.roleSpecific.qualificationStatus?.trim()) ? (
              <Section title={isNanny ? "Training" : "Qualifications"}>
                {isNanny ? (
                  <>
                    <FieldRow label="Training completed">
                      <YesNo value={row.roleSpecific.nannyTrainingCompleted} />
                    </FieldRow>
                    <FieldRow label="Training description">
                      {row.roleSpecific.nannyTrainingDescription || <Dash />}
                    </FieldRow>
                  </>
                ) : (
                  <FieldRow label="Qualification status">
                    {toLabel(row.roleSpecific.qualificationStatus)}
                  </FieldRow>
                )}
              </Section>
            ) : null}

            <Section title="Compliance">
              <FieldRow label="Vulnerable sector check">
                <YesNo value={asYesNo(row.compliance.vscStatus)} unknownLabel={toLabel(row.compliance.vscStatus)} />
              </FieldRow>
              <FieldRow label="VSC date">{fmtDate(row.compliance.vscIssueOrRequestDate)}</FieldRow>
              <FieldRow label="First aid & CPR">
                <YesNo
                  value={asYesNo(row.compliance.firstAidCprStatus)}
                  unknownLabel={toLabel(row.compliance.firstAidCprStatus)}
                />
              </FieldRow>
              <FieldRow label="CPR expiry">{fmtDate(row.compliance.firstAidCprExpiry)}</FieldRow>
              <FieldRow label="Immunizations">
                <YesNo
                  value={asYesNo(row.compliance.immunizationStatus)}
                  unknownLabel={toLabel(row.compliance.immunizationStatus)}
                />
              </FieldRow>
              <FieldRow label="COVID-19 vaccination">
                <YesNo
                  value={asYesNo(row.compliance.covidVaccinationStatus)}
                  unknownLabel={toLabel(row.compliance.covidVaccinationStatus) || "Not provided"}
                />
              </FieldRow>
            </Section>

            <section className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Documents
              </h3>
              {row.documents.length ? (
                <div className="grid gap-2">
                  {row.documents.map((d) => (
                    <DocumentCard key={d.id} doc={d} onOpen={onOpenDoc} />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No documents uploaded.</p>
              )}
            </section>

            <Section title="Languages">
              <FieldRow label="English proficiency">
                {toLabel(row.languages.englishProficiency)}
              </FieldRow>
              <FieldRow label="Additional languages">
                {row.languages.additionalLanguages.length ? (
                  <div className="space-y-1">
                    {row.languages.additionalLanguages.map((l) => (
                      <div key={`${l.language}-${l.proficiency}`}>
                        {toLabel(l.language)}
                        {l.proficiency ? (
                          <span className="text-muted-foreground"> · {toLabel(l.proficiency)}</span>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : (
                  <Dash />
                )}
              </FieldRow>
            </Section>

            <Section title="Application information">
              <FieldRow label="Submitted">{fmtDateTime(row.metadata.submittedAt)}</FieldRow>
              <FieldRow label="Source page">{row.metadata.sourcePage || <Dash />}</FieldRow>
              <FieldRow label="Source URL">
                {row.metadata.sourceUrl ? (
                  <span className="break-all text-xs">{row.metadata.sourceUrl}</span>
                ) : (
                  <Dash />
                )}
              </FieldRow>
              <FieldRow label="Form ID">
                <span className="text-xs font-mono">{row.metadata.formId || "—"}</span>
              </FieldRow>
              <FieldRow label="Consent">
                <YesNo value={row.metadata.consentAccepted} />
                {row.metadata.consentPolicyVersion ? (
                  <span className="ml-2 text-xs text-muted-foreground">
                    v{row.metadata.consentPolicyVersion}
                  </span>
                ) : null}
              </FieldRow>
              <FieldRow label="Consent accepted">{fmtDateTime(row.metadata.consentAcceptedAt)}</FieldRow>
              <FieldRow label="Application ID">
                <span className="text-xs font-mono break-all">{row.id}</span>
              </FieldRow>
            </Section>

            <section className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Activity
              </h3>
              {activityLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading activity…
                </div>
              ) : (
                <Timeline items={timeline} />
              )}
              <Separator />
              <p className="text-[11px] text-muted-foreground">
                Activity is read-only in this phase; workflow events are written by the backend.
              </p>
            </section>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
