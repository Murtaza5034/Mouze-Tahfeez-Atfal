import re

with open('src/Jadwal.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# ===== 1. Add Info icon to lucide-react import =====
content = content.replace(
    "import { Download, Save, Loader2, ChevronLeft, ChevronRight, Calendar, BookOpen, Sparkles, Repeat, Calculator } from 'lucide-react';",
    "import { Download, Save, Loader2, ChevronLeft, ChevronRight, Calendar, BookOpen, Sparkles, Repeat, Calculator, Info } from 'lucide-react';"
)

# ===== 2. Add useFatemiCalendar import after JadwalNotes import =====
content = content.replace(
    "import { JadwalNotes } from \"./JadwalNotes\";",
    "import { JadwalNotes } from \"./JadwalNotes\";\nimport { useFatemiCalendar, summarizeMiqaats } from './fatemiCalendarApi';"
)

# ===== 3. Add MiqaatPopup import =====
content = content.replace(
    "import { useFatemiCalendar, summarizeMiqaats } from './fatemiCalendarApi';",
    "import { useFatemiCalendar, summarizeMiqaats } from './fatemiCalendarApi';\nimport MiqaatPopup from './MiqaatPopup';"
)

# ===== 4. Add miqaat badges + onClick to JadwalTableStyle day-cell =====
# Find the line: <td className="day-cell">{day}{dayObj.fatemiDate ? <div className="day-fatemi-date">{dayObj.fatemiDate}</div> : null}</td>
old_day_cell = """              <td className="day-cell">{day}{dayObj.fatemiDate ? <div className=\"day-fatemi-date\">{dayObj.fatemiDate}</div> : null}</td>"""

new_day_cell = """              <td className="day-cell">
                <div className="day-cell-content">
                  <span className="day-cell-name">{day}</span>
                  {dayObj.miqaats && dayObj.miqaats.length > 0 && (
                    <span className="miqaat-badge" data-tooltip={dayObj.miqaatSummary?.summary || dayObj.miqaats.map(e => e.name).join(', ')}
                      onClick={(e) => { e.stopPropagation(); onMiqaatClick && onMiqaatClick(dayObj); }}>
                      <Info size={10} />
                      <span className="miqaat-count">{dayObj.miqaats.length}</span>
                    </span>
                  )}
                </div>
                {dayObj.fatemiDate ? <div className="day-fatemi-date">{dayObj.fatemiDate}</div> : null}
              </td>"""

content = content.replace(old_day_cell, new_day_cell)

# ===== 5. Add miqaat badge to JadwalCalendarStyle renderDayCell =====
# Find: <span className="jadwal-calendar-day-name">{day}</span>
old_cal_day = """          <span className=\"jadwal-calendar-day-name\">{day}</span>"""

new_cal_day = """          <span className=\"jadwal-calendar-day-name\">
            {day}
            {dayObj && dayObj.miqaats && dayObj.miqaats.length > 0 && (
              <span className=\"miqaat-badge miqaat-badge-inline\" data-tooltip={dayObj.miqaatSummary?.summary || dayObj.miqaats.map(e => e.name).join(', ')}
                onClick={(e) => { e.stopPropagation(); onMiqaatClick && onMiqaatClick(dayObj); }}>
                <Info size={9} />
                <span className=\"miqaat-count\">{dayObj.miqaats.length}</span>
              </span>
            )}
          </span>"""

content = content.replace(old_cal_day, new_cal_day)

# ===== 6. Update renderDayCell signature to accept dayObj =====
# Find: const renderDayCell = (day, dateObj, customFatemi, idx) => {
content = content.replace(
    'const renderDayCell = (day, dateObj, customFatemi, idx) => {',
    'const renderDayCell = (day, dateObj, customFatemi, idx, dayObj) => {'
)

# ===== 7. Update renderDayCell calls to pass dayObj =====
# customDays path: renderDayCell(d.dayName, d, d.fatemiDate, idx)
content = content.replace(
    'renderDayCell(d.dayName, d, d.fatemiDate, idx)',
    'renderDayCell(d.dayName, d, d.fatemiDate, idx, d)'
)

# regular week: renderDayCell(day, weekDays[idx], null, idx)
content = content.replace(
    'renderDayCell(day, weekDays[idx], null, idx)',
    'renderDayCell(day, weekDays[idx], null, idx, null)'
)

# ===== 8. Add miqaat badge to JadwalSingleDayCardStyle title =====
# Find: <h3>{date ? `${day} - ${date}` : day}</h3>
old_single_title = """          <h3>{date ? `${day} - ${date}` : day}</h3>"""

new_single_title = """          <h3>
            {date ? `${day} - ${date}` : day}
            {dayObj && dayObj.miqaats && dayObj.miqaats.length > 0 && (
              <span className=\"miqaat-badge miqaat-badge-inline\" data-tooltip={dayObj.miqaatSummary?.summary || dayObj.miqaats.map(e => e.name).join(', ')}
                onClick={(e) => { e.stopPropagation(); onMiqaatClick && onMiqaatClick(dayObj); }}>
                <Info size={9} />
                <span className=\"miqaat-count\">{dayObj.miqaats.length}</span>
              </span>
            )}
          </h3>"""

content = content.replace(old_single_title, new_single_title)

# ===== 9. Add Fatemi calendar hook + enrichedDays to JadwalTeacherView =====
# Find: const theme = getJadwalThemeFromSettings(settings);
# Replace with same + hook + enrichedDays
old_teacher_theme = """  const theme = getJadwalThemeFromSettings(settings);
  const [miqaatPopup, setMiqaatPopup] = useState(null);
  const weekRange = useMemo(() => theme.jadwalType === 'weekly' ? getCurrentWeekRange() : null, [theme.jadwalType]);
  const dayDates = weekRange ? DAYS.map((_, idx) => getDayDate(weekRange.weekStart, idx)) : (theme.weekStart ? DAYS.map((_, idx) => getDayDate(theme.weekStart, idx)) : []);
  const customDays = theme.jadwalType === 'miqaat' ? getDaysFromRange(theme.weekStart, theme.weekEnd)
    : theme.jadwalType === 'weekly' && weekRange ? getDaysFromRange(weekRange.weekStart, weekRange.weekEnd)
    : null;"""

new_teacher_theme = """  const theme = getJadwalThemeFromSettings(settings);
  const [miqaatPopup, setMiqaatPopup] = useState(null);
  const weekRange = useMemo(() => theme.jadwalType === 'weekly' ? getCurrentWeekRange() : null, [theme.jadwalType]);
  const dayDates = weekRange ? DAYS.map((_, idx) => getDayDate(weekRange.weekStart, idx)) : (theme.weekStart ? DAYS.map((_, idx) => getDayDate(theme.weekStart, idx)) : []);
  const customDays = theme.jadwalType === 'miqaat' ? getDaysFromRange(theme.weekStart, theme.weekEnd)
    : theme.jadwalType === 'weekly' && weekRange ? getDaysFromRange(weekRange.weekStart, weekRange.weekEnd)
    : null;

  // Fatemi calendar & miqaat API
  const apiWeekStart = theme.jadwalType === 'miqaat' ? theme.weekStart : (weekRange?.weekStart || null);
  const apiWeekEnd = theme.jadwalType === 'miqaat' ? theme.weekEnd : (weekRange?.weekEnd || null);
  const { loading: fatemiLoading, fatemiData } = useFatemiCalendar(apiWeekStart, apiWeekEnd);
  const [enrichedDays, setEnrichedDays] = useState(null);

  useEffect(() => {
    if (!customDays || !fatemiData || Object.keys(fatemiData).length === 0) return;
    const enriched = customDays.map(day => {
      const apiData = fatemiData[day.date];
      if (apiData && apiData.hijri) {
        return {
          ...day,
          fatemiDate: apiData.hijri.date_arabic || day.fatemiDate,
          miqaats: apiData.miqaats || [],
          miqaatSummary: summarizeMiqaats(apiData.miqaats),
        };
      }
      return { ...day, miqaats: [], miqaatSummary: null };
    });
    setEnrichedDays(enriched);
  }, [customDays, fatemiData]);"""

content = content.replace(old_teacher_theme, new_teacher_theme)

# ===== 10. Remove duplicate handleMiqaatClick in JadwalTeacherView =====
# Find the duplicate
old_dup_handler = """
  const handleMiqaatClick = (dayObj) => {
    setMiqaatPopup({
      events: dayObj.miqaats || [],
      dayName: dayObj.dayName,
      fatemiDate: dayObj.fatemiDate || '',
    });
  };

  const handleMiqaatClick = (dayObj) => {
    setMiqaatPopup({
      events: dayObj.miqaats || [],
      dayName: dayObj.dayName,
      fatemiDate: dayObj.fatemiDate || '',
    });
  };"""

new_dedup_handler = """
  const handleMiqaatClick = (dayObj) => {
    setMiqaatPopup({
      events: dayObj.miqaats || [],
      dayName: dayObj.dayName,
      fatemiDate: dayObj.fatemiDate || '',
    });
  };"""

content = content.replace(old_dup_handler, new_dedup_handler)

# ===== 11. Update JadwalTeacherView renderJadwalContent to use enrichedDays + pass onMiqaatClick =====
# Replace the entire renderJadwalContent function
old_render_teacher = """  const renderJadwalContent = () => {
    switch (teacherDisplayStyle) {
      case 'calendar':
        return (
          <JadwalCalendarStyle
            mode={mode}
            scheduleData={scheduleData}
            onCellChange={handleCellChange}
            compact={isCompact}
            dayDates={dayDates}
            customDays={customDays}
            onRepeatPattern={handleRepeatPattern}
          />
        );
      case 'single_day_card':
        return (
          <JadwalSingleDayCardStyle
            mode={mode}
            scheduleData={scheduleData}
            onCellChange={handleCellChange}
            dayDates={dayDates}
            customDays={customDays}
            onRepeatPattern={handleRepeatPattern}
          />
        );
      default:
        return (
          <JadwalTableStyle
            mode={mode}
            scheduleData={scheduleData}
            onCellChange={handleCellChange}
            dayDates={dayDates}
            customDays={customDays}
          />
        );
    }
  };"""

new_render_teacher = """  const renderJadwalContent = () => {
    const days = enrichedDays || customDays;
    switch (teacherDisplayStyle) {
      case 'calendar':
        return (
          <JadwalCalendarStyle
            mode={mode}
            scheduleData={scheduleData}
            onCellChange={handleCellChange}
            compact={isCompact}
            dayDates={dayDates}
            customDays={days}
            onRepeatPattern={handleRepeatPattern}
            onMiqaatClick={handleMiqaatClick}
          />
        );
      case 'single_day_card':
        return (
          <JadwalSingleDayCardStyle
            mode={mode}
            scheduleData={scheduleData}
            onCellChange={handleCellChange}
            dayDates={dayDates}
            customDays={days}
            onRepeatPattern={handleRepeatPattern}
            onMiqaatClick={handleMiqaatClick}
          />
        );
      default:
        return (
          <JadwalTableStyle
            mode={mode}
            scheduleData={scheduleData}
            onCellChange={handleCellChange}
            dayDates={dayDates}
            customDays={days}
            onMiqaatClick={handleMiqaatClick}
          />
        );
    }
  };"""

content = content.replace(old_render_teacher, new_render_teacher)

# ===== 12. Add Fatemi calendar hook + enrichedDays to JadwalParentView =====
# After: const [miqaatPopup, setMiqaatPopup] = useState(null);
# Before: const displayStyle = settings?.jadwal_style || 'table';
old_parent_hook = """  const [miqaatPopup, setMiqaatPopup] = useState(null);

  const displayStyle = settings?.jadwal_style || 'table';
  const theme = getJadwalThemeFromSettings(settings);
  const weekRange = theme.jadwalType === 'weekly' ? getCurrentWeekRange() : null;
  const dayDates = weekRange ? DAYS.map((_, idx) => getDayDate(weekRange.weekStart, idx)) : (theme.weekStart ? DAYS.map((_, idx) => getDayDate(theme.weekStart, idx)) : []);
  const customDays = theme.jadwalType === 'miqaat' ? getDaysFromRange(theme.weekStart, theme.weekEnd)
    : theme.jadwalType === 'weekly' && weekRange ? getDaysFromRange(weekRange.weekStart, weekRange.weekEnd)
    : null;"""

new_parent_hook = """  const [miqaatPopup, setMiqaatPopup] = useState(null);

  const displayStyle = settings?.jadwal_style || 'table';
  const theme = getJadwalThemeFromSettings(settings);
  const weekRange = theme.jadwalType === 'weekly' ? getCurrentWeekRange() : null;
  const dayDates = weekRange ? DAYS.map((_, idx) => getDayDate(weekRange.weekStart, idx)) : (theme.weekStart ? DAYS.map((_, idx) => getDayDate(theme.weekStart, idx)) : []);
  const customDays = theme.jadwalType === 'miqaat' ? getDaysFromRange(theme.weekStart, theme.weekEnd)
    : theme.jadwalType === 'weekly' && weekRange ? getDaysFromRange(weekRange.weekStart, weekRange.weekEnd)
    : null;

  // Fatemi calendar & miqaat API
  const apiWeekStart = theme.jadwalType === 'miqaat' ? theme.weekStart : (weekRange?.weekStart || null);
  const apiWeekEnd = theme.jadwalType === 'miqaat' ? theme.weekEnd : (weekRange?.weekEnd || null);
  const { loading: fatemiLoading, fatemiData } = useFatemiCalendar(apiWeekStart, apiWeekEnd);
  const [enrichedDays, setEnrichedDays] = useState(null);

  useEffect(() => {
    if (!customDays || !fatemiData || Object.keys(fatemiData).length === 0) return;
    const enriched = customDays.map(day => {
      const apiData = fatemiData[day.date];
      if (apiData && apiData.hijri) {
        return {
          ...day,
          fatemiDate: apiData.hijri.date_arabic || day.fatemiDate,
          miqaats: apiData.miqaats || [],
          miqaatSummary: summarizeMiqaats(apiData.miqaats),
        };
      }
      return { ...day, miqaats: [], miqaatSummary: null };
    });
    setEnrichedDays(enriched);
  }, [customDays, fatemiData]);"""

content = content.replace(old_parent_hook, new_parent_hook)

# ===== 13. Update JadwalParentView renderJadwalContent to use enrichedDays + pass onMiqaatClick =====
old_render_parent = """  const renderJadwalContent = () => {
    const noop = () => {};
    switch (displayStyle) {
      case 'calendar':
        return (
          <JadwalCalendarStyle
            mode={mode}
            scheduleData={scheduleData}
            onCellChange={noop}
            readOnly
            dayDates={dayDates}
            customDays={customDays}
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
            customDays={customDays}
          />
        );
      default:
        return (
          <JadwalTableStyle
            mode={mode}
            scheduleData={scheduleData}
            onCellChange={noop}
            readOnly
            dayDates={dayDates}
            customDays={customDays}
          />
        );
    }
  };"""

new_render_parent = """  const renderJadwalContent = () => {
    const noop = () => {};
    const days = enrichedDays || customDays;
    switch (displayStyle) {
      case 'calendar':
        return (
          <JadwalCalendarStyle
            mode={mode}
            scheduleData={scheduleData}
            onCellChange={noop}
            readOnly
            dayDates={dayDates}
            customDays={days}
            onMiqaatClick={handleMiqaatClick}
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
            onMiqaatClick={handleMiqaatClick}
          />
        );
      default:
        return (
          <JadwalTableStyle
            mode={mode}
            scheduleData={scheduleData}
            onCellChange={noop}
            readOnly
            dayDates={dayDates}
            customDays={days}
            onMiqaatClick={handleMiqaatClick}
          />
        );
    }
  };"""

content = content.replace(old_render_parent, new_render_parent)

with open('src/Jadwal.jsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("All Jadwal.jsx replacements done successfully!")
print(f"File size: {len(content)} chars")
