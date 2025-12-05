import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Type for our debate results
export type DebateResult = {
  id?: string;
  user_email: string;
  user_name: string;
  topic: string;
  user_role: "affirmative" | "negative";
  opponent_type: "human" | "ai";
  won: boolean;
  score: number;
  reasoning: string;
  transcript: Array<{ role: string; text: string; timestamp: number }>;
  created_at?: string;
};
