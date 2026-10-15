-- ============================================================
-- MIGRATION: Add mobile_number to users & Fix Signup Trigger
-- Run this ONCE in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/alplydafnokiucslivsd/sql
-- ============================================================

-- 1. Add the mobile_number column to public.users if not present
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS mobile_number TEXT;

-- 2. Update the signup trigger so new accounts capture mobile_number
--    and gracefully handle re-registrations via ON CONFLICT.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.users (id, full_name, email, role, nstp_component, municipality, barangay, mobile_number)
    VALUES (
        new.id,
        COALESCE(new.raw_user_meta_data->>'full_name', new.email),
        new.email,
        'volunteer',  -- SECURITY: never trust client-supplied role metadata
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
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Re-attach trigger to auth.users safely
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 4. Reload PostgREST schema cache immediately so Flutter & Web can access mobile_number
NOTIFY pgrst, 'reload schema';
