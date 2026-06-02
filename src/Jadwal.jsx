import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { Download, Save, Loader2, ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import { JadwalNotes } from "./JadwalNotes";
import './jadwal.css';

const DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];
const DEFAULT_SCHEDULE = {};
DAYS.forEach(day => {
  DEFAULT_SCHEDULE[day] = { juz1: '', juz2: '', juz3: '', juz4: '', murajah: '', juzhali: '', jadeed: '', star: '' };
});

const FONT_FACE_CSS = `
@font-face {
  font-family: 'Kanz al Marjaan';
  src: url('/Kanz%20al%20Marjaan/kanz-al-marjaan-webfont.woff2') format('woff2'),
       url('/Kanz%20al%20Marjaan/kanz-al-marjaan-webfont.woff') format('woff'),
       url('/Kanz%20al%20Marjaan/kanz-al-marjaan-webfont.ttf') format('truetype');
  font-weight: normal;
  font-style: normal;
  font-display: swap;
}
@font-face {
  font-family: 'Al-Kanz';
  src: url('/fonts/al-kanz.ttf') format('truetype');
  font-weight: normal;
  font-style: normal;
  font-display: swap;
}
`;

const getDefaultTheme = () => ({
  primaryColor: '#5d4037',
  accentColor: '#d4af37',
  backgroundColor: '#ffffff',
  backgroundUrl: '',
  fontFamily: 'Inter',
});

