import fs from 'fs';
import path from 'path';

const filePath = path.resolve('src/App.jsx');
let content = fs.readFileSync(filePath, 'utf-8');
let changes = 0;

// Fix the teacher profile check in resolveInitialPortal - instead of calling authorizePortalAccess
// (which will fail for metadata-only admins), directly return teacher role
const oldTeacherCheck = `      if (teacherCheck) {
        const teacherAccess = await authorizePortalAccess(user, "teacher");
        if (teacherAccess.ok) {
          return teacherAccess;
        }
      }`;

const newTeacherCheck = `      if (teacherCheck) {
        return {
          ok: true,
          role: "teacher",
          assignedRoles: assignedRoles.length > 0 ? assignedRoles : ["teacher"],
          parentProfile: null,
          accessRow: null,
        };
      }`;

if (content.includes(oldTeacherCheck)) {
  content = content.replace(oldTeacherCheck, newTeacherCheck);
  console.log('CHANGE 1 OK: resolveInitialPortal now directly returns teacher role when teacher profile found');
  changes++;
} else {
  console.log('CHANGE 1 FAILED: Could not find teacherCheck pattern');
  
  // Try to read the actual surrounding code for debugging
  const idx = content.indexOf('teacherCheck');
  if (idx >= 0) {
    console.log('Found teacherCheck at index:', idx);
    console.log('Context:', content.substring(idx - 50, idx + 200));
  } else {
    console.log('teacherCheck not found in file at all');
  }
}

fs.writeFileSync(filePath, content, 'utf-8');
console.log(`\nDone! ${changes} changes applied.`);
