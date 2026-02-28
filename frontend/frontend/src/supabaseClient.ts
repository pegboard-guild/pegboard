// Supabase Client for Frontend
// Used for direct database access and caching

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || 'https://yurdvlcxednoaikrljbh.supabase.co';
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl1cmR2bGN4ZWRub2Fpa3JsamJoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcyMjA4MTIsImV4cCI6MjA3Mjc5NjgxMn0.MJrIO2Txxfyi6VtHKOH0-2R62fTYGLvpQnvEHkpTXdg';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);