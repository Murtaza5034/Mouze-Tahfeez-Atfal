import re

path = r'E:/Mauze Tahfeez/src/Jadwal.jsx'

with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# ---- Find and replace the FIRST enrich effect (JadwalTeacherView) ----
old1 = """  const [enrichedDays, setEnrichedDays] = useState(null);

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

new1 = """  const [enrichedDays, setEnrichedDays] = useState(null);

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

count1 = content.count(old1)
print(f"Found {count1} occurrence(s) of first enrich effect")

if count1 >= 1:
    content = content.replace(old1, new1, 1)
    print("Replaced first enrich effect")
else:
    print("ERROR: First enrich effect not found!")
    # Try to find it with partial match
    idx = content.find('const [enrichedDays, setEnrichedDays] = useState(null);')
    if idx >= 0:
        print(f"Found at index {idx}")
        print("Context:", content[idx:idx+200])

# ---- Find and replace the SECOND enrich effect (JadwalParentView) ----
# It should be identical to the first
if count1 >= 2:
    content = content.replace(old1, new1, 1)
    print("Replaced second enrich effect")
elif count1 == 1:
    # Second one might have different surrounding context
    print("Second enrich effect not found via exact match. Trying pattern...")
    # Try to find second occurrence of the state variable
    idx2 = content.find('const [enrichedDays, setEnrichedDays] = useState(null);')
    if idx2 >= 0:
        # Find the second occurrence
        idx3 = content.find('const [enrichedDays, setEnrichedDays] = useState(null);', idx2 + 1)
        if idx3 >= 0:
            # The effect starts after this useState
            print(f"Second useState found at {idx3}")
            # Find the useEffect that follows
            effect_start = content.find('useEffect(() => {', idx3)
            if effect_start >= 0:
                effect_end = content.find('}, [customDays, fatemiData]);', effect_start)
                if effect_end >= 0:
                    effect_end += len('}, [customDays, fatemiData]);')
                    full_effect = content[effect_start:effect_end]
                    print(f"Second effect length: {len(full_effect)}")
                    print(f"Second effect preview: {full_effect[:100]}...")
                    
                    # Replace this specific occurrence
                    new_effect = new1.split("const [enrichedDays, setEnrichedDays] = useState(null);")[1]
                    new_effect = "  console.log('\\u{1F50D} JadwalParentView: enrich inputs', {\n    hasCustomDays: !!customDays,\n    customDaysCount: customDays?.length,\n    fatemiDataKeys: Object.keys(fatemiData).length,\n    fatemiLoading,\n  });\n" + new_effect
                    
                    # Insert after the state declaration but before useEffect
                    insert_pos = idx3 + len("const [enrichedDays, setEnrichedDays] = useState(null);\n\n")
                    content = content[:insert_pos] + new_effect + content[effect_end:]
                    print("Replaced second enrich effect manually")
    else:
        print("ERROR: Second useState not found!")
else:
    print("No enrich effects found!")

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Done!")
