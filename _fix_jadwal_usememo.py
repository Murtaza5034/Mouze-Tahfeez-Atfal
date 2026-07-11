import re

path = r'E:/Mauze Tahfeez/src/Jadwal.jsx'

with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# ---- Replace FIRST enrich effect (JadwalTeacherView) ----
# Old pattern: enrichedDays state + enrich effect
old_teacher = """  const [enrichedDays, setEnrichedDays] = useState(null);

  console.log('\\u{1F50D} JadwalTeacherView: enrich inputs', {
    hasCustomDays: !!customDays,
    customDaysCount: customDays?.length,
    fatemiDataKeys: Object.keys(fatemiData).length,
    fatemiLoading,
  });

  useEffect(() => {
    if (!customDays || !fatemiData || Object.keys(fatemiData).length === 0) {
      console.log('\\u{1F50D} enrich (teacher): skipping (no data)');
      return;
    }
    console.log('\\u{1F50D} enrich (teacher): running', { daysCount: customDays.length, dataKeys: Object.keys(fatemiData) });
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
      console.log('\\u{1F50D} enrich (teacher): no hijri for', day.date);
      return { ...day, miqaats: [], miqaatSummary: null };
    });
    const miqaatDays = enriched.filter(d => d.miqaats && d.miqaats.length > 0);
    console.log('\\u{1F50D} enrich (teacher):', enriched.length, 'days,', miqaatDays.length, 'with miqaats', miqaatDays.map(d => ({ day: d.dayName, date: d.date, count: d.miqaats.length })));
    setEnrichedDays(enriched);
  }, [customDays, fatemiData]);"""

new_teacher = """  // Compute enriched days directly from fatemiData using useMemo
  const enrichedDays = useMemo(() => {
    if (!customDays || !fatemiData || Object.keys(fatemiData).length === 0) {
      console.log('\\u{1F50D} JadwalTeacherView: useMemo skipping (no data)');
      return null;
    }
    console.log('\\u{1F50D} JadwalTeacherView: useMemo enriching', { daysCount: customDays.length });
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
    const miqaatDays = enriched.filter(d => d.miqaats && d.miqaats.length > 0);
    console.log('\\u{1F50D} JadwalTeacherView: useMemo done', enriched.length, 'days,', miqaatDays.length, 'with miqaats');
    return enriched;
  }, [customDays, fatemiData]);"""

count = content.count(old_teacher)
print(f"Found {count} occurrences of teacher enrich pattern")

if count >= 1:
    content = content.replace(old_teacher, new_teacher, 1)
    print("Replaced teacher enrich pattern")
else:
    print("ERROR: Teacher enrich pattern not found!")
    # Try partial match to find it
    idx = content.find('const [enrichedDays, setEnrichedDays] = useState(null);')
    if idx >= 0:
        context = content[idx:idx+300]
        print(f"Found 'const [enrichedDays' at {idx}")
        print(f"Context: {repr(context[:200])}")

# ---- Replace SECOND enrich effect (JadwalParentView) ----
# The second one might not have the console.log that was added earlier
# Let's check if there's another occurrence
if count >= 2:
    content = content.replace(old_teacher, new_teacher, 1)
    print("Replaced second enrich pattern (same as first)")
elif count == 1:
    # Second one might have the old pattern without console.log
    # Look for it
    old_parent = """  const [enrichedDays, setEnrichedDays] = useState(null);

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
    
    count2 = content.count(old_parent)
    print(f"Found {count2} occurrences of parent enrich pattern (without console.log)")
    
    if count2 >= 1:
        content = content.replace(old_parent, new_teacher, 1)
        print("Replaced parent enrich pattern")
    else:
        print("ERROR: Parent enrich pattern not found!")
        # Try to find second useState
        idx1 = content.find('const [enrichedDays, setEnrichedDays] = useState(null);')
        if idx1 >= 0:
            idx2 = content.find('const [enrichedDays, setEnrichedDays] = useState(null);', idx1 + 1)
            if idx2 >= 0:
                print(f"Second useState found at {idx2}")
                # Find the useEffect that follows
                effect_start = content.find('useEffect(() => {', idx2)
                if effect_start >= 0:
                    effect_end = content.find('}, [customDays, fatemiData]);', effect_start)
                    if effect_end >= 0:
                        effect_end += len('}, [customDays, fatemiData]);')
                        full_effect = content[effect_start:effect_end]
                        print(f"Second effect: {repr(full_effect[:150])}")
                        
                        # Now replace just the state declaration and effect
                        # Find the exact text from state to end of effect
                        state_to_effect = content[idx2:effect_end]
                        print(f"State+effect length: {len(state_to_effect)}")
                        
                        # Use the new_teacher but without the state declaration
                        new_parent = new_teacher
                        content = content[:idx2] + new_parent + content[effect_end:]
                        print("Replaced second enrich pattern manually!")
                    else:
                        print("Could not find end of second effect!")
                else:
                    print("Could not find useEffect for second enrich")
            else:
                print("Could not find second useState!")
        else:
            print("Could not find any enrichedDays useState!")

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Done!")
