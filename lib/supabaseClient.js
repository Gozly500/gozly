import { createClient } from "@supabase/supabase-js";

// Ces deux valeurs viennent de ton projet Supabase (Project Settings > API).
// Elles doivent être mises dans un fichier .env.local (voir .env.local.example)
// et JAMAIS commitées directement dans le code.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
