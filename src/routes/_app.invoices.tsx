import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useInvoices, useProfile } from "@/lib/queries";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DocEditor } from "@/components/DocEditor";
import { PaymentsTrigger } from "@/components/PaymentsDialog";
import { Plus, Download, Send, Trash2, Receipt, Link2, FileDown, Search, Bell, Pencil } from "lucide-react";
import { formatMoney } from "@/lib/currency";
import { downloadPdf, downloadCsv, openEmailWithPdf } from "@/lib/pdf";
import { ReminderDialog } from "@/components/ReminderDialog";
import { Countdown } from "@/components/Countdown";
import { logActivity } from "@/lib/activity";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/invoices")({
  component: Invoices,
});

function Invoices() {
  const { data: invoices = [] } = useInvoices();
  const { data: profile } = useProfile();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<any | null>(null);
  const [open, setOpen] = useState(false);
  const [reminderRow, setReminderRow] = useState<any | null>(null);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");

  const buildDoc = (i: any): any => ({
    kind: "INVOICE", number: i.number, title: i.title, currency: i.currency, items: i.items,
    subtotal: Number(i.subtotal), discount: Number(i.discount || 0), taxRate: Number(i.tax_rate),
    total: Number(i.total), amountPaid: Number(i.amount_paid || 0), notes: i.notes, issueDate: i.issue_date,
    dueOrValidLabel: "Due", dueOrValid: i.due_date, terms: i.terms || profile?.terms_conditions,
    business: { name: profile?.business_name, email: profile?.business_email, phone: profile?.business_phone, address: profile?.business_address },
    client: i.clients,
    design: profile?.doc_design,
  });

  const filtered = useMemo(() => {
    return invoices.filter((i: any) => {
      const matchQ = !q || `${i.number} ${i.title} ${i.clients?.name}`.toLowerCase().includes(q.toLowerCase());
      const matchS = status === "all" || (status === "overdue"
        ? i.status !== "paid" && new Date(i.due_date) < new Date()
        : i.status === status);
      return matchQ && matchS;
    });
  }, [invoices, q, status]);

  const exportCsv = () => {
    const headers = ["Number", "Client", "Title", "Currency", "Total", "Paid", "Status", "Due"];
    const rows = filtered.map((i: any) => [i.number, i.clients?.name, i.title, i.currency, i.total, i.amount_paid, i.status, i.due_date]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `invoices-${Date.now()}.csv`;
    a.click();
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-8 py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold">Invoices</h1>
          <p className="text-sm text-muted-foreground">Live countdown · partial payments · recurring · share links.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportCsv}><FileDown className="mr-2 h-4 w-4" /> Export CSV</Button>
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }}>
            <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" /> New invoice</Button></DialogTrigger>
            {open && <DocEditor key={editing?.id ?? "new"} kind="invoice" editing={editing} onDone={() => { setOpen(false); setEditing(null); }} />}
          </Dialog>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search by number, client, title…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="sent">Sent</SelectItem>
            <SelectItem value="partial">Partially paid</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="overdue">Overdue</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 && (
        <Card><CardContent className="p-12 text-center text-muted-foreground"><Receipt className="mx-auto mb-2 h-8 w-8 opacity-40" />No invoices match.</CardContent></Card>
      )}

      <div className="space-y-2">
        {filtered.map((i: any) => {
          const isOverdue = i.status !== "paid" && new Date(i.due_date) < new Date();
          const remaining = Number(i.total) - Number(i.amount_paid || 0);
          return (
            <Card key={i.id} className="cursor-pointer transition hover:border-primary/50" onClick={() => { setEditing(i); setOpen(true); }}>
              <CardContent className="flex flex-wrap items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">#{i.number}</span>
                    <Badge variant="outline" className={
                      i.status === "paid" ? "border-success/40 bg-success/20 text-success"
                      : isOverdue ? "border-destructive/40 bg-destructive/20 text-destructive"
                      : i.status === "partial" ? "border-warning/40 bg-warning/20"
                      : i.status === "sent" ? "border-warning/40 bg-warning/20" : ""
                    }>{isOverdue ? "overdue" : i.status}</Badge>
                    {i.recurring_interval && <Badge variant="outline" className="text-[10px]">recurring · {i.recurring_interval}</Badge>}
                    {i.viewed_at && <Badge variant="outline" className="text-[10px]">viewed</Badge>}
                  </div>
                  <p className="truncate text-sm text-muted-foreground">{i.title} · {i.clients?.name}</p>
                </div>
                <div className="text-right">
                  <div className="font-bold text-primary">{formatMoney(Number(i.total), i.currency)}</div>
                  {Number(i.amount_paid) > 0 && i.status !== "paid" && (
                    <div className="text-xs text-muted-foreground">{formatMoney(remaining, i.currency)} remaining</div>
                  )}
                  {i.status !== "paid" && <Countdown target={i.due_date} label="until due" />}
                </div>
                <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                  <Button variant="ghost" size="icon" title="Copy share link" onClick={() => {
                    navigator.clipboard.writeText(`${window.location.origin}/share/i/${i.share_token}`);
                    toast.success("Share link copied");
                  }}><Link2 className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" title="Download PDF" onClick={() => downloadPdf(buildDoc(i))}><Download className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" title="Download CSV" onClick={() => downloadCsv(buildDoc(i))}><FileDown className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" title="Send" onClick={async () => {
                    try {
                      await openEmailWithPdf(buildDoc(i), `${window.location.origin}/share/i/${i.share_token}`);
                      await supabase.from("invoices").update({ status: i.status === "paid" ? i.status : "sent", sent_at: new Date().toISOString() }).eq("id", i.id);
                      logActivity(user!.id, "invoices", i.id, "sent", { number: i.number });
                      qc.invalidateQueries({ queryKey: ["invoices"] });
                      toast.success(`Invoice #${i.number} sent to ${i.clients?.email}`);
                    } catch (err: any) {
                      toast.error(err.message || "Failed to send invoice");
                    }
                  }}><Send className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" title="Send reminder" onClick={() => setReminderRow(i)}><Bell className="h-4 w-4" /></Button>
                  <PaymentsTrigger invoice={i} />
                  <Button variant="ghost" size="icon" title="Edit" onClick={() => { setEditing(i); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" title="Delete" onClick={async () => {
                    if (!confirm("Delete this invoice?")) return;
                    await supabase.from("invoices").delete().eq("id", i.id);
                    qc.invalidateQueries({ queryKey: ["invoices"] });
                  }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <ReminderDialog kind="invoice" row={reminderRow} open={!!reminderRow} onOpenChange={(v) => !v && setReminderRow(null)} />
    </div>
  );
}
