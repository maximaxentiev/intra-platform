import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { shiftsApi } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { SectionCard } from "@/components/ui-kit";
import { toast } from "sonner";

export function ShiftComments({ shiftId }: { shiftId: string }) {
  const qc = useQueryClient();
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [composing, setComposing] = useState(false);

  const { data: comments } = useQuery({
    queryKey: ["shift-comments", shiftId],
    queryFn: () => shiftsApi.comments(shiftId),
  });

  async function addComment(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = body.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      await shiftsApi.addComment(shiftId, trimmed);
      setBody("");
      setComposing(false);
      qc.invalidateQueries({ queryKey: ["shift-comments", shiftId] });
      toast.success("Comment added");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add comment");
    } finally {
      setSaving(false);
    }
  }

  function formatTimestamp(iso: string) {
    return new Date(iso).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  const list = comments ?? [];

  return (
    <SectionCard
      id="shift-comments"
      title="Internal comments"
      className="text-foreground"
    >
      <div className="space-y-3 text-foreground">
        {!composing && body.trim() === "" ? (
          <button
            type="button"
            onClick={() => setComposing(true)}
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-left text-sm text-muted-foreground transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none"
          >
            Add a comment…
          </button>
        ) : (
          <form onSubmit={addComment} className="space-y-2">
            <Textarea
              rows={3}
              autoFocus
              aria-label="Internal comment"
              placeholder="Add a comment about this shift..."
              className="text-foreground placeholder:text-muted-foreground"
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
            <div className="flex items-center gap-2">
              <Button type="submit" size="sm" disabled={saving || !body.trim()}>
                {saving ? "Saving..." : "Add comment"}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => {
                  setBody("");
                  setComposing(false);
                }}
              >
                Cancel
              </Button>
            </div>
          </form>
        )}

        {list.length === 0 ? (
          <p className="text-[13px] text-muted-foreground">No comments yet.</p>
        ) : (
          <ul className="divide-y divide-border/60">
            {list.map((c) => (
              <li key={c.id} className="py-2.5 first:pt-0 last:pb-0">
                <div className="whitespace-pre-wrap text-sm">{c.body}</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {c.authorName || c.authorEmail || "Unknown user"} · {formatTimestamp(c.createdAt)}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </SectionCard>
  );
}
