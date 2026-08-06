import { createFileRoute, redirect } from "@tanstack/react-router";
import { carerAuthApi } from "@/lib/carer";
import { CarerShell } from "@/components/carer/CarerShell";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/carer/onboarding")({
  ssr: false,
  beforeLoad: async () => {
    let session;
    try {
      session = await carerAuthApi.session();
    } catch {
      throw redirect({ to: "/carer/login", replace: true });
    }
    if (session.onboardingCompletedAt) {
      throw redirect({ to: "/carer", replace: true });
    }
    return { carer: session };
  },
  loader: ({ context }) => context.carer,
  component: CarerOnboardingPage,
});

const STEPS = [
  { step: 1, title: "Your details", description: "Confirm your name, phone, and address." },
  { step: 2, title: "Documents", description: "Upload your certifications and clearances." },
  { step: 3, title: "Availability", description: "Tell us when you can work each week." },
];

function CarerOnboardingPage() {
  const carer = Route.useLoaderData();

  return (
    <CarerShell
      session={carer}
      title="Set up your account"
      subtitle="Three quick steps before you can be matched to shifts."
    >
      <div className="grid gap-3">
        {STEPS.map((s) => {
          const state =
            s.step < carer.onboardingStep
              ? "done"
              : s.step === carer.onboardingStep
                ? "current"
                : "todo";
          return (
            <Card
              key={s.step}
              className={state === "current" ? "border-primary/50 shadow-sm" : "opacity-80"}
            >
              <CardContent className="flex items-center gap-4 p-4">
                <div
                  className={`grid h-10 w-10 shrink-0 place-items-center rounded-full text-sm font-semibold ${
                    state === "todo"
                      ? "bg-muted text-muted-foreground"
                      : "bg-primary text-primary-foreground"
                  }`}
                >
                  {s.step}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium">{s.title}</div>
                  <div className="text-sm text-muted-foreground">{s.description}</div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </CarerShell>
  );
}
