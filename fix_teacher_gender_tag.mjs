import fs from 'fs';
import path from 'path';

const appPath = path.resolve('src/App.jsx');
let content = fs.readFileSync(appPath, 'utf-8');
let changes = 0;

// ====================== ADD HELPER FUNCTION ======================
// Add a getTeacherTag helper function near getAssignedRoles area
const helperFunc = `function getTeacherTag(gender) {
  return gender === 'female' ? 'Muhaffezah' : 'Muhaffiz';
}

async function findPortalAccess(userId) {`;

if (content.includes('async function findPortalAccess(userId) {')) {
  content = content.replace(
    'async function findPortalAccess(userId) {',
    helperFunc
  );
  console.log('HELPER OK: Added getTeacherTag helper function');
  changes++;
} else {
  console.log('HELPER FAILED: Could not find findPortalAccess');
}

// ====================== CHANGE 1: Admin form initial state ======================
// Add gender: "male" to teacher profile reset state
const oldReset = `teacherProfile: { user_id: \"\", full_name: \"\", photo_url: \"\", phone_number: \"\", whatsapp_number: \"\", salary_per_minute: \"2.3\", show_salary_card: true }`;
const newReset = `teacherProfile: { user_id: \"\", full_name: \"\", photo_url: \"\", phone_number: \"\", whatsapp_number: \"\", salary_per_minute: \"2.3\", show_salary_card: true, gender: \"male\" }`;

if (content.includes(oldReset)) {
  content = content.replace(oldReset, newReset);
  console.log('CHANGE 1 OK: Added gender: \"male\" to teacher profile reset state');
  changes++;
} else {
  console.log('CHANGE 1 FAILED: Could not find reset state pattern');
}

// ====================== CHANGE 2: Extract gender from existing profile ======================
const oldSalary = `const rawSalary = existingProfile?.salary_per_minute ?? existingAccess?.salary_per_minute;`;
const newSalary = `const rawGender = existingProfile?.gender || 'male';
                          const rawSalary = existingProfile?.salary_per_minute ?? existingAccess?.salary_per_minute;`;

if (content.includes(oldSalary)) {
  content = content.replace(oldSalary, newSalary);
  console.log('CHANGE 2 OK: Added gender extraction from existing profile');
  changes++;
} else {
  console.log('CHANGE 2 FAILED: Could not find salary extraction pattern');
}

// ====================== CHANGE 3: Include gender in setAdminForms call ======================
// Find where adminForms.teacherProfile is set with the selected data
// Pattern: setAdminForms(curr => ({...curr, teacherProfile: { ...existingProfile, ...existingAccess, ... }}))
const oldSetForm = `setAdminForms(curr => ({
                              ...curr,
                              teacherProfile: {
                                ...existingProfile,
                                ...existingAccess,
                                user_id: existingProfile?.user_id || existingAccess?.user_id || \"\",
                                full_name: selectedName,
                                photo_url: existingProfile?.photo_url || existingAccess?.photo_url || \"\",
                                phone_number: existingProfile?.phone_number || \"\",
                                whatsapp_number: existingProfile?.whatsapp_number || existingAccess?.whatsapp_number || \"\",
                                salary_per_minute: rawSalary,
                                show_salary_card: existingProfile?.show_salary_card ?? existingAccess?.show_salary_card ?? true,
                              }
                            }));`;

const newSetForm = `setAdminForms(curr => ({
                              ...curr,
                              teacherProfile: {
                                ...existingProfile,
                                ...existingAccess,
                                user_id: existingProfile?.user_id || existingAccess?.user_id || \"\",
                                full_name: selectedName,
                                photo_url: existingProfile?.photo_url || existingAccess?.photo_url || \"\",
                                phone_number: existingProfile?.phone_number || \"\",
                                whatsapp_number: existingProfile?.whatsapp_number || existingAccess?.whatsapp_number || \"\",
                                salary_per_minute: rawSalary,
                                show_salary_card: existingProfile?.show_salary_card ?? existingAccess?.show_salary_card ?? true,
                                gender: rawGender,
                              }
                            }));`;

