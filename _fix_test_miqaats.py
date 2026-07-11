import re

with open('src/Jadwal.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# The test miqaat data to inject
TEST_MIQAAT_CODE = '''
  // HARDCODED TEST: Add test miqaat to WEDNESDAY to verify rendering works
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
'''

# ======== 1. JadwalTableStyle ========
# Find the daysToRender line and replace it with code that has test miqaats
old1 = '''const JadwalTableStyle = ({ mode, scheduleData, onCellChange, readOnly, dayDates, customDays, onMiqaatClick }) => {
  const daysToRender = customDays || DAYS.map((day, idx) => ({ dayName: day, fatemiDate: dayDates?.[idx] || '' }));'''

new1 = '''const JadwalTableStyle = ({ mode, scheduleData, onCellChange, readOnly, dayDates, customDays, onMiqaatClick }) => {
  const _daysToRender = customDays || DAYS.map((day, idx) => ({ dayName: day, fatemiDate: dayDates?.[idx] || '' }));'''

content = content.replace(old1, new1)

# Add test miqaat memo after _daysToRender
# Find the point where _daysToRender is assigned and add after it
# Actually let me find the defaultJadeedSurah useMemo which comes right after
old1b = '''  const defaultJadeedSurah = React.useMemo(() => {'''
new1b = TEST_MIQAAT_CODE + '''  const defaultJadeedSurah = React.useMemo(() => {'''
content = content.replace(old1b, new1b)

# ======== 2. JadwalCalendarStyle ========
old2 = '''const JadwalCalendarStyle = ({ mode, scheduleData, onCellChange, readOnly, compact, customDays, onRepeatPattern, onMiqaatClick }) => {
  const [currentWeekOffset, setCurrentWeekOffset] = useState(0);'''

new2 = '''const JadwalCalendarStyle = ({ mode, scheduleData, onCellChange, readOnly, compact, customDays, onRepeatPattern, onMiqaatClick }) => {
  // HARDCODED TEST: Add test miqaats
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

content = content.replace(old2, new2)

# ======== 3. JadwalSingleDayCardStyle ========
old3 = '''const JadwalSingleDayCardStyle = ({ mode, scheduleData, onCellChange, readOnly, dayDates, customDays, onRepeatPattern, onMiqaatClick }) => {
  const daysList = customDays || DAYS.map((day, idx) => ({ dayName: day, date: '', fatemiDate: dayDates?.[idx] || '' }));'''

new3 = '''const JadwalSingleDayCardStyle = ({ mode, scheduleData, onCellChange, readOnly, dayDates, customDays, onRepeatPattern, onMiqaatClick }) => {
  // HARDCODED TEST: Add test miqaats  
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

content = content.replace(old3, new3)

# Now update JadwalCalendarStyle to use __testCustomDays instead of customDays where it matters
# In renderDayCell where it checks dayObj.miqaats
# Internal renderDayCell already receives dayObj from __testCustomDays... wait, renderDayCell uses customDays
# In the customDays branch:
old_custom_days_branch = '''  if (customDays) {
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

new_custom_days_branch = '''  if (__testCustomDays || customDays) {
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

content = content.replace(old_custom_days_branch, new_custom_days_branch)

# Also update JadwalTableStyle to use __miqaatDays
# The existing daysToRender in JadwalTableStyle wasn't replaced cleanly. Let me fix the actual usage.
# After the __miqaatDays memo, the code uses `daysToRender` variable which doesn't exist anymore (renamed to _daysToRender)
# So I need to replace the usage in the JSX return

# Actually wait - I renamed daysToRender to _daysToRender and then __miqaatDays is the new variable.
# But the JSX still references daysToRender. I need to replace those references.

# Replace **all** uses of `daysToRender` in JadwalTableStyle with `__miqaatDays`
# These references are:
# 1. defaultJadeedSurah useMemo: Array.from({ length: daysToRender.length }
# 2. daysToRender.map((dayObj, idx) => ... in the JSX
# Let me find and replace these.

# daysToRender in defaultJadeedSurah useMemo
content = content.replace(
    'daysToRender.indexOf(dayObj)',
    '__miqaatDays.indexOf(dayObj)'
)

# daysToRender.map in the JSX of JadwalTableStyle
content = content.replace(
    '{daysToRender.map((dayObj, idx) => {',
    '{__miqaatDays.map((dayObj, idx) => {'
)

# daysToRender in defaultJadeedSurah for loop
content = content.replace(
    'for (const dayObj of daysToRender) {',
    'for (const dayObj of __miqaatDays) {'
)

# daysToRender in deps array of defaultJadeedSurah
content = content.replace(
    ', [scheduleData, daysToRender, customDays]);',
    ', [scheduleData, __miqaatDays, customDays]);'
)

# defaultJadeedSurah needs to reference __miqaatDays
# Also add console.log for debugging in JadwalTableStyle
# Actually, since __miqaatDays already logs, we're fine.

# For JadwalSingleDayCardStyle - update the dayObj usage in miqaat check
# The `dayObj` in the miqaat badge check is already `dayObj` from `daysList[currentDayIndex]`
# Since daysList = __testSingleDays || customDays || DAYS.map(...), this should work if __testSingleDays has the miqaats.

# But wait - when customDays is null, __testSingleDays is also null (from the useMemo check)
# So `daysList = __testSingleDays || customDays || DAYS.map(...)` → `null || null || DAYS.map(...)`
# And DAYS.map(...) doesn't have miqaats, so no test badge in single day mode when customDays is null.

# I need to also add test data to the DAYS.map fallback. Let me add it differently:

# For JadwalSingleDayCardStyle with DAYS fallback, the miqaats need to be on the dayObj from daysList
# daysList[currentDayIndex] gives the day object. If customDays is null, daysList is DAYS.map

# Let me add test miqaats after the daysList is computed:

# Find: const dayObj = daysList[currentDayIndex];
# Add: // Override with test miqaat if needed

# Actually, I can keep it simpler. Let me add a check in the miqaat badge rendering.

with open('src/Jadwal.jsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Done - test miqaats added to all 3 Jadwal style components")
