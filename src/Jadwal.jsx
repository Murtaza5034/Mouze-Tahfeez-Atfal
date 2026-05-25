import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { Download, Save, Loader2 } from 'lucide-react';
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import { JadwalNotes } from "./JadwalNotes";
import './jadwal.css';

const DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];
const DEFAULT_SCHEDULE = {};
DAYS.forEach(day => {
  DEFAULT_SCHEDULE[day] = { juz1: '', juz2: '', juz3: '', juz4: '', star: '' };
});

const handleDownloadPDF = async (studentName, scheduleData) => {
  const printContainer = document.createElement("div");
  printContainer.style.position = "absolute";
  printContainer.style.left = "-9999px";
  printContainer.style.top = "-9999px";
  printContainer.style.width = "850px";
  printContainer.style.padding = "40px";
  printContainer.style.background = "#ffffff";
  printContainer.style.fontFamily = "'Inter', 'Segoe UI', sans-serif";
  printContainer.style.color = "#2c1e11";
  
  printContainer.innerHTML = `
    <div style="border: 2px solid #dfcbb5; border-radius: 16px; padding: 30px; background: #fffcf8; box-sizing: border-box;">
      <!-- Header -->
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #dfcbb5; padding-bottom: 20px; margin-bottom: 25px;">
        <div>
          <h1 style="margin: 0; font-size: 26px; color: #5d4037; font-family: 'Cinzel', serif; font-weight: bold; letter-spacing: 1px;">MAUZE TAHFEEZ ATFAL</h1>
          <p style="margin: 5px 0 0 0; font-size: 14px; color: #8b6d31; font-weight: 600; letter-spacing: 0.5px;">Weekly Quran Jadwal (Timetable)</p>
        </div>
        <div style="text-align: right;">
          <div style="font-size: 12px; color: #888; font-weight: 500;">Generated on</div>
          <div style="font-size: 14px; color: #5d4037; font-weight: bold;">${new Date().toLocaleDateString()}</div>
        </div>
      </div>

      <!-- Student Info Details -->
      <div style="background: rgba(212, 175, 55, 0.05); border: 1px solid rgba(212, 175, 55, 0.2); border-radius: 12px; padding: 18px 24px; margin-bottom: 30px; display: flex; justify-content: space-between; align-items: center; box-sizing: border-box;">
        <div>
          <span style="font-size: 11px; color: #8b6d31; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; display: block; margin-bottom: 4px;">STUDENT NAME</span>
          <span style="font-size: 20px; color: #5d4037; font-weight: 800;">${studentName}</span>
        </div>
        <div style="text-align: right;">
          <span style="font-size: 11px; color: #8b6d31; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; display: block; margin-bottom: 4px;">ACADEMIC PORTAL</span>
          <span style="font-size: 14px; color: #ffffff; font-weight: 700; background: #5d4037; padding: 4px 12px; border-radius: 20px;">Hifz Program</span>
        </div>
      </div>

      <!-- Jadwal Table -->
      <table style="width: 100%; border-collapse: collapse; margin-top: 10px; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 10px rgba(93, 64, 55, 0.03);">
        <thead>
          <tr style="background: #5d4037; color: #ffffff;">
            <th style="padding: 14px; border: 1px solid #dfcbb5; font-size: 12px; text-transform: uppercase; font-weight: bold; text-align: left; width: 120px;">DAYS</th>
            <th style="padding: 14px; border: 1px solid #dfcbb5; font-size: 12px; text-transform: uppercase; font-weight: bold; text-align: center;">JUZ 1</th>
            <th style="padding: 14px; border: 1px solid #dfcbb5; font-size: 12px; text-transform: uppercase; font-weight: bold; text-align: center;">JUZ 2</th>
            <th style="padding: 14px; border: 1px solid #dfcbb5; font-size: 12px; text-transform: uppercase; font-weight: bold; text-align: center;">JUZ 3</th>
            <th style="padding: 14px; border: 1px solid #dfcbb5; font-size: 12px; text-transform: uppercase; font-weight: bold; text-align: center;">JUZ 4</th>
            <th style="padding: 14px; border: 1px solid #dfcbb5; font-size: 12px; text-transform: uppercase; font-weight: bold; text-align: center; width: 110px;">STAR</th>
          </tr>
        </thead>
        <tbody>
          ${DAYS.map((day, idx) => {
            const row = scheduleData[day] || { juz1: '', juz2: '', juz3: '', juz4: '', star: '' };
            const stars = row.star ? '⭐'.repeat(parseInt(row.star)) : '-';
            const rowBg = idx % 2 === 0 ? '#ffffff' : '#fefbf7';
            return `
              <tr style="background: ${rowBg};">
                <td style="padding: 14px; border: 1px solid #dfcbb5; font-weight: bold; font-size: 13px; color: #5d4037; text-align: left;">${day}</td>
                <td style="padding: 14px; border: 1px solid #dfcbb5; font-size: 13px; color: #333; text-align: center; font-weight: 500;">${row.juz1 || '-'}</td>
                <td style="padding: 14px; border: 1px solid #dfcbb5; font-size: 13px; color: #333; text-align: center; font-weight: 500;">${row.juz2 || '-'}</td>
                <td style="padding: 14px; border: 1px solid #dfcbb5; font-size: 13px; color: #333; text-align: center; font-weight: 500;">${row.juz3 || '-'}</td>
                <td style="padding: 14px; border: 1px solid #dfcbb5; font-size: 13px; color: #333; text-align: center; font-weight: 500;">${row.juz4 || '-'}</td>
                <td style="padding: 14px; border: 1px solid #dfcbb5; font-size: 16px; color: #FFD700; text-align: center; letter-spacing: 1px;">${stars}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>

      <!-- Footer Note -->
      <div style="margin-top: 35px; border-top: 1px dashed #dfcbb5; padding-top: 15px; text-align: center;">
        <p style="margin: 0; font-size: 12px; color: #8b6d31; font-style: italic; font-weight: 600;">
          "And We have indeed made the Quran easy to understand and remember..."
        </p>
      </div>
    </div>
  `;

  document.body.appendChild(printContainer);

  try {
    const canvas = await html2canvas(printContainer, {
      scale: 3, // 100% HD Quality
      useCORS: true,
      allowTaint: true,
      backgroundColor: "#ffffff",
    });

    const imgData = canvas.toDataURL("image/png");
    const pdfWidth = 210;
    const imgProps = new jsPDF().getImageProperties(imgData);
    const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
    
    const pdf = new jsPDF({
      orientation: "p",
      unit: "mm",
      format: "a4"
    });

    pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
    pdf.save(`${studentName.replace(/[^a-z0-9]/gi, '_')}_Jadwal.pdf`);
  } catch (err) {
    console.error("Failed to export Jadwal PDF:", err);
    alert("Failed to export Jadwal PDF");
  } finally {
    document.body.removeChild(printContainer);
  }
};

export const JadwalTeacherView = ({ students, onShowAction, onBroadcastNotification, initialStudentId }) => {
  const [selectedStudentId, setSelectedStudentId] = useState(initialStudentId || '');
  const [scheduleData, setScheduleData] = useState(DEFAULT_SCHEDULE);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (initialStudentId) {
      setSelectedStudentId(initialStudentId);
    }
  }, [initialStudentId]);

  useEffect(() => {
    if (selectedStudentId) {
      fetchJadwal();
    } else {
      setScheduleData(DEFAULT_SCHEDULE);
    }
  }, [selectedStudentId]);

  const fetchJadwal = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('jadawal')
      .select('schedule_data')
      .eq('student_id', selectedStudentId)
      .single();
    
    if (error && error.code !== 'PGRST116') {
      console.error(error);
      onShowAction('error', 'Failed to fetch Jadwal');
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
      onShowAction('error', 'Failed to save Jadwal. Make sure you ran the SQL setup script.');
    } else {
      onShowAction('success', 'Jadwal saved successfully');
      if (onBroadcastNotification) {
        try {
          const targetStudent = (students || []).find(s => 
            String(s.student_id) === String(selectedStudentId) || 
            (s.allIds && s.allIds.includes(String(selectedStudentId)))
          );
          const parentId = targetStudent?.parent_user_id || targetStudent?.user_id || targetStudent?.parent_email;
          if (parentId) {
            await onBroadcastNotification(
              "Jadwal Timetable Updated 📅",
              `The weekly Quran study schedule (Jadwal) for ${studentName} has been updated by the teacher. Tap to view.`,
              "parents",
              parentId,
              "Jadwal"
            );
          }
        } catch (e) {
          console.warn("Jadwal notification failed:", e);
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

  const selectedStudentObj = (students || []).find(s => String(s.student_id) === String(selectedStudentId));
  const studentName = selectedStudentObj ? (selectedStudentObj.full_name || selectedStudentObj.name) : "Student";

  return (
    <div className="jadwal-container">
      <div className="jadwal-header">
        <h2>Teacher Jadwal Editor</h2>
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
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <button className="jadwal-save-btn" onClick={handleSave} disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="animate-spin" size={16} />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Save size={16} />
                    <span>Save Jadwal</span>
                  </>
                )}
              </button>
              <button 
                className="jadwal-download-btn" 
                onClick={() => handleDownloadPDF(studentName, scheduleData)}
              >
                <Download size={16} /> Download PDF
              </button>
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <div className="loading-spinner">Loading...</div>
      ) : selectedStudentId ? (
        <div className="jadwal-table-wrapper">
          <table className="jadwal-table">
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
        <div className="jadwal-empty">Please select a student from the dropdown to view and edit their Jadwal timetable.</div>
      )}
      
      {selectedStudentId && (
        <JadwalNotes 
          role="teacher" 
          studentId={selectedStudentId} 
          studentName={studentName} 
          showAction={onShowAction} 
        />
      )}
    </div>
  );
};

export const JadwalParentView = ({ studentId, teacherName, teacherId, teacherProfiles, showAction }) => {
  const [scheduleData, setScheduleData] = useState(DEFAULT_SCHEDULE);
  const [studentName, setStudentName] = useState('Student');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (studentId) {
      fetchJadwal();
    }
  }, [studentId]);

  const fetchJadwal = async () => {
    setLoading(true);
    
    // Fetch student's name
    try {
      const { data: studentData } = await supabase
        .from('child_profiles')
        .select('full_name')
        .eq('student_id', studentId)
        .single();
        
      if (studentData) {
        setStudentName(studentData.full_name);
      }
    } catch (e) {
      console.warn("Failed to fetch student name:", e);
    }

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

  if (loading) return <div className="loading-spinner">Loading Jadwal...</div>;

  return (
    <div className="jadwal-container parent-view">
      <div className="jadwal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>Weekly Jadwal Schedule</h2>
        <button 
          className="jadwal-save-btn" 
          onClick={() => handleDownloadPDF(studentName, scheduleData)}
        >
          <Download size={16} /> Download PDF
        </button>
      </div>
      <div className="jadwal-table-wrapper">
        <table className="jadwal-table">
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
      
      <JadwalNotes 
        role="parent" 
        studentId={studentId} 
        studentName={studentName}
        teacherName={teacherName}
        teacherId={teacherId}
        teacherProfiles={teacherProfiles}
        showAction={showAction}
      />
    </div>
  );
};
