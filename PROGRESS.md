# NSTP-CONNECT Development Progress

This file mirrors the AI's internal task tracking so you can monitor progress directly in your IDE.

- [x] **Phase 1: Backend Setup (Supabase)**
  - [x] Create `supabase/schema.sql` defining `users`, `activities`, `volunteer_logs`, and `notifications` tables.
  - [x] Setup Row Level Security (RLS) policies for secure data access.
  - [x] Enable Supabase Realtime for the `volunteer_logs` table (for Live Radar).

- [x] **Phase 2: Web Dashboard Initial Setup**
  - [x] Initialize Next.js project with Tailwind CSS.
  - [x] Install dependencies (`@supabase/supabase-js`, `react-leaflet`, `leaflet`, `lucide-react`, `date-fns`).
  - [x] Implement Supabase Client configuration.
  - [x] Build visually intuitive Login screen with clear error messaging.

- [x] **Phase 3: Web Dashboard UI & Logic (Next.js)**
  - [x] Create layout and role-based routing (LGU vs NSTP).
  - [x] **NSTP Portal:** Build Verification dashboard (Approve/Reject buttons).
  - [x] **LGU Portal:** Build Activity creation view using `react-leaflet` for map-click coordinate selection.
  - [x] **LGU Portal:** Implement Live Radar map tracking volunteers using Supabase Realtime.
  - [x] **LGU Portal:** Implement Volunteer Heatmap view.

- [x] **Phase 4: Mobile Application Initial Setup (Flutter)**
  - [x] Initialize Flutter project.
  - [x] Install packages (`supabase_flutter`, `flutter_map`, `latlong2`, `geolocator`, `flutter_spinkit`).

- [x] **Phase 5: Mobile Application UI & Logic**
  - [x] Implement Supabase Client configuration.
  - [x] Build simple Login and Signup flow (with NSTP certificate placeholder UI).
  - [x] Build main Bottom Navigation structure.
  - [x] **Home Screen:** Fetch and display nearby activities.
  - [x] **Activity Screen:** Giant "Start Volunteering" button with Haversine distance validation.
  - [x] Implement GPS tracking logic using `geolocator` and logging to Supabase.
  - [x] **Logbook Screen:** Visual dashboard of past service hours.
  - [x] **Profile Screen:** View user metadata and Logout mechanism.

- [x] **Phase 6: Polish & Integration Testing**
  - [x] Verify color coding (Green/Yellow/Red statuses).
  - [x] Ensure terminology is strictly non-IT (Zero Jargon).
  - [x] Add Complete Volunteer Profile fields (Name, Component, Municipality) to mobile app.
  - [x] Implement real Certificate Viewer in NSTP Web Dashboard.
  - [x] Setup Role Promoters (`seed_roles.sql`) for LGU and NSTP.

- [x] **Phase 7: "Don't Make Me Think" UI/UX Audit**
  - [x] **Jakob's Law:** Ensure familiar layouts (standard navigation, recognizable icons).
  - [x] **Aesthetic Minimalism:** Hide advanced settings; keep one primary action per screen.
  - [x] **Strong Visual Hierarchy:** Large/bright primary buttons vs. small/neutral secondary ones.
  - [x] **Affordances & Signifiers:** Buttons look clickable; inactive states clearly grayed out.
  - [x] **Immediate System Feedback:** Clear loading states, friendly error messages.

- [x] **Phase 8: Objective 2 Fulfillment**
  - [x] Integrate OpenStreetMap (`flutter_map`) into the mobile app's Discover tab.
  - [x] Create native Push Notification service (`flutter_local_notifications`) for community activities.

- [x] **Phase 9: App Icon and Welcome Screen**
  - [x] Implemented modern Welcome/Splash Screen.
  - [x] Generated native iOS and Android app icons based on custom logo.

- [x] **Phase 10: Email OTP Verification**
  - [x] Built the `otp_screen.dart` to verify 6-digit codes.
  - [x] Restructured sign-up flow to defer Supabase bucket uploads until OTP is fully verified.

- [x] **Phase 11: Custom Next.js OTP Backend**
  - [x] Bypassed Supabase verification entirely.
  - [x] Created `/api/send-otp` in Next.js using `nodemailer` to send Gmail OTPs directly.

