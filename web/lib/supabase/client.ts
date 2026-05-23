import { createBrowserClient } from "@supabase/ssr";

import { requireSupabasePublicEnv } from "@/lib/supabase/env";
import type { Database } from "@/types/supabase";

export function createClient() {
  const { url, publishableKey } = requireSupabasePublicEnv();

  return createBrowserClient<Database>(url, publishableKey);
}
