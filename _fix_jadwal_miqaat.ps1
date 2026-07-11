$c = Get-Content src/Jadwal.jsx -Raw

# 1. Add onMiqaatClick to JadwalCalendarStyle props
$c = $c -replace [regex]::Escape('const JadwalCalendarStyle = ({ mode, scheduleData, onCellChange, readOnly, compact, customDays, onRepeatPattern }) => {'), 'const JadwalCalendarStyle = ({ mode, scheduleData, onCellChange, readOnly, compact, customDays, onRepeatPattern, onMiqaatClick }) => {'

# 2. Add onMiqaatClick to JadwalSingleDayCardStyle props
$c = $c -replace [regex]::Escape('const JadwalSingleDayCardStyle = ({ mode, scheduleData, onCellChange, readOnly, dayDates, customDays, onRepeatPattern }) => {'), 'const JadwalSingleDayCardStyle = ({ mode, scheduleData, onCellChange, readOnly, dayDates, customDays, onRepeatPattern, onMiqaatClick }) => {'

# 3. Make JadwalTableStyle badge clickable - first occurrence (table style)
$pattern = '<span className="miqaat-badge" data-tooltip={dayObj.miqaatSummary?.summary || dayObj.miqaats.map(e => e.name).join('', '')}>\r?\n                      <Info size={10} />'
$replacement = '<span className="miqaat-badge" data-tooltip={dayObj.miqaatSummary?.summary || dayObj.miqaats.map(e => e.name).join('', '')} onClick={(e) => { e.stopPropagation(); onMiqaatClick && onMiqaatClick(dayObj); }}>
                      <Info size={10} />'
$c = $c -replace $pattern, $replacement

# 4. Make JadwalCalendarStyle badge clickable
$pattern2 = '<span className="miqaat-badge miqaat-badge-inline" data-tooltip={dayObj.miqaatSummary?.summary || dayObj.miqaats.map(e => e.name).join('', '')}>\r?\n                <Info size={9} />'
$replacement2 = '<span className="miqaat-badge miqaat-badge-inline" data-tooltip={dayObj.miqaatSummary?.summary || dayObj.miqaats.map(e => e.name).join('', '')} onClick={(e) => { e.stopPropagation(); onMiqaatClick && onMiqaatClick(dayObj); }}>
                <Info size={9} />'
$c = $c -replace $pattern2, $replacement2

# 5. Make JadwalSingleDayCardStyle badge clickable (same pattern as calendar style)
$c = $c -replace $pattern2, $replacement2

Set-Content src/Jadwal.jsx -NoNewline -Value $c

Write-Host "Replacements done"
