import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { shiftsApi } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

export function ShiftComments({ shiftId }: { shiftId: string }) {
  const qc = useQueryClient();
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);

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
      qc.invalidateQueries({ queryKey: ["shift-comments", shiftId] });
      toast.success("Comment added");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add comment");
    } finally {
      setSaving(false);
    }
  }

  function formatTimestamp(iso: string) {
    return new Date(iso).toLocaleString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Internal comments</CardTitle>
        <p className="text-sm text-muted-foreground">Notes and updates visible only to the ops team.</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={addComment} className="space-y-2">
          <Textarea
            rows={3}
            placeholder="Add a comment about this shift..."
            value={body}
            onChange={e => setBody(e.target.value)}
          />
          <Button type="submit" size="sm" disabled={saving || !body.trim()}>
            {saving ? "Saving..." : "Add comment"}
          </Button>
        </form>

        {(comments ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground italic">No comments yet.</p>
        ) : (
          <ul className="space-y-3 divide-y">
            {(comments ?? []).map((c) => (
              <li key={c.id} className="pt-3 first:pt-0">
                <div className="text-sm whitespace-pre-wrap">{c.body}</div>
                <div className="text-xs text-muted-foreground mt-1.5">
                  {c.authorName || c.authorEmail || "Unknown user"} · {formatTimestamp(c.createdAt)}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
