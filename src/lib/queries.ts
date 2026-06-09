import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export function useProfile() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").eq("id", user!.id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useRole() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["role", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", user!.id);
      if (error) throw error;
      const roles = (data ?? []).map((r: any) => r.role as string);
      return {
        roles,
        isAdmin: roles.includes("admin"),
        isAccounts: roles.includes("accounts"),
      };
    },
  });
}

export function useClients() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["clients", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useQuotations() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["quotations", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("quotations").select("*, clients(*)").order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useInvoices() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["invoices", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("invoices").select("*, clients(*)").order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useReceipts() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["receipts", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("receipts")
        .select("*, clients(*), invoices(number, title)")
        .order("issued_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useProjects() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["projects", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("*, clients(name, company), quotations(number)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useHosting() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["hosting", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("hosting_subscriptions").select("*, clients(*)").order("end_date", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useNotifications() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["notifications", user?.id],
    enabled: !!user,
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data: reads } = await supabase
        .from("notification_reads")
        .select("last_seen_at")
        .eq("user_id", user!.id)
        .maybeSingle();
      const since = reads?.last_seen_at ?? "1970-01-01";
      const { data: events, error } = await supabase
        .from("activity_log")
        .select("id, action, entity_type, entity_id, meta, created_at")
        .gt("created_at", since)
        .in("action", ["sent", "reminder_sent", "accepted", "paid", "created", "created_from_quote", "marked_sent", "email_opened"])
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return { events: events ?? [], lastSeen: since };
    },
  });
}

export async function markNotificationsRead(userId: string) {
  await supabase
    .from("notification_reads")
    .upsert({ user_id: userId, last_seen_at: new Date().toISOString() }, { onConflict: "user_id" });
}
