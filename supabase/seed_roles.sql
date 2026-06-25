-- Run this script in your Supabase SQL Editor to promote a specific user to an Admin or NSTP Coordinator.
-- Replace the email addresses below with the emails of the accounts you created.

-- To promote an account to an LGU Admin (For the Live Radar / Map portal)
UPDATE public.users 
SET role = 'admin', is_verified = true 
WHERE email = 'YOUR_LGU_EMAIL@example.com';

-- To promote an account to an NSTP Coordinator (For the Verification portal)
UPDATE public.users 
SET role = 'nstp', is_verified = true 
WHERE email = 'YOUR_NSTP_EMAIL@example.com';
