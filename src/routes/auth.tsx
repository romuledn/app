import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/Logo";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
});

function AuthPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  if (loading) return null;
  if (user) return <Navigate to="/dashboard" />;

  const signIn = async () => {
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) return toast.error(error.message);
    navigate({ to: "/dashboard" });
  };

  return (
    <div className="grid min-h-screen md:grid-cols-2">
      <div
        className="relative hidden p-12 text-white md:flex md:flex-col md:justify-between bg-cover bg-center"
        style={{ backgroundImage: "url(/images/auth-bg.jpg)" }}
      >
        <div className="absolute inset-0 bg-black/60" />
        <div className="relative self-start">
          <Logo variant="white" className="h-24 w-auto drop-shadow-lg" />
        </div>
        <div className="relative">
          <h2 className="font-display text-4xl font-bold leading-tight drop-shadow-lg">
            Quotes out. <br /> Invoices paid. <br /> <span className="text-primary">No chasing.</span>
          </h2>
          <p className="mt-4 max-w-sm text-white/80 drop-shadow">
            We Design · We Code · We Communicate · We Influence
          </p>
        </div>
        <p className="relative text-xs text-white/60">© Senes Media</p>
      </div>
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-6">
          <div className="md:hidden mb-2">
            <Logo className="h-14 w-auto" />
          </div>
          <div>
            <h1 className="font-display text-3xl font-bold">Welcome back</h1>
            <p className="mt-1 text-sm text-muted-foreground">Sign in to your account</p>
          </div>
          <div className="space-y-3">
            <Field label="Email" value={email} setValue={setEmail} type="email" />
            <Field label="Password" value={password} setValue={setPassword} type="password" />
            <Button className="w-full" onClick={signIn} disabled={busy}>
              {busy ? "Signing in…" : "Sign in"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, setValue, type }: { label: string; value: string; setValue: (v: string) => void; type: string }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input type={type} value={value} onChange={(e) => setValue(e.target.value)} />
    </div>
  );
}
