import re

with open('src/Jadwal.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# === Fix 1: PDF generation - replace the nested template literal with proper conditional ===
# The current code has `return mode === 'juz-wise' ? \`...\` : \`...\`` inside a template literal
# which creates nested backticks. Fix by building the table HTML separately.

old_pdf_block = """  printContainer.innerHTML = `\r\n    <div style=\"border: 2px solid #dfcbb5; border-radius: 16px; padding: 30px; background: #fffcf8; box-sizing: border-box;\">\r\n      <!-- Header -->\r\n      <div style=\"display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #dfcbb5; padding-bottom: 20px; margin-bottom: 25px;\">\r\n        <div>\r\n          <h1 style=\"margin: 0; font-size: 26px; color: #5d4037; font-family: 'Cinzel', serif; font-weight: bold; letter-spacing: 1px;\">MAUZE TAHFEEZ ATFAL</h1>\r\n          <p style=\"margin: 5px 0 0 0; font-size: 14px; color: #8b6d31; font-weight: 600; letter-spacing: 0.5px;\">Weekly Quran Jadwal (Timetable)</p>\r\n        </div>\r\n        <div style=\"text-align: right;\">\r\n          <div style=\"font-size: 12px; color: #888; font-weight: 500;\">Generated on</div>\r\n          <div style=\"font-size: 14px; color: #5d4037; font-weight: bold;\">${new Date().toLocaleDateString()}</div>\r\n        </div>\r\n      </div>\r\n\r\n      <!-- Student Info Details -->\r\n      <div style=\"background: rgba(212, 175, 55, 0.05); border: 1px solid rgba(212, 175, 55, 0.2); border-radius: 12px; padding: 18px 24px; margin-bottom: 30px; display: flex; justify-content: space-between; align-items: center; box-sizing: border-box;\">\r\n        <div>\r\n          <span style=\"font-size: 11px; color: #8b6d31; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; display: block; margin-bottom: 4px;\">STUDENT NAME</span>\r\n          <span style=\"font-size: 20px; color: #5d4037; font-weight: 800;\">${studentName}</span>\r\n        </div>\r\n        <div style=\"text-align: right;\">\r\n          <span style=\"font-size: 11px; color: #8b6d31; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; display: block; margin-bottom: 4px;\">ACADEMIC PORTAL</span>\r\n          <span style=\"font-size: 14px; color: #ffffff; font-weight: 700; background: #5d4037; padding: 4px 12px; border-radius: 20px;\">Hifz Program</span>\r\n        </div>\r\n      </div>\r\n\r\n      <!-- Jadwal Table -->\r\n      <table style=\"width: 100%; border-collapse: collapse; margin-top: 10px; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 10px rgba(93, 64, 55, 0.03);\">\r\n        <thead>\r\n          <tr style=\"background: #5d4037; color: #ffffff;\">\r\n            <th style=\"padding: 14px; border: 1px solid #dfcbb5; font-size: 12px; text-transform: uppercase; font-weight: bold; text-align: left; width: 120px;\">DAYS</th>\r\n            <th style=\"padding: 14px; border: 1px solid #dfcbb5; font-size: 12px; text-transform: uppercase; font-weight: bold; text-align: center;\">JUZ 1</th>\r\n            <th style=\"padding: 14px; border: 1px solid #dfcbb5; font-size: 12px; text-transform: uppercase; font-weight: bold; text-align: center;\">JUZ 2</th>\r\n            <th style=\"padding: 14px; border: 1px solid #dfcbb5; font-size: 12px; text-transform: uppercase; font-weight: bold; text-align: center;\">JUZ 3</th>\r\n            <th style=\"padding: 14px; border: 1px solid #dfcbb5; font-size: 12px; text-transform: uppercase; font-weight: bold; text-align: center;\">JUZ 4</th>\r\n            <th style=\"padding: 14px; border: 1px solid #dfcbb5; font-size: 12px; text-transform: uppercase; font-weight: bold; text-align: center; width: 110px;\">STAR</th>\r\n          </tr>\r\n        </thead>\r\n        <tbody>\r\n          ${DAYS.map((day, idx) => {\r\n            const row = scheduleData[day] || { juz1: '', juz2: '', juz3: '', juz4: '', murajah: '', juzhali: '', jadeed: '', star: '' };\r\n            const stars = row.star ? '\\u2B50'.repeat(parseInt(row.star)) : '-';\r\n            const rowBg = idx % 2 === 0 ? '#ffffff' : '#fefbf7';\r\n            return mode === 'juz-wise' ? `\r\n              <tr style=\"background: ${rowBg};\">\r\n                <td style=\"padding: 14px; border: 1px solid #dfcbb5; font-weight: bold; font-size: 13px; color: #5d4037; text-align: left;\">${day}</td>\r\n                <td style=\"padding: 14px; border: 1px solid #dfcbb5; font-size: 13px; color: #333; text-align: center; font-weight: 500;\">${row.juz1 || '-'}</td>\r\n                <td style=\"padding: 14px; border: 1px solid #dfcbb5; font-size: 13px; color: #333; text-align: center; font-weight: 500;\">${row.juz2 || '-'}</td>\r\n                <td style=\"padding: 14px; border: 1px solid #dfcbb5; font-size: 13px; color: #333; text-align: center; font-weight: 500;\">${row.juz3 || '-'}</td>\r\n                <td style=\"padding: 14px; border: 1px solid #dfcbb5; font-size: 13px; color: #333; text-align: center; font-weight: 500;\">${row.juz4 || '-'}</td>\r\n                <td style=\"padding: 14px; border: 1px solid #dfcbb5; font-size: 16px; color: #FFD700; text-align: center; letter-spacing: 1px;\">${stars}</td>\r\n              </tr>\r\n            ` : `\r\n              <tr style=\"background: ${rowBg};\">\r\n                <td style=\"padding: 14px; border: 1px solid #dfcbb5; font-weight: bold; font-size: 13px; color: #5d4037; text-align: left;\">${day}</td>\r\n                <td style=\"padding: 14px; border: 1px solid #dfcbb5; font-size: 13px; color: #333; text-align: center; font-weight: 500;\">${row.murajah || '-'}</td>\r\n                <td style=\"padding: 14px; border: 1px solid #dfcbb5; font-size: 13px; color: #333; text-align: center; font-weight: 500;\">${row.juzhali || '-'}</td>\r\n                <td style=\"padding: 14px; border: 1px solid #dfcbb5; font-size: 13px; color: #333; text-align: center; font-weight: 500;\">${row.jadeed || '-'}</td>\r\n                <td style=\"padding: 14px; border: 1px solid #dfcbb5; font-size: 16px; color: #FFD700; text-align: center; letter-spacing: 1px;\">${stars}</td>\r\n              </tr>\r\n            `;\r\n          }).join('')}\r\n        </tbody>\r\n      </table>"""

# Build the table HTML separately for each mode to avoid nested template literals
new_pdf_block = """  // Build table HTML based on mode
  const pdfTableHeaders = mode === 'juz-wise'
    ? '<tr style=\"background: #5d4037; color: #ffffff;\">'
      + '<th style=\"padding: 14px; border: 1px solid #dfcbb5; font-size: 12px; text-transform: uppercase; font-weight: bold; text-align: left; width: 120px;\">DAYS</th>'
      + '<th style=\"padding: 14px; border: 1px solid #dfcbb5; font-size: 12px; text-transform: uppercase; font-weight: bold; text-align: center;\">MURAJAH 1</th>'
      + '<th style=\"padding: 14px; border: 1px solid #dfcbb5; font-size: 12px; text-transform: uppercase; font-weight: bold; text-align: center;\">MURAJAH 2</th>'
      + '<th style=\"padding: 14px; border: 1px solid #dfcbb5; font-size: 12px; text-transform: uppercase; font-weight: bold; text-align: center;\">MURAJAH 3</th>'
      + '<th style=\"padding: 14px; border: 1px solid #dfcbb5; font-size: 12px; text-transform: uppercase; font-weight: bold; text-align: center;\">MURAJAH 4</th>'
      + '<th style=\"padding: 14px; border: 1px solid #dfcbb5; font-size: 12px; text-transform: uppercase; font-weight: bold; text-align: center; width: 110px;\">STAR</th>'
      + '</tr>'
    : '<tr style=\"background: #5d4037; color: #ffffff;\">'
      + '<th style=\"padding: 14px; border: 1px solid #dfcbb5; font-size: 12px; text-transform: uppercase; font-weight: bold; text-align: left; width: 120px;\">DAYS</th>'
      + '<th style=\"padding: 14px; border: 1px solid #dfcbb5; font-size: 12px; text-transform: uppercase; font-weight: bold; text-align: center;\">MURAJAH</th>'
      + '<th style=\"padding: 14px; border: 1px solid #dfcbb5; font-size: 12px; text-transform: uppercase; font-weight: bold; text-align: center;\">JUZHALI</th>'
      + '<th style=\"padding: 14px; border: 1px solid #dfcbb5; font-size: 12px; text-transform: uppercase; font-weight: bold; text-align: center;\">JADEED</th>'
      + '<th style=\"padding: 14px; border: 1px solid #dfcbb5; font-size: 12px; text-transform: uppercase; font-weight: bold; text-align: center; width: 110px;\">STAR</th>'
      + '</tr>';

  const pdfTableRows = DAYS.map((day, idx) => {
    const row = scheduleData[day] || { juz1: '', juz2: '', juz3: '', juz4: '', murajah: '', juzhali: '', jadeed: '', star: '' };
    const stars = row.star ? '\\u2B50'.repeat(parseInt(row.star)) : '-';
    const rowBg = idx % 2 === 0 ? '#ffffff' : '#fefbf7';
    if (mode === 'juz-wise') {
      return '<tr style=\"background: ' + rowBg + ';\">'
        + '<td style=\"padding: 14px; border: 1px solid #dfcbb5; font-weight: bold; font-size: 13px; color: #5d4037; text-align: left;\">' + day + '</td>'
        + '<td style=\"padding: 14px; border: 1px solid #dfcbb5; font-size: 13px; color: #333; text-align: center; font-weight: 500;\">' + (row.juz1 || '-') + '</td>'
        + '<td style=\"padding: 14px; border: 1px solid #dfcbb5; font-size: 13px; color: #333; text-align: center; font-weight: 500;\">' + (row.juz2 || '-') + '</td>'
        + '<td style=\"padding: 14px; border: 1px solid #dfcbb5; font-size: 13px; color: #333; text-align: center; font-weight: 500;\">' + (row.juz3 || '-') + '</td>'
        + '<td style=\"padding: 14px; border: 1px solid #dfcbb5; font-size: 13px; color: #333; text-align: center; font-weight: 500;\">' + (row.juz4 || '-') + '</td>'
        + '<td style=\"padding: 14px; border: 1px solid #dfcbb5; font-size: 16px; color: #FFD700; text-align: center; letter-spacing: 1px;\">' + stars + '</td>'
        + '</tr>';
    }
    return '<tr style=\"background: ' + rowBg + ';\">'
      + '<td style=\"padding: 14px; border: 1px solid #dfcbb5; font-weight: bold; font-size: 13px; color: #5d4037; text-align: left;\">' + day + '</td>'
      + '<td style=\"padding: 14px; border: 1px solid #dfcbb5; font-size: 13px; color: #333; text-align: center; font-weight: 500;\">' + (row.murajah || '-') + '</td>'
      + '<td style=\"padding: 14px; border: 1px solid #dfcbb5; font-size: 13px; color: #333; text-align: center; font-weight: 500;\">' + (row.juzhali || '-') + '</td>'
      + '<td style=\"padding: 14px; border: 1px solid #dfcbb5; font-size: 13px; color: #333; text-align: center; font-weight: 500;\">' + (row.jadeed || '-') + '</td>'
      + '<td style=\"padding: 14px; border: 1px solid #dfcbb5; font-size: 16px; color: #FFD700; text-align: center; letter-spacing: 1px;\">' + stars + '</td>'
      + '</tr>';
  }).join('');

  printContainer.innerHTML = `
    <div style="border: 2px solid #dfcbb5; border-radius: 16px; padding: 30px; background: #fffcf8; box-sizing: border-box;">
      <!-- Header -->
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #dfcbb5; padding-bottom: 20px; margin-bottom: 25px;">
        <div>
          <h1 style="margin: 0; font-size: 26px; color: #5d4037; font-family: 'Cinzel', serif; font-weight: bold; letter-spacing: 1px;">MAUZE TAHFEEZ ATFAL</h1>
          <p style="margin: 5px 0 0 0; font-size: 14px; color: #8b6d31; font-weight: 600; letter-spacing: 0.5px;">Weekly Quran Jadwal (Timetable)</p>
        </div>
        <div style="text-align: right;">
          <div style="font-size: 12px; color: #888; font-weight: 500;">Generated on</div>
          <div style="font-size: 14px; color: #5d4037; font-weight: bold;">${new Date().toLocaleDateString()}</div>
        </div>
      </div>

      <!-- Student Info Details -->
      <div style="background: rgba(212, 175, 55, 0.05); border: 1px solid rgba(212, 175, 55, 0.2); border-radius: 12px; padding: 18px 24px; margin-bottom: 30px; display: flex; justify-content: space-between; align-items: center; box-sizing: border-box;">
        <div>
          <span style="font-size: 11px; color: #8b6d31; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; display: block; margin-bottom: 4px;">STUDENT NAME</span>
          <span style="font-size: 20px; color: #5d4037; font-weight: 800;">${studentName}</span>
        </div>
        <div style="text-align: right;">
          <span style="font-size: 11px; color: #8b6d31; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; display: block; margin-bottom: 4px;">ACADEMIC PORTAL</span>
          <span style="font-size: 14px; color: #ffffff; font-weight: 700; background: #5d4037; padding: 4px 12px; border-radius: 20px;">Hifz Program</span>
        </div>
      </div>

      <!-- Jadwal Table -->
      <table style="width: 100%; border-collapse: collapse; margin-top: 10px; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 10px rgba(93, 64, 55, 0.03);">
        <thead>
          ${pdfTableHeaders}
        </thead>
        <tbody>
          ${pdfTableRows}
        </tbody>
      </table>"""

content = content.replace(old_pdf_block, new_pdf_block)

if old_pdf_block not in content:
    print("WARNING: Fix 1 (PDF) - pattern not found!")
else:
    print("Fix 1 (PDF generation) applied successfully")

# === Fix 2: Add mode state to parent view ===
old_parent_state = """export const JadwalParentView = ({ studentId, teacherName, teacherId, teacherProfiles, showAction }) => {
  const [scheduleData, setScheduleData] = useState(DEFAULT_SCHEDULE);
  const [studentName, setStudentName] = useState('Student');
  const [loading, setLoading] = useState(true);"""

new_parent_state = """export const JadwalParentView = ({ studentId, teacherName, teacherId, teacherProfiles, showAction }) => {
  const [scheduleData, setScheduleData] = useState(DEFAULT_SCHEDULE);
  const [studentName, setStudentName] = useState('Student');
  const [mode, setMode] = useState('juz-wise');
  const [loading, setLoading] = useState(true);"""

content = content.replace(old_parent_state, new_parent_state)

if old_parent_state not in content:
    print("Fix 2 (parent mode state) applied successfully")
else:
    print("WARNING: Fix 2 (parent mode state) - pattern not found!")

# === Fix 3: Fix parent view PDF download call ===
# The parent view calls handleDownloadPDF(studentName, scheduleData, mode)
# But we need to use the mode state variable now that we added it
# Already uses `mode` which is now the state variable - good.

with open('src/Jadwal.jsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("All fixes written to file!")
