import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabasePublishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const hasSupabaseConfig = Boolean(supabaseUrl && supabasePublishableKey);

export function createBrowserSupabaseClient() {
  if (!hasSupabaseConfig) {
    return null;
  }

  return createClient<Database>(supabaseUrl, supabasePublishableKey);
}
