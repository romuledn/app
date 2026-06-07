import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Trash2, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

type Comment = {
  id: string;
  user_id: string;
  author_name: string | null;
  body: string;
  created_at: string;
  client_visible: boolean;
};

export function ProjectComments({
  projectId,
  readOnly = false,
  publicOnly = false,
}: {
  projectId: string;
  readOnly?: boolean;
  publicOnly?: boolean;
}) {
  const { user } = useAuth();
  const [items, setItems] = useState<Comment[]>([]);
  const [body, setBody] = useState("");
  const [clientVisible, setClientVisible] = useState(true);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  const load = async () => {
    setLoading(true);
    let q = supabase
      .from("project_comments")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: true });
    if (publicOnly) q = q.eq("client_visible", true);
    const { data, error } = await q;
    setLoading(false);
    if (error) return toast.error(error.message);
    setItems((data as Comment[]) ?? []);
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel(`pc-${projectId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "project_comments", filter: `project_id=eq.${projectId}` },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, publicOnly]);

  const submit = async () => {
    if (!body.trim() || !user) return;
    setSending(true);
    const authorName =
      (user.user_metadata as any)?.full_name ||
      (user.user_metadata as any)?.name ||
      user.email ||
      "User";
    const { error } = await supabase.from("project_comments").insert({
      project_id: projectId,
      user_id: user.id,
      author_name: authorName,
      body: body.trim(),
      client_visible: clientVisible,
    });
    setSending(false);
    if (error) return toast.error(error.message);
    setBody("");
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("project_comments").delete().eq("id", id);
    if (error) return toast.error(error.message);
  };

  const toggleVisible = async (c: Comment) => {
    const { error } = await supabase
      .from("project_comments")
      .update({ client_visible: !c.client_visible })
      .eq("id", c.id);
    if (error) toast.error(error.message);
  };

  return (
    <div className="space-y-3">
      <div className="max-h-72 space-y-2 overflow-y-auto rounded-md border bg-muted/30 p-3">
        {loading && <p className="text-xs text-muted-foreground">Loading…</p>}
        {!loading && items.length === 0 && (
          <p className="text-xs text-muted-foreground">No comments yet.</p>
        )}
        {items.map((c) => (
          <div key={c.id} className="rounded-md border bg-background p-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="flex items-center gap-2">
                <span className="font-medium text-foreground">{c.author_name || "User"}</span>
                {!publicOnly && (
                  <Badge variant="outline" className="gap-1 px-1.5 py-0 text-[10px]">
                    {c.client_visible ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                    {c.client_visible ? "Client" : "Internal"}
                  </Badge>
                )}
              </span>
              <span className="flex items-center gap-2">
                {new Date(c.created_at).toLocaleString()}
                {!readOnly && user?.id === c.user_id && (
                  <>
                    <button
                      type="button"
                      onClick={() => toggleVisible(c)}
                      className="hover:text-foreground"
                      aria-label="Toggle visibility"
                      title={c.client_visible ? "Hide from client" : "Show to client"}
                    >
                      {c.client_visible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(c.id)}
                      className="text-destructive hover:opacity-80"
                      aria-label="Delete comment"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </>
                )}
              </span>
            </div>
            <p className="mt-1 whitespace-pre-wrap text-sm">{c.body}</p>
          </div>
        ))}
      </div>
      {!readOnly && (
        <div className="flex flex-col gap-2">
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Add a comment for the project log…"
            rows={3}
          />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Switch id="cv" checked={clientVisible} onCheckedChange={setClientVisible} />
              <Label htmlFor="cv" className="text-xs text-muted-foreground">
                Visible to client on tracking page
              </Label>
            </div>
            <Button size="sm" onClick={submit} disabled={sending || !body.trim()}>
              {sending ? "Posting…" : "Post comment"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
