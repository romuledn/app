import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useProjects, useClients } from "@/lib/queries";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ProjectRevisions } from "@/components/ProjectRevisions";
import { ProjectFeedbackInbox } from "@/components/ProjectFeedbackInbox";
import {
  ListTodo,
  CheckCircle2,
  Plus,
  User,
  Share2,
  Copy,
  RotateCcw,
  Check,
  ChevronRight,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { ProjectComments } from "@/components/ProjectComments";

export const Route = createFileRoute("/_app/projects")({
  component: Projects,
});

function Projects() {
  const { data: projects = [] } = useProjects();
  const qc = useQueryClient();

  useEffect(() => {
    const ch = supabase
      .channel("projects-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "projects" },
        () => qc.invalidateQueries({ queryKey: ["projects"] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [qc]);

  const ongoing = useMemo(
    () => projects.filter((p: any) => p.status !== "completed"),
    [projects],
  );
  const completed = useMemo(
    () => projects.filter((p: any) => p.status === "completed"),
    [projects],
  );


  return (
    <div className="mx-auto max-w-7xl space-y-4 px-4 py-4 md:space-y-6 md:px-8 md:py-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold md:text-3xl">Projects</h1>
          <p className="text-xs text-muted-foreground md:text-sm">
            Click a project to open it. Track progress, post updates and share a live tracking
            link with your client.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline">Ongoing: {ongoing.length}</Badge>
          <Badge variant="outline" className="border-success/40 bg-success/20 text-success">
            Completed: {completed.length}
          </Badge>
          <NewProjectDialog />
        </div>
      </div>

      <div>
        <Tabs defaultValue="ongoing">
          <TabsList>
            <TabsTrigger value="ongoing">
              <ListTodo className="mr-2 h-4 w-4" /> Ongoing ({ongoing.length})
            </TabsTrigger>
            <TabsTrigger value="completed">
              <CheckCircle2 className="mr-2 h-4 w-4" /> Completed ({completed.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="ongoing" className="mt-4 space-y-3">
            {ongoing.length === 0 && <EmptyState label="No ongoing projects." />}
            {ongoing.map((p: any) => (
              <ProjectRow key={p.id} p={p} />
            ))}
          </TabsContent>

          <TabsContent value="completed" className="mt-4 space-y-3">
            {completed.length === 0 && <EmptyState label="No completed projects yet." />}
            {completed.map((p: any) => (
              <ProjectRow key={p.id} p={p} />
            ))}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function ProjectRow({ p }: { p: any }) {
  const [open, setOpen] = useState(false);
  const done = p.status === "completed";

  return (
    <>
      <Card
        role="button"
        tabIndex={0}
        onClick={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen(true);
          }
        }}
        className="cursor-pointer transition-colors hover:border-primary/40 hover:bg-accent/30"
      >
        <CardContent className="space-y-3 p-4">
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <div className={`font-medium ${done ? "text-muted-foreground line-through" : ""}`}>
                {p.title}
              </div>
              <div className="text-xs text-muted-foreground">
                {p.clients?.name}
                {p.clients?.company ? ` · ${p.clients.company}` : ""}
                {p.quotations?.number ? ` · Quote #${p.quotations.number}` : ""}
              </div>
            </div>
            <div className="text-right text-xs text-muted-foreground">
              {p.start_date && <div>Start: {new Date(p.start_date).toLocaleDateString()}</div>}
              {p.due_date && <div>Due: {new Date(p.due_date).toLocaleDateString()}</div>}
            </div>
            <ChevronRight className="mt-1 h-4 w-4 text-muted-foreground" />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex min-w-[180px] flex-1 items-center gap-2">
              <Progress value={p.progress ?? 0} className="h-2 flex-1" />
              <span className="w-10 text-right text-xs font-medium tabular-nums">
                {p.progress ?? 0}%
              </span>
            </div>
            <Badge variant="outline" className="gap-1">
              <User className="h-3 w-3" />
              {p.assignee_name || "Unassigned"}
            </Badge>
            {done ? (
              <Badge variant="outline" className="border-success/40 bg-success/20 text-success">
                Completed
              </Badge>
            ) : (
              <Badge variant="outline">In progress</Badge>
            )}
          </div>
        </CardContent>
      </Card>

      <ProjectDetailDialog p={p} open={open} onOpenChange={setOpen} />
    </>
  );
}

function ProjectDetailDialog({
  p,
  open,
  onOpenChange,
}: {
  p: any;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const qc = useQueryClient();
  const [title, setTitle] = useState<string>(p.title);
  const [progress, setProgress] = useState<number>(p.progress ?? 0);
  const [assignee, setAssignee] = useState<string>(p.assignee_name ?? "");
  const [startDate, setStartDate] = useState<string>(p.start_date ?? "");
  const [dueDate, setDueDate] = useState<string>(p.due_date ?? "");
  const [clientVisible, setClientVisible] = useState<boolean>(p.client_visible ?? true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setTitle(p.title);
      setProgress(p.progress ?? 0);
      setAssignee(p.assignee_name ?? "");
      setStartDate(p.start_date ?? "");
      setDueDate(p.due_date ?? "");
      setClientVisible(p.client_visible ?? true);
    }
  }, [open, p]);

  const refresh = () => qc.invalidateQueries({ queryKey: ["projects"] });

  const save = async () => {
    if (!title.trim()) return toast.error("Title is required");
    setSaving(true);
    const { error } = await supabase
      .from("projects")
      .update({
        title: title.trim(),
        progress,
        assignee_name: assignee.trim() || null,
        start_date: startDate || null,
        due_date: dueDate || null,
        client_visible: clientVisible,
      })
      .eq("id", p.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    refresh();
    toast.success("Project updated");
  };

  const markComplete = async () => {
    const { error } = await supabase
      .from("projects")
      .update({ status: "completed", completed_at: new Date().toISOString(), progress: 100 })
      .eq("id", p.id);
    if (error) return toast.error(error.message);
    setProgress(100);
    refresh();
    toast.success("Project marked complete");
  };

  const reopen = async () => {
    const { error } = await supabase
      .from("projects")
      .update({
        status: "ongoing",
        completed_at: null,
        progress: progress >= 100 ? 90 : progress,
      })
      .eq("id", p.id);
    if (error) return toast.error(error.message);
    if (progress >= 100) setProgress(90);
    refresh();
    toast.success("Project reopened");
  };

  const shareUrl = `${window.location.origin}/share/p/${p.share_token}`;
  const copyShare = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success("Tracking link copied");
    } catch {
      toast.error("Could not copy link");
    }
  };

  const done = p.status === "completed";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span>{title || "Project"}</span>
            {done ? (
              <Badge className="bg-success text-success-foreground">Completed</Badge>
            ) : (
              <Badge variant="outline">In progress</Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-5 md:grid-cols-2">
          <div className="space-y-4">
            <div>
              <Label>Title</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div>
              <Label>Assigned to</Label>
              <Input
                value={assignee}
                onChange={(e) => setAssignee(e.target.value)}
                placeholder="e.g. Jane Doe"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Start date</Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div>
                <Label>Due date</Label>
                <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </div>
            </div>
            <div>
              <div className="mb-2 flex items-center justify-between">
                <Label>Progress</Label>
                <span className="text-sm font-medium tabular-nums">{progress}%</span>
              </div>
              <Slider
                value={[progress]}
                onValueChange={(v) => setProgress(v[0] ?? 0)}
                min={0}
                max={100}
                step={5}
              />
              
            </div>

            <div className="rounded-md border p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-medium">Client tracking link</div>
                  <div className="text-xs text-muted-foreground">
                    Share this link so your client can follow the project live.
                  </div>
                </div>
                <Switch checked={clientVisible} onCheckedChange={setClientVisible} />
              </div>
              {clientVisible && (
                <div className="mt-2 flex items-center gap-2">
                  <Input value={shareUrl} readOnly className="text-xs" />
                  <Button size="sm" variant="outline" onClick={copyShare}>
                    <Copy className="mr-1.5 h-3.5 w-3.5" /> Copy
                  </Button>
                  <Button size="sm" variant="outline" asChild>
                    <a href={shareUrl} target="_blank" rel="noreferrer">
                      <Share2 className="mr-1.5 h-3.5 w-3.5" /> Open
                    </a>
                  </Button>
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button onClick={save} disabled={saving}>
                {saving ? "Saving…" : "Save changes"}
              </Button>
              {done ? (
                <Button variant="outline" onClick={reopen}>
                  <RotateCcw className="mr-2 h-4 w-4" /> Mark not completed
                </Button>
              ) : (
                <Button variant="outline" onClick={markComplete}>
                  <Check className="mr-2 h-4 w-4" /> Mark complete
                </Button>
              )}
              <Button
                variant="destructive"
                onClick={async () => {
                  if (!confirm("Delete this project? This cannot be undone.")) return;
                  await supabase.from("projects").delete().eq("id", p.id);
                  refresh();
                  onOpenChange(false);
                  toast.success("Project deleted");
                }}
              >
                <Trash2 className="mr-2 h-4 w-4" /> Delete
              </Button>
            </div>
          </div>

          <div className="space-y-4">
            <ProjectRevisions project={p} onChanged={refresh} />
            <div>
              <Label className="mb-2 block">Client feedback & meetings</Label>
              <ProjectFeedbackInbox projectId={p.id} />
            </div>
            <div>
              <Label className="mb-2 block">Discussion & updates</Label>
              <ProjectComments projectId={p.id} />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <Card>
      <CardContent className="p-12 text-center text-muted-foreground">{label}</CardContent>
    </Card>
  );
}

function NewProjectDialog() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: clients = [] } = useClients();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [clientId, setClientId] = useState<string>("");
  const [assignee, setAssignee] = useState<string>("");
  const [startDate, setStartDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!title.trim()) return toast.error("Title is required");
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("projects").insert({
      user_id: user.id,
      title: title.trim(),
      client_id: clientId || null,
      assignee_name: assignee.trim() || null,
      start_date: startDate || null,
      due_date: dueDate || null,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Project created");
    setOpen(false);
    setTitle("");
    setClientId("");
    setAssignee("");
    setDueDate("");
    qc.invalidateQueries({ queryKey: ["projects"] });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="mr-2 h-4 w-4" /> New project
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create project</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Title</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Website redesign"
            />
          </div>
          <div>
            <Label>Client (optional)</Label>
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger>
                <SelectValue placeholder="Select client" />
              </SelectTrigger>
              <SelectContent>
                {clients.map((c: any) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.company || c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Assigned to (optional)</Label>
            <Input
              value={assignee}
              onChange={(e) => setAssignee(e.target.value)}
              placeholder="e.g. Jane Doe"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Start date</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div>
              <Label>Due date</Label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? "Creating…" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
