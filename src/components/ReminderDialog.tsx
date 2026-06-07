import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { formatMoney } from "@/lib/currency";
import { Send } from "lucide-react";
import { toast } from "sonner";

type Kind = "invoice" | "quotation";

export function ReminderDialog({
  open, onOpenChange, kind, row,
}: { open: boolean; onOpenChange: (v: boolean) => void; kind: Kind; row: any | null }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [to, setTo] = useState("");

  useEffect(() => {
    if (!row) return;
    setTo(row.clients?.email ?? "");
    if (kind === "invoice") {
      setSubject(`Friendly reminder · Invoice ${row.number}`);
      setBody(
        `Hi ${row.clients?.name || ""},\n\n` +
        `Just a quick reminder that invoice ${row.number} for "${row.title}" ` +
        `(${formatMoney(Number(row.total), row.currency)}) is due on ${row.due_date}.\n\n` +
        `View online: ${window.location.origin}/share/i/${row.share_token}\n\n` +
        `Please let me know if you have any questions.\n\nKind regards,`
      );
    } else {
      setSubject(`Following up · Quotation ${row.number}`);
      setBody(
        `Hi ${row.clients?.name || ""},\n\n` +
        `Following up on quotation ${row.number} for "${row.title}" ` +
        `(${formatMoney(Number(row.total), row.currency)}). Let me know if you'd like to proceed ` +
        `or if you have any questions.\n\n` +
        `View online: ${window.location.origin}/share/q/${row.share_token}\n\n` +
        `Kind regards,`
      );
    }
  }, [row, kind]);

  if (!row) return null;

  const [sending, setSending] = useState(false);

  const send = async () => {
    if (!to) return toast.error("Recipient email missing");
    setSending(true);
    try {
      const { sendEmail } = await import("@/lib/email");
      await sendEmail({ to, subject, message: body });
      const table = kind === "invoice" ? "invoices" : "quotations";
      await supabase.from(table).update({ sent_at: new Date().toISOString() } as any).eq("id", row.id);
      logActivity(user!.id, table, row.id, "reminder_sent", { number: row.number });
      qc.invalidateQueries({ queryKey: [table] });
      toast.success("Reminder sent successfully");
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to send reminder");
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Send {kind === "invoice" ? "payment" : "follow-up"} reminder</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1"><Label>To</Label><Input value={to} onChange={(e) => setTo(e.target.value)} /></div>
          <div className="space-y-1"><Label>Subject</Label><Input value={subject} onChange={(e) => setSubject(e.target.value)} /></div>
          <div className="space-y-1"><Label>Message</Label><Textarea rows={9} value={body} onChange={(e) => setBody(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={send} disabled={sending}><Send className="mr-2 h-4 w-4" /> {sending ? "Sending…" : "Send reminder"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
