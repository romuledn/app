import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useProfile } from "@/lib/queries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { formatMoney } from "@/lib/currency";
import { logActivity } from "@/lib/activity";
import { sendEmail } from "@/lib/email";
import { CreditCard, Trash2, Send, ExternalLink, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";

export function PaymentsDialog({ invoice, open, onOpenChange }: { invoice: any; open: boolean; onOpenChange: (v: boolean) => void }) {
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const qc = useQueryClient();
  const [amount, setAmount] = useState<number>(0);
  const [method, setMethod] = useState("");
  const [reference, setReference] = useState("");
  const [showTrackingPreview, setShowTrackingPreview] = useState(false);
  const [trackingProject, setTrackingProject] = useState<any>(null);
  const [sendingTracking, setSendingTracking] = useState(false);
  const [trackingSent, setTrackingSent] = useState(false);

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

  const findProject = async () => {
    // Find project linked to this invoice via quotation_id
    if (invoice?.quotation_id) {
      const { data: proj } = await supabase
        .from("projects")
        .select("*, clients(*)")
        .eq("quotation_id", invoice.quotation_id)
        .maybeSingle();
      if (proj) return proj;
    }
    // Fallback: find project by client_id
    if (invoice?.client_id) {
      const { data: proj } = await supabase
        .from("projects")
        .select("*, clients(*)")
        .eq("client_id", invoice.client_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (proj) return proj;
    }
    return null;
  };

  const addPayment = async (amt?: number, opts?: { method?: string; reference?: string; isDeposit?: boolean }) => {
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
    toast.success(fullyPaid ? "Invoice fully paid" : "Payment recorded");

    // If this was a deposit (60%), find the project and show tracking email preview
    if (opts?.isDeposit) {
      const proj = await findProject();
      if (proj) {
        // Enable client_visible on the project
        await supabase.from("projects").update({ client_visible: true }).eq("id", proj.id);
        setTrackingProject({ ...proj, client_visible: true });
        setShowTrackingPreview(true);
        setTrackingSent(false);
      } else {
        toast.info("No linked project found — create a project to share a tracking link.");
      }
    }
  };

  const total = Number(invoice?.total ?? 0);
  const sixtyAmount = Math.max(0, Math.round((total * 0.6 - totalPaid) * 100) / 100);
  const fortyAmount = Math.max(0, Math.round((total - totalPaid) * 100) / 100);
  const sixtyDone = totalPaid >= total * 0.6 - 0.001;
  const fortyDone = totalPaid >= total - 0.001;

  const trackingUrl = trackingProject
    ? `${window.location.origin}/share/p/${trackingProject.share_token}`
    : "";

  const clientName = invoice?.clients?.name || invoice?.clients?.company || "Client";
  const clientEmail = invoice?.clients?.email || "";
  const businessName = profile?.business_name || "Senes Media";

  const trackingEmailSubject = `Your project is underway — ${invoice?.title || "Project"}`;
  const trackingEmailBody =
    `Hi ${clientName},\n\n` +
    `Great news! We've received your 60% deposit payment of ${formatMoney(sixtyAmount || total * 0.6, invoice?.currency || "ZAR")} for "${invoice?.title}".\n\n` +
    `Your project is now officially underway. You can track the progress live using the link below:\n\n` +
    `${trackingUrl}\n\n` +
    `This page updates in real-time as our team makes progress. You can also leave feedback and request revision meetings directly from the tracking page.\n\n` +
    `Thank you for your trust in us!\n\n` +
    `Kind regards,\n${businessName}`;

  const sendTrackingEmail = async () => {
    if (!clientEmail) return toast.error("No client email — add an email to the client first.");
    setSendingTracking(true);
    try {
      await sendEmail({
        to: clientEmail,
        subject: trackingEmailSubject,
        message: trackingEmailBody,
        replyTo: profile?.business_email || undefined,
        documentType: "Project Tracking",
        documentNumber: invoice?.number || "",
        clientName,
        total: formatMoney(total, invoice?.currency),
        shareUrl: trackingUrl,
        trackingId: invoice?.id,
        trackingTable: "i",
      });
      logActivity(user!.id, "projects", trackingProject.id, "tracking_sent", { number: invoice?.number, client: clientName });
      setTrackingSent(true);
      toast.success(`Tracking link sent to ${clientEmail}`);
    } catch (err: any) {
      toast.error(err.message || "Failed to send tracking email");
    } finally {
      setSendingTracking(false);
    }
  };

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
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) { setShowTrackingPreview(false); setTrackingProject(null); setTrackingSent(false); } }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
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
                onClick={() => addPayment(sixtyAmount, { method: method || "Deposit", reference: reference || "60% deposit", isDeposit: true })}
              >
                {sixtyDone ? "60% paid" : `Pay 60% · ${formatMoney(sixtyAmount, invoice.currency)}`}
              </Button>
              <Button
                variant={fortyDone ? "outline" : "default"}
                disabled={fortyDone || fortyAmount <= 0 || !sixtyDone}
                onClick={() => addPayment(fortyAmount, { method: method || "Final", reference: reference || "40% final" })}
                title={!sixtyDone ? "Pay the 60% deposit first" : undefined}
              >
                {fortyDone ? "40% paid" : `Pay 40% · ${formatMoney(fortyAmount, invoice.currency)}`}
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              60% deposit kicks the project off and sends the client a live tracking link. The 40% balance closes the invoice.
            </p>
          </div>

          {/* Tracking Email Preview */}
          {showTrackingPreview && trackingProject && (
            <div className="space-y-3 rounded-xl border-2 border-blue-200 bg-blue-50/50 dark:border-blue-900 dark:bg-blue-950/30 p-4">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900">
                  <Send className="h-4 w-4 text-blue-600" />
                </div>
                <div>
                  <div className="text-sm font-semibold">Send tracking link to {clientName}</div>
                  <div className="text-xs text-muted-foreground">Preview of the email that will be sent to {clientEmail}</div>
                </div>
              </div>

              {/* Email Preview Card */}
              <div className="rounded-lg border bg-white dark:bg-card shadow-sm overflow-hidden">
                {/* Email Header */}
                <div className="border-b bg-muted/30 px-4 py-2.5">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">To:</span> {clientEmail}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">Subject:</span> {trackingEmailSubject}
                  </div>
                </div>

                {/* Email Body Preview */}
                <div className="p-4 space-y-4">
                  <div className="rounded-lg border bg-card p-5 shadow-sm">
                    <div className="text-center mb-4">
                      <h3 className="text-base font-semibold">Your Project Tracking from {businessName}</h3>
                    </div>
                    <div className="text-sm leading-relaxed text-muted-foreground space-y-3">
                      <p>Hi {clientName},</p>
                      <p>
                        Great news! We've received your 60% deposit payment of{" "}
                        <span className="font-semibold text-foreground">
                          {formatMoney(sixtyAmount || total * 0.6, invoice?.currency || "ZAR")}
                        </span>{" "}
                        for "<span className="font-medium text-foreground">{invoice?.title}</span>".
                      </p>
                      <p>Your project is now officially underway. You can track the progress live using the link below:</p>
                    </div>

                    {/* Summary Table */}
                    <div className="my-4 rounded-lg bg-muted/40 p-3">
                      <table className="w-full text-sm">
                        <tbody>
                          <tr>
                            <td className="py-1 text-muted-foreground">Project</td>
                            <td className="py-1 font-semibold text-right">{trackingProject.title || invoice?.title}</td>
                          </tr>
                          <tr>
                            <td className="py-1 text-muted-foreground">Client</td>
                            <td className="py-1 font-semibold text-right">{clientName}</td>
                          </tr>
                          <tr>
                            <td className="py-1 text-muted-foreground">Invoice Total</td>
                            <td className="py-1 font-semibold text-right">{formatMoney(total, invoice?.currency)}</td>
                          </tr>
                          <tr>
                            <td className="py-1 text-muted-foreground">Deposit Paid</td>
                            <td className="py-1 font-semibold text-right text-success">
                              {formatMoney(sixtyAmount || total * 0.6, invoice?.currency || "ZAR")}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {/* CTA Button Preview */}
                    <div className="text-center my-4">
                      <span className="inline-block rounded-lg bg-red-600 px-8 py-3 text-sm font-semibold text-white shadow">
                        Track Your Project Live
                      </span>
                    </div>

                    <div className="text-sm leading-relaxed text-muted-foreground space-y-3">
                      <p>This page updates in real-time as our team makes progress. You can also leave feedback and request revision meetings directly from the tracking page.</p>
                      <p>Thank you for your trust in us!</p>
                      <p>Kind regards,<br /><span className="font-medium text-foreground">{businessName}</span></p>
                    </div>
                  </div>

                  {/* Footer Preview */}
                  <div className="text-center text-[11px] text-muted-foreground">
                    <p>&copy; {new Date().getFullYear()} {businessName}</p>
                    <p>This is a transactional email regarding your project with {businessName}.</p>
                  </div>
                </div>
              </div>

              {/* Tracking URL */}
              <div className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-xs">
                <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="truncate text-muted-foreground">{trackingUrl}</span>
                <Button size="sm" variant="ghost" className="shrink-0 h-6 px-2 text-[10px]" onClick={() => {
                  navigator.clipboard.writeText(trackingUrl);
                  toast.success("Tracking link copied");
                }}>Copy</Button>
              </div>

              {/* Send / Sent Actions */}
              {trackingSent ? (
                <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/30 p-3 text-sm text-green-700 dark:text-green-400">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Tracking link sent to {clientEmail}</span>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Button className="flex-1" onClick={sendTrackingEmail} disabled={sendingTracking}>
                    {sendingTracking ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending...</>
                    ) : (
                      <><Send className="mr-2 h-4 w-4" /> Send tracking link to {clientName}</>
                    )}
                  </Button>
                  <Button variant="outline" onClick={() => setShowTrackingPreview(false)}>Skip</Button>
                </div>
              )}
            </div>
          )}

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
