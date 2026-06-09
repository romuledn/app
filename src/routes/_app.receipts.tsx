import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useReceipts, useProfile } from "@/lib/queries";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Download, Send, FileDown, Search, ReceiptText, Trash2 } from "lucide-react";
import { formatMoney } from "@/lib/currency";
import { downloadPdf, downloadCsv, openEmailWithPdf } from "@/lib/pdf";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/receipts")({
  component: Receipts,
});

function Receipts() {
  const { data: receipts = [] } = useReceipts();
  const { data: profile } = useProfile();
  const qc = useQueryClient();
  const [q, setQ] = useState("");

  const buildDoc = (r: any): any => ({
    kind: "RECEIPT",
    number: r.number,
    title: r.invoices?.title || "Payment receipt",
    currency: r.currency,
    items: r.items || [],
    subtotal: Number(r.subtotal),
    discount: Number(r.discount || 0),
    taxRate: Number(r.tax_rate),
    total: Number(r.total),
    amountPaid: Number(r.amount),
    notes: r.notes,
    issueDate: r.issued_at,
    dueOrValidLabel: "Issued",
    dueOrValid: r.issued_at,
    terms: r.terms || profile?.terms_conditions,
    business: {
      name: profile?.business_name,
      email: profile?.business_email,
      phone: profile?.business_phone,
      address: profile?.business_address,
    },
    client: r.clients,
    design: profile?.doc_design,
  });

  const filtered = useMemo(
    () =>
      receipts.filter((r: any) =>
        !q
          ? true
          : `${r.number} ${r.clients?.name} ${r.invoices?.number}`.toLowerCase().includes(q.toLowerCase()),
      ),
    [receipts, q],
  );

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-8 py-8">
      <div>
        <h1 className="font-display text-3xl font-bold">Receipts</h1>
        <p className="text-sm text-muted-foreground">
          Auto-generated when invoices are paid in full.
        </p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-9" placeholder="Search receipts…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      {filtered.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">
            <ReceiptText className="mx-auto mb-2 h-8 w-8 opacity-40" />
            No receipts yet. They appear automatically once an invoice is fully paid.
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        {filtered.map((r: any) => (
          <Card key={r.id}>
            <CardContent className="flex flex-wrap items-center gap-3 p-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">#{r.number}</span>
                  <Badge variant="outline" className="border-success/40 bg-success/20 text-success">PAID</Badge>
                  {r.invoices?.number && (
                    <Badge variant="outline" className="text-[10px]">from INV #{r.invoices.number}</Badge>
                  )}
                </div>
                <p className="truncate text-sm text-muted-foreground">
                  {r.invoices?.title} · {r.clients?.name}
                </p>
              </div>
              <div className="text-right">
                <div className="font-bold text-primary">{formatMoney(Number(r.amount), r.currency)}</div>
                <div className="text-xs text-muted-foreground">{new Date(r.issued_at).toLocaleDateString()}</div>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" title="Download PDF" onClick={() => downloadPdf(buildDoc(r))}>
                  <Download className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" title="Download CSV" onClick={() => downloadCsv(buildDoc(r))}>
                  <FileDown className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  title="Email receipt"
                  onClick={async () => {
                    try {
                      await openEmailWithPdf(buildDoc(r));
                      toast.success(`Receipt #${r.number} sent to ${r.clients?.email}`);
                    } catch (err: any) {
                      toast.error(err.message || "Failed to send receipt");
                    }
                  }}
                >
                  <Send className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  title="Delete receipt"
                  onClick={async () => {
                    if (!confirm("Delete this receipt?")) return;
                    await supabase.from("receipts").delete().eq("id", r.id);
                    qc.invalidateQueries({ queryKey: ["receipts"] });
                    toast.success("Receipt deleted");
                  }}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
