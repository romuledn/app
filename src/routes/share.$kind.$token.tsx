import { createFileRoute, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Logo } from "@/components/Logo";
import { formatMoney } from "@/lib/currency";
import { downloadPdf, type DocData } from "@/lib/pdf";
import { ProjectComments } from "@/components/ProjectComments";
import { ProjectRevisions } from "@/components/ProjectRevisions";
import { ClientRevisionPanel } from "@/components/ClientRevisionPanel";
import { Download, CheckCircle2, FileText, User, Calendar as CalIcon } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/share/$kind/$token")({
  component: SharePage,
});

function SharePage() {
  const { kind, token } = useParams({ from: "/share/$kind/$token" });
  if (kind === "p") return <ProjectShare token={token} />;
  return <DocShare kind={kind} token={token} />;
}

function DocShare({ kind, token }: { kind: string; token: string }) {
  const isQuote = kind === "q";
  const [row, setRow] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    (async () => {
      const table = isQuote ? "quotations" : "invoices";
      const { data } = await supabase.from(table).select("*, clients(*)").eq("share_token", token).maybeSingle();
      if (!data) { setLoading(false); return; }
      setRow(data);
      const { data: prof } = await supabase.from("profiles").select("*").eq("id", data.user_id).maybeSingle();
      setProfile(prof);
      // mark viewed
      await supabase.rpc(isQuote ? "mark_quotation_viewed" : "mark_invoice_viewed", { p_token: token });
      setLoading(false);
    })();
  }, [kind, token, isQuote]);

  if (loading) return <Centered>Loading…</Centered>;
  if (!row) return <Centered>This link is invalid or has expired.</Centered>;

  const buildDoc = (): DocData => ({
    kind: isQuote ? "QUOTATION" : "INVOICE",
    number: row.number, title: row.title, currency: row.currency, items: row.items,
    subtotal: Number(row.subtotal), discount: Number(row.discount || 0), taxRate: Number(row.tax_rate),
    depositPercent: isQuote ? Number(row.deposit_percent || 0) : 0,
    total: Number(row.total), notes: row.notes,
    issueDate: isQuote ? row.created_at : row.issue_date,
    dueOrValidLabel: isQuote ? "Valid until" : "Due",
    dueOrValid: isQuote ? row.valid_until : row.due_date,
    terms: profile?.terms_conditions,
    business: { name: profile?.business_name, email: profile?.business_email, phone: profile?.business_phone, address: profile?.business_address },
    client: row.clients,
    design: profile?.doc_design,
  });

  const accept = async () => {
    await supabase.rpc("accept_quotation", { p_token: token });
    setAccepted(true);
    toast.success("Thank you — your acceptance has been recorded.");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-accent/40">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <Logo className="h-10" />
          <span className="text-xs uppercase tracking-widest text-muted-foreground">{isQuote ? "Quotation" : "Invoice"} · {row.number}</span>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-10">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-4xl font-bold">{row.title}</h1>
            <p className="text-sm text-muted-foreground">Prepared for {row.clients?.company || row.clients?.name}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => downloadPdf(buildDoc())}><Download className="mr-2 h-4 w-4" /> Download PDF</Button>
            {isQuote && row.status !== "accepted" && row.status !== "converted" && !accepted && (
              <Button onClick={accept}><CheckCircle2 className="mr-2 h-4 w-4" /> Accept quotation</Button>
            )}
            {(row.status === "accepted" || row.status === "converted" || accepted) && isQuote && (
              <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-3 py-1 text-sm text-success">
                <CheckCircle2 className="h-4 w-4" /> Accepted
              </span>
            )}
          </div>
        </div>

        <Card>
          <CardContent className="p-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="w-10 py-3">No.</th>
                  <th className="py-3">Item Description</th>
                  <th className="py-3 text-right">Price</th>
                  <th className="w-16 py-3 text-right">Qty</th>
                  <th className="py-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {row.items.map((it: any, idx: number) => {
                  const [title, ...rest] = (it.description || "").split("\n");
                  return (
                    <tr key={idx} className="border-b align-top">
                      <td className="py-3 font-medium">{idx + 1}.</td>
                      <td className="py-3">
                        <div className="font-medium">{title}</div>
                        {rest.length > 0 && <div className="text-xs text-muted-foreground">{rest.join(" ")}</div>}
                      </td>
                      <td className="py-3 text-right">{formatMoney(it.price, row.currency)}</td>
                      <td className="py-3 text-right">{it.quantity}</td>
                      <td className="py-3 text-right">{formatMoney(it.price * it.quantity, row.currency)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="mt-4 flex justify-end">
              <div className="w-72 space-y-1 text-sm">
                <Row k="Subtotal" v={formatMoney(Number(row.subtotal), row.currency)} />
                {Number(row.discount) > 0 && <Row k="Discount" v={`- ${formatMoney(Number(row.discount), row.currency)}`} />}
                {Number(row.tax_rate) > 0 && <Row k={`Tax (${row.tax_rate}%)`} v={formatMoney((Number(row.subtotal) - Number(row.discount || 0)) * Number(row.tax_rate) / 100, row.currency)} />}
                <div className="border-t pt-2 text-lg font-bold text-primary"><Row k="Total" v={formatMoney(Number(row.total), row.currency)} /></div>
                {isQuote && Number(row.deposit_percent) > 0 && (
                  <Row k={`${row.deposit_percent}% deposit`} v={formatMoney(Number(row.total) * Number(row.deposit_percent) / 100, row.currency)} />
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {profile?.terms_conditions && (
          <Card className="mt-6">
            <CardContent className="p-6">
              <h3 className="font-display text-lg font-semibold">Terms &amp; Conditions</h3>
              <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">{profile.terms_conditions}</p>
            </CardContent>
          </Card>
        )}

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-2"><FileText className="h-3 w-3" /> {isQuote ? "Quotation" : "Invoice"} {row.number}</div>
          <div>{profile?.business_email} · {profile?.business_phone}</div>
        </div>
      </main>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return <div className="flex justify-between"><span className="text-muted-foreground">{k}</span><span className="font-medium">{v}</span></div>;
}
function Centered({ children }: { children: any }) {
  return <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">{children}</div>;
}

function ProjectShare({ token }: { token: string }) {
  const [row, setRow] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const { data } = await supabase
        .from("projects")
        .select("*, clients(*)")
        .eq("share_token", token)
        .eq("client_visible", true)
        .maybeSingle();
      if (!active) return;
      setRow(data);
      if (data?.user_id) {
        const { data: prof } = await supabase
          .from("profiles")
          .select("business_name, business_email, business_phone")
          .eq("id", data.user_id)
          .maybeSingle();
        setProfile(prof);
      }
      setLoading(false);
    };
    load();
    const ch = supabase
      .channel(`proj-share-${token}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "projects" },
        () => load(),
      )
      .subscribe();
    return () => {
      active = false;
      supabase.removeChannel(ch);
    };
  }, [token]);

  if (loading) return <Centered>Loading…</Centered>;
  if (!row) return <Centered>This tracking link is invalid or has been hidden by the owner.</Centered>;

  const done = row.status === "completed";
  const progress = row.progress ?? 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-accent/40">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <Logo className="h-10" />
          <span className="text-xs uppercase tracking-widest text-muted-foreground">
            Project tracking
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-6 px-6 py-10">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-4xl font-bold">{row.title}</h1>
            {done ? (
              <Badge className="bg-success text-success-foreground">Completed</Badge>
            ) : (
              <Badge variant="outline">In progress</Badge>
            )}
          </div>
          {row.clients && (
            <p className="text-sm text-muted-foreground">
              Prepared for {row.clients.company || row.clients.name}
            </p>
          )}
        </div>

        <Card>
          <CardContent className="space-y-4 p-6">
            <div>
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="font-medium">Project progress</span>
                <span className="tabular-nums">{progress}%</span>
              </div>
              <Progress value={progress} className="h-3" />
              <p className="mt-2 text-xs text-muted-foreground">
                This page updates live as the team makes progress.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
              <Meta icon={<User className="h-4 w-4" />} label="Owner">
                {row.assignee_name || "Team"}
              </Meta>
              <Meta icon={<CalIcon className="h-4 w-4" />} label="Start">
                {row.start_date ? new Date(row.start_date).toLocaleDateString() : "—"}
              </Meta>
              <Meta icon={<CalIcon className="h-4 w-4" />} label="Due">
                {row.due_date ? new Date(row.due_date).toLocaleDateString() : "—"}
              </Meta>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <h3 className="mb-3 font-display text-lg font-semibold">Revisions</h3>
            <ProjectRevisions project={row} readOnly />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-3 p-6">
            <div>
              <h3 className="font-display text-lg font-semibold">
                Your feedback & meetings
              </h3>
              <p className="text-xs text-muted-foreground">
                Send screenshots with comments at each revision checkpoint and request a
                meeting with the team. First meeting: up to 30 minutes. Second meeting:
                up to 45 minutes. After both rounds, any further changes or meetings
                require payment.
              </p>
            </div>
            <ClientRevisionPanel project={row} />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <h3 className="font-display text-lg font-semibold">Updates from the team</h3>
            <p className="mb-3 text-xs text-muted-foreground">
              Comments your project team has chosen to share.
            </p>
            <ProjectComments projectId={row.id} readOnly publicOnly />
          </CardContent>
        </Card>

        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <FileText className="h-3 w-3" /> {profile?.business_name || "Project"}
          </div>
          <div>
            {profile?.business_email}
            {profile?.business_phone ? ` · ${profile.business_phone}` : ""}
          </div>
        </div>
      </main>
    </div>
  );
}

function Meta({
  icon,
  label,
  children,
}: {
  icon: any;
  label: string;
  children: any;
}) {
  return (
    <div className="rounded-md border bg-muted/30 p-3">
      <div className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground">
        {icon} {label}
      </div>
      <div className="mt-1 font-medium">{children}</div>
    </div>
  );
}
