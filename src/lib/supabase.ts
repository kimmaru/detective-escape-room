import { createClient, SupabaseClient } from "@supabase/supabase-js";

export interface DbSession {
  pin: string;
  nickname: string;
  current_room: number;
  started_at: number | null;
  room_entered_at: number | null;
  unlocked_hints: number[];
  last_hint_unlocked_at: number | null;
  is_cleared: boolean;
  cleared_at: number | null;
  total_time_seconds: number;
  total_hints_used: number;
  last_active_at: number | null;
  status: "ready" | "playing" | "cleared" | "inactive";
  has_reviewed: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface DbReview {
  id?: number;
  pin: string;
  author_name: string;
  content: string;
  photo_url: string | null;
  is_hidden: boolean;
  created_at: number;
  inserted_at?: string;
}

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  "";

let _supabaseAdmin: SupabaseClient | null = null;

export function isSupabaseConfigured(): boolean {
  return (
    typeof supabaseUrl === "string" &&
    supabaseUrl.trim().length > 0 &&
    typeof supabaseKey === "string" &&
    supabaseKey.trim().length > 0 &&
    !supabaseUrl.includes("your-project")
  );
}

export function getSupabaseAdmin(): SupabaseClient | null {
  if (!isSupabaseConfigured()) {
    return null;
  }

  if (!_supabaseAdmin) {
    _supabaseAdmin = createClient(supabaseUrl.trim(), supabaseKey.trim(), {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }

  return _supabaseAdmin;
}
