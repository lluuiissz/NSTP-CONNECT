-- ============================================================
-- MIGRATION: Emergency Broadcast Attendance & Statistics
-- Adds volunteer mustering / on-site attendance tracking
-- to emergency broadcasts for CWTS, ROTC, and LTS.
-- ============================================================

-- 1. Add attendance requirement and location fields to notifications
ALTER TABLE public.notifications 
ADD COLUMN IF NOT EXISTS requires_attendance BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS target_barangay TEXT,
ADD COLUMN IF NOT EXISTS assembly_point TEXT;

-- 2. Create broadcast_attendances table
CREATE TABLE IF NOT EXISTS public.broadcast_attendances (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    broadcast_id UUID REFERENCES public.notifications(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    nstp_component TEXT NOT NULL, -- 'CWTS', 'ROTC', or 'LTS'
    lat DOUBLE PRECISION,
    lng DOUBLE PRECISION,
    municipality TEXT,
    barangay TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(broadcast_id, user_id)
);

-- 3. Row Level Security (RLS)
ALTER TABLE public.broadcast_attendances ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    CREATE POLICY "Anyone can view broadcast attendances" 
        ON public.broadcast_attendances FOR SELECT USING (true);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE POLICY "Volunteers can record their own broadcast attendance" 
        ON public.broadcast_attendances FOR INSERT WITH CHECK (auth.uid() = user_id);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE POLICY "Volunteers can update their own broadcast attendance" 
        ON public.broadcast_attendances FOR UPDATE 
        USING (auth.uid() = user_id) 
        WITH CHECK (auth.uid() = user_id);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE POLICY "Admins can delete broadcast attendances" 
        ON public.broadcast_attendances FOR DELETE USING (
            EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'nstp'))
        );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 4. Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.broadcast_attendances;

-- 5. Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
