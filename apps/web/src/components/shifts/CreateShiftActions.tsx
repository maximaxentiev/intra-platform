import { Link } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

export function CreateShiftActions({ size = "default" }: { size?: "default" | "sm" }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button asChild size={size}>
        <Link to="/shifts/new">
          <Plus className="h-4 w-4 mr-1.5" aria-hidden />
          Create Shift
        </Link>
      </Button>
      <Button asChild size={size} variant="secondary">
        <Link to="/shifts/batches/new">Create Batch</Link>
      </Button>
    </div>
  );
}
