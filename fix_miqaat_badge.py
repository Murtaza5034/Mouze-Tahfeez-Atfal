import re

with open('src/Jadwal.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

changes = 0

# 1. Add fatemiData to JadwalCalendarStyle props
old1 = 'const JadwalCalendarStyle = ({ mode, scheduleData, onCellChange, readOnly, compact, customDays, onRepeatPattern, onMiqaatClick }) => {'
new1 = 'const JadwalCalendarStyle = ({ mode, scheduleData, onCellChange, readOnly, compact, customDays, onRepeatPattern, onMiqaatClick, fatemiData }) => {'
if old1 in content:
    content = content.replace(old1, new1, 1)
    changes += 1
    print('OK fix1: Added fatemiData to JadwalCalendarStyle props')
else:
    print('WARN fix1: pattern not found')

# 2. Add enrichedWeekDays useMemo after fatemiDates line
old2 = "  const fatemiDates = weekDays.map(d => getFatemiDateStr(d.toISOString().split('T')[0]));\n\n\n  const defaultJadeedSurah"
new2 = (
    "  const fatemiDates = weekDays.map(d => getFatemiDateStr(d.toISOString().split('T')[0]));\n"
    "\n"
    "  // Enriched day objects for week navigation so miqaat badges show\n"
    "  const enrichedWeekDays = React.useMemo(() => {\n"
    "    return DAYS.map((day, idx) => {\n"
    "      const dateStr = weekDays[idx]?.toISOString().split('T')[0];\n"
    "      if (!dateStr) return { dayName: day, miqaats: [], miqaatSummary: null };\n"
    "      const apiData = fatemiData?.[dateStr];\n"
    "      return {\n"
    "        dayName: day,\n"
    "        fatemiDate: fatemiDates[idx],\n"
    "        date: dateStr,\n"
    "        miqaats: apiData?.miqaats || [],\n"
    "        miqaatSummary: (apiData?.miqaats and apiData.miqaats.length > 0) ? summarizeMiqaats(apiData.miqaats) : null,\n"
    "      };\n"
    "    });\n"
    "  }, [DAYS, weekDays, fatemiDates, fatemiData]);\n"
    "\n"
    "  const defaultJadeedSurah"
)
if old2 in content:
    content = content.replace(old2, new2, 1)
    changes += 1
    print('OK fix2: Added enrichedWeekDays useMemo')
else:
    print('WARN fix2: pattern not found')

# 3. Replace null dayObj with enrichedWeekDays in week navigation
old3 = '{DAYS.map((day, idx) => renderDayCell(day, weekDays[idx], null, idx, null))}'
new3 = '{enrichedWeekDays.map((dayObj, idx) => renderDayCell(dayObj.dayName, weekDays[idx], null, idx, dayObj))}'
if old3 in content:
    content = content.replace(old3, new3, 1)
    changes += 1
    print('OK fix3: Replaced week nav with enrichedWeekDays')
else:
    print('WARN fix3: pattern not found')

# 4. Add fatemiData to JadwalTeacherView calendar call (teacher view - has compact prop)
old4 = '''            onMiqaatClick={handleMiqaatClick}
            fatemiData={fatemiData}
          />
        );
      case 'single_day_card':
        return (
          <JadwalSingleDayCardStyle'''

# First check if step 4 was already applied by a previous run
if old4 in content:
    print('OK fix4: already applied, skipping')
else:
    old4a = '''            onMiqaatClick={handleMiqaatClick}
          />
        );
      case 'single_day_card':
        return (
          <JadwalSingleDayCardStyle'''
    new4a = '''            onMiqaatClick={handleMiqaatClick}
            fatemiData={fatemiData}
          />
        );
      case 'single_day_card':
        return (
          <JadwalSingleDayCardStyle'''
    if old4a in content:
        # There are two occurrences of this pattern - use the FIRST ONE (teacher view)
        idx = content.find(old4a)
        if idx >= 0:
            content = content[:idx] + new4a + content[idx+len(old4a):]
            changes += 1
            print('OK fix4: Added fatemiData to teacher view calendar')
        else:
            print('WARN fix4: pattern not found')
    else:
        print('WARN fix4: pattern not found (variant a)')

# 5. Add fatemiData to JadwalParentView calendar call (parent view - has readOnly prop)
old5 = '''            onMiqaatClick={handleMiqaatClick}
          />
        );
      case 'single_day_card':
        return (
          <JadwalSingleDayCardStyle
            mode={mode}
            scheduleData={scheduleData}
            onCellChange={noop}
            readOnly
            dayDates={dayDates}
            customDays={days}
            onMiqaatClick={handleMiqaatClick}'''
new5 = '''            onMiqaatClick={handleMiqaatClick}
            fatemiData={fatemiData}
          />
        );
      case 'single_day_card':
        return (
          <JadwalSingleDayCardStyle
            mode={mode}
            scheduleData={scheduleData}
            onCellChange={noop}
            readOnly
            dayDates={dayDates}
            customDays={days}
            onMiqaatClick={handleMiqaatClick}'''

# Check if already has fatemiData
if 'fatemiData={fatemiData}' in content:
    print('NOTE: fatemiData already present in file, checking individual fixes...')
    # Count occurrences of fatemiData prop
    count = content.count('fatemiData={fatemiData}')
    print(f'Found {count} occurrences of fatemiData prop')

if old5 in content:
    # Find the SECOND occurrence (after teacher view)
    # First check if step 4 changed the first occurrence
    needle = "onMiqaatClick={handleMiqaatClick}\n            fatemiData={fatemiData}\n          />\n        );\n      case 'single_day_card'"
    idx_start = 0
    if needle in content:
        idx_start = content.find(needle) + len(needle)
    
    remaining = content[idx_start:]
    idx2 = remaining.find(old5)
    if idx2 >= 0:
        actual_idx = idx_start + idx2
        content = content[:actual_idx] + new5 + content[actual_idx+len(old5):]
        changes += 1
        print('OK fix5: Added fatemiData to parent view calendar')
    else:
        print('WARN fix5: second occurrence not found')
else:
    print('WARN fix5: pattern not found')

print(f'\nTotal changes: {changes}')

if changes > 0:
    with open('src/Jadwal.jsx', 'w', encoding='utf-8') as f:
        f.write(content)
    print('File written successfully!')
else:
    print('No changes made - something went wrong!')
