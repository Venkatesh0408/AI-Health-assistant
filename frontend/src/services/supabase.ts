import { createClient } from '@supabase/supabase-js';

const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL || 'https://donabciemrrxsydbdhsz.supabase.co';
const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRvbmFiY2llbXJyeHN5ZGJkaHN6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTUwMDEwMzUsImV4cCI6MjExMDU3NzAzNX0.Arel9CUD5A0kbQj0Y21lYS6fC1LLG7k89SruJRuJhgo';

export const isSupabaseConfigured = true;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