if (content.includes(oldSetForm)) {
  content = content.replace(oldSetForm, newSetForm);
  console.log('CHANGE 3 OK: Added gender to setAdminForms call');
  changes++;
} else {
  console.log('CHANGE 3 FAILED: Could not find setAdminForms pattern - will try alternative');
}

// ====================== CHANGE 4: Add gender dropdown in admin form UI ======================
// Find the show_salary_card checkbox and add gender dropdown after it
const oldSalarySection = `<input
                          type=\"checkbox\"
                          name=\"show_salary_card\"
                          checked={adminForms.teacherProfile.show_salary_card}
                          onChange={onAdminFormChange(\"teacherProfile\")}
                        />
                      </label>
                    </div>
                  </div>
                </div>

                <h4 className=\"section-title\">Contact Information</h4>`;

const newSalarySection = `<input
                          type=\"checkbox\"
                          name=\"show_salary_card\"
                          checked={adminForms.teacherProfile.show_salary_card}
                          onChange={onAdminFormChange(\"teacherProfile\")}
                        />
                      </label>
                    </div>

                    <label className=\"form-group\">
                      <span>Gender</span>
                      <select
                        name=\"gender\"
                        value={adminForms.teacherProfile.gender || \"male\"}
                        onChange={onAdminFormChange(\"teacherProfile\")}
                        className=\"premium-select\"
                      >
                        <option value=\"male\">Male â€” Muhaffiz</option>
                        <option value=\"female\">Female â€” Muhaffezah</option>
                      </select>
                    </label>
                  </div>
                </div>

                <h4 className=\"section-title\">Contact Information</h4>`;

if (content.includes(oldSalarySection)) {
  content = content.replace(oldSalarySection, newSalarySection);
  console.log('CHANGE 4 OK: Added gender dropdown in admin form');
  changes++;
} else {
  console.log('CHANGE 4 FAILED: Could not find salary section pattern');
}

// ====================== CHANGE 5: Teacher profile upsert ======================
// Add gender to the upsert payload
const oldUpsert = `const { error: profileError } = await supabase
      .from(\"teacher_profiles\")
      .upsert(
        {
          user_id: resolvedUserId,
          full_name: payload.full_name,
          photo_url: payload.photo_url,
          phone_number: payload.phone_number,
          whatsapp_number: payload.whatsapp_number,
          salary_per_minute: Number(payload.salary_per_minute || 2.3),
          show_salary_card: !!payload.show_salary_card,
          is_active: true,`;

const newUpsert = `const { error: profileError } = await supabase
      .from(\"teacher_profiles\")
      .upsert(
        {
          user_id: resolvedUserId,
          full_name: payload.full_name,
          photo_url: payload.photo_url,
          phone_number: payload.phone_number,
          whatsapp_number: payload.whatsapp_number,
          salary_per_minute: Number(payload.salary_per_minute || 2.3),
          show_salary_card: !!payload.show_salary_card,
          is_active: true,
          gender: payload.gender || 'male',`;

if (content.includes(oldUpsert)) {
  content = content.replace(oldUpsert, newUpsert);
  console.log('CHANGE 5 OK: Added gender to teacher profile upsert');
  changes++;
} else {
  console.log('CHANGE 5 FAILED: Could not find upsert pattern');
}

// ====================== CHANGE 6: Parent Portal Teacher page tags ======================
// 6a: Pinned teacher card - "My Child's Muhaffiz" badge
const oldPinBadge = `<div className=\"pin-badge\">
                        <Sparkles size={12} /> My Child's Muhaffiz
                      </div>`;
const newPinBadge = `<div className=\"pin-badge\">
                        <Sparkles size={12} /> My Child's {getTeacherTag(teacher.gender || 'male')}
                      </div>`;

