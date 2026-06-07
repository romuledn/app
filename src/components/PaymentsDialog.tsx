import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { formatMoney } from "@/lib/currency";
import { logActivity } from "@/lib/activity";
import { CreditCard, Trash2 } from "lucide-react";
import { toast } from "sonner";

export function PaymentsDialog({ invoice, open, onOpenChange }: { invoice: any; open: boolean; onOpenChange: (v: boolean) => void }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [amount, setAmount] = useState<number>(0);
  const [method, setMethod] = useState("");
  const [reference, setReference] = useState("");

  const { data: payments = [] } = useQuery({
    queryKey: ["payments", invoice?.id],
    enabled: !!invoice?.id && open,
    queryFn: async () => {
      const { data } = await supabase.from("invoice_payments").select("*").eq("invoice_id", invoice.id).order("paid_on", { ascending: false });
      return data ?? [];
    },
  });

  const totalPaid = payments.reduce((s: number, p: any) => s + Number(p.amount), 0);
  const remaining = Math.max(0, Number(invoice?.total ?? 0) - totalPaid);
  const pct = invoice?.total ? Math.min(100, (totalPaid / Number(invoice.total)) * 100) : 0;

  const addPayment = async (amt?: number, opts?: { method?: string; reference?: string }) => {
    const value = Number(amt ?? amount);
    if (!value || value <= 0) return toast.error("Enter an amount");
    const m = opts?.method ?? method;
    const r = opts?.reference ?? reference;
    const { error } = await supabase.from("invoice_payments").insert({
      user_id: user!.id, invoice_id: invoice.id, amount: value, method: m, reference: r,
    });
    if (error) return toast.error(error.message);
    const newPaid = totalPaid + value;
    const fullyPaid = newPaid >= Number(invoice.total);
    await supabase.from("invoices").update({
      amount_paid: newPaid,
      status: fullyPaid ? "paid" : "partial",
      paid_at: fullyPaid ? new Date().toISOString() : null,
    }).eq("id", invoice.id);
    logActivity(user!.id, "invoice_payments", invoice.id, "payment_recorded", { number: invoice.number, amount: formatMoney(value, invoice.currency) });
    qc.invalidateQueries({ queryKey: ["payments", invoice.id] });
    qc.invalidateQueries({ queryKey: ["invoices"] });
    qc.invalidateQueries({ queryKey: ["projects"] });
    setAmount(0); setMethod(""); setReference("");
    toast.success(fullyPaid ? "Invoice fully paid 🎉" : "Payment recorded");
  };

  const total = Number(invoice?.total ?? 0);
  const sixtyAmount = Math.max(0, Math.round((total * 0.6 - totalPaid) * 100) / 100);
  const fortyAmount = Math.max(0, Math.round((total - totalPaid) * 100) / 100);
  const sixtyDone = totalPaid >= total * 0.6 - 0.001;
  const fortyDone = totalPaid >= total - 0.001;


  const removePayment = async (p: any) => {
    if (!confirm("Remove this payment?")) return;
    await supabase.from("invoice_payments").delete().eq("id", p.id);
    const newPaid = totalPaid - Number(p.amount);
    await supabase.from("invoices").update({
      amount_paid: newPaid,
      status: newPaid <= 0 ? "sent" : newPaid >= Number(invoice.total) ? "paid" : "partial",
      paid_at: newPaid >= Number(invoice.total) ? new Date().toISOString() : null,
    }).eq("id", invoice.id);
    qc.invalidateQueries({ queryKey: ["payments", invoice.id] });
    qc.invalidateQueries({ queryKey: ["invoices"] });
  };

  if (!invoice) return null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><CreditCard className="h-4 w-4" /> Payments · #{invoice.number}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-lg border bg-muted/40 p-4">
            <div className="flex justify-between text-sm"><span>Paid</span><span className="font-bold text-success">{formatMoney(totalPaid, invoice.currency)}</span></div>
            <div className="flex justify-between text-sm"><span>Remaining</span><span className="font-bold text-primary">{formatMoney(remaining, invoice.currency)}</span></div>
            <Progress value={pct} className="mt-2" />
          </div>

          <div className="space-y-2">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Quick milestones</div>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant={sixtyDone ? "outline" : "default"}
                disabled={sixtyDone || sixtyAmount <= 0}
                onClick={() => addPayment(sixtyAmount, { method: method || "Deposit", reference: reference || "60% deposit" })}
              >
                {sixtyDone ? "60% paid ✓" : `Pay 60% · ${formatMoney(sixtyAmount, invoice.currency)}`}
              </Button>
              <Button
                variant={fortyDone ? "outline" : "default"}
                disabled={fortyDone || fortyAmount <= 0 || !sixtyDone}
                onClick={() => addPayment(fortyAmount, { method: method || "Final", reference: reference || "40% final" })}
                title={!sixtyDone ? "Pay the 60% deposit first" : undefined}
              >
                {fortyDone ? "40% paid ✓" : `Pay 40% · ${formatMoney(fortyAmount, invoice.currency)}`}
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              60% deposit kicks the project off automatically. The 40% balance closes the invoice and issues the receipt.
            </p>
          </div>

          <div className="space-y-2">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Custom payment</div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1"><Label>Amount</Label><Input type="number" value={amount || ""} onChange={(e) => setAmount(Number(e.target.value))} /></div>
              <div className="space-y-1"><Label>Method</Label><Input placeholder="Bank, cash…" value={method} onChange={(e) => setMethod(e.target.value)} /></div>
            </div>
            <div className="space-y-1"><Label>Reference</Label><Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Transaction id, cheque #…" /></div>
            <Button className="w-full" onClick={() => addPayment()}>Add payment</Button>
          </div>

          <div className="space-y-2">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">History</div>
            {payments.length === 0 && <p className="text-xs text-muted-foreground">No payments yet.</p>}
            {payments.map((p: any) => (
              <div key={p.id} className="flex items-center justify-between rounded-md border p-2 text-sm">
                <div>
                  <div className="font-medium">{formatMoney(Number(p.amount), invoice.currency)}</div>
                  <div className="text-xs text-muted-foreground">{p.paid_on} · {p.method || "—"} {p.reference ? `· ${p.reference}` : ""}</div>
                </div>
                <Button variant="ghost" size="icon" onClick={() => removePayment(p)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </div>
            ))}
          </div>
        </div>
        <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function PaymentsTrigger({ invoice }: { invoice: any }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="ghost" size="icon" title="Payments" onClick={() => setOpen(true)}><CreditCard className="h-4 w-4" /></Button>
      <PaymentsDialog invoice={invoice} open={open} onOpenChange={setOpen} />
    </>
  );
}
