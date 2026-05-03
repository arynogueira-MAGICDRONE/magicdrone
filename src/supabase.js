import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://outvhkbjijyjeqdyvlrq.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im91dHZoa2JqaWp5amVxZHl2bHJxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc3NDg5MTgsImV4cCI6MjA5MzMyNDkxOH0.LDEVEx86PDJIhNToTi8f0gkuUxUr8zFOgzQ624QK_DY'

export const supabase = createClient(supabaseUrl, supabaseKey)