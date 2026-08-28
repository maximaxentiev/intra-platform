import intraLogoPurple from "@/assets/intra-logo-purple.png";
import { cn } from "@/lib/utils";

type IntraAuthLogoProps = {
  className?: string;
  size?: "xs" | "sm" | "nav" | "md" | "lg";
};

const sizeClass = {
  xs: "h-8 w-8",
  sm: "h-9 w-9",
  nav: "h-10 w-10",
  md: "h-20 w-20",
  lg: "h-24 w-24 sm:h-28 sm:w-28",
} as const;

const sizePixels = {
  xs: 32,
  sm: 36,
  nav: 40,
  md: 80,
  lg: 112,
} as const;

/** Official purple Intra logo for authentication and app chrome. */
export function IntraAuthLogo({ className, size = "md" }: IntraAuthLogoProps) {
  return (
    <img
      src={intraLogoPurple}
      alt="Intra"
      width={sizePixels[size]}
      height={sizePixels[size]}
      className={cn("shrink-0 bg-transparent object-contain", sizeClass[size], className)}
    />
  );
}

export { intraLogoPurple as INTRA_LOGO_PURPLE_ASSET };
