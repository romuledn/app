import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useClients, useHosting, useInvoices, useQuotations } from "@/lib/queries";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Countdown } from "@/components/Countdown";
import { ReminderDialog } from "@/components/ReminderDialog";
import { formatMoney } from "@/lib/currency";
import { differenceInDays, formatDistanceToNow, format, subMonths, startOfMonth, isSameMonth } from "date-fns";
import { AlertTriangle, Bell, Clock, FileText, Receipt, TrendingUp, Users } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, PieChart, Pie, Cell, Legend } from "recharts";

export const Route = createFileRoute("/_app/dashboard")({
  component: Dashboard,
});

const STATUS_COLORS: Record<string, string> = {
  paid: "hsl(var(--success, 142 71% 45%))",
  sent: "#f59e0b",
  partial: "#3b82f6",
  draft: "#94a3b8",
  overdue: "#e63946",
};

function Dashboard() {
  const { data: clients = [] } = useClients();
  const { data: quotations = [] } = useQuotations();
  const { data: invoices = [] } = useInvoices();
  const { data: hosting = [] } = useHosting();
  const [reminder, setReminder] = useState<{ kind: "invoice" | "quotation"; row: any } | null>(null);

  const stats = useMemo(() => {
    const outstanding = invoices
      .filter((i: any) => i.status !== "paid")
      .reduce((s: number, i: any) => s + (Number(i.total) - Number(i.amount_paid)), 0);
    const collected = invoices.reduce((s: number, i: any) => s + Number(i.amount_paid || 0), 0);
    const overdue = invoices.filter((i: any) => i.status !== "paid" && new Date(i.due_date) < new Date()).length;
    const thisMonth = invoices
      .filter((i: any) => i.paid_at && isSameMonth(new Date(i.paid_at), new Date()))
      .reduce((s: number, i: any) => s + Number(i.amount_paid || i.total), 0);
    return { outstanding, overdue, collected, thisMonth };
  }, [invoices]);

  const revenueByMonth = useMemo(() => {
    const months = Array.from({ length: 6 }, (_, i) => startOfMonth(subMonths(new Date(), 5 - i)));
    return months.map((m) => {
      const total = invoices
        .filter((i: any) => i.paid_at && startOfMonth(new Date(i.paid_at)).getTime() === m.getTime())
        .reduce((s: number, i: any) => s + Number(i.amount_paid || i.total), 0);
      return { month: format(m, "MMM"), revenue: total };
    });
  }, [invoices]);

  const statusBreakdown = useMemo(() => {
    const map: Record<string, number> = { paid: 0, sent: 0, partial: 0, draft: 0, overdue: 0 };
    invoices.forEach((i: any) => {
      const overdue = i.status !== "paid" && new Date(i.due_date) < new Date();
      const k = overdue ? "overdue" : i.status;
      if (k in map) map[k] += 1;
    });
    return Object.entries(map).filter(([, v]) => v > 0).map(([name, value]) => ({ name, value }));
  }, [invoices]);

  const dueInvoices = invoices
    .filter((i: any) => i.status !== "paid")
    .sort((a: any, b: any) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())
    .slice(0, 6);

  const pendingQuotations = quotations
    .filter((q: any) => q.status === "sent" || q.status === "draft")
    .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 6);

  const notifications = useMemo(() => {
    const n: { id: string; kind: "invoice" | "quotation"; row: any; severity: "danger" | "warn" | "info"; label: string; when: string }[] = [];
    const now = new Date();
    invoices.forEach((i: any) => {
      if (i.status === "paid") return;
      const d = differenceInDays(new Date(i.due_date), now);
      if (d <= 7) n.push({
        id: `i-${i.id}`, kind: "invoice", row: i,
        severity: d < 0 ? "danger" : d <= 2 ? "warn" : "info",
        label: d < 0 ? `Overdue ${-d}d · #${i.number}` : d === 0 ? `Due today · #${i.number}` : `Due in ${d}d · #${i.number}`,
        when: i.clients?.name || "",
      });
    });
    quotations.forEach((q: any) => {
      if (q.status !== "sent") return;
      const sent = q.sent_at ? new Date(q.sent_at) : new Date(q.created_at);
      const days = differenceInDays(now, sent);
      if (days >= 2) n.push({
        id: `q-${q.id}`, kind: "quotation", row: q,
        severity: days >= 7 ? "danger" : "warn",
        label: `No reply · ${days}d · #${q.number}`,
        when: q.clients?.name || "",
      });
    });
    return n.sort((a, b) => (a.severity === "danger" ? -1 : 1));
  }, [invoices, quotations]);

  const cur = invoices[0]?.currency || "ZAR";

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 md:space-y-8 md:px-8 md:py-8">
      <div>
        <h1 className="font-display text-3xl font-bold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">A snapshot of what needs your attention today.</p>
      </div>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Stat icon={Users} label="Clients" value={clients.length} />
        <Stat icon={FileText} label="Quotations" value={quotations.length} />
        <Stat icon={Receipt} label="This month" value={formatMoney(stats.thisMonth, cur)} />
        <Stat icon={TrendingUp} label="Outstanding" value={formatMoney(stats.outstanding, cur)}
          accent={stats.overdue > 0} sub={stats.overdue > 0 ? `${stats.overdue} overdue` : undefined} />
      </div>

      {notifications.length > 0 && (
        <Card className="border-primary/30 bg-gradient-to-br from-card to-accent/30">
          <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base">
            <Bell className="h-4 w-4 text-primary" /> Notifications · {notifications.length}
          </CardTitle></CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {notifications.slice(0, 10).map((n) => (
              <button
                key={n.id}
                onClick={() => setReminder({ kind: n.kind, row: n.row })}
                className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition hover:scale-[1.02] ${
                  n.severity === "danger" ? "border-destructive/50 bg-destructive/10 text-destructive"
                  : n.severity === "warn" ? "border-warning/50 bg-warning/10"
                  : "border-border bg-card"
                }`}
              >
                <AlertTriangle className="h-3 w-3" />
                <span className="font-medium">{n.label}</span>
                <span className="opacity-60">· {n.when}</span>
              </button>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Revenue · last 6 months</CardTitle></CardHeader>
          <CardContent style={{ height: 240 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={revenueByMonth}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="month" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip formatter={(v: any) => formatMoney(Number(v), cur)} />
                <Bar dataKey="revenue" fill="hsl(var(--primary, 0 84% 60%))" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Invoice status</CardTitle></CardHeader>
          <CardContent style={{ height: 240 }}>
            {statusBreakdown.length === 0 ? (
              <p className="text-sm text-muted-foreground">No invoices yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={statusBreakdown} dataKey="value" nameKey="name" innerRadius={45} outerRadius={75}>
                    {statusBreakdown.map((s, i) => <Cell key={i} fill={STATUS_COLORS[s.name] || "#888"} />)}
                  </Pie>
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base"><Clock className="h-4 w-4 text-primary" /> Due invoices</CardTitle>
            <Link to="/invoices" className="text-xs text-primary underline">View all</Link>
          </CardHeader>
          <CardContent className="space-y-2">
            {dueInvoices.length === 0 && <p className="text-sm text-muted-foreground">No outstanding invoices.</p>}
            {dueInvoices.map((i: any) => (
              <div key={i.id} className="flex items-center justify-between gap-2 rounded-lg border bg-card p-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">#{i.number} · {i.clients?.name}</div>
                  <div className="truncate text-xs text-muted-foreground">{i.title} · {formatMoney(Number(i.total), i.currency)}</div>
                </div>
                <div className="flex items-center gap-2">
                  <Countdown target={i.due_date} />
                  <Button size="icon" variant="ghost" title="Send reminder" onClick={() => setReminder({ kind: "invoice", row: i })}>
                    <Bell className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base"><FileText className="h-4 w-4 text-primary" /> Pending quotations</CardTitle>
            <Link to="/quotations" className="text-xs text-primary underline">View all</Link>
          </CardHeader>
          <CardContent className="space-y-2">
            {pendingQuotations.length === 0 && <p className="text-sm text-muted-foreground">All quotations responded.</p>}
            {pendingQuotations.map((q: any) => {
              const sentAgo = q.sent_at ? formatDistanceToNow(new Date(q.sent_at), { addSuffix: true }) : "draft";
              return (
                <div key={q.id} className="flex items-center justify-between gap-2 rounded-lg border bg-card p-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium">#{q.number} · {q.clients?.name}</span>
                      <Badge variant="outline" className="text-[10px]">{q.status}</Badge>
                    </div>
                    <div className="truncate text-xs text-muted-foreground">{q.title} · sent {sentAgo}</div>
                  </div>
                  <Button size="icon" variant="ghost" title="Send reminder" onClick={() => setReminder({ kind: "quotation", row: q })}>
                    <Bell className="h-4 w-4" />
                  </Button>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      <ReminderDialog
        kind={reminder?.kind ?? "invoice"}
        row={reminder?.row ?? null}
        open={!!reminder}
        onOpenChange={(v) => !v && setReminder(null)}
      />
    </div>
  );
}

function Stat({ icon: Icon, label, value, sub, accent }:
  { icon: any; label: string; value: string | number; sub?: string; accent?: boolean }) {
  return (
    <Card className={accent ? "border-primary/40" : undefined}>
      <CardContent className="flex items-center justify-between p-5">
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
          <div className="mt-1 truncate font-display text-2xl font-bold">{value}</div>
          {sub && <div className="mt-1 text-xs text-destructive">{sub}</div>}
        </div>
        <div className="rounded-xl bg-accent p-3 text-accent-foreground"><Icon className="h-5 w-5" /></div>
      </CardContent>
    </Card>
  );
}
