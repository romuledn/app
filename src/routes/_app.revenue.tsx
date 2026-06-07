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
import { TrendingUp, ArrowUpRight, ArrowDownRight, Receipt, Globe2 } from "lucide-react";

export const Route = createFileRoute("/_app/revenue")({
  component: Revenue,
});

const CURRENCY_META: Record<string, { label: string; flag: string; country: string }> = {
  ZAR: { label: "South African Rand", flag: "🇿🇦", country: "South Africa" },
  USD: { label: "US Dollar", flag: "🇺🇸", country: "United States" },
  MWK: { label: "Malawian Kwacha", flag: "🇲🇼", country: "Malawi" },
};

function Revenue() {
  const { data: invoices = [] } = useInvoices();

  // Discover all currencies present in data, plus always show the core three
  const currencies = useMemo(() => {
    const set = new Set<string>(["ZAR", "USD", "MWK"]);
    invoices.forEach((i: any) => i.currency && set.add(i.currency));
    return Array.from(set);
  }, [invoices]);

  const [active, setActive] = useState<string>("ZAR");

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 md:px-8 md:py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">Revenue by Country</h1>
          <p className="text-sm text-muted-foreground">Switch between currencies to see how each market is performing.</p>
        </div>
        <Badge variant="outline" className="gap-1.5"><Globe2 className="h-3 w-3" /> {currencies.length} currencies tracked</Badge>
      </div>

      <Tabs value={active} onValueChange={setActive}>
        <TabsList className="grid w-full grid-cols-3 md:w-auto md:inline-grid">
          {currencies.slice(0, 6).map((c) => {
            const meta = CURRENCY_META[c] || { label: c, flag: "🌐", country: c };
            return (
              <TabsTrigger key={c} value={c} className="gap-2">
                <span className="text-base">{meta.flag}</span>
                <span className="hidden sm:inline">{meta.country}</span>
                <span className="text-xs text-muted-foreground">({c})</span>
              </TabsTrigger>
            );
          })}
        </TabsList>

        {currencies.map((c) => (
          <TabsContent key={c} value={c} className="mt-6">
            <CurrencyPanel currency={c} invoices={invoices.filter((i: any) => (i.currency || "ZAR") === c)} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

function CurrencyPanel({ currency, invoices }: { currency: string; invoices: any[] }) {
  const [monthOffset, setMonthOffset] = useState(0);
  const meta = CURRENCY_META[currency] || { label: currency, flag: "🌐", country: currency };

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
                      <Line type="monotone" dataKey="revenue" stroke="hsl(var(--primary, 0 84% 60%))" strokeWidth={2.5} dot={false} />
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
            </div>
          </div>

          <Card>
            <CardHeader><CardTitle>12-month overview · {currency}</CardTitle></CardHeader>
            <CardContent style={{ height: 280 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trail}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="month" fontSize={12} />
                  <YAxis fontSize={12} />
                  <Tooltip formatter={(v: any) => formatMoney(Number(v), currency)} />
                  <Bar dataKey="revenue" fill="hsl(var(--primary, 0 84% 60%))" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

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
        </>
      )}
    </div>
  );
}
