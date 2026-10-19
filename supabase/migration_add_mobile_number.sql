-- ============================================================
-- MIGRATION: Add mobile_number to users & Bulletproof Signup Trigger
-- Run this ONCE in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/alplydafnokiucslivsd/sql
-- ============================================================

-- 1. Add the mobile_number column to public.users if not present
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS mobile_number TEXT;

-- 2. Ensure public permissions are granted
GRANT ALL ON TABLE public.users TO postgres, service_role, authenticated, anon;

-- 3. Update the signup trigger with an EXCEPTION block so signups NEVER crash!
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.users (id, full_name, email, role, nstp_component, municipality, barangay, mobile_number)
    VALUES (
        new.id,
        COALESCE(new.raw_user_meta_data->>'full_name', new.email),
        new.email,
        'volunteer',
        new.raw_user_meta_data->>'nstp_component',
        new.raw_user_meta_data->>'municipality',
        new.raw_user_meta_data->>'barangay',
        new.raw_user_meta_data->>'mobile_number'
    )
    ON CONFLICT (id) DO UPDATE SET
        full_name = EXCLUDED.full_name,
        nstp_component = COALESCE(EXCLUDED.nstp_component, public.users.nstp_component),
        municipality = COALESCE(EXCLUDED.municipality, public.users.municipality),
        barangay = COALESCE(EXCLUDED.barangay, public.users.barangay),
        mobile_number = COALESCE(EXCLUDED.mobile_number, public.users.mobile_number);
    RETURN new;
EXCEPTION
    WHEN OTHERS THEN
        -- Fallback: If any column issue occurs, still insert basic user so signup never crashes!
        BEGIN
            INSERT INTO public.users (id, full_name, email, role)
            VALUES (
                new.id,
                COALESCE(new.raw_user_meta_data->>'full_name', new.email),
                new.email,
                'volunteer'
            )
            ON CONFLICT (id) DO NOTHING;
        EXCEPTION
            WHEN OTHERS THEN
                NULL; -- Never block auth signup!
        END;
        RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Re-attach trigger to auth.users safely
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 5. Reload PostgREST schema cache immediately
NOTIFY pgrst, 'reload schema';