const handleDownloadPDF = async (studentName, scheduleData, mode = 'juz-wise', theme = {}) => {
  const t = { ...getDefaultTheme(), ...theme };
  const pdfDays = (() => {
    if (t.jadwalType === 'miqaat' && t.weekStart && t.weekEnd) {
      const s = new Date(t.weekStart + 'T00:00:00Z');
      const e = new Date(t.weekEnd + 'T00:00:00Z');
      if (s <= e) {
        const names = ['SUNDAY','MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY'];
        const days = [];
        const cur = new Date(s);
        while (cur <= e) {
          days.push(names[cur.getUTCDay()]);
          cur.setUTCDate(cur.getUTCDate() + 1);
        }
        return days;
      }
    }
    return DAYS;
  })();
  const printContainer = document.createElement("div");
  printContainer.style.position = "absolute";
  printContainer.style.left = "-9999px";
  printContainer.style.top = "-9999px";
  printContainer.style.width = "850px";
  printContainer.style.padding = "40px";
  printContainer.style.background = t.backgroundColor;
  printContainer.style.fontFamily = t.fontFamily.includes(',') ? t.fontFamily : `'${t.fontFamily}', 'Inter', 'Segoe UI', sans-serif`;
  printContainer.style.color = "#2c1e11";

  const bgImageStyle = t.backgroundUrl
    ? `background-image: url('${t.backgroundUrl}'); background-size: cover; background-position: center; background-repeat: no-repeat;`
    : '';

  const pdfHeaders = mode === 'juz-wise'
    ? `<tr style="background: ${t.primaryColor}; color: #ffffff;">`
      + `<th style="padding: 14px; border: 1px solid ${t.accentColor}; font-size: 12px; text-transform: uppercase; font-weight: bold; text-align: left; width: 120px;">DAYS</th>`
      + `<th style="padding: 14px; border: 1px solid ${t.accentColor}; font-size: 12px; text-transform: uppercase; font-weight: bold; text-align: center;">MURAJAH 1</th>`
      + `<th style="padding: 14px; border: 1px solid ${t.accentColor}; font-size: 12px; text-transform: uppercase; font-weight: bold; text-align: center;">MURAJAH 2</th>`
      + `<th style="padding: 14px; border: 1px solid ${t.accentColor}; font-size: 12px; text-transform: uppercase; font-weight: bold; text-align: center;">MURAJAH 3</th>`
      + `<th style="padding: 14px; border: 1px solid ${t.accentColor}; font-size: 12px; text-transform: uppercase; font-weight: bold; text-align: center;">MURAJAH 4</th>`
      + `<th style="padding: 14px; border: 1px solid ${t.accentColor}; font-size: 12px; text-transform: uppercase; font-weight: bold; text-align: center;">JUZHALI</th>`
      + `<th style="padding: 14px; border: 1px solid ${t.accentColor}; font-size: 12px; text-transform: uppercase; font-weight: bold; text-align: center;">JADEED</th>`
      + `<th style="padding: 14px; border: 1px solid ${t.accentColor}; font-size: 12px; text-transform: uppercase; font-weight: bold; text-align: center; width: 110px;">STAR</th>`
      + '</tr>'
    : `<tr style="background: ${t.primaryColor}; color: #ffffff;">`
      + `<th style="padding: 14px; border: 1px solid ${t.accentColor}; font-size: 12px; text-transform: uppercase; font-weight: bold; text-align: left; width: 120px;">DAYS</th>`
      + `<th style="padding: 14px; border: 1px solid ${t.accentColor}; font-size: 12px; text-transform: uppercase; font-weight: bold; text-align: center;">MURAJAH</th>`
      + `<th style="padding: 14px; border: 1px solid ${t.accentColor}; font-size: 12px; text-transform: uppercase; font-weight: bold; text-align: center;">JUZHALI</th>`
      + `<th style="padding: 14px; border: 1px solid ${t.accentColor}; font-size: 12px; text-transform: uppercase; font-weight: bold; text-align: center;">JADEED</th>`
      + `<th style="padding: 14px; border: 1px solid ${t.accentColor}; font-size: 12px; text-transform: uppercase; font-weight: bold; text-align: center; width: 110px;">STAR</th>`
      + '</tr>';

  const buildPdfRows = () => {
    const rows = pdfDays.map((day, idx) => {
      const row = scheduleData[day] || {};
      const stars = row.star ? '\u2B50'.repeat(parseInt(row.star)) : '-';
      const bg = idx % 2 === 0 ? t.backgroundColor : `${t.backgroundColor}f2`;
      const dayTd = `<td style="padding: 14px; border: 1px solid ${t.accentColor}; font-weight: bold; font-size: 13px; color: ${t.primaryColor}; text-align: left;">${day}</td>`;
      const starTd = `<td style="padding: 14px; border: 1px solid ${t.accentColor}; font-size: 16px; color: #FFD700; text-align: center; letter-spacing: 1px;">${stars}</td>`;
      const tdStyle = `style="padding: 14px; border: 1px solid ${t.accentColor}; font-size: 13px; color: #333; text-align: center; font-weight: 500;"`;

      if (mode === 'juz-wise') {
        return `<tr style="background: ${bg};">${dayTd}`
          + `<td ${tdStyle}>${row.juz1 || '-'}</td>`
          + `<td ${tdStyle}>${row.juz2 || '-'}</td>`
          + `<td ${tdStyle}>${row.juz3 || '-'}</td>`
          + `<td ${tdStyle}>${row.juz4 || '-'}</td>`
          + `<td ${tdStyle}>${row.juzhali || '-'}</td>`
          + `<td ${tdStyle}>${row.jadeed || '-'}</td>`
          + `${starTd}</tr>`;
      }
      return `<tr style="background: ${bg};">${dayTd}`
        + `<td ${tdStyle}>${row.murajah || '-'}</td>`
        + `<td ${tdStyle}>${row.juzhali || '-'}</td>`
        + `<td ${tdStyle}>${row.jadeed || '-'}</td>`
        + `${starTd}</tr>`;
    });
    return rows.join('');
  };

  const pdfRows = buildPdfRows();

  printContainer.innerHTML = `
    <div style="border: 2px solid ${t.accentColor}; border-radius: 16px; padding: 30px; background: ${t.backgroundColor}; box-sizing: border-box; ${bgImageStyle}">
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid ${t.accentColor}; padding-bottom: 20px; margin-bottom: 25px;">
        <div>
          <h1 style="margin: 0; font-size: 26px; color: ${t.primaryColor}; font-family: 'Cinzel', serif; font-weight: bold; letter-spacing: 1px;">MAUZE TAHFEEZ ATFAL</h1>
           <p style="margin: 5px 0 0 0; font-size: 14px; color: ${t.accentColor}; font-weight: 600; letter-spacing: 0.5px;">${t.jadwalType === 'miqaat' ? 'Miqaāt' : 'Weekly'} Quran Jadwal (Timetable)</p>
        </div>
        <div style="text-align: right;">
          <div style="font-size: 12px; color: #888; font-weight: 500;">Generated on</div>
          <div style="font-size: 14px; color: ${t.primaryColor}; font-weight: bold;">${new Date().toLocaleDateString()}</div>
        </div>
      </div>

      <div style="background: rgba(212, 175, 55, 0.05); border: 1px solid rgba(212, 175, 55, 0.2); border-radius: 12px; padding: 18px 24px; margin-bottom: 30px; display: flex; justify-content: space-between; align-items: center; box-sizing: border-box;">
        <div>
          <span style="font-size: 11px; color: ${t.accentColor}; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; display: block; margin-bottom: 4px;">STUDENT NAME</span>
          <span style="font-size: 20px; color: ${t.primaryColor}; font-weight: 800;">${studentName}</span>
        </div>
        <div style="text-align: right;">
          <span style="font-size: 11px; color: ${t.accentColor}; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; display: block; margin-bottom: 4px;">ACADEMIC PORTAL</span>
          <span style="font-size: 14px; color: #ffffff; font-weight: 700; background: ${t.primaryColor}; padding: 4px 12px; border-radius: 20px;">Hifz Program</span>
        </div>
      </div>

      <table style="width: 100%; border-collapse: collapse; margin-top: 10px; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 10px rgba(93, 64, 55, 0.03);">
        <thead>${pdfHeaders}</thead>
        <tbody>${pdfRows}</tbody>
      </table>

      <div style="margin-top: 35px; border-top: 1px dashed ${t.accentColor}; padding-top: 15px; text-align: center;">
        <p style="margin: 0; font-size: 12px; color: ${t.accentColor}; font-style: italic; font-weight: 600;">
          "And We have indeed made the Quran easy to understand and remember..."
        </p>
      </div>
    </div>
  `;
  document.body.appendChild(printContainer);

  try {
    try {
      await document.fonts.ready;
      const kanzFamily = ['Kanz al Marjaan', 'Al-Kanz'];
      for (const family of kanzFamily) {
        if (!document.fonts.check('1em "' + family + '"', 'abcdefghijklmnopqrstuvwxyz0123456789')) {
          const fontSrc = family === 'Kanz al Marjaan'
            ? "url(/Kanz%20al%20Marjaan/kanz-al-marjaan-webfont.woff2) format('woff2'),url(/Kanz%20al%20Marjaan/kanz-al-marjaan-webfont.woff) format('woff'),url(/Kanz%20al%20Marjaan/kanz-al-marjaan-webfont.ttf) format('truetype')"
            : "url(/fonts/al-kanz.ttf) format('truetype')";
          const ff = new FontFace(family, fontSrc);
          await ff.load();
          document.fonts.add(ff);
        }
      }
      await document.fonts.ready;
    } catch (e) {
      console.warn('Custom font loading for Jadwal PDF failed:', e);
    }
    const canvas = await html2canvas(printContainer, {
      scale: 3,
      useCORS: true,
      allowTaint: true,
      backgroundColor: t.backgroundColor,
      onclone: async (clonedDoc) => {
        const style = clonedDoc.createElement('style');
        style.textContent = FONT_FACE_CSS;
        clonedDoc.head.appendChild(style);
        if (clonedDoc.fonts && clonedDoc.fonts.ready) {
          await Promise.race([
            clonedDoc.fonts.ready,
            new Promise(resolve => setTimeout(resolve, 3000)),
          ]);
        }
      },
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

const JadwalTableStyle = ({ mode, scheduleData, onCellChange, readOnly, dayDates, customDays }) => {
  const daysToRender = customDays || DAYS.map((day, idx) => ({ dayName: day, fatemiDate: dayDates?.[idx] || '' }));
  return (
    <div className="jadwal-table-wrapper">
      <table className="jadwal-table">
        <thead>
          {mode === 'juz-wise' ? (
            <>
              <tr>
                <th rowSpan="2">Days</th>
                <th colSpan="4" style={{ textAlign: 'center', borderBottom: 'none' }}>Murajah</th>
                <th rowSpan="2">Juzhali</th>
                <th rowSpan="2">Jadeed</th>
                <th rowSpan="2">Star</th>
              </tr>
              <tr>
                <th>1</th>
                <th>2</th>
                <th>3</th>
                <th>4</th>
              </tr>
            </>
          ) : (
            <tr>
              <th>Days</th>
              <th>Murajah</th>
              <th>Juzhali</th>
              <th>Jadeed</th>
              <th>Star</th>
            </tr>
          )}
        </thead>
        <tbody>
          {daysToRender.map((dayObj) => {
            const day = dayObj.dayName;
            return (
            <tr key={day}>
              <td className="day-cell">{day}{dayObj.fatemiDate ? <div className="day-fatemi-date">{dayObj.fatemiDate}</div> : null}</td>
              {mode === 'juz-wise' ? (
                <>
                  {['juz1', 'juz2', 'juz3', 'juz4'].map(juz => (
                    <td key={juz}>
                      {readOnly ? (
                        <span>{scheduleData[day]?.[juz] || '-'}</span>
                      ) : (
                        <input
                          type="text"
                          value={scheduleData[day]?.[juz] || ''}
                          onChange={(e) => onCellChange(day, juz, e.target.value)}
                          placeholder="-"
                        />
                      )}
                    </td>
                  ))}
                  <td>
                    {readOnly ? (
                      <span>{scheduleData[day]?.juzhali || '-'}</span>
                    ) : (
                      <input
                        type="text"
                        value={scheduleData[day]?.juzhali || ''}
                        onChange={(e) => onCellChange(day, 'juzhali', e.target.value)}
                        placeholder="-"
                        style={{ direction: /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/.test(scheduleData[day]?.juzhali || '') ? 'rtl' : 'ltr' }}
                      />
                    )}
                  </td>
                  <td>
                    {readOnly ? (
                      <span>{scheduleData[day]?.jadeed || '-'}</span>
                    ) : (
                      <input
                        type="text"
                        value={scheduleData[day]?.jadeed || ''}
                        onChange={(e) => onCellChange(day, 'jadeed', e.target.value)}
                        placeholder="-"
                        style={{ direction: /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/.test(scheduleData[day]?.jadeed || '') ? 'rtl' : 'ltr' }}
                      />
                    )}
                  </td>
                </>
              ) : (
                <>
                  {['murajah', 'juzhali', 'jadeed'].map(field => (
                    <td key={field}>
                      {readOnly ? (
                        <span>{scheduleData[day]?.[field] || '-'}</span>
                      ) : (
                        <input
                          type="text"
                          value={scheduleData[day]?.[field] || ''}
                          onChange={(e) => onCellChange(day, field, e.target.value)}
                          placeholder="-"
                          style={{ direction: /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/.test(scheduleData[day]?.[field] || '') ? 'rtl' : 'ltr' }}
                        />
                      )}
                    </td>
                  ))}
                </>
              )}
              <td className="star-cell">
                {readOnly ? (
                  <span>{scheduleData[day]?.star ? '⭐'.repeat(parseInt(scheduleData[day].star)) : '-'}</span>
                ) : (
                  <select
                    value={scheduleData[day]?.star || ''}
                    onChange={(e) => onCellChange(day, 'star', e.target.value)}
                    className="star-select"
                  >
                    <option value="">-</option>
                    <option value="1">⭐</option>
                    <option value="2">⭐⭐</option>
                    <option value="3">⭐⭐⭐</option>
                    <option value="4">⭐⭐⭐⭐</option>
                    <option value="5">⭐⭐⭐⭐⭐</option>
                  </select>
                )}
              </td>
            </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

const JadwalCalendarStyle = ({ mode, scheduleData, onCellChange, readOnly, compact, customDays }) => {
  const [currentWeekOffset, setCurrentWeekOffset] = useState(0);

  const getWeekDays = () => {
    const now = new Date();
    now.setDate(now.getDate() + currentWeekOffset * 7);
    const day = now.getDay();
    const mondayOffset = day === 0 ? -6 : 1 - day;
    return DAYS.map((_, idx) => {
      const d = new Date(now);
      d.setDate(now.getDate() + mondayOffset + idx);
      return d;
    });
  };

  const weekDays = getWeekDays();
  const fatemiDates = weekDays.map(d => getFatemiDateStr(d.toISOString().split('T')[0]));

  const renderDayCell = (day, dateObj, customFatemi) => {
    const row = scheduleData[day] || {};
    const dateStr = customDays
      ? dateObj?.date || ''
      : dateObj?.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const isToday = customDays ? false : dateObj?.toDateString() === new Date().toDateString();
    const fatemi = customFatemi || (customDays ? '' : fatemiDates[DAYS.indexOf(day)]);

    const fields = mode === 'juz-wise'
      ? ['juz1', 'juz2', 'juz3', 'juz4']
      : ['murajah'];
    const extraFields = ['juzhali', 'jadeed'];

    return (
      <div key={day} className={`jadwal-calendar-card ${isToday ? 'today' : ''}`}>
        <div className="jadwal-calendar-card-header">
          <span className="jadwal-calendar-day-name">{day}</span>
          {dateStr ? <span className="jadwal-calendar-date">{dateStr}</span> : null}
        </div>
        {fatemi ? (
          <div style={{ textAlign: 'center', fontSize: '0.7rem', fontFamily: "'Kanz al Marjaan', serif", color: 'var(--primary-gold)', padding: '2px 0 4px', lineHeight: 1.2, direction: 'rtl' }}>
            {fatemi}
          </div>
        ) : null}
        <div className="jadwal-calendar-card-body">
          {fields.map(field => (
            <div className="jadwal-calendar-field" key={field}>
              <label>{field.charAt(0).toUpperCase() + field.slice(1).replace(/\d/, ' $&')}</label>
              {readOnly ? (
                <span>{row[field] || '-'}</span>
              ) : (
                <input
                  type="text"
                  value={row[field] || ''}
                  onChange={(e) => onCellChange(day, field, e.target.value)}
                  placeholder="-"
                />
              )}
            </div>
          ))}
          {extraFields.map(field => (
            <div className="jadwal-calendar-field" key={field}>
              <label>{field.charAt(0).toUpperCase() + field.slice(1)}</label>
              {readOnly ? (
                <span>{row[field] || '-'}</span>
              ) : (
                <input
                  type="text"
                  value={row[field] || ''}
                  onChange={(e) => onCellChange(day, field, e.target.value)}
                  placeholder="-"
                  style={{ direction: /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/.test(row[field] || '') ? 'rtl' : 'ltr' }}
                />
              )}
            </div>
          ))}
          <div className="jadwal-calendar-field">
            <label>Star</label>
            {readOnly ? (
              <span className="star-cell">{row.star ? '⭐'.repeat(parseInt(row.star)) : '-'}</span>
            ) : (
              <select
                value={row.star || ''}
                onChange={(e) => onCellChange(day, 'star', e.target.value)}
                className="star-select"
              >
                <option value="">-</option>
                <option value="1">⭐</option>
                <option value="2">⭐⭐</option>
                <option value="3">⭐⭐⭐</option>
                <option value="4">⭐⭐⭐⭐</option>
                <option value="5">⭐⭐⭐⭐⭐</option>
              </select>
            )}
          </div>
        </div>
      </div>
    );
  };

  if (customDays) {
    return (
      <div className="jadwal-calendar-container">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '12px', fontSize: '0.85rem', color: 'var(--soft-brown)' }}>
          <Calendar size={16} />
          <span>Showing <strong>{customDays.length}</strong> day{customDays.length !== 1 ? 's' : ''} — {customDays[0]?.date} to {customDays[customDays.length - 1]?.date}</span>
        </div>
        <div className="jadwal-calendar-grid">
          {customDays.map(d => renderDayCell(d.dayName, d, d.fatemiDate))}
        </div>
      </div>
    );
  }

  return (
    <div className="jadwal-calendar-container">
      <div className="jadwal-calendar-nav">
        <button className="jadwal-calendar-nav-btn" onClick={() => setCurrentWeekOffset(prev => prev - 1)}>
          <ChevronLeft size={18} /> Previous Week
        </button>
        <span className="jadwal-calendar-week-label">
          {weekDays[0]?.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {weekDays[6]?.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
        </span>
        <button className="jadwal-calendar-nav-btn" onClick={() => setCurrentWeekOffset(prev => prev + 1)}>
          Next Week <ChevronRight size={18} />
        </button>
      </div>
      <div className="jadwal-calendar-grid">
        {DAYS.map((day, idx) => renderDayCell(day, weekDays[idx]))}
      </div>
    </div>
  );
};

const JadwalSingleDayCardStyle = ({ mode, scheduleData, onCellChange, readOnly, dayDates, customDays }) => {
  const daysList = customDays || DAYS.map((day, idx) => ({ dayName: day, date: '', fatemiDate: dayDates?.[idx] || '' }));
  const maxIdx = daysList.length - 1;
  const [currentDayIndex, setCurrentDayIndex] = useState(() => {
    if (customDays) return 0;
    const today = new Date().getDay();
    return today === 0 ? 6 : today - 1;
  });

  const dayObj = daysList[currentDayIndex];
  const day = dayObj?.dayName || '';
  const row = scheduleData[day] || {};
  const fatemiDate = dayObj?.fatemiDate || '';
  const { date } = dayObj;

  const goToDay = (offset) => {
    setCurrentDayIndex(prev => {
      const next = prev + offset;
      if (next < 0) return maxIdx;
      if (next > maxIdx) return 0;
      return next;
    });
  };

  const getNavDayName = (offset) => {
    const idx = ((currentDayIndex + offset) % (maxIdx + 1) + (maxIdx + 1)) % (maxIdx + 1);
    return daysList[idx]?.dayName || '';
  };

  const fields = mode === 'juz-wise'
    ? ['juz1', 'juz2', 'juz3', 'juz4']
    : ['murajah'];
  const extraFields = ['juzhali', 'jadeed'];

  return (
    <div className="jadwal-single-day-container">
      <div className="jadwal-single-day-nav">
        <button className="jadwal-calendar-nav-btn" onClick={() => goToDay(-1)}>
          <ChevronLeft size={18} /> {getNavDayName(-1)}
        </button>
        <div className="jadwal-single-day-title">
          <h3>{date ? `${day} - ${date}` : day}</h3>
          {fatemiDate && <span style={{ fontSize: '0.75rem', fontFamily: "'Kanz al Marjaan', serif", color: 'var(--primary-gold)', direction: 'rtl', display: 'block', marginTop: '2px' }}>{fatemiDate}</span>}
          {customDays ? null : <span className="jadwal-single-day-subtitle">Current Day View</span>}
        </div>
        <button className="jadwal-calendar-nav-btn" onClick={() => goToDay(1)}>
          {getNavDayName(1)} <ChevronRight size={18} />
        </button>
      </div>
      <div className="jadwal-single-day-card">
        <div className="jadwal-single-day-card-body">
          {fields.map(field => (
            <div className="jadwal-calendar-field" key={field}>
              <label>{field.charAt(0).toUpperCase() + field.slice(1).replace(/\d/, ' $&')}</label>
              {readOnly ? (
                <span>{row[field] || '-'}</span>
              ) : (
                <input
                  type="text"
                  value={row[field] || ''}
                  onChange={(e) => onCellChange(day, field, e.target.value)}
                  placeholder="-"
                />
              )}
            </div>
          ))}
          {extraFields.map(field => (
            <div className="jadwal-calendar-field" key={field}>
              <label>{field.charAt(0).toUpperCase() + field.slice(1)}</label>
              {readOnly ? (
                <span>{row[field] || '-'}</span>
              ) : (
                <input
                  type="text"
                  value={row[field] || ''}
                  onChange={(e) => onCellChange(day, field, e.target.value)}
                  placeholder="-"
                  style={{ direction: /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/.test(row[field] || '') ? 'rtl' : 'ltr' }}
                />
              )}
            </div>
          ))}
          <div className="jadwal-calendar-field">
            <label>Star</label>
            {readOnly ? (
              <span className="star-cell">{row.star ? '⭐'.repeat(parseInt(row.star)) : '-'}</span>
            ) : (
              <select
                value={row.star || ''}
                onChange={(e) => onCellChange(day, 'star', e.target.value)}
                className="star-select"
              >
                <option value="">-</option>
                <option value="1">⭐</option>
                <option value="2">⭐⭐</option>
                <option value="3">⭐⭐⭐</option>
                <option value="4">⭐⭐⭐⭐</option>
                <option value="5">⭐⭐⭐⭐⭐</option>
              </select>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const getJadwalThemeFromSettings = (settings = {}) => ({
  primaryColor: settings.jadwal_pdf_primary_color || '#5d4037',
  accentColor: settings.jadwal_pdf_accent_color || '#d4af37',
  backgroundColor: settings.jadwal_pdf_background_color || '#ffffff',
  backgroundUrl: settings.jadwal_pdf_background_url || '',
  fontFamily: settings.jadwal_pdf_font_family || 'Inter',
  jadwalType: settings.jadwal_type || 'weekly',
  weekStart: settings.jadwal_week_start || '',
  weekEnd: settings.jadwal_week_end || '',
});

const getFatemiDateStr = (dateStr) => {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    const parts = new Intl.DateTimeFormat('en-u-ca-islamic-tbla-nu-latn', {
      day: 'numeric', month: 'numeric', year: 'numeric'
    }).formatToParts(date);
    const d = parts.find(p => p.type === 'day').value;
    const m = parseInt(parts.find(p => p.type === 'month').value);
    const y = parts.find(p => p.type === 'year').value;
    const arabicMonths = [
      "محرم الحرام", "صفر المظفر", "ربيع الأول", "ربيع الآخر",
      "جمادى الأولى", "جمادى الآخرة", "رجب الأصب", "شعبان الكريم",
      "رمضان المعظم", "شوال المكرم", "ذي القعدة الحرام", "ذي الحجة الحرام"
    ];
    return `${d} ${arabicMonths[m - 1] || ''} ${y}`;
  } catch { return ''; }
};

const getDayDate = (weekStart, dayIndex) => {
  if (!weekStart) return '';
  const d = new Date(weekStart);
  d.setDate(d.getDate() + dayIndex);
  return getFatemiDateStr(d.toISOString().split('T')[0]);
};

const getDaysFromRange = (startStr, endStr) => {
  if (!startStr || !endStr) return null;
  const start = new Date(startStr + 'T00:00:00Z');
  const end = new Date(endStr + 'T00:00:00Z');
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) return null;
  const DAY_NAMES = ['SUNDAY','MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY'];
  const days = [];
  const current = new Date(start);
  while (current <= end) {
    const dateStr = current.toISOString().split('T')[0];
    days.push({
      dayName: DAY_NAMES[current.getUTCDay()],
      date: dateStr,
      fatemiDate: getFatemiDateStr(dateStr)
    });
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return days;
};

export const JadwalTeacherView = ({ students, onShowAction, onBroadcastNotification, initialStudentId, jadwalSettings }) => {
  const settings = Array.isArray(jadwalSettings) ? jadwalSettings[0] : jadwalSettings;
  const [selectedStudentId, setSelectedStudentId] = useState(initialStudentId || '');
  const [scheduleData, setScheduleData] = useState({ ...DEFAULT_SCHEDULE, _mode: 'juz-wise' });
  const [mode, setMode] = useState('juz-wise');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const displayStyle = settings?.jadwal_style || 'table';
  const teacherStyle = settings?.jadwal_teacher_style || 'default';
  const isCompact = teacherStyle === 'compact';
  const theme = getJadwalThemeFromSettings(settings);
  const dayDates = theme.weekStart ? DAYS.map((_, idx) => getDayDate(theme.weekStart, idx)) : [];
  const customDays = theme.jadwalType === 'miqaat' ? getDaysFromRange(theme.weekStart, theme.weekEnd) : null;

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
      const savedMode = data.schedule_data._mode || 'juz-wise';
      setMode(savedMode);
      setScheduleData({ ...DEFAULT_SCHEDULE, ...data.schedule_data, _mode: savedMode });
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
        schedule_data: { ...scheduleData, _mode: mode },
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

  const renderJadwalContent = () => {
    switch (displayStyle) {
      case 'calendar':
        return (
          <JadwalCalendarStyle
            mode={mode}
            scheduleData={scheduleData}
            onCellChange={handleCellChange}
            compact={isCompact}
            dayDates={dayDates}
            customDays={customDays}
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
  };

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
                onClick={() => handleDownloadPDF(studentName, scheduleData, mode, theme)}
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
        <>
          <div style={{ marginBottom: '16px', display: 'flex', gap: '12px', alignItems: 'center' }}>
            <label style={{ fontWeight: 600, color: '#5d4037', fontSize: '14px' }}>Schedule Mode:</label>
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value)}
              className="premium-select"
              style={{ padding: '8px 16px', borderRadius: '10px', border: '1px solid #dfcbb5', background: '#fdfaf4', fontFamily: 'Inter, sans-serif', fontSize: '13px', cursor: 'pointer' }}
            >
              <option value="juz-wise">Juz Wise</option>
              <option value="surah-wise">Surah Wise</option>
            </select>
            {mode === 'surah-wise' && (
              <span style={{ fontSize: '12px', color: '#8b6d31', fontStyle: 'italic' }}>Free text: English or Arabic</span>
            )}
            <span className="jadwal-style-badge">
              {displayStyle.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
            </span>
          </div>
          {renderJadwalContent()}
        </>
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

export const JadwalParentView = ({ studentId, teacherName, teacherId, teacherProfiles, showAction, jadwalSettings }) => {
  const settings = Array.isArray(jadwalSettings) ? jadwalSettings[0] : jadwalSettings;
  const [scheduleData, setScheduleData] = useState(DEFAULT_SCHEDULE);
  const [studentName, setStudentName] = useState('Student');
  const [mode, setMode] = useState('juz-wise');
  const [loading, setLoading] = useState(true);

  const displayStyle = settings?.jadwal_style || 'table';
  const theme = getJadwalThemeFromSettings(settings);
  const dayDates = theme.weekStart ? DAYS.map((_, idx) => getDayDate(theme.weekStart, idx)) : [];

  useEffect(() => {
    if (studentId) {
      fetchJadwal();
    }
  }, [studentId]);

  const fetchJadwal = async () => {
    setLoading(true);

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
      const savedMode = data.schedule_data._mode || 'juz-wise';
      setMode(savedMode);
      setScheduleData({ ...DEFAULT_SCHEDULE, ...data.schedule_data, _mode: savedMode });
    } else {
      setScheduleData(DEFAULT_SCHEDULE);
    }
    setLoading(false);
  };

  const renderJadwalContent = () => {
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
          />
        );
    }
  };

  if (loading) return <div className="loading-spinner">Loading Jadwal...</div>;

  return (
    <div className="jadwal-container parent-view">
      <div className="jadwal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>Weekly Jadwal Schedule</h2>
        <button
          className="jadwal-save-btn"
          onClick={() => handleDownloadPDF(studentName, scheduleData, mode, theme)}
        >
          <Download size={16} /> Download PDF
        </button>
      </div>
      {renderJadwalContent()}

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
