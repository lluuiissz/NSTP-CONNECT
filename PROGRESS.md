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
