import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuotations, useProfile } from "@/lib/queries";
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
import { Plus, Download, Send, CheckCircle2, Trash2, FileText, Link2, FileDown, Search, Bell, Pencil } from "lucide-react";
import { formatMoney } from "@/lib/currency";
import { downloadPdf, downloadCsv, openEmailWithPdf } from "@/lib/pdf";
import { ReminderDialog } from "@/components/ReminderDialog";
import { logActivity } from "@/lib/activity";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/quotations")({
  component: Quotations,
});

function Quotations() {
  const { data: quotes = [] } = useQuotations();
  const { data: profile } = useProfile();
  const qc = useQueryClient();
  const { user } = useAuth();
  const [editing, setEditing] = useState<any | null>(null);
  const [open, setOpen] = useState(false);
  const [reminderRow, setReminderRow] = useState<any | null>(null);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");

  const buildDoc = (row: any): any => ({
    kind: "QUOTATION", number: row.number, title: row.title, currency: row.currency, items: row.items,
    subtotal: Number(row.subtotal), discount: Number(row.discount || 0), taxRate: Number(row.tax_rate),
    depositPercent: Number(row.deposit_percent || 0),
    total: Number(row.total), notes: row.notes, issueDate: row.created_at,
    dueOrValidLabel: "Valid until", dueOrValid: row.valid_until, terms: row.terms || profile?.terms_conditions,
    business: { name: profile?.business_name, email: profile?.business_email, phone: profile?.business_phone, address: profile?.business_address },
    client: row.clients,
    design: profile?.doc_design,
  });

  const filtered = useMemo(() => quotes.filter((row: any) => {
    const matchQ = !q || `${row.number} ${row.title} ${row.clients?.name}`.toLowerCase().includes(q.toLowerCase());
    const matchS = status === "all" || row.status === status;
    return matchQ && matchS;
  }), [quotes, q, status]);

  const acceptAndConvert = async (row: any) => {
    await supabase.from("quotations").update({ status: "converted", accepted_at: new Date().toISOString() }).eq("id", row.id);
    const { error, data } = await supabase.from("invoices").insert({
      user_id: user!.id, client_id: row.client_id, quotation_id: row.id,
      number: `INV-${String(Date.now()).slice(-6)}`, title: row.title, currency: row.currency,
      items: row.items, subtotal: row.subtotal, discount: row.discount, tax_rate: row.tax_rate, total: row.total, notes: row.notes,
      due_date: new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10),
    }).select().maybeSingle();
    if (error) return toast.error(error.message);
    if (data) logActivity(user!.id, "invoices", data.id, "created_from_quote", { number: data.number });
    qc.invalidateQueries({ queryKey: ["quotations"] });
    qc.invalidateQueries({ queryKey: ["invoices"] });
    toast.success("Converted to invoice");
  };

  const exportCsv = () => {
    const headers = ["Number", "Client", "Title", "Currency", "Total", "Status", "Valid"];
    const rows = filtered.map((i: any) => [i.number, i.clients?.name, i.title, i.currency, i.total, i.status, i.valid_until]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = `quotations-${Date.now()}.csv`; a.click();
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-8 py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold">Quotations</h1>
          <p className="text-sm text-muted-foreground">Deposit %, follow-ups, online accept &amp; tracked views.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportCsv}><FileDown className="mr-2 h-4 w-4" /> Export CSV</Button>
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }}>
            <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" /> New quotation</Button></DialogTrigger>
            {open && <DocEditor key={editing?.id ?? "new"} kind="quotation" editing={editing} onDone={() => { setOpen(false); setEditing(null); }} />}
          </Dialog>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="sent">Sent</SelectItem>
            <SelectItem value="accepted">Accepted</SelectItem>
            <SelectItem value="converted">Converted</SelectItem>
            <SelectItem value="declined">Declined</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 && (
        <Card><CardContent className="p-12 text-center text-muted-foreground"><FileText className="mx-auto mb-2 h-8 w-8 opacity-40" />No quotations match.</CardContent></Card>
      )}

      <div className="space-y-2">
        {filtered.map((row: any) => (
          <Card key={row.id} className="cursor-pointer transition hover:border-primary/50" onClick={() => { setEditing(row); setOpen(true); }}>
            <CardContent className="flex flex-wrap items-center gap-3 p-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">#{row.number}</span>
                  <StatusBadge status={row.status} />
                  {row.viewed_at && <Badge variant="outline" className="text-[10px]">viewed</Badge>}
                </div>
                <p className="truncate text-sm text-muted-foreground">{row.title} · {row.clients?.name}</p>
              </div>
              <div className="text-right">
                <div className="font-bold text-primary">{formatMoney(Number(row.total), row.currency)}</div>
                {row.valid_until && <div className="text-xs text-muted-foreground">Valid {new Date(row.valid_until).toLocaleDateString()}</div>}
              </div>
              <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                <Button variant="ghost" size="icon" title="Copy share link" onClick={() => {
                  navigator.clipboard.writeText(`${window.location.origin}/share/q/${row.share_token}`);
                  toast.success("Share link copied");
                }}><Link2 className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" title="Download PDF" onClick={() => downloadPdf(buildDoc(row))}><Download className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" title="Download CSV" onClick={() => downloadCsv(buildDoc(row))}><FileDown className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" title="Send" onClick={async () => {
                  try {
                    await openEmailWithPdf(buildDoc(row), `${window.location.origin}/share/q/${row.share_token}`);
                    await supabase.from("quotations").update({
                      status: "sent", sent_at: new Date().toISOString(),
                      follow_up_at: new Date(Date.now() + 2 * 86400000).toISOString(),
                    }).eq("id", row.id);
                    logActivity(user!.id, "quotations", row.id, "sent", { number: row.number });
                    qc.invalidateQueries({ queryKey: ["quotations"] });
                    toast.success(`Quotation #${row.number} sent to ${row.clients?.email}`);
                  } catch (err: any) {
                    toast.error(err.message || "Failed to send quotation");
                  }
                }}><Send className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" title="Send reminder" onClick={() => setReminderRow(row)}><Bell className="h-4 w-4" /></Button>
                {row.status !== "converted" && (
                  <Button variant="ghost" size="icon" title="Accept & convert to invoice" onClick={() => acceptAndConvert(row)}>
                    <CheckCircle2 className="h-4 w-4 text-success" />
                  </Button>
                )}
                <Button variant="ghost" size="icon" title="Edit" onClick={() => { setEditing(row); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" title="Delete" onClick={async () => {
                  if (!confirm("Delete this quotation?")) return;
                  await supabase.from("quotations").delete().eq("id", row.id);
                  qc.invalidateQueries({ queryKey: ["quotations"] });
                }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <ReminderDialog kind="quotation" row={reminderRow} open={!!reminderRow} onOpenChange={(v) => !v && setReminderRow(null)} />
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    draft: "bg-muted text-muted-foreground",
    sent: "bg-warning/20 text-warning-foreground border-warning/40",
    accepted: "bg-success/20 text-success border-success/40",
    converted: "bg-success/20 text-success border-success/40",
    declined: "bg-destructive/20 text-destructive border-destructive/40",
  };
  return <Badge variant="outline" className={map[status] ?? ""}>{status}</Badge>;
}