if (content.includes(oldPinBadge)) {
  content = content.replace(oldPinBadge, newPinBadge);
  console.log('CHANGE 6a OK: Updated pinned teacher badge to use gender tag');
  changes++;
} else {
  console.log('CHANGE 6a FAILED: Could not find pin badge pattern');
}

// 6b: "Assigned Muhaffiz" specialty text
const oldAssignedMuhaffiz = `<p className=\"teacher-specialty\">Assigned Muhaffiz</p>`;
const newAssignedMuhaffiz = `<p className=\"teacher-specialty\">Assigned {getTeacherTag(teacher.gender || 'male')}</p>`;

if (content.includes(oldAssignedMuhaffiz)) {
  content = content.replace(oldAssignedMuhaffiz, newAssignedMuhaffiz);
  console.log('CHANGE 6b OK: Updated Assigned Muhaffiz to use gender tag');
  changes++;
} else {
  console.log('CHANGE 6b FAILED: Could not find Assigned Muhaffiz pattern');
}

// 6c: "Muhaffiz" specialty text for other teachers
const oldMuhaffiz = `<p className=\"teacher-specialty\">Muhaffiz</p>`;
const newMuhaffiz = `<p className=\"teacher-specialty\">{getTeacherTag(teacher.gender || 'male')}</p>`;

if (content.includes(oldMuhaffiz)) {
  content = content.replace(oldMuhaffiz, newMuhaffiz);
  console.log('CHANGE 6c OK: Updated Muhaffiz to use gender tag');
  changes++;
} else {
  console.log('CHANGE 6c FAILED: Could not find Muhaffiz pattern');
}

// ====================== CHANGE 7: Premium stats card ======================
const oldStatLabel = `{ label: \"My Muhaffiz\", val: hifzDetails?.muhaffiz_name || \"Pending\", sub: (() => { const bt = teacherProfiles?.find(t => t.user_id === studentProfile?.badal_teacher_id); return bt ? \`Badal: \${bt.full_name || bt.name}\` : \"Direct Teacher\"; })(), icon: GraduationCap, color: \"#d4af37\" }`;
const newStatLabel = `{ label: (() => { const mt = myTeacher; return mt ? (mt.gender === 'female' ? 'My Muhaffezah' : 'My Muhaffiz') : 'My Muhaffiz'; })(), val: hifzDetails?.muhaffiz_name || \"Pending\", sub: (() => { const bt = teacherProfiles?.find(t => t.user_id === studentProfile?.badal_teacher_id); return bt ? \`Badal: \${bt.full_name || bt.name}\` : \"Direct Teacher\"; })(), icon: GraduationCap, color: \"#d4af37\" }`;

if (content.includes(oldStatLabel)) {
  content = content.replace(oldStatLabel, newStatLabel);
  console.log('CHANGE 7 OK: Updated premium stats card label to be gender-aware');
  changes++;
} else {
  console.log('CHANGE 7 FAILED: Could not find stats card pattern');
}

// ====================== CHANGE 8: Info section ======================
const oldInfoMuhaffiz = `<span className=\"label\">MUHAFFIZ NAME</span>`;
const newInfoMuhaffiz = `<span className=\"label\">{(() => { const mt = myTeacher; return mt?.gender === 'female' ? 'Muhaffezah NAME' : 'Muhaffiz NAME'; })()}</span>`;

if (content.includes(oldInfoMuhaffiz)) {
  content = content.replace(oldInfoMuhaffiz, newInfoMuhaffiz);
  console.log('CHANGE 8 OK: Updated info section label to be gender-aware');
  changes++;
} else {
  console.log('CHANGE 8 FAILED: Could not find info section pattern');
}

// ====================== SAVE ======================
fs.writeFileSync(appPath, content, 'utf-8');
console.log(`\nDone! ${changes} changes applied.`);

