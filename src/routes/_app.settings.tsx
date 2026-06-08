import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/lib/queries";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CURRENCIES } from "@/lib/currency";
import { seedDemoData, deleteAllUserData } from "@/lib/demo-data";
import { Sparkles, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { DesignBuilder } from "@/components/DesignBuilder";

export const Route = createFileRoute("/_app/settings")({ component: Settings });


function Settings() {
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const qc = useQueryClient();
  const [seeding, setSeeding] = useState(false);
  const [wiping, setWiping] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [f, setF] = useState({
    business_name: "", business_email: "", business_phone: "", business_address: "",
    default_currency: "ZAR", terms_conditions: "", deposit_percent: 60, bank_details: "",
  });
  useEffect(() => {
    if (profile) setF({
      business_name: profile.business_name ?? "",
      business_email: profile.business_email ?? "",
      business_phone: profile.business_phone ?? "",
      business_address: profile.business_address ?? "",
      default_currency: profile.default_currency ?? "ZAR",
      terms_conditions: profile.terms_conditions ?? "",
      deposit_percent: Number(profile.deposit_percent ?? 60),
      bank_details: profile.bank_details ?? "",
    });
  }, [profile]);

  const save = async () => {
    const { error } = await supabase.from("profiles").update(f).eq("id", user!.id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["profile"] });
    toast.success("Saved");
  };

  const handleSeed = async () => {
    if (!user) return;
    setSeeding(true);
    try {
      await seedDemoData(user.id);
      qc.invalidateQueries();
      toast.success("Demo data loaded");
    } catch (e: any) {
      toast.error(e.message ?? "Failed to seed demo data");
    } finally {
      setSeeding(false);
    }
  };

  const handleWipe = async () => {
    if (!user) return;
    setWiping(true);
    try {
      await deleteAllUserData(user.id);
      qc.invalidateQueries();
      toast.success("All data deleted");
      setConfirmText("");
    } catch (e: any) {
      toast.error(e.message ?? "Failed to delete data");
    } finally {
      setWiping(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-8 py-8">
      <div>
        <h1 className="font-display text-3xl font-bold">Settings</h1>
        <p className="text-sm text-muted-foreground">Business info, document design, and account tools.</p>
      </div>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList>
          <TabsTrigger value="profile">Business profile</TabsTrigger>
          <TabsTrigger value="design">Document design</TabsTrigger>
          <TabsTrigger value="account">Account</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-6">
          <Card>
        <CardHeader><CardTitle>Business profile</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Row label="Business name"><Input value={f.business_name} onChange={(e) => setF({ ...f, business_name: e.target.value })} /></Row>
          <div className="grid grid-cols-2 gap-3">
            <Row label="Email"><Input value={f.business_email} onChange={(e) => setF({ ...f, business_email: e.target.value })} /></Row>
            <Row label="Phone"><Input value={f.business_phone} onChange={(e) => setF({ ...f, business_phone: e.target.value })} /></Row>
          </div>
          <Row label="Address"><Textarea rows={2} value={f.business_address} onChange={(e) => setF({ ...f, business_address: e.target.value })} /></Row>
          <div className="grid grid-cols-2 gap-3">
            <Row label="Default currency">
              <Select value={f.default_currency} onValueChange={(v) => setF({ ...f, default_currency: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CURRENCIES.map((c) => <SelectItem key={c.code} value={c.code}>{c.symbol} {c.code} · {c.label}</SelectItem>)}</SelectContent>
              </Select>
            </Row>
            <Row label="Default deposit %"><Input type="number" value={f.deposit_percent} onChange={(e) => setF({ ...f, deposit_percent: Number(e.target.value) })} /></Row>
          </div>
          <Row label="Terms & conditions (appears on every PDF)">
            <Textarea rows={5} value={f.terms_conditions} onChange={(e) => setF({ ...f, terms_conditions: e.target.value })} />
          </Row>
          <Row label="Banking / payment details (printed on invoices)">
            <Textarea
              rows={4}
              value={f.bank_details}
              placeholder={"Bank: FNB\nAccount Name: Senes Media\nAccount No: 123456789\nBranch Code: 250655\nRef: Invoice number"}
              onChange={(e) => setF({ ...f, bank_details: e.target.value })}
            />
          </Row>
          <div className="flex justify-end"><Button onClick={save}>Save changes</Button></div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="design">
          <DesignBuilder />
        </TabsContent>

        <TabsContent value="account" className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Demo data</CardTitle></CardHeader>
            <CardContent className="flex items-center justify-between gap-4">
              <p className="text-sm text-muted-foreground">
                Populate your account with sample clients, quotations, invoices, a paid invoice (auto-receipt) and a hosting subscription.
              </p>
              <Button onClick={handleSeed} disabled={seeding} variant="secondary">
                {seeding ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                Load demo data
              </Button>
            </CardContent>
          </Card>

          <Card className="border-destructive/40">
            <CardHeader><CardTitle className="text-destructive">Danger zone</CardTitle></CardHeader>
            <CardContent className="flex items-center justify-between gap-4">
              <p className="text-sm text-muted-foreground">
                Permanently delete all clients, quotations, invoices, payments, receipts, projects, hosting subscriptions and activity logs on this account. This cannot be undone.
              </p>
              <AlertDialog onOpenChange={(o) => !o && setConfirmText("")}>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" disabled={wiping}>
                    {wiping ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                    Delete all data
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete all data?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently wipe every record on your account. Type <strong>DELETE</strong> below to confirm.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <Input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="Type DELETE to confirm" />
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      disabled={confirmText !== "DELETE" || wiping}
                      onClick={handleWipe}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Yes, delete everything
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Row({ label, children }: { label: string; children: any }) {
  return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>;
}
