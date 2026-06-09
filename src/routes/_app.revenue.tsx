import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useInvoices } from "@/lib/queries";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { formatMoney } from "@/lib/currency";
import { format, startOfMonth, subMonths, isSameMonth } from "date-fns";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Line, LineChart } from "recharts";
import { TrendingUp, ArrowUpRight, ArrowDownRight, Receipt, Globe2, FileText, Clock, CheckCircle2, AlertCircle } from "lucide-react";

export const Route = createFileRoute("/_app/revenue")({
  component: Revenue,
});

const CURRENCY_META: Record<string, { label: string; flag: string; country: string; color: string }> = {
  ZAR: { label: "South African Rand", flag: "\u{1F1FF}\u{1F1E6}", country: "South Africa", color: "hsl(142, 71%, 45%)" },
  USD: { label: "US Dollar", flag: "\u{1F1FA}\u{1F1F8}", country: "United States", color: "hsl(217, 91%, 60%)" },
  MWK: { label: "Malawian Kwacha", flag: "\u{1F1F2}\u{1F1FC}", country: "Malawi", color: "hsl(0, 84%, 60%)" },
};

function Revenue() {
  const { data: invoices = [] } = useInvoices();

  const currencies = useMemo(() => {
    const set = new Set<string>(["ZAR", "USD", "MWK"]);
    invoices.forEach((i: any) => i.currency && set.add(i.currency));
    return Array.from(set);
  }, [invoices]);

  const [active, setActive] = useState<string>("overview");

  // Overview stats per currency
  const overviewStats = useMemo(() => {
    const now = new Date();
    const thisMonth = startOfMonth(now);
    const prevMonth = startOfMonth(subMonths(now, 1));

    return currencies.map((c) => {
      const meta = CURRENCY_META[c] || { label: c, flag: "\u{1F310}", country: c, color: "hsl(0, 0%, 60%)" };
      const curr = invoices.filter((i: any) => (i.currency || "ZAR") === c);

      const totalInvoices = curr.length;
      const paidInvoices = curr.filter((i: any) => i.paid_at);
      const unpaidInvoices = curr.filter((i: any) => !i.paid_at && i.status !== "cancelled");

      const monthRevenue = paidInvoices
        .filter((i: any) => isSameMonth(new Date(i.paid_at), thisMonth))
        .reduce((s, i: any) => s + Number(i.amount_paid || i.total), 0);

      const prevMonthRevenue = paidInvoices
        .filter((i: any) => isSameMonth(new Date(i.paid_at), prevMonth))
        .reduce((s, i: any) => s + Number(i.amount_paid || i.total), 0);

      const ytdRevenue = paidInvoices
        .filter((i: any) => new Date(i.paid_at).getFullYear() === now.getFullYear())
        .reduce((s, i: any) => s + Number(i.amount_paid || i.total), 0);

      const allTimeRevenue = paidInvoices.reduce((s, i: any) => s + Number(i.amount_paid || i.total), 0);

      const outstanding = unpaidInvoices.reduce((s, i: any) => s + Number(i.total), 0);

      const delta = prevMonthRevenue === 0 ? (monthRevenue > 0 ? 100 : 0) : ((monthRevenue - prevMonthRevenue) / prevMonthRevenue) * 100;

      return { code: c, meta, totalInvoices, monthRevenue, prevMonthRevenue, ytdRevenue, allTimeRevenue, outstanding, delta, paidCount: paidInvoices.length, unpaidCount: unpaidInvoices.length };
    });
  }, [invoices, currencies]);

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 md:px-8 md:py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">Revenue</h1>
          <p className="text-sm text-muted-foreground">Track performance across all markets and currencies.</p>
        </div>
        <Badge variant="outline" className="gap-1.5"><Globe2 className="h-3 w-3" /> {currencies.length} currencies tracked</Badge>
      </div>

      <Tabs value={active} onValueChange={setActive}>
        <TabsList className="flex flex-wrap w-full md:w-auto md:inline-flex">
          <TabsTrigger value="overview" className="gap-2">
            <TrendingUp className="h-3.5 w-3.5" />
            <span>Overview</span>
          </TabsTrigger>
          {currencies.map((c) => {
            const meta = CURRENCY_META[c] || { label: c, flag: "\u{1F310}", country: c, color: "" };
            return (
              <TabsTrigger key={c} value={c} className="gap-2">
                <span className="text-base">{meta.flag}</span>
                <span className="hidden sm:inline">{meta.country}</span>
                <span className="text-xs text-muted-foreground">({c})</span>
              </TabsTrigger>
            );
          })}
        </TabsList>

        {/* ===== OVERVIEW TAB ===== */}
        <TabsContent value="overview" className="mt-6 space-y-6">
          {/* Summary cards per currency */}
          <div className="grid gap-4 md:grid-cols-3">
            {overviewStats.map((s) => (
              <Card key={s.code} className="cursor-pointer hover:border-primary/40 transition-colors" onClick={() => setActive(s.code)}>
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2.5">
                      <span className="text-2xl">{s.meta.flag}</span>
                      <div>
                        <div className="font-display font-bold">{s.meta.country}</div>
                        <div className="text-xs text-muted-foreground">{s.meta.label}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 text-xs">
                      {s.delta >= 0 ? <ArrowUpRight className="h-3.5 w-3.5 text-success" /> : <ArrowDownRight className="h-3.5 w-3.5 text-destructive" />}
                      <span className={s.delta >= 0 ? "text-success font-medium" : "text-destructive font-medium"}>
                        {s.delta >= 0 ? "+" : ""}{s.delta.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                  <div className="font-display text-3xl font-bold text-primary">{formatMoney(s.monthRevenue, s.code)}</div>
                  <div className="text-xs text-muted-foreground mt-1">This month's revenue</div>
                  <div className="mt-4 grid grid-cols-3 gap-2 pt-3 border-t">
                    <div>
                      <div className="text-xs text-muted-foreground">YTD</div>
                      <div className="text-sm font-semibold">{formatMoney(s.ytdRevenue, s.code)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">All-time</div>
                      <div className="text-sm font-semibold">{formatMoney(s.allTimeRevenue, s.code)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Outstanding</div>
                      <div className="text-sm font-semibold text-amber-500">{formatMoney(s.outstanding, s.code)}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Quick stats */}
          <div className="grid gap-4 md:grid-cols-4">
            {overviewStats.map((s) => (
              <Card key={`inv-${s.code}`}>
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="rounded-xl p-2.5" style={{ backgroundColor: `${s.meta.color}20` }}>
                    <FileText className="h-5 w-5" style={{ color: s.meta.color }} />
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">{s.code} Invoices</div>
                    <div className="font-bold text-lg">{s.totalInvoices}</div>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                      <span className="flex items-center gap-0.5"><CheckCircle2 className="h-2.5 w-2.5 text-success" /> {s.paidCount} paid</span>
                      <span className="flex items-center gap-0.5"><Clock className="h-2.5 w-2.5 text-amber-500" /> {s.unpaidCount} pending</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="rounded-xl bg-primary/10 p-2.5">
                  <Receipt className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Total Invoices</div>
                  <div className="font-bold text-lg">{invoices.length}</div>
                  <div className="text-[10px] text-muted-foreground">Across all currencies</div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 12-month comparison chart */}
          <ComparisonChart invoices={invoices} currencies={currencies} />
        </TabsContent>

        {/* ===== PER-CURRENCY TABS ===== */}
        {currencies.map((c) => (
          <TabsContent key={c} value={c} className="mt-6">
            <CurrencyPanel currency={c} invoices={invoices.filter((i: any) => (i.currency || "ZAR") === c)} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

/* ===== Comparison chart across currencies ===== */
function ComparisonChart({ invoices, currencies }: { invoices: any[]; currencies: string[] }) {
  const months = useMemo(
    () => Array.from({ length: 12 }, (_, i) => startOfMonth(subMonths(new Date(), 11 - i))),
    [],
  );

  const data = months.map((m) => {
    const row: any = { month: format(m, "MMM") };
    currencies.forEach((c) => {
      row[c] = invoices
        .filter((i: any) => (i.currency || "ZAR") === c && i.paid_at && isSameMonth(new Date(i.paid_at), m))
        .reduce((s, i: any) => s + Number(i.amount_paid || i.total), 0);
    });
    return row;
  });

  return (
    <Card>
      <CardHeader><CardTitle>12-Month Revenue Comparison</CardTitle></CardHeader>
      <CardContent style={{ height: 320 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
            <XAxis dataKey="month" fontSize={12} />
            <YAxis fontSize={12} />
            <Tooltip />
            {currencies.map((c) => {
              const meta = CURRENCY_META[c] || { color: "hsl(0, 0%, 60%)" };
              return <Bar key={c} dataKey={c} fill={meta.color} radius={[4, 4, 0, 0]} />;
            })}
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

/* ===== Per-currency detail panel ===== */
function CurrencyPanel({ currency, invoices }: { currency: string; invoices: any[] }) {
  const [monthOffset, setMonthOffset] = useState(0);
  const [invoiceFilter, setInvoiceFilter] = useState<"all" | "paid" | "unpaid">("all");
  const meta = CURRENCY_META[currency] || { label: currency, flag: "\u{1F310}", country: currency, color: "hsl(0,0%,60%)" };

  const selectedMonth = startOfMonth(subMonths(new Date(), monthOffset));
  const monthLabel = format(selectedMonth, "MMMM yyyy");

  const monthInvoices = useMemo(
    () => invoices.filter((i: any) => i.paid_at && isSameMonth(new Date(i.paid_at), selectedMonth)),
    [invoices, selectedMonth],
  );
  const monthInvoiced = useMemo(
    () => invoices.filter((i: any) => isSameMonth(new Date(i.created_at), selectedMonth)),
    [invoices, selectedMonth],
  );

  const monthRevenue = monthInvoices.reduce((s, i: any) => s + Number(i.amount_paid || i.total), 0);
  const monthInvoicedTotal = monthInvoiced.reduce((s, i: any) => s + Number(i.total), 0);

  const months = useMemo(
    () => Array.from({ length: 12 }, (_, i) => startOfMonth(subMonths(new Date(), 11 - i))),
    [],
  );
  const trail = months.map((m) => {
    const rev = invoices
      .filter((i: any) => i.paid_at && isSameMonth(new Date(i.paid_at), m))
      .reduce((s, i: any) => s + Number(i.amount_paid || i.total), 0);
    const inv = invoices
      .filter((i: any) => isSameMonth(new Date(i.created_at), m))
      .reduce((s, i: any) => s + Number(i.total), 0);
    return { month: format(m, "MMM"), revenue: rev, invoiced: inv };
  });

  const prevMonth = startOfMonth(subMonths(selectedMonth, 1));
  const prevRevenue = invoices
    .filter((i: any) => i.paid_at && isSameMonth(new Date(i.paid_at), prevMonth))
    .reduce((s, i: any) => s + Number(i.amount_paid || i.total), 0);
  const delta = prevRevenue === 0 ? (monthRevenue > 0 ? 100 : 0) : ((monthRevenue - prevRevenue) / prevRevenue) * 100;

  const ytdRevenue = invoices
    .filter((i: any) => i.paid_at && new Date(i.paid_at).getFullYear() === new Date().getFullYear())
    .reduce((s, i: any) => s + Number(i.amount_paid || i.total), 0);

  const totalPaidAllTime = invoices
    .filter((i: any) => i.paid_at)
    .reduce((s, i: any) => s + Number(i.amount_paid || i.total), 0);

  const totalOutstanding = invoices
    .filter((i: any) => !i.paid_at && i.status !== "cancelled")
    .reduce((s, i: any) => s + Number(i.total), 0);

  // All invoices list with filter
  const filteredInvoices = useMemo(() => {
    let list = [...invoices];
    if (invoiceFilter === "paid") list = list.filter((i: any) => i.paid_at);
    else if (invoiceFilter === "unpaid") list = list.filter((i: any) => !i.paid_at && i.status !== "cancelled");
    return list.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [invoices, invoiceFilter]);

  const isEmpty = invoices.length === 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="text-4xl">{meta.flag}</div>
          <div>
            <div className="font-display text-xl font-bold">{meta.country}</div>
            <div className="text-xs text-muted-foreground">{meta.label} · {currency}</div>
          </div>
        </div>
        <Select value={String(monthOffset)} onValueChange={(v) => setMonthOffset(Number(v))}>
          <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
          <SelectContent>
            {Array.from({ length: 12 }).map((_, i) => (
              <SelectItem key={i} value={String(i)}>{format(startOfMonth(subMonths(new Date(), i)), "MMMM yyyy")}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isEmpty ? (
        <Card><CardContent className="p-10 text-center text-sm text-muted-foreground">
          No invoices issued in {currency} yet. Create an invoice in {meta.country} to start tracking this market.
        </CardContent></Card>
      ) : (
        <>
          {/* Stats row */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="md:col-span-2 border-primary/20 bg-gradient-to-br from-card to-accent/30">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-xs uppercase tracking-widest text-muted-foreground">{monthLabel} revenue</div>
                    <div className="mt-2 font-display text-5xl font-bold text-primary">{formatMoney(monthRevenue, currency)}</div>
                    <div className="mt-2 flex items-center gap-2 text-sm">
                      {delta >= 0 ? <ArrowUpRight className="h-4 w-4 text-success" /> : <ArrowDownRight className="h-4 w-4 text-destructive" />}
                      <span className={delta >= 0 ? "text-success" : "text-destructive"}>
                        {delta >= 0 ? "+" : ""}{delta.toFixed(1)}%
                      </span>
                      <span className="text-muted-foreground">vs {format(prevMonth, "MMM yyyy")}</span>
                    </div>
                  </div>
                  <div className="rounded-2xl bg-primary/10 p-4"><TrendingUp className="h-7 w-7 text-primary" /></div>
                </div>
                <div className="mt-6 h-32">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trail}>
                      <Line type="monotone" dataKey="revenue" stroke={meta.color} strokeWidth={2.5} dot={false} />
                      <Tooltip formatter={(v: any) => formatMoney(Number(v), currency)} />
                      <XAxis dataKey="month" fontSize={10} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-4">
              <Card><CardContent className="p-5">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Invoiced this month</div>
                <div className="mt-1 font-display text-2xl font-bold">{formatMoney(monthInvoicedTotal, currency)}</div>
                <div className="text-xs text-muted-foreground">{monthInvoiced.length} invoice(s)</div>
              </CardContent></Card>
              <Card><CardContent className="p-5">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Year to date</div>
                <div className="mt-1 font-display text-2xl font-bold text-success">{formatMoney(ytdRevenue, currency)}</div>
              </CardContent></Card>
              <Card><CardContent className="p-5">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">All-time paid</div>
                <div className="mt-1 font-display text-xl font-bold">{formatMoney(totalPaidAllTime, currency)}</div>
              </CardContent></Card>
              <Card><CardContent className="p-5">
                <div className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground"><AlertCircle className="h-3 w-3 text-amber-500" /> Outstanding</div>
                <div className="mt-1 font-display text-xl font-bold text-amber-500">{formatMoney(totalOutstanding, currency)}</div>
              </CardContent></Card>
            </div>
          </div>

          {/* 12-month bar chart */}
          <Card>
            <CardHeader><CardTitle>12-month overview · {currency}</CardTitle></CardHeader>
            <CardContent style={{ height: 280 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trail}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="month" fontSize={12} />
                  <YAxis fontSize={12} />
                  <Tooltip formatter={(v: any) => formatMoney(Number(v), currency)} />
                  <Bar dataKey="revenue" fill={meta.color} radius={[6, 6, 0, 0]} name="Paid" />
                  <Bar dataKey="invoiced" fill={`${meta.color}40`} radius={[6, 6, 0, 0]} name="Invoiced" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Paid invoices this month */}
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Receipt className="h-4 w-4" /> Paid in {monthLabel}</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {monthInvoices.length === 0 && <p className="text-sm text-muted-foreground">No payments recorded for this month.</p>}
              {monthInvoices.map((i: any) => (
                <div key={i.id} className="flex items-center justify-between rounded-lg border bg-card p-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2"><span className="font-semibold">#{i.number}</span><Badge variant="outline" className="text-[10px]">{i.status}</Badge></div>
                    <div className="truncate text-xs text-muted-foreground">{i.title} · {i.clients?.name}</div>
                  </div>
                  <div className="font-bold text-primary">{formatMoney(Number(i.amount_paid || i.total), i.currency)}</div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* All invoices breakdown */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2"><FileText className="h-4 w-4" /> All {currency} Invoices</CardTitle>
                <div className="flex gap-1">
                  {(["all", "paid", "unpaid"] as const).map((f) => (
                    <button
                      key={f}
                      onClick={() => setInvoiceFilter(f)}
                      className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                        invoiceFilter === f
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground hover:bg-muted/80"
                      }`}
                    >
                      {f === "all" ? `All (${invoices.length})` : f === "paid" ? `Paid (${invoices.filter((i: any) => i.paid_at).length})` : `Pending (${invoices.filter((i: any) => !i.paid_at && i.status !== "cancelled").length})`}
                    </button>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {filteredInvoices.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No invoices match this filter.</p>
              ) : (
                <div className="divide-y">
                  {filteredInvoices.map((i: any) => (
                    <div key={i.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm">#{i.number}</span>
                          <Badge
                            variant="outline"
                            className={`text-[10px] ${
                              i.paid_at ? "border-success/40 text-success" :
                              i.status === "sent" ? "border-blue-400/40 text-blue-500" :
                              i.status === "overdue" ? "border-destructive/40 text-destructive" :
                              ""
                            }`}
                          >
                            {i.paid_at ? "Paid" : i.status}
                          </Badge>
                        </div>
                        <div className="truncate text-xs text-muted-foreground mt-0.5">{i.title}</div>
                        <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-1">
                          <span>{i.clients?.name}{i.clients?.company ? ` · ${i.clients.company}` : ""}</span>
                          <span>Created {format(new Date(i.created_at), "dd MMM yyyy")}</span>
                          {i.paid_at && <span className="text-success">Paid {format(new Date(i.paid_at), "dd MMM yyyy")}</span>}
                        </div>
                      </div>
                      <div className="text-right ml-4">
                        <div className={`font-bold ${i.paid_at ? "text-success" : "text-foreground"}`}>{formatMoney(Number(i.total), currency)}</div>
                        {i.paid_at && i.amount_paid && Number(i.amount_paid) !== Number(i.total) && (
                          <div className="text-[10px] text-muted-foreground">Received: {formatMoney(Number(i.amount_paid), currency)}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
