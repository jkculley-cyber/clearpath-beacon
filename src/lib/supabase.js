import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://cghhabcbgyoqwqjzunfo.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNnaGhhYmNiZ3lvcXdxanp1bmZvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1NzU4NDQsImV4cCI6MjA4ODE1MTg0NH0.y2qpi6U9tMfTvgZjqGD_csx5VImCbuNNG8Awq3VKskg';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
