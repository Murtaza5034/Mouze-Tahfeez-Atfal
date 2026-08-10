# Firebase Migration Blueprint — Mauze Tahfeez

Goal: move the live backend from Supabase (project `medypnbcsjytbxiwenob`) to
Firebase (project `al-mawaid-1ihvq0`) — **Auth, Firestore, Cloud Functions,
Storage**. The frontend UI/UX stays identical; only the data-access layer
(where components call Supabase) changes.

Source of truth: live schema dumped 2026-08-08 (42 tables, all columns/keys).

---

## 1. Layout

App code:
- `src/` — unchanged UI components
- `src/firebase/db.js` — NEW Firestore data layer (replaces `supabaseClient.js` usage)
- `src/firebase/auth.js` — NEW Firebase Auth wrapper
- `src/firebase/storage.js` — NEW Storage wrapper
- `src/firebase/db-adapter.js` — adapter mapping supabase-style calls to Firestore

Backend:
- `firebase/functions/` — Cloud Functions (TypeScript)
- `firebase/firestore.rules` — Firestore security rules (mirrors RLS)
- `firebase/storage.rules` — Storage rules (mirrors bucket policies)
- `firebase/.firebaserc` — project alias `al-mawaid-1ihvq0`

---

## 2. Auth model (replaces `auth.users` + `user_portal_access`)

Source of truth for identity: **Firebase Auth**.
Roles live in Firestore `users/{uid}` document under role-aware fields.

Collection `users/`:
- doc id = Firebase Auth `uid` (migrated 1:1 from auth.users uid)
- fields: email, full_name, portal_role (`'admin' | 'teacher' | 'parent'`),
  is_active, created_at, updated_at, salary_per_minute, show_salary_card

`user_portal_access` rows:
- `user_id` references auth.users -> becomes `users/{uid}`
- `portal_role` becomes `users/{uid}.portal_role`
- `full_name`, `email` denormalized onto `users`
- `salary_per_minute`, `show_salary_card` moved to `users`
- `user_portal_access` doc id = `users/{uid}` (unique on user_id preserved)

## 3. Collections (1:1 table → collection unless noted)

| Firestore collection | Source table | Doc id | Notes |
|---|---|---|---|
| `users` | auth.users + user_portal_access | uid | merged |
| `child_profiles` | child_profiles | student_id | |
| `weekly_results` | weekly_results | id | |
| `weekly_results_archive` | weekly_results_archive | id | |
| `teacher_profiles` | teacher_profiles | id | id/uuid, referenced by user_id |
| `teacher_student_assignments` | teacher_student_assignments | id | |
| `custom_groups` | custom_groups | id | |
| `attendance` | attendance | id | |
| `student_daily_attendance` | student_daily_attendance | id | |
| `teacher_attendance` | teacher_attendance | id | |
| `student_leaves` | student_leaves | id | |
| `teacher_leaves` | teacher_leaves | id | |
| `teacher_leave_badals` | teacher_leave_badals | id | |
| `event_leaves` | event_leaves | id | |
| `events` | events | id | |
| `schedule` | schedule | id | |
| `jadawal` | jadawal | id | |
| `jadwal_settings` | jadwal_settings | 1 | singleton |
| `self_jadwal` | self_jadwal | user_id | |
| `self_jadawal` | self_jadawal | user_id | legacy |
| `self_jadwal_notifications` | self_jadwal_notifications | id | |
| `miqaat_calendar` | miqaat_calendar | id | |
| `marhala_posts` | marhala_posts | id | |
| `marhala_settings` | marhala_settings | 1 | singleton |
| `parent_notes` | parent_notes | id | |
| `parent_report_views` | parent_report_views | student_id | |
| `page_visibility` | page_visibility | page_key | |
| `portal_issues` | portal_issues | id | |
| `support_tickets` | support_tickets | id | |
| `quran_ikhtebar` | quran_ikhtebar | id | |
| `elearning_tracking` | elearning_tracking | id | |
| `system_notifications` | system_notifications | id | |
| `scheduled_notifications` | scheduled_notifications | id | |
| `report_settings` | report_settings | 1 | singleton |
| `settings` | email_settings, whatsapp_config, app_releases | see below |
| `email_settings` | email_settings | 1 | singleton |
| `whatsapp_config` | whatsapp_config | 1 | singleton |
| `app_releases` | app_releases | id | |
| `email_logs` | email_logs | id | |
| `user_fcm_tokens` | user_fcm_tokens | fcm_token | unique on token |
| `badal_assignments` | badal_assignments | id | |
| `badal_progress` | badal_progress | id | |
| `teacher_unlock_logs` | teacher_unlock_logs | id | |
| `tahfeez_signals` | tahfeez_signals | id | no longer used |

## 3. Query → Firestore mapping

Supabase queries like `supabase.from('weekly_results').select().eq(...)` map
to Firestore `collection('weekly_results').where(...)`.

Simple equality filters, `orderBy`, `limit`, `single()` work directly.

**Anything beyond that** — `.or()`, regex `ilike` on name, `gte/lte` on ranges
where the query needs OR/range logic — must be done via:
- index on the collection, OR
- thin client-side filter after a bounded fetch, OR
- a Cloud Function for the fan-out (e.g. get-global-rank).

## 4. Cloud Functions

Mirrors of runtime Supabase Edge Functions + crons:

| Cloud Function | Trigger | Purpose |
|---|---|---|
| getGlobalRank (callable) | onCall | ranks by week, using indexed weekly_results |
| sendFcm (onWrite) | Firestore trigger | sends FCM when user_fcm_tokens changes |
| sendScheduleNotifications (onSchedule) | cron | scheduled_notifications fire |
| sendJadwalReminder (onSchedule) | cron | 15 min |
| sendResultLiveNotifier (onSchedule) | cron | 2 min |
| sendWhatsapp (callable) | onCall | whatsapp config send |
| sendEmail (callable) | onCall | email settings send |
| deployAndroidApp (callable) | onCall | play store deploy |
| processScheduledNotifications (onSchedule | cron)

In `firebase/functions/src/index.ts`.

## 4. RLS → Rules mapping

Originals live in `supabase/migrations/*.sql`. Migrate each `CREATE POLICY`
to the corresponding `firestore.rules` `allow` statement. Stub
`firestore.rules` contains asserts for admin, teacher, parent roles.

## 5. Storage

Buckets: `child profile pictures`, `marhala_post_photos`, `muhaffezat atfal`,
`notification_files`, `report_backgrounds`, `teacher_photos`.

Firebase Storage bucket: `al-mawaid-1ihvq0.appspot.com`.
Mirror rules with `storage.rules`.

## 7. Client adapter

`src/firebase/db.js` exposes helpers replacing direct `supabase` calls:
- `db.get(collection, docId)`
- `db.query(collection, {where, orderBy, limit})`
- `db.insert(collection, data)`
- `db.update(collection, docId, data)`
- `db.remove(collection, docId)`

Keep `src/supabaseClient.js` exporting `supabase` NO LONGER.
All imports switch to `db.js` + `auth.js`.

## 8. Live data copied

Migration script `firebase/functions/src/migrate.ts` runs once:
- reads each Supabase table via service-key REST
- writes each doc to Firestore with the same id
- (ids preserved so relationships stay intact)