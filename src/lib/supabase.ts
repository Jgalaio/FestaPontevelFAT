import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const hasSupabaseConfig = Boolean(supabaseUrl && supabaseAnonKey);

export function createBrowserSupabaseClient() {
  if (!hasSupabaseConfig) {
    return null;
  }

  return createClient<Database>(supabaseUrl, supabaseAnonKey);
}
