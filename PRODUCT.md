# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Teachers (Tahfeez Asateza)**: Log in daily on mobile/desktop to record students' Quran memorization progress (Jadwal, Takhteet, Juz & Surah completion), mark attendance, log leaves, and assess weekly/marhala tests.
- **Students & Parents**: Log in on the mobile app / PWA to view daily progress cards, upcoming Jadwal, attendance records, Fatemi calendar Miqaats, and progress reports.

## Product Purpose

Mauze Tahfeez Atfal is a dedicated Quran Tahfeez management platform designed to streamline daily memorization tracking (Jadwal), Takhteet progress, attendance, Marhala exam evaluation, and parent communication for Tahfeez institutions through an interactive web app and Android PWA. Success means seamless daily recording by teachers without data loss, instant clarity for parents on child progress, and automated institutional sync.

## Positioning

A culturally tailored, Fatemi calendar-integrated Tahfeez management system built specifically for Dawoodi Bohra community Quran memorization structures (Juz, Surah, Takhteet, Miqaat schedules, and WhatsApp broadcast integration).

## Operating Context

- **Daily Madrasah Sessions**: Fast, high-frequency data entry during live classroom sessions where teachers switch rapidly between students.
- **Parent Check-ins**: Mobile-first viewing on smartphones (PWA / Android APK via Capacitor).
- **Communication Channels**: Automated and manual sync via WhatsApp notifications and Firebase Cloud Messaging (FCM).
- **Calendar & Schedule**: Synchronized with the Fatemi Hijri calendar and local Miqaat events.

## Capabilities and Constraints

- **Capabilities**:
  - Daily Jadwal & Takhteet memorization tracking per student.
  - Comprehensive attendance management and leave requests.
  - Weekly and Marhala examination results & progress cards.
  - Teacher profile & salary tracking.
  - Multi-child parent dashboard with real-time sync.
  - Integrated Fatemi calendar and Miqaat reminders.
  - Offline-resilient local storage with Supabase / Firebase cloud sync.
  - Automated WhatsApp alerts and FCM push notifications.
- **Constraints**:
  - React 18 + Vite frontend packaged for web and Android via Capacitor.
  - Must remain fast and responsive on low-to-mid-tier Android mobile devices.
  - High fidelity required for Arabic Quranic typography and script formatting.

## Brand Commitments

- **Name**: Mauze Tahfeez / Mauze Tahfeez Atfal.
- **Identity & Aesthetics**: Warm, respectful, reverent cultural tone with gold, emerald, and cream palettes fitting sacred educational institutions. Clean modern typography combined with traditional Arabic/Fatemi script elegance.

## Evidence on Hand

- Production codebase running with React 18, Vite, Capacitor Android builds, and Supabase backend.
- Deployed web instance at `https://mouze-tahfeez-atfal.vercel.app` and production Android builds (`Mauze-Tahfeez.apk`/`aab`).
- Real database schemas for Jadwal tracking, parent notes, progress cards, and attendance.

## Product Principles

1. **Classroom-Speed Usability**: The teacher's daily entry workflow must require minimal taps, auto-save reliably, and never block instruction.
2. **Clarity for Parents**: Every progress card, score, and attendance status must be instantly interpretable at a glance on mobile screens.
3. **Data Integrity & Continuity**: Tahfeez records represent months of student effort; updates must be persistent, synced, and protected against data loss.
4. **Cultural & Spiritual Reverence**: UI presentation, calendar integration, and Quranic text rendering must adhere to proper Fatemi norms and typography standards.
