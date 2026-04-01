import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://qaokxufufwbilfultgrk.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFhb2t4dWZ1ZndiaWxmdWx0Z3JrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwNDUxMzgsImV4cCI6MjA5MDYyMTEzOH0.TdATJK9H51dQvEu1ubWri-QiMgmJTMOF1L45MDRhFbs";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
