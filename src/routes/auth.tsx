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

type AuthView = "sign-in" | "sign-up" | "forgot-password";

function AuthPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [view, setView] = useState<AuthView>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");
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

  const signUp = async () => {
    if (!email.trim()) return toast.error("Enter your email address");
    if (password.length < 6) return toast.error("Password must be at least 6 characters");
    if (password !== confirmPassword) return toast.error("Passwords do not match");
    setBusy(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: `${window.location.origin}/auth`,
      },
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Account created successfully!");
    navigate({ to: "/dashboard" });
  };

  const resetPassword = async () => {
    if (!email.trim()) return toast.error("Enter your email address first");
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth`,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Password reset link sent — check your inbox");
    setView("sign-in");
  };

  return (
    <div
      className="relative min-h-screen bg-cover bg-center"
      style={{ backgroundImage: "url(/images/auth-bg.jpg)" }}
    >
      {/* Dark overlay */}
      <div className="absolute inset-0 bg-black/60" />

      {/* Content grid */}
      <div className="relative z-10 grid min-h-screen md:grid-cols-2">
        {/* Left — branding (visible on all screens) */}
        <div className="flex flex-col justify-between p-8 md:p-12 text-white">
          <div className="self-start">
            <Logo variant="white" className="h-16 md:h-24 w-auto drop-shadow-lg" />
          </div>
          <div className="hidden md:block">
            <h2 className="font-display text-4xl font-bold leading-tight drop-shadow-lg">
              Quotes out. <br /> Invoices paid. <br />{" "}
              <span className="text-primary">No chasing.</span>
            </h2>
            <p className="mt-4 max-w-sm text-white/80 drop-shadow">
              We Design · We Code · We Communicate · We Influence
            </p>
          </div>
          <p className="hidden md:block text-xs text-white/60">© Senes Media</p>
        </div>

        {/* Right — form card */}
        <div className="flex items-center justify-center p-6 md:p-12">
          <div className="w-full max-w-sm space-y-6 rounded-2xl bg-white/95 dark:bg-card/95 backdrop-blur-xl p-8 shadow-2xl">
            {view === "sign-in" ? (
              <>
                <div>
                  <h1 className="font-display text-3xl font-bold">Welcome back</h1>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Sign in to your account
                  </p>
                </div>
                <div className="space-y-3">
                  <Field label="Email" value={email} setValue={setEmail} type="email" />
                  <Field
                    label="Password"
                    value={password}
                    setValue={setPassword}
                    type="password"
                  />
                  <div className="flex justify-end">
                    <button
                      type="button"
                      className="text-xs text-primary hover:underline"
                      onClick={() => setView("forgot-password")}
                    >
                      Forgot password?
                    </button>
                  </div>
                  <Button className="w-full" onClick={signIn} disabled={busy}>
                    {busy ? "Signing in…" : "Sign in"}
                  </Button>
                  <p className="text-center text-sm text-muted-foreground">
                    Don't have an account?{" "}
                    <button
                      type="button"
                      className="text-primary font-medium hover:underline"
                      onClick={() => setView("sign-up")}
                    >
                      Sign up
                    </button>
                  </p>
                </div>
              </>
            ) : view === "sign-up" ? (
              <>
                <div>
                  <h1 className="font-display text-3xl font-bold">Create account</h1>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Get started with Senes Accounts
                  </p>
                </div>
                <div className="space-y-3">
                  <Field label="Full name" value={fullName} setValue={setFullName} type="text" />
                  <Field label="Email" value={email} setValue={setEmail} type="email" />
                  <Field
                    label="Password"
                    value={password}
                    setValue={setPassword}
                    type="password"
                  />
                  <Field
                    label="Confirm password"
                    value={confirmPassword}
                    setValue={setConfirmPassword}
                    type="password"
                  />
                  <Button className="w-full" onClick={signUp} disabled={busy}>
                    {busy ? "Creating account…" : "Create account"}
                  </Button>
                  <p className="text-center text-sm text-muted-foreground">
                    Already have an account?{" "}
                    <button
                      type="button"
                      className="text-primary font-medium hover:underline"
                      onClick={() => setView("sign-in")}
                    >
                      Sign in
                    </button>
                  </p>
                </div>
              </>
            ) : (
              <>
                <div>
                  <h1 className="font-display text-3xl font-bold">Reset password</h1>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Enter your email and we'll send a reset link
                  </p>
                </div>
                <div className="space-y-3">
                  <Field label="Email" value={email} setValue={setEmail} type="email" />
                  <Button className="w-full" onClick={resetPassword} disabled={busy}>
                    {busy ? "Sending…" : "Send reset link"}
                  </Button>
                  <button
                    type="button"
                    className="w-full text-sm text-muted-foreground hover:text-foreground transition"
                    onClick={() => setView("sign-in")}
                  >
                    ← Back to sign in
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  setValue,
  type,
}: {
  label: string;
  value: string;
  setValue: (v: string) => void;
  type: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input type={type} value={value} onChange={(e) => setValue(e.target.value)} />
    </div>
  );
}
