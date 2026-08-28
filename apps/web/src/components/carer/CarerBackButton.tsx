import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

type CarerBackButtonProps = {
  to: "/carer" | "/carer/shifts";
  label: "Back to portal" | "Back to shifts";
};

export function CarerBackButton({ to, label }: CarerBackButtonProps) {
  return (
    <Button asChild variant="outline" className="h-11 min-h-11 gap-1.5 px-4 font-medium">
      <Link to={to}>
        <ArrowLeft aria-hidden="true" className="h-4 w-4" />
        {label}
      </Link>
    </Button>
  );
}
