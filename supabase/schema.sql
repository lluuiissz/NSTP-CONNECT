-- Supabase SQL Schema for NSTP-CONNECT

-- Custom Types
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('volunteer', 'admin', 'nstp');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE log_status AS ENUM ('active', 'completed', 'cancelled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 1. Users Table (Extends Supabase auth.users)
CREATE TABLE public.users (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    role user_role NOT NULL DEFAULT 'volunteer',
    nstp_component TEXT, -- e.g., CWTS, LTS, ROTC
    municipality TEXT,
    barangay TEXT,
    profile_image_url TEXT,
    certificate_url TEXT,
    is_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Activities Table
CREATE TABLE public.activities (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    event_date TIMESTAMPTZ NOT NULL,
    municipality TEXT NOT NULL,
    barangay TEXT NOT NULL,
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    lat DOUBLE PRECISION NOT NULL,
    lng DOUBLE PRECISION NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Volunteer Logs Table
CREATE TABLE public.volunteer_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    activity_id UUID REFERENCES public.activities(id) ON DELETE CASCADE,
    service_hours NUMERIC(5, 2) DEFAULT 0.00,
    lat DOUBLE PRECISION,
    lng DOUBLE PRECISION,
    remarks TEXT,
    status log_status DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Notifications Table
CREATE TABLE public.notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    target_municipality TEXT, -- If null, it's a global broadcast
    created_at TIMESTAMPTZ DEFAULT NOW()
);


-- Row Level Security (RLS) Setup

-- Users
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view all users (for admins/nstp, limited for volunteers but simplified for MVP)" ON public.users FOR SELECT USING (true);
CREATE POLICY "Users can update their own profile" ON public.users FOR UPDATE USING (auth.uid() = id);

-- Activities
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view activities" ON public.activities FOR SELECT USING (true);
CREATE POLICY "Only admins can insert activities" ON public.activities FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Admins can update their activities" ON public.activities FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);

-- Volunteer Logs
ALTER TABLE public.volunteer_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Volunteers can view their own logs, admins can view all" ON public.volunteer_logs FOR SELECT USING (
    auth.uid() = user_id OR 
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'nstp'))
);
CREATE POLICY "Volunteers can create their own logs" ON public.volunteer_logs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Volunteers can update their own logs" ON public.volunteer_logs FOR UPDATE USING (auth.uid() = user_id);

-- Notifications
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view notifications" ON public.notifications FOR SELECT USING (true);

-- Enable Realtime for volunteer_logs (Crucial for Live Radar)
ALTER PUBLICATION supabase_realtime ADD TABLE public.volunteer_logs;

-- Storage Setup
-- Note: You must run these manually in the Supabase SQL Editor if 'storage' schema is not exposed to standard migrations.
INSERT INTO storage.buckets (id, name, public) VALUES ('certificates', 'certificates', true) ON CONFLICT DO NOTHING;

CREATE POLICY "Anyone can view certificates" ON storage.objects FOR SELECT USING (bucket_id = 'certificates');
CREATE POLICY "Authenticated users can upload certificates" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'certificates' AND auth.role() = 'authenticated');
CREATE POLICY "Users can update their own certificates" ON storage.objects FOR UPDATE USING (bucket_id = 'certificates' AND auth.uid() = owner);

-- Function to handle new user signup from Supabase Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.users (id, full_name, email, role, nstp_component, municipality, barangay)
    VALUES (
        new.id, 
        COALESCE(new.raw_user_meta_data->>'full_name', new.email), 
        new.email, 
        COALESCE((new.raw_user_meta_data->>'role')::public.user_role, 'volunteer'::public.user_role),
        new.raw_user_meta_data->>'nstp_component',
        new.raw_user_meta_data->>'municipality',
        new.raw_user_meta_data->>'barangay'
    );
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