- [x] **Phase 12: Web Dashboard Completion**
  - [x] Built the Emergency Broadcast Panel for LGUs (`/lgu/broadcast`).
  - [x] Built the Activity Logs table for LGUs (`/lgu/activity-logs`).
  - [x] Built the NSTP Verified Masterlist with service hour aggregation (`/nstp/records`).

- [x] **Phase 13: Refinement & Security Enhancements**
  - [x] Fixed mobile app timer synchronization and session restoration when navigating back.
  - [x] Added unique volunteer counting logic to Activity Logs (including CSV and PDF exports).
  - [x] Restructured sidebar routing to prevent layout collision between LGU and NSTP portals.
  - [x] Restricted Unverified volunteers from starting activity timers in the mobile app.
  - [x] Implemented client-side Route Protection (Auth Guard) to secure LGU and NSTP dashboard URLs.

- [x] **Phase 14: Directory Filters, Live Radar Attendance, and Mobile Session Persistence**
  - [x] Dynamic ROTC, CWTS, and LTS component counters in Student Directory linked to Municipality and Barangay filters.
  - [x] Added required Philippine phone validation and schema persistence to Reservist Registration.
  - [x] Fixed emergency broadcast delivery for targeted municipalities with spaced names (PostgREST grammar fix & case-insensitive token queries).
  - [x] Live Radar Map: Popup direct-calling button (`tel:`) and contact display for rapid attendance verification.
  - [x] Mobile App: Active session persistence on launch to eliminate back-to-login bounces.
  - [x] System Quality Audit: Fixed React 19 component-in-render issues, strict typing, and verified Next.js 16 production build.

- [x] **Phase 15: Static Analysis & Production Hardening**
  - [x] Resolved ESLint `react-hooks/set-state-in-effect` cascading render issues across LGU and NSTP dashboards via deferred timeouts.
  - [x] Eliminated all `any` types in `activity-logs`, `lgu/page.tsx`, `nstp/admins`, and `nstp/page.tsx` with strongly-typed interfaces.
  - [x] Upgraded raw certificate images in verification view to Next.js `Image` component.
  - [x] Passed ESLint with 0 errors and 0 warnings.
  - [x] Passed Next.js 16 (Turbopack) build with 18/18 static routes compiled and prerendered.
  - [x] Validated Flutter mobile codebase with `dart analyze lib/` with 0 errors, 0 warnings, and 0 infos (eliminated all avoid_print, prefer_const, and identifier warnings).

- [x] **Phase 16: End-to-End Edge Case & Integrity Hardening**
  - [x] Profile Screen: Added Mobile Number field to volunteer profile details view for reservist verification.
  - [x] Student Records: Fixed real-time active session calculations by querying `created_at` in `volunteer_logs` sub-select.
  - [x] Student Records: Replaced untyped arrays with `StudentRecord` interface and added null-safe hour formatting in CSV/PDF exports.
  - [x] Activity Creation: Optimized push fan-out with deduplicated tokens, role exclusion, and concurrent delivery.
  - [x] Activity Logs: Preserved `volunteer_logs` participant count when saving edited activity details.

- [x] **Phase 17: Supabase Schema Synchronization & Mobile App Resilience**
  - [x] Diagnosed Supabase Auth 500 error (`Database error saving new user`) and PostgREST 400 error (`Could not find mobile_number column in schema cache`).
  - [x] Verified via live query that `public.users` in project `alplydafnokiucslivsd` was missing `mobile_number` while `handle_new_user()` trigger was attempting to insert into it.
  - [x] Updated `supabase/migration_add_mobile_number.sql` with idempotent `ADD COLUMN IF NOT EXISTS`, `ON CONFLICT DO UPDATE` handling, and immediate `NOTIFY pgrst, 'reload schema'`.
  - [x] Added graceful client-side fallbacks in `profile_screen.dart` and `otp_screen.dart` so user profile edits and OTP registration never crash if database schema sync is in flight.
  - [x] Added resilient query fallback to `LiveRadarMap.tsx` preventing initial load failures when `mobile_number` is pending migration.
  - [x] Replaced `insert` with `upsert` in admin user creation route to eliminate primary key collision with database triggers.


