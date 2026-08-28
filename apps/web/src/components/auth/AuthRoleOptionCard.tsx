import { Link } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

type AuthRoleOptionCardProps = {
  to: string;
  icon: LucideIcon;
  title: string;
  description: string;
};

const cardSurfaceClass =
  "group flex min-h-[7.5rem] items-center gap-5 rounded-2xl border border-border/70 bg-card p-6 text-left shadow-sm transition-[colors,box-shadow,border-color] duration-200 hover:border-primary hover:bg-primary hover:text-primary-foreground hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:border-primary focus-visible:bg-primary focus-visible:text-primary-foreground active:bg-primary active:text-primary-foreground";

const iconSurfaceClass =
  "grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary transition-colors duration-200 group-hover:bg-primary-foreground/15 group-hover:text-primary-foreground group-focus-visible:bg-primary-foreground/15 group-focus-visible:text-primary-foreground group-active:bg-primary-foreground/15 group-active:text-primary-foreground";

const descriptionClass =
  "mt-1 text-sm text-muted-foreground transition-colors duration-200 group-hover:text-primary-foreground/85 group-focus-visible:text-primary-foreground/85 group-active:text-primary-foreground/85";

export function AuthRoleOptionCard({ to, icon: Icon, title, description }: AuthRoleOptionCardProps) {
  return (
    <Link to={to} className={cardSurfaceClass}>
      <div className={iconSurfaceClass}>
        <Icon className="h-7 w-7" aria-hidden />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-xl font-semibold leading-tight">{title}</div>
        <div className={descriptionClass}>{description}</div>
      </div>
      <ArrowRight
        className={cn(
          "h-6 w-6 shrink-0 text-muted-foreground transition-[color,transform] duration-200",
          "group-hover:translate-x-0.5 group-hover:text-primary-foreground",
          "group-focus-visible:translate-x-0.5 group-focus-visible:text-primary-foreground",
          "group-active:translate-x-0.5 group-active:text-primary-foreground",
        )}
        aria-hidden
      />
    </Link>
  );
}
