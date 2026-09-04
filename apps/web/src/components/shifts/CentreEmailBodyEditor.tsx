import { Lock } from "lucide-react";
import { useId } from "react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { CentreEmailBodySegment } from "@/lib/centre-email-review";

const SECURE_DOC_MARKER_PREFIX = "[[INTRA_SECURE_DOC:";
const SECURE_DOC_MARKER_SUFFIX = "]]";

export function serializeCentreEmailBodySegments(segments: CentreEmailBodySegment[]): string {
  return segments
    .map((segment) =>
      segment.type === "text"
        ? segment.content
        : `${SECURE_DOC_MARKER_PREFIX}${segment.staffId}${SECURE_DOC_MARKER_SUFFIX}`,
    )
    .join("");
}

export function splitCentreEmailBodySegments(body: string): CentreEmailBodySegment[] {
  const markerRe =
    /\[\[INTRA_SECURE_DOC:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\]\]/g;
  const segments: CentreEmailBodySegment[] = [];
  let lastIndex = 0;

  for (const match of body.matchAll(markerRe)) {
    const start = match.index ?? 0;
    if (start > lastIndex) {
      segments.push({ type: "text", content: body.slice(lastIndex, start) });
    }
    segments.push({ type: "secureDocumentLink", staffId: match[1]! });
    lastIndex = start + match[0].length;
  }

  if (lastIndex < body.length) {
    segments.push({ type: "text", content: body.slice(lastIndex) });
  }

  return segments;
}

type Props = {
  segments: CentreEmailBodySegment[];
  disabled?: boolean;
  onChange: (next: { body: string; segments: CentreEmailBodySegment[] }) => void;
};

export function CentreEmailBodyEditor({ segments, disabled = false, onChange }: Props) {
  const bodyId = useId();

  function updateTextSegment(index: number, content: string) {
    const nextSegments = segments.map((segment, segmentIndex) =>
      segmentIndex === index && segment.type === "text" ? { ...segment, content } : segment,
    );
    onChange({
      segments: nextSegments,
      body: serializeCentreEmailBodySegments(nextSegments),
    });
  }

  return (
    <div className="space-y-2">
      <Label htmlFor={bodyId}>Email body</Label>
      <div
        id={bodyId}
        className="max-h-[min(52vh,520px)] overflow-y-auto rounded-lg border border-border/70 bg-white p-4 shadow-sm"
      >
        <div className="space-y-3 text-sm leading-relaxed text-foreground">
          {segments.map((segment, index) => {
            if (segment.type === "secureDocumentLink") {
              return (
                <div
                  key={`secure-${segment.staffId}-${index}`}
                  className="flex items-start gap-2 rounded-md border border-border/60 bg-muted/30 px-3 py-2.5 text-muted-foreground"
                  aria-label="Secure document link block"
                >
                  <Lock className="mt-0.5 h-4 w-4 shrink-0 opacity-70" aria-hidden="true" />
                  <div>
                    <p className="font-medium text-foreground/80">Approved documents</p>
                    <p className="text-xs">Secure link included automatically when this email is sent.</p>
                  </div>
                </div>
              );
            }

            return (
              <Textarea
                key={`text-${index}`}
                value={segment.content}
                disabled={disabled}
                rows={Math.min(24, Math.max(4, segment.content.split("\n").length + 1))}
                className="min-h-[6rem] resize-y border-0 bg-transparent p-0 text-sm leading-relaxed shadow-none focus-visible:ring-0"
                onChange={(event) => updateTextSegment(index, event.target.value)}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
