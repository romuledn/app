import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Upload,
  X,
  Image as ImageIcon,
  CalendarClock,
  Lock,
  CheckCircle2,
  AlertTriangle,
  Send,
} from "lucide-react";
import { toast } from "sonner";

const REV1_AT = 50;
const REV2_AT = 90;
const MEETING_LIMITS = { 1: 30, 2: 45 } as const;

type Screenshot = { path: string; url: string; name: string };

type Feedback = {
  id: string;
  revision_number: 1 | 2;
  client_name: string | null;
  message: string;
  screenshots: Screenshot[];
  created_at: string;
};

type Meeting = {
  id: string;
  revision_number: 1 | 2;
  duration_minutes: number;
  preferred_at: string | null;
  status: string;
  paid: boolean;
  client_name: string | null;
  notes: string | null;
  created_at: string;
};

export function ClientRevisionPanel({ project }: { project: any }) {
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const progress = project.progress ?? 0;

  const load = async () => {
    const [{ data: fb }, { data: mt }] = await Promise.all([
      supabase
        .from("project_feedback")
        .select("*")
        .eq("project_id", project.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("project_meeting_requests")
        .select("*")
        .eq("project_id", project.id)
        .order("created_at", { ascending: false }),
    ]);
    setFeedback((fb as any) ?? []);
    setMeetings((mt as any) ?? []);
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel(`client-rev-${project.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "project_feedback", filter: `project_id=eq.${project.id}` },
        () => load(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "project_meeting_requests", filter: `project_id=eq.${project.id}` },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id]);

  return (
    <div className="space-y-6">
      <RevisionBlock
        project={project}
        revisionNumber={1}
        progress={progress}
        unlockAt={REV1_AT}
        meetingMax={MEETING_LIMITS[1]}
        feedback={feedback.filter((f) => f.revision_number === 1)}
        meeting={meetings.find((m) => m.revision_number === 1) ?? null}
      />
      <RevisionBlock
        project={project}
        revisionNumber={2}
        progress={progress}
        unlockAt={REV2_AT}
        meetingMax={MEETING_LIMITS[2]}
        feedback={feedback.filter((f) => f.revision_number === 2)}
        meeting={meetings.find((m) => m.revision_number === 2) ?? null}
      />

      {project.revision1_done && project.revision2_done && (
        <Alert className="border-primary/40 bg-primary/5">
          <AlertTriangle className="h-4 w-4 text-primary" />
          <AlertTitle className="text-sm">Free revisions used</AlertTitle>
          <AlertDescription className="text-xs">
            Both free revision rounds and their meetings have been used. Any further
            changes or additional meetings require a new payment. Please contact the
            team to arrange payment for the next round.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

function RevisionBlock({
  project,
  revisionNumber,
  progress,
  unlockAt,
  meetingMax,
  feedback,
  meeting,
}: {
  project: any;
  revisionNumber: 1 | 2;
  progress: number;
  unlockAt: number;
  meetingMax: number;
  feedback: Feedback[];
  meeting: Meeting | null;
}) {
  const unlocked = progress >= unlockAt;
  const revDone =
    revisionNumber === 1 ? !!project.revision1_done : !!project.revision2_done;

  return (
    <div className="rounded-md border bg-background">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
        <div>
          <div className="font-semibold">
            Revision {revisionNumber}{" "}
            <span className="text-xs font-normal text-muted-foreground">
              · unlocks at {unlockAt}% progress
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Send screenshots with comments and request one meeting (max {meetingMax} min).
          </p>
        </div>
        {revDone ? (
          <Badge variant="outline" className="gap-1 border-success/40 bg-success/15 text-success">
            <CheckCircle2 className="h-3 w-3" /> Closed by team
          </Badge>
        ) : unlocked ? (
          <Badge variant="outline" className="border-primary/40 text-primary">
            Open for review
          </Badge>
        ) : (
          <Badge variant="outline" className="gap-1 text-muted-foreground">
            <Lock className="h-3 w-3" /> Locked
          </Badge>
        )}
      </div>

      <div className="space-y-4 px-4 py-4">
        {!unlocked ? (
          <p className="text-sm text-muted-foreground">
            This revision opens when the project reaches {unlockAt}%. Current progress:{" "}
            {progress}%.
          </p>
        ) : (
          <>
            <FeedbackForm projectId={project.id} revisionNumber={revisionNumber} />
            <FeedbackList items={feedback} />
            <MeetingSection
              projectId={project.id}
              revisionNumber={revisionNumber}
              meetingMax={meetingMax}
              meeting={meeting}
            />
          </>
        )}
      </div>
    </div>
  );
}

function FeedbackForm({
  projectId,
  revisionNumber,
}: {
  projectId: string;
  revisionNumber: 1 | 2;
}) {
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const onPick = (list: FileList | null) => {
    if (!list) return;
    const next = Array.from(list).filter((f) => f.type.startsWith("image/"));
    setFiles((prev) => [...prev, ...next].slice(0, 8));
  };

  const submit = async () => {
    if (!message.trim()) return toast.error("Add a short message describing the change.");
    setBusy(true);
    try {
      const shots: Screenshot[] = [];
      for (const f of files) {
        const path = `${projectId}/rev${revisionNumber}/${Date.now()}-${f.name.replace(
          /[^a-zA-Z0-9._-]/g,
          "_",
        )}`;
        const { error: upErr } = await supabase.storage
          .from("project-feedback")
          .upload(path, f, { contentType: f.type, upsert: false });
        if (upErr) throw upErr;
        const { data: signed } = await supabase.storage
          .from("project-feedback")
          .createSignedUrl(path, 60 * 60 * 24 * 365);
        shots.push({ path, url: signed?.signedUrl ?? "", name: f.name });
      }
      const { error } = await supabase.from("project_feedback").insert({
        project_id: projectId,
        revision_number: revisionNumber,
        client_name: name.trim() || null,
        message: message.trim(),
        screenshots: shots,
      });
      if (error) throw error;
      toast.success("Feedback sent to the team");
      setMessage("");
      setFiles([]);
    } catch (e: any) {
      toast.error(e?.message ?? "Could not send feedback");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2 rounded-md border bg-muted/20 p-3">
      <div className="text-sm font-medium">Send screenshots & comments</div>
      <div className="grid gap-2 sm:grid-cols-2">
        <div>
          <Label className="text-xs">Your name (optional)</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Client" />
        </div>
      </div>
      <div>
        <Label className="text-xs">What needs changing?</Label>
        <Textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={3}
          placeholder="Describe the changes you'd like, referencing the screenshots below."
        />
      </div>
      <div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => onPick(e.target.files)}
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
        >
          <Upload className="mr-1.5 h-3.5 w-3.5" /> Attach screenshots
        </Button>
        {files.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {files.map((f, i) => (
              <div
                key={i}
                className="flex items-center gap-1 rounded-full border bg-background px-2 py-0.5 text-xs"
              >
                <ImageIcon className="h-3 w-3" />
                <span className="max-w-[140px] truncate">{f.name}</span>
                <button
                  type="button"
                  onClick={() => setFiles((p) => p.filter((_, idx) => idx !== i))}
                  className="text-muted-foreground hover:text-destructive"
                  aria-label="Remove"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="flex justify-end">
        <Button size="sm" onClick={submit} disabled={busy || !message.trim()}>
          <Send className="mr-1.5 h-3.5 w-3.5" />
          {busy ? "Sending…" : "Send to team"}
        </Button>
      </div>
    </div>
  );
}

function FeedbackList({ items }: { items: Feedback[] }) {
  if (items.length === 0)
    return <p className="text-xs text-muted-foreground">No feedback sent yet.</p>;
  return (
    <div className="space-y-2">
      {items.map((f) => (
        <div key={f.id} className="rounded-md border bg-background p-3">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="font-medium text-foreground">
              {f.client_name || "Client"}
            </span>
            <span>{new Date(f.created_at).toLocaleString()}</span>
          </div>
          <p className="mt-1 whitespace-pre-wrap text-sm">{f.message}</p>
          {Array.isArray(f.screenshots) && f.screenshots.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {f.screenshots.map((s, i) => (
                <a
                  key={i}
                  href={s.url}
                  target="_blank"
                  rel="noreferrer"
                  className="block h-20 w-20 overflow-hidden rounded-md border bg-muted"
                  title={s.name}
                >
                  <img src={s.url} alt={s.name} className="h-full w-full object-cover" />
                </a>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function MeetingSection({
  projectId,
  revisionNumber,
  meetingMax,
  meeting,
}: {
  projectId: string;
  revisionNumber: 1 | 2;
  meetingMax: number;
  meeting: Meeting | null;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [duration, setDuration] = useState<number>(meetingMax);
  const [when, setWhen] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  if (meeting) {
    return (
      <div className="rounded-md border bg-muted/20 p-3 text-sm">
        <div className="flex items-center gap-2 font-medium">
          <CalendarClock className="h-4 w-4 text-primary" />
          Meeting requested ({meeting.duration_minutes} min)
        </div>
        <div className="mt-1 text-xs text-muted-foreground">
          {meeting.preferred_at
            ? `Preferred: ${new Date(meeting.preferred_at).toLocaleString()}`
            : "No preferred time provided"}{" "}
          · status: {meeting.status}
        </div>
        {meeting.notes && (
          <p className="mt-2 whitespace-pre-wrap text-xs">{meeting.notes}</p>
        )}
      </div>
    );
  }

  const submit = async () => {
    const mins = Math.max(5, Math.min(meetingMax, Number(duration) || meetingMax));
    setBusy(true);
    const { error } = await supabase.from("project_meeting_requests").insert({
      project_id: projectId,
      revision_number: revisionNumber,
      duration_minutes: mins,
      preferred_at: when ? new Date(when).toISOString() : null,
      client_name: name.trim() || null,
      client_email: email.trim() || null,
      notes: notes.trim() || null,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Meeting request sent");
    setOpen(false);
  };

  return (
    <div className="rounded-md border bg-muted/20 p-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-medium">Request a meeting</div>
          <p className="text-xs text-muted-foreground">
            One free meeting for this revision · maximum {meetingMax} minutes.
          </p>
        </div>
        {!open && (
          <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
            <CalendarClock className="mr-1.5 h-3.5 w-3.5" /> Request meeting
          </Button>
        )}
      </div>
      {open && (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <div>
            <Label className="text-xs">Your name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Email</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Duration (max {meetingMax} min)</Label>
            <Input
              type="number"
              min={5}
              max={meetingMax}
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
            />
          </div>
          <div>
            <Label className="text-xs">Preferred date & time</Label>
            <Input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <Label className="text-xs">Agenda / notes</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={submit} disabled={busy}>
              {busy ? "Sending…" : "Send request"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
