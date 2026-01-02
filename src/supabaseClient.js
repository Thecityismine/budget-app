import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://wgjbslvpvgymdmlucpyh.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndnamJzbHZwdmd5bWRtbHVjcHloIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcxODc5NzIsImV4cCI6MjA4Mjc2Mzk3Mn0.NKUxsGVOau6NpUaIsU1MgatvpdvQ8uSMHXeeb0UC4JI';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
