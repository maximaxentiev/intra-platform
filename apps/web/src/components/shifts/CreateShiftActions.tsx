import { Link } from "@tanstack/react-router";
import { ChevronDown, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function CreateShiftActions({ size = "default" }: { size?: "default" | "sm" }) {
  return (
    <div className="flex items-stretch">
      <Button asChild size={size} className="rounded-r-none">
        <Link to="/shifts/new">
          <Plus className="h-4 w-4 mr-1.5" aria-hidden />
          Create Individual Shift
        </Link>
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            size={size}
            className="rounded-l-none border-l border-primary-foreground/20 px-2.5"
            aria-label="More create options"
          >
            <ChevronDown className="h-4 w-4" aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <Link to="/shifts/batches/new">Create Batch Request</Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
