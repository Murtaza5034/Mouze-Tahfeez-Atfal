import re

with open('src/Jadwal.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Remove test miqaat code from JadwalTableStyle
# 1. Rename _daysToRender back to daysToRender
content = content.replace(
    'const _daysToRender = customDays || DAYS.map((day, idx) => ({ dayName: day, fatemiDate: dayDates?.[idx] || \'\' }));',
    'const daysToRender = customDays || DAYS.map((day, idx) => ({ dayName: day, fatemiDate: dayDates?.[idx] || \'\' }));'
)

# 2. Remove the __miqaatDays test memo block
# Find: "// HARDCODED TEST: Add test miqaat to WEDNESDAY" + everything until "const defaultJadeedSurah"
old_test_jadwal_table = '''  // HARDCODED TEST: Add test miqaat to WEDNESDAY to verify rendering works
  const __miqaatDays = React.useMemo(() => {
    if (!_daysToRender) return _daysToRender;
    return _daysToRender.map((d, i) => {
      if (d && d.dayName === 'WEDNESDAY') {
        return {
          ...d,
          miqaats: [{ name: 'TEST: Syedi Dada Sulemanji [Urus]', hijri_date: '1448-01-24', type: { name: 'Urus' }, location: { name: 'Test City', state: 'Test State' }, gregorian_date: '2026-07-08' }],
          miqaatSummary: { summary: 'Urus: TEST Syedi Dada Sulemanji' },
        };
      }
      if (d && d.miqaats && d.miqaats.length > 0) return d;
      return { ...(d || {}), miqaats: [], miqaatSummary: null };
    });
  }, [_daysToRender]);
  if (__miqaatDays) { console.log("\\u{1F50B} JadwalTableStyle: test miqaat on WEDNESDAY"); }
  const defaultJadeedSurah = React.useMemo(() => {'''

new_jadwal_table = '''  const defaultJadeedSurah = React.useMemo(() => {'''

content = content.replace(old_test_jadwal_table, new_jadwal_table)

# 3. Replace __miqaatDays references back to daysToRender
content = content.replace('__miqaatDays.indexOf(dayObj)', 'daysToRender.indexOf(dayObj)')
content = content.replace('{__miqaatDays.map((dayObj, idx) => {', '{daysToRender.map((dayObj, idx) => {')
content = content.replace('for (const dayObj of __miqaatDays) {', 'for (const dayObj of daysToRender) {')
content = content.replace(', [scheduleData, __miqaatDays, customDays]);', ', [scheduleData, daysToRender, customDays]);')

# 4. Remove test code from JadwalCalendarStyle - remove __testCustomDays block
old_calendar_test = '''  // HARDCODED TEST: Add test miqaats
  const __testCustomDays = React.useMemo(() => {
    if (!customDays) return customDays;
    return customDays.map((d) => {
      if (d.dayName === 'WEDNESDAY') {
        return { ...d, miqaats: [{ name: 'TEST: Syedi Dada Sulemanji [Urus]', hijri_date: '1448-01-24', type: { name: 'Urus' }, location: { name: 'Test City', state: 'Test State' }, gregorian_date: '2026-07-08' }], miqaatSummary: { summary: 'Urus: TEST Syedi Dada Sulemanji' } };
      }
      if (d.miqaats && d.miqaats.length > 0) return d;
      return { ...d, miqaats: [], miqaatSummary: null };
    });
  }, [customDays]);
  const [currentWeekOffset, setCurrentWeekOffset] = useState(0);'''

new_calendar_test = '  const [currentWeekOffset, setCurrentWeekOffset] = useState(0);'

content = content.replace(old_calendar_test, new_calendar_test)

# 5. Restore the customDays branch in JadwalCalendarStyle
old_calendar_branch = '''  if (__testCustomDays || customDays) {
    const _cd = __testCustomDays || customDays;
    return (
      <div className="jadwal-calendar-container">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '12px', fontSize: '0.85rem', color: 'var(--soft-brown)' }}>
          <Calendar size={16} />
          <span>Showing <strong>{_cd.length}</strong> day{_cd.length !== 1 ? 's' : ''} — {_cd[0]?.date} to {_cd[_cd.length - 1]?.date}</span>
        </div>
        <div className="jadwal-calendar-grid">
          {_cd.map((d, idx) => renderDayCell(d.dayName, d, d.fatemiDate, idx, d))}
        </div>
      </div>
    );'''

new_calendar_branch = '''  if (customDays) {
    return (
      <div className="jadwal-calendar-container">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '12px', fontSize: '0.85rem', color: 'var(--soft-brown)' }}>
          <Calendar size={16} />
          <span>Showing <strong>{customDays.length}</strong> day{customDays.length !== 1 ? 's' : ''} — {customDays[0]?.date} to {customDays[customDays.length - 1]?.date}</span>
        </div>
        <div className="jadwal-calendar-grid">
          {customDays.map((d, idx) => renderDayCell(d.dayName, d, d.fatemiDate, idx, d))}
        </div>
      </div>
    );'''

content = content.replace(old_calendar_branch, new_calendar_branch)

# 6. Remove test code from JadwalSingleDayCardStyle
old_single_test = '''  // HARDCODED TEST: Add test miqaats  
  const __testSingleDays = React.useMemo(() => {
    if (!customDays) return customDays;
    return customDays.map((d) => {
      if (d.dayName === 'WEDNESDAY') {
        return { ...d, miqaats: [{ name: 'TEST: Syedi Dada Sulemanji [Urus]', hijri_date: '1448-01-24', type: { name: 'Urus' }, location: { name: 'Test City', state: 'Test State' }, gregorian_date: '2026-07-08' }], miqaatSummary: { summary: 'Urus: TEST Syedi Dada Sulemanji' } };
      }
      if (d.miqaats && d.miqaats.length > 0) return d;
      return { ...d, miqaats: [], miqaatSummary: null };
    });
  }, [customDays]);
  const daysList = __testSingleDays || customDays || DAYS.map((day, idx) => ({ dayName: day, date: '', fatemiDate: dayDates?.[idx] || '' }));'''

new_single_test = "  const daysList = customDays || DAYS.map((day, idx) => ({ dayName: day, date: '', fatemiDate: dayDates?.[idx] || '' }));"

content = content.replace(old_single_test, new_single_test)

with open('src/Jadwal.jsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Done - test miqaats removed from Jadwal.jsx")
