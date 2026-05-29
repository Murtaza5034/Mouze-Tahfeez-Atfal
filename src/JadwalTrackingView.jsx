import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from './supabaseClient';
import { Calendar, Users, X, ChevronRight, CheckCircle, AlertCircle, Loader2, GraduationCap, Sparkles } from 'lucide-react';

const JADWAL_DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];

const getJadwalFillPercent = (scheduleData) => {
  if (!scheduleData) return 0;
  const filledDays = JADWAL_DAYS.filter(day => {
    const d = scheduleData[day];
    if (!d) return false;
    return (d.juz1 && d.juz1.trim() !== '') || 
           (d.juz2 && d.juz2.trim() !== '') || 
           (d.juz3 && d.juz3.trim() !== '') || 
           (d.juz4 && d.juz4.trim() !== '');
  }).length;
  return Math.round((filledDays / JADWAL_DAYS.length) * 100);
};

const JadwalTrackingView = ({ students, onShowAction }) => {
  const [jadwalData, setJadwalData] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedTeacher, setSelectedTeacher] = useState(null);

  useEffect(() => {
    fetchAllJadwal();
  }, []);

  const fetchAllJadwal = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('jadawal')
        .select('student_id, schedule_data');

      if (error) {
        console.error("Failed to fetch Jadwal data:", error);
        if (onShowAction) onShowAction('error', 'Failed to fetch Jadwal tracking data');
      } else {
        const jadwalMap = {};
        (data || []).forEach(item => {
          const sid = String(item.student_id).trim();
          jadwalMap[sid] = item.schedule_data;
        });
        setJadwalData(jadwalMap);
      }
    } catch (err) {
      console.error("Jadwal fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  // Group students by teacher and compute Jadwal stats
  const teacherJadwalStats = useMemo(() => {
    const teacherMap = {};

    students.forEach(student => {
      const teacherName = student.teacherName || "Unassigned teacher";
      if (!teacherMap[teacherName]) {
        teacherMap[teacherName] = {
          teacherName,
          children: [],
          totalStudents: 0,
        };
      }

      const sid = String(student.student_id || '').trim();
      // Also check allIds
      const studentIds = student.allIds || [sid];
      let scheduleData = null;
      for (const id of studentIds) {
        if (jadwalData[id]) {
          scheduleData = jadwalData[id];
          break;
        }
      }

      const fillPercent = getJadwalFillPercent(scheduleData);

      teacherMap[teacherName].children.push({
        student_id: student.student_id,
        name: student.name || 'Unnamed',
        groupName: student.groupName || 'Ungrouped',
        fillPercent,
        hasJadwal: scheduleData !== null,
      });
      teacherMap[teacherName].totalStudents += 1;
    });

    return Object.values(teacherMap).map(teacher => ({
      ...teacher,
      // Teachers with at least some Jadwal entries
      jadwalFilledCount: teacher.children.filter(c => c.hasJadwal).length,
      // Average fill percentage across all children
      avgFillPercent: teacher.children.length > 0
        ? Math.round(teacher.children.reduce((sum, c) => sum + c.fillPercent, 0) / teacher.children.length)
        : 0,
    }));
  }, [students, jadwalData]);

  const totalTeachersWithJadwal = teacherJadwalStats.filter(t => t.jadwalFilledCount > 0).length;

  if (loading) {
    return (
      <div className="overview-container fade-in" style={{ padding: '40px', textAlign: 'center' }}>
        <Loader2 size={40} className="spin" style={{ color: 'var(--primary-gold)' }} />
        <p style={{ marginTop: '16px', color: 'var(--text-muted)' }}>Loading Jadwal tracking data...</p>
      </div>
    );
  }

  return (
    <div className="overview-container fade-in">
      {/* Header */}
      <div className="overview-selection-header card-appear" style={{ marginBottom: '24px' }}>
        <div className="selection-box" style={{ border: 'none', padding: '20px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Calendar size={28} className="gold-icon" />
              <div>
                <h3 style={{ margin: 0, color: 'var(--deep-brown)', fontSize: '1.3rem' }}>Jadwal Tracking</h3>
                <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  {totalTeachersWithJadwal} of {teacherJadwalStats.length} teachers have filled Jadwal entries
                </p>
              </div>
            </div>
            <button
              className="action-button"
              onClick={fetchAllJadwal}
              style={{ background: 'var(--soft-brown)', color: 'white', padding: '8px 16px', fontSize: '0.8rem' }}
            >
              <Loader2 size={14} style={{ marginRight: '6px' }} /> Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Teacher list */}
      <div className="jadwal-teacher-grid" style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
        gap: '16px',
      }}>
        {teacherJadwalStats.map(teacher => (
          <div
            key={teacher.teacherName}
            className="premium-card card-appear"
            style={{
              padding: '20px',
              cursor: 'pointer',
              transition: 'transform 0.2s ease, box-shadow 0.2s ease',
              borderLeft: teacher.jadwalFilledCount > 0 ? '4px solid var(--primary-gold)' : '4px solid #e0d6c8',
            }}
            onClick={() => setSelectedTeacher(teacher)}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 12px 30px rgba(0,0,0,0.1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = '';
              e.currentTarget.style.boxShadow = '';
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '12px',
                  background: teacher.jadwalFilledCount > 0
                    ? 'linear-gradient(135deg, rgba(212,175,55,0.2), rgba(212,175,55,0.08))'
                    : 'rgba(0,0,0,0.04)',
                  display: 'grid',
                  placeItems: 'center',
                  color: teacher.jadwalFilledCount > 0 ? 'var(--primary-gold)' : '#bbb',
                }}>
                  <Users size={22} />
                </div>
                <div>
                  <h4 style={{ margin: 0, color: 'var(--deep-brown)', fontSize: '0.95rem' }}>{teacher.teacherName}</h4>
                  <p style={{ margin: '2px 0 0', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                    {teacher.totalStudents} students · {teacher.jadwalFilledCount} with Jadwal
                  </p>
                </div>
              </div>
              <ChevronRight size={18} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            </div>

            {/* Fill percentage bar */}
            <div style={{ marginTop: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Avg Jadwal Fill</span>
                <span style={{
                  fontSize: '0.85rem',
                  fontWeight: 'bold',
                  color: teacher.avgFillPercent >= 80 ? '#2e7d32' : teacher.avgFillPercent >= 50 ? '#f57f17' : '#c62828'
                }}>
                  {teacher.avgFillPercent}%
                </span>
              </div>
              <div style={{
                height: '6px',
                borderRadius: '3px',
                background: 'rgba(0,0,0,0.06)',
                overflow: 'hidden',
              }}>
                <div style={{
                  height: '100%',
                  borderRadius: '3px',
                  width: `${teacher.avgFillPercent}%`,
                  background: teacher.avgFillPercent >= 80
                    ? 'linear-gradient(90deg, #66bb6a, #43a047)'
                    : teacher.avgFillPercent >= 50
                      ? 'linear-gradient(90deg, #ffb300, #ff8f00)'
                      : 'linear-gradient(90deg, #ef5350, #d32f2f)',
                  transition: 'width 0.8s ease',
                }} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {teacherJadwalStats.length === 0 && (
        <div className="empty-overview card-appear" style={{ textAlign: 'center', padding: '60px 20px' }}>
          <Calendar size={64} className="empty-icon" />
          <h3>No Teachers Found</h3>
          <p>No teachers or students are configured in the system yet.</p>
        </div>
      )}

      {/* Teacher Detail Modal */}
      {selectedTeacher && (
        <div
          className="notifications-panel-overlay"
          style={{ zIndex: 9999 }}
          onClick={() => setSelectedTeacher(null)}
        >
          <div
            className="premium-card"
            style={{
              position: 'fixed',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: 'min(600px, 92vw)',
              maxHeight: '80vh',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              padding: 0,
              zIndex: 10000,
              borderRadius: '20px',
              boxShadow: '0 30px 80px rgba(0,0,0,0.25)',
              animation: 'fadeIn 0.2s ease',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{
              padding: '24px 24px 16px',
              borderBottom: '1px solid rgba(0,0,0,0.06)',
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                  <GraduationCap size={22} style={{ color: 'var(--primary-gold)' }} />
                  <h3 style={{ margin: 0, color: 'var(--deep-brown)', fontSize: '1.15rem' }}>
                    {selectedTeacher.teacherName}
                  </h3>
                </div>
                <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  {selectedTeacher.children.length} assigned students · {selectedTeacher.jadwalFilledCount} with Jadwal entries
                </p>
              </div>
              <button
                onClick={() => setSelectedTeacher(null)}
                style={{
                  background: 'rgba(0,0,0,0.04)',
                  border: 'none',
                  borderRadius: '50%',
                  width: '32px',
                  height: '32px',
                  display: 'grid',
                  placeItems: 'center',
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                  flexShrink: 0,
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body - Scrollable */}
            <div style={{
              overflow: 'auto',
              padding: '16px 24px 24px',
              flex: 1,
            }}>
              {selectedTeacher.children.map((child, idx) => (
                <div
                  key={child.student_id}
                  className="card-appear"
                  style={{
                    padding: '14px 16px',
                    borderRadius: '12px',
                    background: child.hasJadwal
                      ? 'rgba(255,255,255,0.9)'
                      : 'rgba(248,245,240,0.6)',
                    border: '1px solid',
                    borderColor: child.hasJadwal
                      ? child.fillPercent >= 80
                        ? 'rgba(67,160,71,0.2)'
                        : child.fillPercent >= 50
                          ? 'rgba(255,143,0,0.2)'
                          : 'rgba(211,47,47,0.15)'
                      : 'rgba(0,0,0,0.06)',
                    marginBottom: '10px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    animationDelay: `${idx * 0.05}s`,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                    <div style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '10px',
                      display: 'grid',
                      placeItems: 'center',
                      fontSize: '0.8rem',
                      fontWeight: 'bold',
                      flexShrink: 0,
                      background: child.hasJadwal
                        ? child.fillPercent >= 80
                          ? 'rgba(46,125,50,0.1)'
                          : child.fillPercent >= 50
                            ? 'rgba(245,127,23,0.1)'
                            : 'rgba(198,40,40,0.1)'
                        : 'rgba(0,0,0,0.04)',
                      color: child.hasJadwal
                        ? child.fillPercent >= 80
                          ? '#2e7d32'
                          : child.fillPercent >= 50
                            ? '#e65100'
                            : '#c62828'
                        : '#bbb',
                    }}>
                      {child.hasJadwal ? (
                        child.fillPercent >= 80 ? <CheckCircle size={18} /> : <AlertCircle size={18} />
                      ) : (
                        <X size={16} />
                      )}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{
                        fontWeight: 600,
                        color: 'var(--deep-brown)',
                        fontSize: '0.9rem',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}>
                        {child.name}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {child.groupName}
                      </div>
                    </div>
                  </div>

                  <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: '12px' }}>
                    <div style={{
                      fontSize: '1rem',
                      fontWeight: 'bold',
                      color: child.hasJadwal
                        ? child.fillPercent >= 80
                          ? '#2e7d32'
                          : child.fillPercent >= 50
                            ? '#e65100'
                            : '#c62828'
                        : '#bbb',
                    }}>
                      {child.hasJadwal ? `${child.fillPercent}%` : '—'}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                      {child.hasJadwal ? `${Math.round(child.fillPercent / 100 * 6)}/6 days` : 'No Jadwal'}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Modal Footer */}
            <div style={{
              padding: '12px 24px',
              borderTop: '1px solid rgba(0,0,0,0.06)',
              background: 'rgba(252,250,245,0.8)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '0.8rem',
              color: 'var(--text-muted)',
            }}>
              <span>
                <Sparkles size={14} style={{ verticalAlign: 'middle', marginRight: '4px', color: 'var(--primary-gold)' }} />
                Avg fill: {selectedTeacher.avgFillPercent}%
              </span>
              <span>{selectedTeacher.jadwalFilledCount}/{selectedTeacher.totalStudents} students with Jadwal</span>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translate(-50%, -48%) scale(0.96); }
          to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        }
      `}</style>
    </div>
  );
};

export default JadwalTrackingView;
