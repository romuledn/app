import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { useClients, useProfile } from "@/lib/queries";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CURRENCIES, formatMoney } from "@/lib/currency";
import { downloadPdf, openEmailWithPdf, type DocData, type LineItem } from "@/lib/pdf";
import { logActivity } from "@/lib/activity";
import { Plus, Trash2, Download, Send, Link2, Copy } from "lucide-react";
import { toast } from "sonner";

type Kind = "quotation" | "invoice";

export function DocEditor({
  kind, editing, onDone, defaultQuotationId,
}: { kind: Kind; editing: any | null; onDone: () => void; defaultQuotationId?: string }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: clients = [] } = useClients();
  const { data: profile } = useProfile();
  const isQuote = kind === "quotation";
  const table = isQuote ? "quotations" : "invoices";

  const [form, setForm] = useState(() => ({
    client_id: editing?.client_id ?? "",
    number: editing?.number ?? `${isQuote ? "Q" : "INV"}-${String(Date.now()).slice(-6)}`,
    title: editing?.title ?? "",
    currency: editing?.currency ?? profile?.default_currency ?? "ZAR",
    items: (editing?.items as LineItem[]) ?? [{ description: "", quantity: 1, price: 0 }],
    tax_rate: Number(editing?.tax_rate ?? 0),
    discount: Number(editing?.discount ?? 0),
    deposit_percent: Number(editing?.deposit_percent ?? profile?.deposit_percent ?? 60),
    notes: editing?.notes ?? "",
    valid_until: editing?.valid_until ?? (isQuote ? new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10) : null),
    due_date: editing?.due_date ?? (!isQuote ? new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10) : null),
    issue_date: editing?.issue_date ?? new Date().toISOString().slice(0, 10),
    quotation_id: editing?.quotation_id ?? defaultQuotationId ?? null,
    recurring_interval: editing?.recurring_interval ?? "",
    terms: editing?.terms ?? profile?.terms_conditions ?? "",
  }));

  useEffect(() => {
    if (!editing && profile?.terms_conditions && !form.terms) {
      setForm((f) => ({ ...f, terms: profile.terms_conditions ?? "" }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.terms_conditions]);

  useEffect(() => {
    if (!editing && profile?.default_currency) setForm((f) => ({ ...f, currency: profile.default_currency }));
  }, [profile, editing]);

  const subtotal = useMemo(
    () => form.items.reduce((s, i) => s + Number(i.quantity || 0) * Number(i.price || 0), 0),
    [form.items],
  );
  const afterDiscount = Math.max(0, subtotal - Number(form.discount || 0));
  const total = afterDiscount + afterDiscount * (Number(form.tax_rate) / 100);
  const depositAmt = total * (Number(form.deposit_percent) / 100);

  const updateItem = (idx: number, patch: Partial<LineItem>) =>
    setForm((f) => ({ ...f, items: f.items.map((it, i) => (i === idx ? { ...it, ...patch } : it)) }));

  const save = async (status?: string) => {
    if (!form.client_id) return toast.error("Pick a client");
    if (!form.title) return toast.error("Add a title");
    const payload: any = {
      user_id: user!.id,
      client_id: form.client_id,
      number: form.number,
      title: form.title,
      currency: form.currency,
      items: form.items,
      subtotal,
      discount: Number(form.discount || 0),
      tax_rate: Number(form.tax_rate),
      total,
      notes: form.notes,
      terms: form.terms || null,
    };
    if (!editing) payload.created_by = user!.id;
    if (isQuote) {
      payload.valid_until = form.valid_until;
      payload.deposit_percent = Number(form.deposit_percent);
    } else {
      payload.issue_date = form.issue_date;
      payload.due_date = form.due_date;
      payload.quotation_id = form.quotation_id;
      payload.recurring_interval = form.recurring_interval || null;
    }
    if (status) {
      payload.status = status;
      if (status === "sent") {
        payload.sent_at = new Date().toISOString();
        payload.sent_by = user!.id;
        if (isQuote) payload.follow_up_at = new Date(Date.now() + 2 * 86400000).toISOString();
      }
    }
    const { data, error } = editing
      ? await supabase.from(table).update(payload).eq("id", editing.id).select("*, clients(*)").maybeSingle()
      : await supabase.from(table).insert(payload).select("*, clients(*)").maybeSingle();
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: [table] });
    if (data) logActivity(user!.id, table, data.id, status ? `marked_${status}` : editing ? "updated" : "created", { number: data.number });
    toast.success(status === "sent" ? "Marked as sent" : "Saved");
    return data;
  };

  const buildDoc = (row: any): DocData => ({
    kind: isQuote ? "QUOTATION" : "INVOICE",
    number: row.number,
    title: row.title,
    currency: row.currency,
    items: row.items as LineItem[],
    subtotal: Number(row.subtotal),
    discount: Number(row.discount || 0),
    taxRate: Number(row.tax_rate),
    depositPercent: isQuote ? Number(row.deposit_percent || 0) : 0,
    total: Number(row.total),
    notes: row.notes,
    bankDetails: (profile?.bank_accounts as Record<string, string> | null)?.[row.currency || profile?.default_currency || "ZAR"] || profile?.bank_details || null,
    issueDate: isQuote ? new Date().toISOString() : row.issue_date,
    dueOrValidLabel: isQuote ? "Valid until" : "Due",
    dueOrValid: isQuote ? row.valid_until : row.due_date,
    terms: row.terms || profile?.terms_conditions,
    business: {
      name: profile?.business_name,
      email: profile?.business_email,
      phone: profile?.business_phone,
      address: profile?.business_address,
    },
    client: row.clients,
    design: profile?.doc_design as any,
  });

  const shareUrl = (row: any) =>
    `${window.location.origin}/share/${isQuote ? "q" : "i"}/${row.share_token}`;

  const handleDownload = async () => {
    const row = await save();
    if (row) await downloadPdf(buildDoc(row));
  };
  const handleSend = async () => {
    const row = await save("sent");
    if (row) {
      try {
        await openEmailWithPdf(buildDoc(row), shareUrl(row), row.id);
        toast.success("Sent successfully");
      } catch (err: any) {
        toast.error(err.message || "Failed to send");
      }
    }
    onDone();
  };
  const handleCopyLink = async () => {
    const row = await save();
    if (row) {
      navigator.clipboard.writeText(shareUrl(row));
      toast.success("Share link copied");
    }
  };

  return (
    <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>{editing ? "Edit" : "New"} {isQuote ? "quotation" : "invoice"}</DialogTitle>
      </DialogHeader>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Client *">
            <Select value={form.client_id} onValueChange={(v) => setForm({ ...form, client_id: v })}>
              <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
              <SelectContent>
                {clients.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}{c.company ? ` · ${c.company}` : ""}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Number"><Input value={form.number} onChange={(e) => setForm({ ...form, number: e.target.value })} /></Field>
        </div>
        <Field label="Title *"><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Website redesign" /></Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Currency">
            <Select value={form.currency} onValueChange={(v) => setForm({ ...form, currency: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CURRENCIES.map((c) => <SelectItem key={c.code} value={c.code}>{c.symbol} {c.code}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          {isQuote ? (
            <Field label="Valid until"><Input type="date" value={form.valid_until ?? ""} onChange={(e) => setForm({ ...form, valid_until: e.target.value })} /></Field>
          ) : (
            <>
              <Field label="Issue date"><Input type="date" value={form.issue_date} onChange={(e) => setForm({ ...form, issue_date: e.target.value })} /></Field>
              <Field label="Due date"><Input type="date" value={form.due_date ?? ""} onChange={(e) => setForm({ ...form, due_date: e.target.value })} /></Field>
            </>
          )}
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <Label>Line items</Label>
            <Button variant="outline" size="sm" onClick={() => setForm({ ...form, items: [...form.items, { description: "", quantity: 1, price: 0 }] })}>
              <Plus className="mr-1 h-3 w-3" /> Add row
            </Button>
          </div>
          <div className="space-y-3">
            {form.items.map((it, idx) => (
              <div key={idx} className="rounded-lg border bg-card p-3 space-y-2">
                <div className="grid grid-cols-12 gap-2">
                  <Textarea className="col-span-6" rows={1} placeholder="Title / description" value={it.description} onChange={(e) => updateItem(idx, { description: e.target.value })} />
                  <Input className="col-span-2" type="number" placeholder="Qty" value={it.quantity} onChange={(e) => updateItem(idx, { quantity: Number(e.target.value) })} />
                  <Input className="col-span-3" type="number" placeholder="Price" value={it.price} onChange={(e) => updateItem(idx, { price: Number(e.target.value) })} />
                  <Button variant="ghost" size="icon" className="col-span-1" onClick={() => setForm({ ...form, items: form.items.filter((_, i) => i !== idx) })}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
                <Textarea
                  rows={2}
                  className="text-xs"
                  placeholder="Notes for this item (deliverables, assumptions, exclusions…)"
                  value={(it as any).notes ?? ""}
                  onChange={(e) => updateItem(idx, { notes: e.target.value } as any)}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Field label="Discount"><Input type="number" value={form.discount} onChange={(e) => setForm({ ...form, discount: Number(e.target.value) })} /></Field>
          <Field label="Tax %"><Input type="number" value={form.tax_rate} onChange={(e) => setForm({ ...form, tax_rate: Number(e.target.value) })} /></Field>
          {isQuote ? (
            <Field label="Deposit %"><Input type="number" value={form.deposit_percent} onChange={(e) => setForm({ ...form, deposit_percent: Number(e.target.value) })} /></Field>
          ) : (
            <Field label="Recurring">
              <Select value={form.recurring_interval || "none"} onValueChange={(v) => setForm({ ...form, recurring_interval: v === "none" ? "" : v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">One-off</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="quarterly">Quarterly</SelectItem>
                  <SelectItem value="yearly">Yearly</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          )}
        </div>

        <Field label="Notes"><Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>

        <Field label="Terms & Conditions (printed on the document)">
          <Textarea
            rows={3}
            value={form.terms}
            placeholder="All projects undertaken by SENES require a non-refundable 60% down payment…"
            onChange={(e) => setForm({ ...form, terms: e.target.value })}
          />
        </Field>

        <div className="rounded-lg border bg-muted/40 p-4 text-right text-sm">
          <div>Subtotal: <span className="font-medium">{formatMoney(subtotal, form.currency)}</span></div>
          {Number(form.discount) > 0 && <div>Discount: <span className="font-medium">- {formatMoney(Number(form.discount), form.currency)}</span></div>}
          {form.tax_rate > 0 && <div>Tax ({form.tax_rate}%): <span className="font-medium">{formatMoney(afterDiscount * Number(form.tax_rate) / 100, form.currency)}</span></div>}
          <div className="mt-1 text-lg font-bold text-primary">Total: {formatMoney(total, form.currency)}</div>
          {isQuote && Number(form.deposit_percent) > 0 && (
            <div className="text-xs text-muted-foreground">Deposit ({form.deposit_percent}%): {formatMoney(depositAmt, form.currency)}</div>
          )}
        </div>
      </div>

      <DialogFooter className="flex-wrap gap-2">
        <Button variant="outline" onClick={() => save().then(() => onDone())}>Save draft</Button>
        <Button variant="outline" onClick={handleCopyLink}><Link2 className="mr-2 h-4 w-4" /> Copy share link</Button>
        <Button variant="outline" onClick={handleDownload}><Download className="mr-2 h-4 w-4" /> Download PDF</Button>
        <Button onClick={handleSend}><Send className="mr-2 h-4 w-4" /> Send to client</Button>
      </DialogFooter>
    </DialogContent>
  );
}

function Field({ label, children }: { label: string; children: any }) {
  return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>;
}
