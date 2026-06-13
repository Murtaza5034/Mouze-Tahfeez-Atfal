import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('src/App.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Find the insertion point - after TahfeezReportCard ends (}) and before SettingsPage
old_str = '  );\n}\n\nfunction SettingsPage({ \n  isDarkMode,'

rank_preview_component = '''

function RankPreview({ students }) {
  const getEffectiveScore = (r) => {
    if (!r) return 0;
    if (r.total_score !== undefined && r.total_score !== null && r.total_score !== "") return Number(r.total_score);
    return (Number(r.murajazah) || 0) + (Number(r.juz_hali) || 0) + (Number(r.takhteet) || 0) + (Number(r.jadeed) || 0);
  };

  const rankedStudents = useMemo(() => {
    const withScores = students
      .filter(s => s.latestResult)
      .map(s => ({
        ...s,
        score: getEffectiveScore(s.latestResult),
        jadeed: Number(s.latestResult.jadeed) || 0,
        attendance: Number(s.latestResult.attendance_count) || 0,
      }));
    
    withScores.sort((a, b) => {
      const scoreDiff = b.score - a.score;
      if (scoreDiff !== 0) return scoreDiff;
      const jadeedDiff = b.jadeed - a.jadeed;
      if (jadeedDiff !== 0) return jadeedDiff;
      return b.attendance - a.attendance;
    });

    return withScores.map((s, idx) => ({
      ...s,
      rank: idx + 1,
      tieInfo: getTieInfo(withScores, s, idx),
    }));
  }, [students]);

  const getTieInfo = (sorted, student, idx) => {
    if (idx === 0) return 'Leader';
    const prev = sorted[idx - 1];
    if (prev.score === student.score) {
      if (prev.jadeed === student.jadeed) {
        if (prev.attendance === student.attendance) {
          return "Tied on Score, Jadeed & Attendance";
        }
        return "Tied on Score & Jadeed \\u2192 Attendance broke tie";
      }
      return "Tied on Score \\u2192 Jadeed broke tie";
    }
    return '';
  };

  return (
    <div className="fade-in" style={{ padding: '20px 0' }}>
      <div className="page-header">
        <h2 className="premium-title">Rank Preview & Tie-Breaking Analysis</h2>
        <p className="subtitle">
          Students sorted by <strong>Score</strong> \\u2193 \\u2192 <strong>Jadeed</strong> \\u2193 \\u2192 <strong>Attendance</strong> \\u2193
          \\u2014 ranks are unique sequential (no ties)
        </p>
      </div>

      {rankedStudents.length === 0 ? (
        <div className="empty-state">
          <TrendingUp size={48} style={{ opacity: 0.2 }} />
          <p>No student results available for ranking</p>
        </div>
      ) : (
        <div style={{ overflowX: 'auto', borderRadius: '16px', border: '1px solid var(--glass-border)', background: '#fff' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ background: 'linear-gradient(135deg, #3d2b1f, #5d4037)', color: '#fff' }}>
                <th style={{ padding: '14px 16px', textAlign: 'left' }}>Rank</th>
                <th style={{ padding: '14px 16px', textAlign: 'left' }}>Student</th>
                <th style={{ padding: '14px 16px', textAlign: 'center' }}>Score</th>
                <th style={{ padding: '14px 16px', textAlign: 'center' }}>Jadeed</th>
                <th style={{ padding: '14px 16px', textAlign: 'center' }}>Attendance</th>
                <th style={{ padding: '14px 16px', textAlign: 'left' }}>Tie-Break Info</th>
              </tr>
            </thead>
            <tbody>
              {rankedStudents.map((s, i) => (
                <tr key={s.id || i} style={{ borderBottom: '1px solid #f0ede8', background: i % 2 === 0 ? '#fcfaf5' : '#fff' }}>
                  <td style={{ padding: '12px 16px', fontWeight: 900 }}>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      width: '36px', height: '36px', borderRadius: '50%',
                      background: s.rank <= 3 ? 'linear-gradient(135deg, #d4af37, #b88a1d)' : '#f0ede8',
                      color: s.rank <= 3 ? '#fff' : '#3d2b1f', fontSize: '0.85rem',
                    }}>
                      {s.rank <= 3 ? ['\\U0001F3C6', '\\U0001F948', '\\U0001F949'][s.rank - 1] : s.rank}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ width: '32px', height: '32px', borderRadius: '50%', overflow: 'hidden', background: '#f0ede8', flexShrink: 0 }}>
                        {s.photoUrl ? (
                          <img src={s.photoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px' }}>\\U0001F464</div>
                        )}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, color: '#3d2b1f' }}>{s.name || s.full_name}</div>
                        {s.arabic_name && <div style={{ fontSize: '0.8rem', color: '#d4af37' }}>{s.arabic_name}</div>}
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                    <div style={{
                      width: '40px', height: '40px', borderRadius: '50%',
                      background: s.score >= 80 ? '#d4af37' : s.score >= 50 ? '#f0ede8' : '#f8e8e8',
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: 900, fontSize: '0.85rem', color: s.score >= 80 ? '#fff' : '#3d2b1f'
                    }}>
                      {s.score}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#aaa', marginTop: '2px' }}>out of 100</div>
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 600 }}>
                    <span style={{ color: s.jadeed >= 15 ? '#2e7d32' : '#3d2b1f' }}>{s.jadeed}</span>
                    <div style={{ fontSize: '0.7rem', color: '#aaa' }}>max 20</div>
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '3px' }}>
                      {Array.from({ length: 6 }, (_, j) => (
                        <Sparkles key={j} size={12}
                          color={j < s.attendance ? '#d4af37' : '#e0ddd8'}
                          fill={j < s.attendance ? '#d4af37' : 'transparent'}
                        />
                      ))}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#aaa', marginTop: '2px' }}>{s.attendance}/6</div>
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: '0.8rem', color: s.tieInfo ? '#b88a1d' : '#999' }}>
                    {s.tieInfo || '\\u2014'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ marginTop: '24px', padding: '16px 20px', background: '#fcfaf5', borderRadius: '12px', border: '1px solid var(--glass-border)', fontSize: '0.85rem', color: '#666' }}>
        <strong style={{ color: '#3d2b1f' }}>Tie-Breaking Order:</strong>
        <ol style={{ margin: '8px 0 0', paddingLeft: '20px' }}>
          <li><strong>Total Score</strong> (descending) \\u2014 highest marks first</li>
          <li><strong>Jadeed (New Pages)</strong> (descending) \\u2014 more new pages = higher rank</li>
          <li><strong>Attendance Count</strong> (descending) \\u2014 better attendance = higher rank</li>
        </ol>
        <p style={{ marginTop: '8px', fontStyle: 'italic' }}>Ranks are unique and sequential \\u2014 no two students share the same rank.</p>
      </div>
    </div>
  );
}
'''

insert_pos = content.find(old_str)

if insert_pos == -1:
    print('ERROR: Insertion point not found')
    sys.exit(1)

new_content = content[:insert_pos] + rank_preview_component + content[insert_pos:]
with open('src/App.jsx', 'w', encoding='utf-8') as f:
    f.write(new_content)
print('SUCCESS: RankPreview component added')
