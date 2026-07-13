# Badal Teacher Test Checklist

## ⚡ Prerequisites

- [ ] **Migration applied**: Run `supabase/migrations/20260713000000_add_badal_columns_to_child_profiles.sql`
- [ ] **Build passes**: `npx vite build` (confirmed ✅)
- [ ] You have **3 test accounts**: Admin, Original Teacher (Teacher A), Badal Teacher (Teacher B)
- [ ] Each teacher account has a `user_portal_access` entry with `portal_role = 'teacher'`
- [ ] Teacher B has their `user_id` set in `user_portal_access` (important!)
- [ ] At least 1 child in `child_profiles` assigned to Teacher A (`teacher_id` = Teacher A's UUID)

---

## 1. Database Schema Check

### 1.1 Verify columns exist
```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'child_profiles' 
  AND column_name IN ('original_teacher_id', 'badal_teacher_id');
```
- [ ] Both columns exist with `text` data type

### 1.2 Verify RLS allows admin updates
```sql
SELECT * FROM pg_policies WHERE tablename = 'child_profiles';
```
- [ ] Admin user can update `child_profiles.badal_teacher_id`

---

## 2. Admin: Assign Badal Teacher (via UI)

### 2.1 Open Admin Portal
- [ ] Login as **Admin**
- [ ] Navigate to the student card for a child assigned to **Teacher A**

### 2.2 Assign Badal Teacher
- [ ] Find the **"Badal Teacher" dropdown** on the child's card
- [ ] Select **Teacher B** from the dropdown
- [ ] Verify success toast: *"Badal teacher assigned! Child will appear in both teachers' portals."*
- [ ] Verify the dropdown now shows Teacher B as selected

### 2.3 Verify Database Update
```sql
SELECT student_id, teacher_id, badal_teacher_id, original_teacher_id
FROM child_profiles 
WHERE student_id = '<child_student_id>';
```
- [ ] `badal_teacher_id` = Teacher B's UUID
- [ ] `original_teacher_id` = Teacher A's UUID (or null if not previously set)

---

## 3. Teacher Portal: Badal Teacher Sees the Child

### 3.1 Login as Badal Teacher (Teacher B)
- [ ] Logout as Admin
- [ ] Login as **Teacher B**
- [ ] You should land in **Teacher Portal**

### 3.2 Check "My Group" Page
- [ ] Navigate to **"My Group"** page
- [ ] The assigned child should be visible in the student grid
- [ ] **Verify**: The child's card shows a **"Badal" badge/tag** indicating substitute status
- [ ] **Verify**: Student count stat includes this child

### 3.3 Check "Fill Result" Page
- [ ] Navigate to **"Fill Result"** page
- [ ] Open the **student selector dropdown**
- [ ] The assigned child should appear in the dropdown options
- [ ] Select the child and verify the form fields load

### 3.4 Check Daily Attendance
- [ ] Navigate to the attendance section (daily attendance grid)
- [ ] The assigned child should appear in the attendance list
- [ ] Try marking **Present** for today → verify success
- [ ] Try marking **Absent** → verify success
- [ ] Try **Mark All** attendance → verify child is included

---

## 4. Teacher Portal: Original Teacher Still Sees the Child

### 4.1 Login as Original Teacher (Teacher A)
- [ ] Login as **Teacher A**

### 4.2 Verify Child is Still Visible
- [ ] Navigate to **"My Group"**
- [ ] The child should still be visible (both teachers see the child)

### 4.3 Check Badal Indicator
- [ ] The child's card should show a **"Badal Active"** badge
- [ ] Should indicate that **Teacher B** is the substitute

---

## 5. Badal Teacher: Fill Marks/Progress

### 5.1 Login as Badal Teacher (Teacher B)
- [ ] Login as **Teacher B**
- [ ] Navigate to **"Fill Result"**

### 5.2 Submit Weekly Progress
- [ ] Select the assigned child
- [ ] Select current week date
- [ ] Fill in Murajah, Juz Hali, Takhteet, Jadeed scores
- [ ] Click Save
- [ ] **Verify**: Success message appears (or auto-save status shows "Saved")
- [ ] **Verify**: The student's latest result appears with the submitted scores

---

## 6. Badal Teacher: Update Daily Attendance

### 6.1 Mark Individual Attendance
- [ ] Navigate to the **daily attendance** grid
- [ ] For the assigned child, click on today's date cell
- [ ] Select **"Present"**
- [ ] **Verify**: The cell shows green/checkmark immediately
- [ ] Refresh the page
- [ ] **Verify**: The attendance persists after refresh

### 6.2 Mark All Attendance
- [ ] Click **"Mark All"** button
- [ ] Select **"Present"**
- [ ] **Verify**: All children (including the badal child) get marked

### 6.3 Check Attendance History
- [ ] Open **"Attendance History"** for the badal child
- [ ] **Verify**: Previous marks are visible (last 28 days)

---

## 7. Edge Cases

### 7.1 Remove Badal Teacher
- [ ] Login as **Admin**
- [ ] Navigate to the child's card
- [ ] Change the Badal Teacher dropdown to **"-- No Badal --"**
- [ ] **Verify**: Success toast: *"Badal teacher removed. Child will only appear in the original teacher's portal."*
- [ ] Login as **Teacher B** → child should **NOT** appear anymore
- [ ] Login as **Teacher A** → child should **STILL** appear

### 7.2 Re-assign Badal Teacher
- [ ] Login as **Admin**
- [ ] Re-assign Teacher B as badal teacher
- [ ] Login as **Teacher B** → child should appear again

### 7.3 Badal Teacher with Email Fallback (no UUID)
- [ ] In Supabase, update `child_profiles.badal_teacher_id` to **Teacher B's email** instead of UUID
```sql
UPDATE child_profiles 
SET badal_teacher_id = 'teacherb@example.com'
WHERE student_id = '<child_id>';
```
- [ ] Login as **Teacher B**
- [ ] The child should still appear (email fallback matching should catch this)
- [ ] **Revert**: Set it back to UUID after testing

### 7.4 Concurrent Badal + Leave
- [ ] Login as **Teacher A** and apply for leave
- [ ] Admin approves the leave
- [ ] Verify the leave-based badal system doesn't conflict with the manually-assigned badal

### 7.5 Multiple Children
- [ ] Assign **Teacher B** as badal for 2+ children
- [ ] Login as Teacher B → all assigned children should appear
- [ ] Fill results for one child → other child's data should not be affected

---

## 8. Data Integrity Checks (SQL)

```sql
-- Check all badal assignments
SELECT cp.student_id, cp.full_name, 
       cp.original_teacher_id, cp.badal_teacher_id,
       tp1.full_name as original_teacher,
       tp2.full_name as badal_teacher
FROM child_profiles cp
LEFT JOIN teacher_profiles tp1 ON tp1.user_id = cp.original_teacher_id
LEFT JOIN teacher_profiles tp2 ON tp2.user_id = cp.badal_teacher_id
WHERE cp.badal_teacher_id IS NOT NULL;
```

- [ ] All badal assignments show correct teacher names
- [ ] `badal_teacher_id` values are valid UUIDs (not emails or other text)

---

## 9. Test Summary

| # | Test Case | Pass/Fail | Notes |
|---|-----------|-----------|-------|
| 2.2 | Admin assigns badal teacher | ⬜ | |
| 3.2 | Badal teacher sees child in My Group | ⬜ | |
| 3.3 | Badal teacher sees child in Fill Result | ⬜ | |
| 3.4 | Badal teacher marks daily attendance | ⬜ | |
| 4.2 | Original teacher still sees child | ⬜ | |
| 5.2 | Badal teacher fills weekly progress | ⬜ | |
| 6.1 | Badal teacher marks individual attendance | ⬜ | |
| 7.1 | Remove badal assignment | ⬜ | |
| 7.3 | Email fallback matching | ⬜ | |

---

## Troubleshooting

If the badal teacher **still can't see the child** after all fixes:

1. **Run the migration**: `20260713000000_add_badal_columns_to_child_profiles.sql`
2. **Check the `badal_teacher_id` value**: It must be set in the database
3. **Check the teacher's `user.id`**: Open browser console and run `console.log(user.id)` - compare with `badal_teacher_id` in DB
4. **Check `user_portal_access`**: Ensure the teacher has an entry with their `user_id` set properly
5. **Refresh data**: After assigning a badal, the teacher may need to refresh their portal
6. **Build is deployed**: Run `npx vite build` and deploy the new build
