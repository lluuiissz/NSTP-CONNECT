-- Migration: Add explicit pinned coordinates to notifications table
ALTER TABLE public.notifications 
ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION;

COMMENT ON COLUMN public.notifications.lat IS 'Exact pinned latitude for the incident or muster location';
COMMENT ON COLUMN public.notifications.lng IS 'Exact pinned longitude for the incident or muster location';
