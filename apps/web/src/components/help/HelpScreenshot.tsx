import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type HelpScreenshotProps = {
  src: string;
  alt: string;
  caption?: string;
  className?: string;
};

export function HelpScreenshot({ src, alt, caption, className }: HelpScreenshotProps) {
  const [enlarged, setEnlarged] = useState(false);

  return (
    <figure className={cn("not-prose my-6", className)}>
      <button
        type="button"
        onClick={() => setEnlarged(true)}
        className="block w-full overflow-hidden rounded-lg border border-border/70 bg-muted/20 text-left transition hover:border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        aria-label={`Enlarge screenshot: ${alt}`}
      >
        <img
          src={src}
          alt={alt}
          className="max-h-[420px] w-full object-contain object-left"
          loading="lazy"
        />
      </button>
      {caption ? (
        <figcaption className="mt-2 text-xs text-muted-foreground">{caption}</figcaption>
      ) : null}

      <Dialog open={enlarged} onOpenChange={setEnlarged}>
        <DialogContent className="max-w-4xl p-2 sm:p-3">
          <DialogTitle className="sr-only">{alt}</DialogTitle>
          <DialogDescription className="sr-only">Enlarged screenshot preview</DialogDescription>
          <img src={src} alt={alt} className="max-h-[80vh] w-full object-contain" />
          {caption ? <p className="px-1 pb-1 text-xs text-muted-foreground">{caption}</p> : null}
        </DialogContent>
      </Dialog>
    </figure>
  );
}
