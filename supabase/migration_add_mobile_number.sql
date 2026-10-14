-- ============================================================
-- MIGRATION: Add mobile_number to users (Phase A - Nancy's Request)
-- Run this ONCE in the Supabase SQL Editor.
-- This is idempotent: safe to run even if partially applied.
-- ============================================================

-- 1. Add the column (skipped automatically if it already exists)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name   = 'users'
          AND column_name  = 'mobile_number'
    ) THEN
        ALTER TABLE public.users ADD COLUMN mobile_number TEXT;
    END IF;
END $$;

-- 2. Update the signup trigger so new accounts capture mobile_number
--    from the metadata sent by the mobile app.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.users (id, full_name, email, role, nstp_component, municipality, barangay, mobile_number)
    VALUES (
        new.id,
        COALESCE(new.raw_user_meta_data->>'full_name', new.email),
        new.email,
        'volunteer',  -- SECURITY: never trust client-supplied role metadata; promote via service-role API only
        new.raw_user_meta_data->>'nstp_component',
        new.raw_user_meta_data->>'municipality',
        new.raw_user_meta_data->>'barangay',
        new.raw_user_meta_data->>'mobile_number'
    );
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Note: existing volunteers will have NULL mobile_number.
-- They can add/edit it themselves in the mobile app's Profile screen.
