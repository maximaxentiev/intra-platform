import intraLogoPurple from "@/assets/intra-logo-purple.png";
import { cn } from "@/lib/utils";

type IntraAuthLogoProps = {
  className?: string;
  size?: "md" | "lg";
};

const sizeClass = {
  md: "h-20 w-20",
  lg: "h-24 w-24 sm:h-28 sm:w-28",
} as const;

/** Official purple Intra logo for authentication surfaces. */
export function IntraAuthLogo({ className, size = "md" }: IntraAuthLogoProps) {
  return (
    <img
      src={intraLogoPurple}
      alt="Intra"
      width={112}
      height={112}
      className={cn("object-contain", sizeClass[size], className)}
    />
  );
}

export { intraLogoPurple as INTRA_LOGO_PURPLE_ASSET };
