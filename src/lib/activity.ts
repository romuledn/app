import { supabase } from "@/integrations/supabase/client";

export function logActivity(userId: string, entity_type: string, entity_id: string, action: string, meta: Record<string, any> = {}) {
  return supabase.from("activity_log").insert({ user_id: userId, entity_type, entity_id, action, meta });
}
