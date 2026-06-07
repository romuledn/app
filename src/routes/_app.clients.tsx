import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { useClients } from "@/lib/queries";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Mail, Phone } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/clients")({
  component: Clients,
});

function Clients() {
  const { data: clients = [] } = useClients();
  const [editing, setEditing] = useState<any | null>(null);
  const [open, setOpen] = useState(false);
  const [viewing, setViewing] = useState<any | null>(null);

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-8 py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold">Clients</h1>
          <p className="text-sm text-muted-foreground">People and companies you bill.</p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }}>
          <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" /> New client</Button></DialogTrigger>
          <ClientDialog editing={editing} onDone={() => { setOpen(false); setEditing(null); }} />
        </Dialog>
      </div>

      {clients.length === 0 && (
        <Card><CardContent className="p-12 text-center text-muted-foreground">No clients yet. Add your first.</CardContent></Card>
      )}

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {clients.map((c: any) => (
          <Card
            key={c.id}
            className="group cursor-pointer transition hover:border-primary/50 hover:shadow-md"
            onClick={() => setViewing(c)}
          >
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold">{c.name}</h3>
                  {c.company && <p className="text-xs text-muted-foreground">{c.company}</p>}
                </div>
                <div
                  className="flex gap-1 opacity-0 transition group-hover:opacity-100"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Button variant="ghost" size="icon" onClick={() => { setEditing(c); setOpen(true); }}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <DeleteBtn id={c.id} />
                </div>
              </div>
              <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                <div className="flex items-center gap-2"><Mail className="h-3 w-3" /> {c.email}</div>
                {c.phone && <div className="flex items-center gap-2"><Phone className="h-3 w-3" /> {c.phone}</div>}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <ClientDetailsDialog
        client={viewing}
        onClose={() => setViewing(null)}
        onEdit={(c) => { setViewing(null); setEditing(c); setOpen(true); }}
      />
    </div>
  );
}

function ClientDetailsDialog({
  client,
  onClose,
  onEdit,
}: {
  client: any | null;
  onClose: () => void;
  onEdit: (c: any) => void;
}) {
  return (
    <Dialog open={!!client} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent>
        {client && (
          <>
            <DialogHeader>
              <DialogTitle>{client.name}</DialogTitle>
              {client.company && <p className="text-sm text-muted-foreground">{client.company}</p>}
            </DialogHeader>
            <div className="space-y-3 text-sm">
              <DetailRow label="Email" value={client.email} />
              <DetailRow label="Phone" value={client.phone} />
              <DetailRow label="Company" value={client.company} />
              <DetailRow label="Address" value={client.address} multiline />
              <DetailRow label="Notes" value={client.notes} multiline />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={onClose}>Close</Button>
              <Button onClick={() => onEdit(client)}>
                <Pencil className="mr-2 h-3.5 w-3.5" /> Edit
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function DetailRow({ label, value, multiline }: { label: string; value?: string | null; multiline?: boolean }) {
  return (
    <div className="grid grid-cols-[100px_1fr] gap-3">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className={multiline ? "whitespace-pre-wrap" : ""}>{value || <span className="text-muted-foreground">—</span>}</span>
    </div>
  );
}

function DeleteBtn({ id }: { id: string }) {
  const qc = useQueryClient();
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={async () => {
        if (!confirm("Delete this client?")) return;
        const { error } = await supabase.from("clients").delete().eq("id", id);
        if (error) return toast.error(error.message);
        toast.success("Deleted");
        qc.invalidateQueries({ queryKey: ["clients"] });
      }}
    >
      <Trash2 className="h-3.5 w-3.5 text-destructive" />
    </Button>
  );
}

function ClientDialog({ editing, onDone }: { editing: any | null; onDone: () => void }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [form, setForm] = useState({
    name: editing?.name ?? "",
    email: editing?.email ?? "",
    phone: editing?.phone ?? "",
    company: editing?.company ?? "",
    address: editing?.address ?? "",
    notes: editing?.notes ?? "",
  });
  const save = async () => {
    if (!form.name || !form.email) return toast.error("Name and email required");
    const payload = { ...form, user_id: user!.id };
    const { error } = editing
      ? await supabase.from("clients").update(payload).eq("id", editing.id)
      : await supabase.from("clients").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("Saved");
    qc.invalidateQueries({ queryKey: ["clients"] });
    onDone();
  };
  return (
    <DialogContent>
      <DialogHeader><DialogTitle>{editing ? "Edit client" : "New client"}</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <FormRow label="Name *"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></FormRow>
        <FormRow label="Email *"><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></FormRow>
        <div className="grid grid-cols-2 gap-3">
          <FormRow label="Phone"><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></FormRow>
          <FormRow label="Company"><Input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} /></FormRow>
        </div>
        <FormRow label="Address"><Textarea rows={2} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></FormRow>
        <FormRow label="Notes"><Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></FormRow>
      </div>
      <DialogFooter><Button onClick={save}>Save client</Button></DialogFooter>
    </DialogContent>
  );
}

function FormRow({ label, children }: { label: string; children: any }) {
  return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>;
}
