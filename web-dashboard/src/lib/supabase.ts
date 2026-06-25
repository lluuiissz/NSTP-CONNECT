import { createClient } from '@supabase/supabase-js'

// We will use environment variables, but provide default fallback.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://alplydafnokiucslivsd.supabase.co'
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_IrArR2RLpsx40QH_ghftHg_R3vyQAWE'

export const supabase = createClient(supabaseUrl, supabaseKey)
