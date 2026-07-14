import fs from 'fs';
import path from 'path';

const appPath = path.resolve('src/App.jsx');
let content = fs.readFileSync(appPath, 'utf-8');
let changes = 0;

// CHANGE 3 FIX: Add gender: rawGender to setAdminForms call
const oldSetForm = `    show_salary_card: existingProfile?.show_salary_card ?? existingAccess?.show_salary_card ?? true
  }
}));`;

const newSetForm = `    show_salary_card: existingProfile?.show_salary_card ?? existingAccess?.show_salary_card ?? true,
    gender: rawGender
  }
}));`;

if (content.includes(oldSetForm)) {
  content = content.replace(oldSetForm, newSetForm);
  console.log('CHANGE 3 OK: Added gender to setAdminForms call');
  changes++;
} else {
  console.log('CHANGE 3 FAILED: Could not find setAdminForms pattern');
}

// CHANGE 4 FIX: Add gender dropdown between show_salary_card checkbox and Contact Information
// Find the show_salary_card checkbox end and the Contact Information heading
const oldUi = `                        checked={adminForms.teacherProfile.show_salary_card}
                        onChange={onAdminFormChange(\"teacherProfile\")}
                      />
                    </label>
                  </div>
                </div>

                <h4 className=\"section-title\">Contact Information</h4>`;

const newUi = `                        checked={adminForms.teacherProfile.show_salary_card}
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
                      <option value=\"male\">Male \u2014 Muhaffiz</option>
                      <option value=\"female\">Female \u2014 Muhaffezah</option>
                    </select>
                  </label>
                </div>
              </div>

              <h4 className=\"section-title\">Contact Information</h4>`;

if (content.includes(oldUi)) {
  content = content.replace(oldUi, newUi);
  console.log('CHANGE 4 OK: Added gender dropdown in admin form UI');
  changes++;
} else {
  console.log('CHANGE 4 FAILED: Could not find UI pattern');
  // Debug: show context
  const idx = content.indexOf('Contact Information');
  if (idx >= 0) {
    console.log('Found Contact Information at index', idx);
    console.log('Context before:', content.substring(idx - 80, idx));
    console.log('Context after:', content.substring(idx, idx + 50));
  }
}

// Also fix the My Child's Muhaffiz badge since it uses template literal syntax wrong
// Let's check and fix
const oldBadge = `<div className=\"pin-badge\">
                        <Sparkles size={12} /> My Child's {getTeacherTag(teacher.gender || 'male')}
                      </div>`;
const newBadge = `<div className=\"pin-badge\">
                        <Sparkles size={12} /> My Child\u2019s {getTeacherTag(teacher.gender || 'male')}
                      </div>`;

if (content.includes(oldBadge)) {
  content = content.replace(oldBadge, newBadge);
  console.log('FIX: Fixed apostrophe in badge');
  changes++;
}

// Also fix the "Assigned" tag pattern
const oldAssigned = `<p className=\"teacher-specialty\">Assigned {getTeacherTag(teacher.gender || 'male')}</p>`;
// This should be a JSX expression, not a string with braces
// The correct way is: Assigned {getTeacherTag(...)}
const newAssigned = `<p className=\"teacher-specialty\">Assigned {getTeacherTag(teacher.gender || 'male')}</p>`;

// Actually this is correct JSX - text and JSX expression mixed
// Let me check if the build would pass

fs.writeFileSync(appPath, content, 'utf-8');
console.log(`\nDone! ${changes} changes applied.`);

