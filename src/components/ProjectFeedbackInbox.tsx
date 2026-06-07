import { useEffect, useState } from "react";
import JSZip from "jszip";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  CalendarClock,
  Image as ImageIcon,
  Check,
  Trash2,
  Download,
  Pencil,
} from "lucide-react";
import { toast } from "sonner";

export function ProjectFeedbackInbox({ projectId }: { projectId: string }) {
  const [feedback, setFeedback] = useState<any[]>([]);
  const [meetings, setMeetings] = useState<any[]>([]);

  const load = async () => {
    const [{ data: fb }, { data: mt }] = await Promise.all([
      supabase
        .from("project_feedback")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false }),
      supabase
        .from("project_meeting_requests")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false }),
    ]);
    setFeedback(fb ?? []);
    setMeetings(mt ?? []);
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel(`inbox-${projectId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "project_feedback", filter: `project_id=eq.${projectId}` },
        () => load(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "project_meeting_requests", filter: `project_id=eq.${projectId}` },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const toggleResolved = async (f: any) => {
    const { error } = await supabase
      .from("project_feedback")
      .update({ resolved: !f.resolved })
      .eq("id", f.id);
    if (error) toast.error(error.message);
  };
  const removeFb = async (id: string) => {
    const { error } = await supabase.from("project_feedback").delete().eq("id", id);
    if (error) toast.error(error.message);
  };

  const downloadAllScreenshots = async (f: any) => {
    const shots = Array.isArray(f.screenshots) ? f.screenshots : [];
    if (shots.length === 0) return toast.info("No screenshots to download");
    const id = toast.loading(`Preparing ${shots.length} file(s)…`);
    try {
      const zip = new JSZip();
      await Promise.all(
        shots.map(async (s: any, i: number) => {
          const url = s.url;
          if (!url) return;
          const res = await fetch(url);
          const blob = await res.blob();
          const safe = (s.name || `screenshot-${i + 1}.png`).replace(/[^a-zA-Z0-9._-]/g, "_");
          zip.file(safe, blob);
        }),
      );
      const out = await zip.generateAsync({ type: "blob" });
      const a = document.createElement("a");
      const href = URL.createObjectURL(out);
      a.href = href;
      a.download = `feedback-rev${f.revision_number}-${f.id.slice(0, 8)}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(href);
      toast.success("Download ready", { id });
    } catch (e: any) {
      toast.error(e?.message ?? "Could not build zip", { id });
    }
  };

  return (
    <div className="space-y-4 rounded-md border bg-muted/20 p-3">
      <div>
        <div className="mb-2 text-sm font-semibold">Client feedback</div>
        {feedback.length === 0 ? (
          <p className="text-xs text-muted-foreground">No feedback from the client yet.</p>
        ) : (
          <div className="space-y-2">
            {feedback.map((f) => {
              const shotCount = Array.isArray(f.screenshots) ? f.screenshots.length : 0;
              return (
                <div key={f.id} className="rounded-md border bg-background p-2">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline">Rev {f.revision_number}</Badge>
                      <span className="font-medium text-foreground">
                        {f.client_name || "Client"}
                      </span>
                      {f.resolved && (
                        <Badge variant="outline" className="border-success/40 bg-success/15 text-success">
                          Resolved
                        </Badge>
                      )}
                    </span>
                    <span className="flex items-center gap-2">
                      {new Date(f.created_at).toLocaleString()}
                      <button onClick={() => toggleResolved(f)} title="Toggle resolved" className="hover:text-foreground">
                        <Check className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => removeFb(f.id)} title="Delete" className="text-destructive hover:opacity-80">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </span>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-sm">{f.message}</p>
                  {shotCount > 0 && (
                    <>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {f.screenshots.map((s: any, i: number) => (
                          <a
                            key={i}
                            href={s.url}
                            target="_blank"
                            rel="noreferrer"
                            className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-md border bg-muted"
                            title={s.name}
                          >
                            {s.url ? (
                              <img src={s.url} alt={s.name} className="h-full w-full object-cover" />
                            ) : (
                              <ImageIcon className="h-5 w-5 text-muted-foreground" />
                            )}
                          </a>
                        ))}
                      </div>
                      <div className="mt-2">
                        <Button size="sm" variant="outline" onClick={() => downloadAllScreenshots(f)}>
                          <Download className="mr-1.5 h-3.5 w-3.5" />
                          Download all ({shotCount}) as .zip
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div>
        <div className="mb-2 text-sm font-semibold">Meeting requests</div>
        {meetings.length === 0 ? (
          <p className="text-xs text-muted-foreground">No meeting requests yet.</p>
        ) : (
          <div className="space-y-2">
            {meetings.map((m) => (
              <MeetingRow key={m.id} m={m} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function MeetingRow({ m }: { m: any }) {
  const toLocalInput = (iso: string | null) => {
    if (!iso) return "";
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const [editing, setEditing] = useState(false);
  const [when, setWhen] = useState<string>(toLocalInput(m.preferred_at));
  const [note, setNote] = useState<string>("");
  const [busy, setBusy] = useState(false);

  const apply = async (status: string) => {
    setBusy(true);
    const patch: any = { status };
    if (when) patch.preferred_at = new Date(when).toISOString();
    if (note.trim()) {
      patch.notes = `${m.notes ? m.notes + "\n\n" : ""}[${status} @ ${new Date().toLocaleString()}] ${note.trim()}`;
    }
    const { error } = await supabase
      .from("project_meeting_requests")
      .update(patch)
      .eq("id", m.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(`Meeting ${status}`);
    setEditing(false);
    setNote("");
  };

  return (
    <div className="rounded-md border bg-background p-2 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className="flex flex-wrap items-center gap-2">
          <CalendarClock className="h-3.5 w-3.5 text-primary" />
          <Badge variant="outline">Rev {m.revision_number}</Badge>
          <span className="font-medium text-foreground">{m.client_name || "Client"}</span>
          <span>· {m.duration_minutes} min</span>
          <Badge
            variant="outline"
            className={
              m.status === "confirmed"
                ? "border-success/40 bg-success/15 text-success"
                : m.status === "declined"
                  ? "border-destructive/40 bg-destructive/10 text-destructive"
                  : ""
            }
          >
            {m.status}
          </Badge>
        </span>
        <span>{new Date(m.created_at).toLocaleString()}</span>
      </div>
      <div className="mt-1 text-xs">
        {m.preferred_at
          ? `Preferred: ${new Date(m.preferred_at).toLocaleString()}`
          : "No preferred time"}
        {m.client_email && <> · {m.client_email}</>}
      </div>
      {m.notes && <p className="mt-1 whitespace-pre-wrap text-xs">{m.notes}</p>}

      {!editing ? (
        <div className="mt-2 flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
            <Pencil className="mr-1.5 h-3.5 w-3.5" /> Update / reschedule
          </Button>
          <Button size="sm" variant="outline" onClick={() => apply("confirmed")} disabled={busy}>
            Confirm
          </Button>
          <Button size="sm" variant="outline" onClick={() => apply("completed")} disabled={busy}>
            Mark done
          </Button>
          <Button size="sm" variant="ghost" onClick={() => apply("declined")} disabled={busy}>
            Decline
          </Button>
        </div>
      ) : (
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <div>
            <Label className="text-xs">New date & time</Label>
            <Input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <Label className="text-xs">Message to client (optional)</Label>
            <Textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Proposing a new time / reason for decline"
            />
          </div>
          <div className="flex flex-wrap justify-end gap-2 sm:col-span-2">
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
              Cancel
            </Button>
            <Button size="sm" variant="outline" onClick={() => apply("declined")} disabled={busy}>
              Decline
            </Button>
            <Button size="sm" onClick={() => apply("confirmed")} disabled={busy}>
              Confirm with update
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
