const fs = require('fs');
let code = fs.readFileSync('src/App.jsx', 'utf8');

const startIndex = code.indexOf(`{(function() {\n                const [tlLeaves, setTlLeaves] = useState([]);`);
const endIndex = code.indexOf(`})()}`, startIndex) + `})()}`.length;

if (startIndex === -1 || endIndex === -1) {
  console.log('Could not find IIFE bounds.');
  process.exit(1);
}

const iifeCode = code.slice(startIndex, endIndex);

// Build the new component code
let componentBody = iifeCode
  .replace(`{(function() {`, `export function TeacherLeaveApprovalsAdmin({ students, teacherProfiles, onShowAction, loadPortalData, portalRole, user, supabase }) {`)
  .replace(/}\)\(\)\}$/, `}`);

const componentCode = componentBody + '\n\n';

// Replace the IIFE with the component call
const replacementCall = `<TeacherLeaveApprovalsAdmin 
                students={students} 
                teacherProfiles={teacherProfiles} 
                onShowAction={onShowAction} 
                loadPortalData={loadPortalData} 
                portalRole={portalRole} 
                user={user} 
                supabase={supabase}
              />`;

code = code.slice(0, startIndex) + replacementCall + code.slice(endIndex);

// Insert the new component right before function AdminPortal
const adminPortalStart = code.indexOf('function AdminPortal({');
if (adminPortalStart === -1) {
  console.log('Could not find AdminPortal start.');
  process.exit(1);
}

code = code.slice(0, adminPortalStart) + componentCode + code.slice(adminPortalStart);

fs.writeFileSync('src/App.jsx', code);
console.log('Successfully refactored TeacherLeaveApprovalsAdmin into a separate component!');
