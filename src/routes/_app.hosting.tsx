import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { useClients, useHosting } from "@/lib/queries";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CURRENCIES, formatMoney } from "@/lib/currency";
import { Plus, Trash2, Globe } from "lucide-react";
import { differenceInDays } from "date-fns";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/hosting")({
  component: Hosting,
});

function Hosting() {
  const { data: rows = [] } = useHosting();
  const [open, setOpen] = useState(false);

  return (
    <div className="mx-auto max-w-7xl space-y-4 px-4 py-4 md:space-y-6 md:px-8 md:py-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold md:text-3xl">Hosting & subscriptions</h1>
          <p className="text-xs text-muted-foreground md:text-sm">Renewal alerts at 60, 30 and 7 days before expiry.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" /> New subscription</Button></DialogTrigger>
          <HostingDialog onDone={() => setOpen(false)} />
        </Dialog>
      </div>

      {rows.length === 0 && (
        <Card><CardContent className="p-12 text-center text-muted-foreground"><Globe className="mx-auto mb-2 h-8 w-8 opacity-40" />No subscriptions tracked.</CardContent></Card>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        {rows.map((h: any) => {
          const days = differenceInDays(new Date(h.end_date), new Date());
          const tone = days < 0 ? "destructive" : days <= 7 ? "destructive" : days <= 30 ? "warning" : days <= 60 ? "warning" : "success";
          return (
            <Card key={h.id}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold">{h.service_name}</h3>
                    <p className="text-xs text-muted-foreground">{h.clients?.name}</p>
                  </div>
                  <Badge variant="outline" className={
                    tone === "destructive" ? "border-destructive/40 bg-destructive/20 text-destructive"
                    : tone === "warning" ? "border-warning/40 bg-warning/20" : "border-success/40 bg-success/20 text-success"
                  }>
                    {days < 0 ? `Expired ${-days}d ago` : days === 0 ? "Ends today" : `${days} days left`}
                  </Badge>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div><div className="text-muted-foreground">Start</div><div>{new Date(h.start_date).toLocaleDateString()}</div></div>
                  <div><div className="text-muted-foreground">End</div><div>{new Date(h.end_date).toLocaleDateString()}</div></div>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <span className="font-bold text-primary">{formatMoney(Number(h.amount), h.currency)}</span>
                  <Button variant="ghost" size="icon" onClick={async () => {
                    if (!confirm("Delete?")) return;
                    await supabase.from("hosting_subscriptions").delete().eq("id", h.id);
                    location.reload();
                  }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function HostingDialog({ onDone }: { onDone: () => void }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: clients = [] } = useClients();
  const today = new Date().toISOString().slice(0, 10);
  const sixMo = new Date(Date.now() + 180 * 86400000).toISOString().slice(0, 10);
  const [f, setF] = useState({
    client_id: "", service_name: "Website hosting", start_date: today, end_date: sixMo,
    amount: 0, currency: "ZAR" as string, notes: "",
  });
  const save = async () => {
    if (!f.client_id || !f.service_name) return toast.error("Client and service required");
    const { error } = await supabase.from("hosting_subscriptions").insert({ ...f, user_id: user!.id });
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["hosting"] });
    toast.success("Added");
    onDone();
  };
  return (
    <DialogContent>
      <DialogHeader><DialogTitle>New subscription</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <FormRow label="Client">
          <Select value={f.client_id} onValueChange={(v) => setF({ ...f, client_id: v })}>
            <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
            <SelectContent>{clients.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
          </Select>
        </FormRow>
        <FormRow label="Service"><Input value={f.service_name} onChange={(e) => setF({ ...f, service_name: e.target.value })} /></FormRow>
        <div className="grid grid-cols-2 gap-3">
          <FormRow label="Start"><Input type="date" value={f.start_date} onChange={(e) => setF({ ...f, start_date: e.target.value })} /></FormRow>
          <FormRow label="End"><Input type="date" value={f.end_date} onChange={(e) => setF({ ...f, end_date: e.target.value })} /></FormRow>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <FormRow label="Amount"><Input type="number" value={f.amount} onChange={(e) => setF({ ...f, amount: Number(e.target.value) })} /></FormRow>
          <FormRow label="Currency">
            <Select value={f.currency} onValueChange={(v) => setF({ ...f, currency: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{CURRENCIES.map((c) => <SelectItem key={c.code} value={c.code}>{c.code}</SelectItem>)}</SelectContent>
            </Select>
          </FormRow>
        </div>
      </div>
      <DialogFooter><Button onClick={save}>Save</Button></DialogFooter>
    </DialogContent>
  );
}

function FormRow({ label, children }: { label: string; children: any }) {
  return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>;
}
