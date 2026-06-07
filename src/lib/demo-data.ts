import { supabase } from "@/integrations/supabase/client";

type Item = { description: string; quantity: number; unit_price: number; total: number };

const mkItems = (rows: [string, number, number][]): Item[] =>
  rows.map(([description, quantity, unit_price]) => ({
    description,
    quantity,
    unit_price,
    total: quantity * unit_price,
  }));

const sum = (items: Item[]) => items.reduce((s, i) => s + i.total, 0);

const daysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
};
const daysAhead = (n: number) => daysAgo(-n);

export async function seedDemoData(userId: string) {
  // 1. Clients
  const clientsPayload = [
    { user_id: userId, name: "Thandi Mokoena", email: "thandi@brightwave.co.za", phone: "+27 82 123 4567", company: "Brightwave Studios", address: "12 Loop Street, Cape Town" },
    { user_id: userId, name: "Sipho Dlamini", email: "sipho@kasimedia.co.za", phone: "+27 83 555 7788", company: "Kasi Media Group", address: "45 Vilakazi Street, Soweto" },
    { user_id: userId, name: "Lerato Khumalo", email: "lerato@auragency.com", phone: "+27 71 998 1122", company: "Aura Creative Agency", address: "8 Fredman Drive, Sandton" },
    { user_id: userId, name: "Naledi Botha", email: "naledi@flux.co.za", phone: "+27 84 221 9090", company: "Flux Retail", address: "3 Long Street, Cape Town" },
  ];
  const { data: clients, error: cErr } = await supabase.from("clients").insert(clientsPayload).select();
  if (cErr) throw cErr;

  // 2. Quotations
  const q1Items = mkItems([
    ["Brand identity & logo design", 1, 12000],
    ["Brand guidelines document", 1, 4500],
    ["Social media kit (12 templates)", 1, 6500],
  ]);
  const q2Items = mkItems([
    ["Promotional video (60s)", 1, 18000],
    ["On-location shoot day", 2, 5500],
    ["Post-production & colour grading", 1, 7500],
  ]);
  const q3Items = mkItems([
    ["E-commerce website build", 1, 32000],
    ["Payment gateway integration", 1, 4500],
    ["Annual hosting & maintenance", 1, 9600],
  ]);

  const quotesPayload = [
    {
      user_id: userId, client_id: clients![0].id, number: "QT-2026-001",
      title: "Brightwave Studios — Brand identity package",
      currency: "ZAR", items: q1Items, subtotal: sum(q1Items), tax_rate: 15,
      total: sum(q1Items) * 1.15, valid_until: daysAhead(14), status: "accepted",
      accepted_at: new Date(Date.now() - 5 * 86400000).toISOString(),
      sent_at: new Date(Date.now() - 7 * 86400000).toISOString(),
      deposit_percent: 60, created_by: userId,
    },
    {
      user_id: userId, client_id: clients![1].id, number: "QT-2026-002",
      title: "Kasi Media — Launch campaign video",
      currency: "ZAR", items: q2Items, subtotal: sum(q2Items), tax_rate: 15,
      total: sum(q2Items) * 1.15, valid_until: daysAhead(21), status: "sent",
      sent_at: new Date(Date.now() - 2 * 86400000).toISOString(),
      deposit_percent: 60, created_by: userId,
    },
    {
      user_id: userId, client_id: clients![2].id, number: "QT-2026-003",
      title: "Aura Agency — E-commerce platform",
      currency: "ZAR", items: q3Items, subtotal: sum(q3Items), tax_rate: 15,
      total: sum(q3Items) * 1.15, valid_until: daysAhead(30), status: "draft",
      deposit_percent: 50, created_by: userId,
    },
  ];
  const { error: qErr } = await supabase.from("quotations").insert(quotesPayload);
  if (qErr) throw qErr;

  // 3. Invoices
  const i1Items = mkItems([
    ["Brand identity — deposit (60%)", 1, 13800],
  ]);
  const i2Items = mkItems([
    ["Monthly social media management", 1, 8500],
    ["Paid ads management fee", 1, 3500],
  ]);
  const i3Items = mkItems([
    ["Website redesign — final payment", 1, 22000],
    ["SEO audit & report", 1, 4800],
  ]);

  const invoicesPayload = [
    {
      user_id: userId, client_id: clients![0].id, number: "INV-2026-001",
      title: "Brightwave — Brand identity deposit",
      currency: "ZAR", items: i1Items, subtotal: sum(i1Items), tax_rate: 15,
      total: sum(i1Items) * 1.15, issue_date: daysAgo(4), due_date: daysAhead(3),
      status: "sent", sent_at: new Date(Date.now() - 4 * 86400000).toISOString(),
      created_by: userId,
    },
    {
      user_id: userId, client_id: clients![3].id, number: "INV-2026-002",
      title: "Flux Retail — Monthly retainer",
      currency: "ZAR", items: i2Items, subtotal: sum(i2Items), tax_rate: 15,
      total: sum(i2Items) * 1.15, issue_date: daysAgo(20), due_date: daysAgo(5),
      status: "overdue", sent_at: new Date(Date.now() - 20 * 86400000).toISOString(),
      created_by: userId,
    },
    {
      user_id: userId, client_id: clients![2].id, number: "INV-2026-003",
      title: "Aura Agency — Website final payment",
      currency: "ZAR", items: i3Items, subtotal: sum(i3Items), tax_rate: 15,
      total: sum(i3Items) * 1.15, issue_date: daysAgo(30), due_date: daysAgo(10),
      status: "sent", sent_at: new Date(Date.now() - 30 * 86400000).toISOString(),
      created_by: userId,
    },
  ];
  const { data: invoices, error: iErr } = await supabase.from("invoices").insert(invoicesPayload).select();
  if (iErr) throw iErr;

  // 4. Full payment on invoice #3 → auto-generates a receipt via trigger
  const fullyPaid = invoices!.find((x) => x.number === "INV-2026-003")!;
  const { error: pErr } = await supabase.from("invoice_payments").insert({
    user_id: userId, invoice_id: fullyPaid.id, amount: fullyPaid.total,
    method: "EFT", reference: "FNB-883421", paid_on: daysAgo(2),
  });
  if (pErr) throw pErr;

  // 5. Hosting subscription
  const { error: hErr } = await supabase.from("hosting_subscriptions").insert({
    user_id: userId, client_id: clients![2].id,
    service_name: "Aura Agency — Website hosting (Annual)",
    start_date: daysAgo(60), end_date: daysAhead(305),
    amount: 9600, currency: "ZAR", auto_renew: true,
    notes: "Includes SSL, daily backups, CDN.",
  });
  if (hErr) throw hErr;
}

const USER_TABLES = [
  "invoice_payments",
  "receipts",
  "projects",
  "hosting_subscriptions",
  "invoices",
  "quotations",
  "clients",
  "activity_log",
] as const;

export async function deleteAllUserData(userId: string) {
  for (const t of USER_TABLES) {
    const { error } = await supabase.from(t).delete().eq("user_id", userId);
    if (error) throw new Error(`${t}: ${error.message}`);
  }
}
