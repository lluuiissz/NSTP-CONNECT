-- ============================================================
-- SECURITY MIGRATION: Stop privilege escalation via signup metadata
-- Run this ONCE in the Supabase SQL Editor.
--
-- BEFORE: handle_new_user() trusted raw_user_meta_data->>'role',
--         so ANYONE could sign up with {"role": "admin"} metadata
--         and instantly gain LGU Admin / NSTP Coordinator access.
-- AFTER:  the trigger ALWAYS creates volunteers. Privileged roles
--         are assigned only by server-side code (service role key),
--         e.g. the /api/admin/create-user route.
--
-- Idempotent: safe to run multiple times.
-- ============================================================

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
    );
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
