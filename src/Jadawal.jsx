import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import './jadawal.css';

const DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];
const DEFAULT_SCHEDULE = {};
DAYS.forEach(day => {
  DEFAULT_SCHEDULE[day] = { juz1: '', juz2: '', juz3: '', juz4: '', star: '' };
});

export const JadawalTeacherView = ({ students, onShowAction, onBroadcastNotification }) => {
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [scheduleData, setScheduleData] = useState(DEFAULT_SCHEDULE);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (selectedStudentId) {
      fetchJadawal();
    } else {
      setScheduleData(DEFAULT_SCHEDULE);
    }
  }, [selectedStudentId]);

  const fetchJadawal = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('jadawal')
      .select('schedule_data')
      .eq('student_id', selectedStudentId)
      .single();
    
    if (error && error.code !== 'PGRST116') {
      console.error(error);
      onShowAction('error', 'Failed to fetch Jadawal');
    } else if (data && data.schedule_data) {
      setScheduleData({ ...DEFAULT_SCHEDULE, ...data.schedule_data });
    } else {
      setScheduleData(DEFAULT_SCHEDULE);
    }
    setLoading(false);
  };

  const handleSave = async () => {
    if (!selectedStudentId) return;
    setSaving(true);
    const { error } = await supabase
      .from('jadawal')
      .upsert({ 
        student_id: selectedStudentId, 
        schedule_data: scheduleData,
        updated_at: new Date().toISOString()
      }, { onConflict: 'student_id' });
    
    if (error) {
      console.error(error);
      onShowAction('error', 'Failed to save Jadawal. Make sure you ran the SQL setup script.');
    } else {
      onShowAction('success', 'Jadawal saved successfully');
      if (onBroadcastNotification) {
        try {
          const targetStudent = (students || []).find(s => 
            String(s.student_id) === String(selectedStudentId) || 
            (s.allIds && s.allIds.includes(String(selectedStudentId)))
          );
          const parentId = targetStudent?.parent_user_id || targetStudent?.user_id || targetStudent?.parent_email;
          if (parentId) {
            await onBroadcastNotification(
              "Jadawal Updated",
              "THE JADAWAL IS UPDATED BY YOUR TEACHER",
              "parents",
              parentId,
              "Jadawal"
            );
          }
        } catch (e) {
          console.warn("Jadawal notification failed:", e);
        }
      }
    }
    setSaving(false);
  };

  const handleCellChange = (day, field, value) => {
    setScheduleData(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        [field]: value
      }
    }));
  };

  return (
    <div className="jadawal-container">
      <div className="jadawal-header">
        <h2>Teacher Jadawal Editor</h2>
        <div className="student-selector">
          <select 
            value={selectedStudentId} 
            onChange={(e) => setSelectedStudentId(e.target.value)}
            className="premium-select"
          >
            <option value="">-- Select Student --</option>
            {(students || []).map(s => (
              <option key={s.student_id} value={s.student_id}>{s.full_name || s.name}</option>
            ))}
          </select>
          {selectedStudentId && (
            <button className="premium-btn gold" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save Jadawal'}
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="loading-spinner">Loading...</div>
      ) : selectedStudentId ? (
        <div className="jadawal-table-wrapper">
          <table className="jadawal-table">
            <thead>
              <tr>
                <th>Days</th>
                <th>Juz 1</th>
                <th>JUZ 2</th>
                <th>JUZ 3</th>
                <th>JUZ 4</th>
                <th>Star</th>
              </tr>
            </thead>
            <tbody>
              {DAYS.map(day => (
                <tr key={day}>
                  <td className="day-cell">{day}</td>
                  {['juz1', 'juz2', 'juz3', 'juz4'].map(juz => (
                    <td key={juz}>
                      <input 
                        type="text" 
                        value={scheduleData[day]?.[juz] || ''}
                        onChange={(e) => handleCellChange(day, juz, e.target.value)}
                        placeholder="-"
                      />
                    </td>
                  ))}
                  <td>
                    <select 
                      value={scheduleData[day]?.star || ''}
                      onChange={(e) => handleCellChange(day, 'star', e.target.value)}
                      className="star-select"
                    >
                      <option value="">-</option>
                      <option value="1">⭐</option>
                      <option value="2">⭐⭐</option>
                      <option value="3">⭐⭐⭐</option>
                      <option value="4">⭐⭐⭐⭐</option>
                      <option value="5">⭐⭐⭐⭐⭐</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="jadawal-empty">Please select a student from the dropdown to view and edit their Jadawal timetable.</div>
      )}
    </div>
  );
};

export const JadawalParentView = ({ studentId }) => {
  const [scheduleData, setScheduleData] = useState(DEFAULT_SCHEDULE);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (studentId) {
      fetchJadawal();
    }
  }, [studentId]);

  const fetchJadawal = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('jadawal')
      .select('schedule_data')
      .eq('student_id', studentId)
      .single();
    
    if (error && error.code !== 'PGRST116') {
      console.error(error);
    } else if (data && data.schedule_data) {
      setScheduleData({ ...DEFAULT_SCHEDULE, ...data.schedule_data });
    } else {
      setScheduleData(DEFAULT_SCHEDULE);
    }
    setLoading(false);
  };

  if (loading) return <div className="loading-spinner">Loading Jadawal...</div>;

  return (
    <div className="jadawal-container parent-view">
      <div className="jadawal-header">
        <h2>Weekly Jadawal Schedule</h2>
      </div>
      <div className="jadawal-table-wrapper">
        <table className="jadawal-table">
          <thead>
            <tr>
              <th>Days</th>
              <th>Juz 1</th>
              <th>JUZ 2</th>
              <th>JUZ 3</th>
              <th>JUZ 4</th>
              <th>Star</th>
            </tr>
          </thead>
          <tbody>
            {DAYS.map(day => (
              <tr key={day}>
                <td className="day-cell">{day}</td>
                <td>{scheduleData[day]?.juz1 || '-'}</td>
                <td>{scheduleData[day]?.juz2 || '-'}</td>
                <td>{scheduleData[day]?.juz3 || '-'}</td>
                <td>{scheduleData[day]?.juz4 || '-'}</td>
                <td className="star-cell">
                  {scheduleData[day]?.star ? '⭐'.repeat(parseInt(scheduleData[day].star)) : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
