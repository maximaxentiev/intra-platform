import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { CarerShell } from "@/components/carer/CarerShell";
import { CarerPersonalInformationForm } from "@/components/carer/CarerPersonalInformationForm";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { carerProfileApi } from "@/lib/carer";
import { personalProfileFromSession } from "@/lib/carer-personal-profile";
import { requireCarerSessionForPortal } from "@/lib/carer-route-guards";

export const Route = createFileRoute("/carer/profile")({
  ssr: false,
  beforeLoad: async () => {
    const carer = await requireCarerSessionForPortal();
    return { carer };
  },
  component: CarerProfilePage,
});

function CarerProfilePage() {
  const { carer } = Route.useRouteContext();

  const profile = useQuery({
    queryKey: ["carer-profile"],
    queryFn: () => carerProfileApi.get(),
    initialData: {
      ...personalProfileFromSession(carer),
      profileCompletedAt: carer.profileCompletedAt,
      onboardingStep: carer.onboardingStep,
      onboardingCompletedAt: carer.onboardingCompletedAt,
    },
  });

  if (profile.isLoading && !profile.data) {
    return (
      <CarerShell session={carer} title="Personal information">
        <Skeleton className="h-40 w-full" />
      </CarerShell>
    );
  }

  const initial = personalProfileFromSession(profile.data);

  return (
    <CarerShell
      session={carer}
      title="Personal information"
      subtitle="Keep your contact and personal information up to date."
    >
      <div className="mb-4">
        <Button asChild variant="ghost" className="h-10 px-0 text-muted-foreground hover:text-foreground">
          <Link to="/carer">
            <ArrowLeft aria-hidden="true" className="mr-1.5 h-4 w-4" />
            Back to portal
          </Link>
        </Button>
      </div>
      <CarerPersonalInformationForm initial={initial} mode="profile" />
    </CarerShell>
  );
}
