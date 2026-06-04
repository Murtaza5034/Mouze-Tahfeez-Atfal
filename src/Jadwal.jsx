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

const SURAH_AYAH_DATA = [
  { number: 1, nameEn: 'Al-Fatiha', nameAr: 'الفاتحة', ayahCount: 7 },
  { number: 2, nameEn: "Al-Baqarah", nameAr: 'البقرة', ayahCount: 286 },
  { number: 3, nameEn: "Aal-e-Imran", nameAr: 'آل عمران', ayahCount: 200 },
  { number: 4, nameEn: "An-Nisa", nameAr: 'النساء', ayahCount: 176 },
  { number: 5, nameEn: "Al-Ma'idah", nameAr: 'المائدة', ayahCount: 120 },
  { number: 6, nameEn: "Al-An'am", nameAr: 'الأنعام', ayahCount: 165 },
  { number: 7, nameEn: "Al-A'raf", nameAr: 'الأعراف', ayahCount: 206 },
  { number: 8, nameEn: "Al-Anfal", nameAr: 'الأنفال', ayahCount: 75 },
  { number: 9, nameEn: "At-Tawbah", nameAr: 'التوبة', ayahCount: 129 },
  { number: 10, nameEn: "Yunus", nameAr: 'يونس', ayahCount: 109 },
  { number: 11, nameEn: "Hud", nameAr: 'هود', ayahCount: 123 },
  { number: 12, nameEn: "Yusuf", nameAr: 'يوسف', ayahCount: 111 },
  { number: 13, nameEn: "Ar-Ra'd", nameAr: 'الرعد', ayahCount: 43 },
  { number: 14, nameEn: "Ibrahim", nameAr: 'إبراهيم', ayahCount: 52 },
  { number: 15, nameEn: "Al-Hijr", nameAr: 'الحجر', ayahCount: 99 },
  { number: 16, nameEn: "An-Nahl", nameAr: 'النحل', ayahCount: 128 },
  { number: 17, nameEn: "Al-Isra", nameAr: 'الإسراء', ayahCount: 111 },
  { number: 18, nameEn: "Al-Kahf", nameAr: 'الكهف', ayahCount: 110 },
  { number: 19, nameEn: "Maryam", nameAr: 'مريم', ayahCount: 98 },
  { number: 20, nameEn: "Ta-Ha", nameAr: 'طه', ayahCount: 135 },
  { number: 21, nameEn: "Al-Anbiya", nameAr: 'الأنبياء', ayahCount: 112 },
  { number: 22, nameEn: "Al-Hajj", nameAr: 'الحج', ayahCount: 78 },
  { number: 23, nameEn: "Al-Mu'minun", nameAr: 'المؤمنون', ayahCount: 118 },
  { number: 24, nameEn: "An-Nur", nameAr: 'النور', ayahCount: 64 },
  { number: 25, nameEn: "Al-Furqan", nameAr: 'الفرقان', ayahCount: 77 },
  { number: 26, nameEn: "Ash-Shu'ara", nameAr: 'الشعراء', ayahCount: 227 },
  { number: 27, nameEn: "An-Naml", nameAr: 'النمل', ayahCount: 93 },
  { number: 28, nameEn: "Al-Qasas", nameAr: 'القصص', ayahCount: 88 },
  { number: 29, nameEn: "Al-Ankabut", nameAr: 'العنكبوت', ayahCount: 69 },
  { number: 30, nameEn: "Ar-Rum", nameAr: 'الروم', ayahCount: 60 },
  { number: 31, nameEn: "Luqman", nameAr: 'لقمان', ayahCount: 34 },
  { number: 32, nameEn: "As-Sajdah", nameAr: 'السجدة', ayahCount: 30 },
  { number: 33, nameEn: "Al-Ahzab", nameAr: 'الأحزاب', ayahCount: 73 },
  { number: 34, nameEn: "Saba", nameAr: 'سبأ', ayahCount: 54 },
  { number: 35, nameEn: "Fatir", nameAr: 'فاطر', ayahCount: 45 },
  { number: 36, nameEn: "Ya-Sin", nameAr: 'يس', ayahCount: 83 },
  { number: 37, nameEn: "As-Saffat", nameAr: 'الصافات', ayahCount: 182 },
  { number: 38, nameEn: "Sad", nameAr: 'ص', ayahCount: 88 },
  { number: 39, nameEn: "Az-Zumar", nameAr: 'الزمر', ayahCount: 75 },
  { number: 40, nameEn: "Ghafir", nameAr: 'غافر', ayahCount: 85 },
  { number: 41, nameEn: "Fussilat", nameAr: 'فصلت', ayahCount: 54 },
  { number: 42, nameEn: "Ash-Shura", nameAr: 'الشورى', ayahCount: 53 },
  { number: 43, nameEn: "Az-Zukhruf", nameAr: 'الزخرف', ayahCount: 89 },
  { number: 44, nameEn: "Ad-Dukhan", nameAr: 'الدخان', ayahCount: 59 },
  { number: 45, nameEn: "Al-Jathiyah", nameAr: 'الجاثية', ayahCount: 37 },
  { number: 46, nameEn: "Al-Ahqaf", nameAr: 'الأحقاف', ayahCount: 35 },
  { number: 47, nameEn: "Muhammad", nameAr: 'محمد', ayahCount: 38 },
  { number: 48, nameEn: "Al-Fath", nameAr: 'الفتح', ayahCount: 29 },
  { number: 49, nameEn: "Al-Hujurat", nameAr: 'الحجرات', ayahCount: 18 },
  { number: 50, nameEn: "Qaf", nameAr: 'ق', ayahCount: 45 },
  { number: 51, nameEn: "Adh-Dhariyat", nameAr: 'الذاريات', ayahCount: 60 },
  { number: 52, nameEn: "At-Tur", nameAr: 'الطور', ayahCount: 49 },
  { number: 53, nameEn: "An-Najm", nameAr: 'النجم', ayahCount: 62 },
  { number: 54, nameEn: "Al-Qamar", nameAr: 'القمر', ayahCount: 55 },
  { number: 55, nameEn: "Ar-Rahman", nameAr: 'الرحمن', ayahCount: 78 },
  { number: 56, nameEn: "Al-Waqi'ah", nameAr: 'الواقعة', ayahCount: 96 },
  { number: 57, nameEn: "Al-Hadid", nameAr: 'الحديد', ayahCount: 29 },
  { number: 58, nameEn: "Al-Mujadilah", nameAr: 'المجادلة', ayahCount: 22 },
  { number: 59, nameEn: "Al-Hashr", nameAr: 'الحشر', ayahCount: 24 },
  { number: 60, nameEn: "Al-Mumtahanah", nameAr: 'الممتحنة', ayahCount: 13 },
  { number: 61, nameEn: "As-Saff", nameAr: 'الصف', ayahCount: 14 },
  { number: 62, nameEn: "Al-Jumu'ah", nameAr: 'الجمعة', ayahCount: 11 },
  { number: 63, nameEn: "Al-Munafiqun", nameAr: 'المنافقون', ayahCount: 11 },
  { number: 64, nameEn: "At-Taghabun", nameAr: 'التغابن', ayahCount: 18 },
  { number: 65, nameEn: "At-Talaq", nameAr: 'الطلاق', ayahCount: 12 },
  { number: 66, nameEn: "At-Tahrim", nameAr: 'التحريم', ayahCount: 12 },
  { number: 67, nameEn: "Al-Mulk", nameAr: 'الملك', ayahCount: 30 },
  { number: 68, nameEn: "Al-Qalam", nameAr: 'القلم', ayahCount: 52 },
  { number: 69, nameEn: "Al-Haqqah", nameAr: 'الحاقة', ayahCount: 52 },
  { number: 70, nameEn: "Al-Ma'arij", nameAr: 'المعارج', ayahCount: 44 },
  { number: 71, nameEn: "Nuh", nameAr: 'نوح', ayahCount: 28 },
  { number: 72, nameEn: "Al-Jinn", nameAr: 'الجن', ayahCount: 28 },
  { number: 73, nameEn: "Al-Muzzammil", nameAr: 'المزمل', ayahCount: 20 },
  { number: 74, nameEn: "Al-Muddaththir", nameAr: 'المدثر', ayahCount: 56 },
  { number: 75, nameEn: "Al-Qiyamah", nameAr: 'القيامة', ayahCount: 40 },
  { number: 76, nameEn: "Al-Insan", nameAr: 'الإنسان', ayahCount: 31 },
  { number: 77, nameEn: "Al-Mursalat", nameAr: 'المرسلات', ayahCount: 50 },
  { number: 78, nameEn: "An-Naba", nameAr: 'النبأ', ayahCount: 40 },
  { number: 79, nameEn: "An-Nazi'at", nameAr: 'النازعات', ayahCount: 46 },
  { number: 80, nameEn: "Abasa", nameAr: 'عبس', ayahCount: 42 },
  { number: 81, nameEn: "At-Takwir", nameAr: 'التكوير', ayahCount: 29 },
  { number: 82, nameEn: "Al-Infitar", nameAr: 'الإنفطار', ayahCount: 19 },
  { number: 83, nameEn: "Al-Mutaffifin", nameAr: 'المطففين', ayahCount: 36 },
  { number: 84, nameEn: "Al-Inshiqaq", nameAr: 'الإنشقاق', ayahCount: 25 },
  { number: 85, nameEn: "Al-Buruj", nameAr: 'البروج', ayahCount: 22 },
  { number: 86, nameEn: "At-Tariq", nameAr: 'الطارق', ayahCount: 17 },
  { number: 87, nameEn: "Al-Ala", nameAr: 'الأعلى', ayahCount: 19 },
  { number: 88, nameEn: "Al-Ghashiyah", nameAr: 'الغاشية', ayahCount: 26 },
  { number: 89, nameEn: "Al-Fajr", nameAr: 'الفجر', ayahCount: 30 },
  { number: 90, nameEn: "Al-Balad", nameAr: 'البلد', ayahCount: 20 },
  { number: 91, nameEn: "Ash-Shams", nameAr: 'الشمس', ayahCount: 15 },
  { number: 92, nameEn: "Al-Layl", nameAr: 'الليل', ayahCount: 21 },
  { number: 93, nameEn: "Ad-Duha", nameAr: 'الضحى', ayahCount: 11 },
  { number: 94, nameEn: "Ash-Sharh", nameAr: 'الشرح', ayahCount: 8 },
  { number: 95, nameEn: "At-Tin", nameAr: 'التين', ayahCount: 8 },
  { number: 96, nameEn: "Al-Alaq", nameAr: 'العلق', ayahCount: 19 },
  { number: 97, nameEn: "Al-Qadr", nameAr: 'القدر', ayahCount: 5 },
  { number: 98, nameEn: "Al-Bayyinah", nameAr: 'البينة', ayahCount: 8 },
  { number: 99, nameEn: "Az-Zalzalah", nameAr: 'الزلزلة', ayahCount: 8 },
  { number: 100, nameEn: "Al-Adiyat", nameAr: 'العاديات', ayahCount: 11 },
  { number: 101, nameEn: "Al-Qari'ah", nameAr: 'القارعة', ayahCount: 11 },
  { number: 102, nameEn: "At-Takathur", nameAr: 'التكاثر', ayahCount: 8 },
  { number: 103, nameEn: "Al-Asr", nameAr: 'العصر', ayahCount: 3 },
  { number: 104, nameEn: "Al-Humazah", nameAr: 'الهمزة', ayahCount: 9 },
  { number: 105, nameEn: "Al-Fil", nameAr: 'الفيل', ayahCount: 5 },
  { number: 106, nameEn: "Quraysh", nameAr: 'قريش', ayahCount: 4 },
  { number: 107, nameEn: "Al-Ma'un", nameAr: 'الماعون', ayahCount: 7 },
  { number: 108, nameEn: "Al-Kawthar", nameAr: 'الكوثر', ayahCount: 3 },
  { number: 109, nameEn: "Al-Kafirun", nameAr: 'الكافرون', ayahCount: 6 },
  { number: 110, nameEn: "An-Nasr", nameAr: 'النصر', ayahCount: 3 },
  { number: 111, nameEn: "Al-Masad", nameAr: 'المسد', ayahCount: 5 },
  { number: 112, nameEn: "Al-Ikhlas", nameAr: 'الإخلاص', ayahCount: 4 },
  { number: 113, nameEn: "Al-Falaq", nameAr: 'الفلق', ayahCount: 5 },
  { number: 114, nameEn: "An-Nas", nameAr: 'الناس', ayahCount: 6 },
];

const SURAH_PAGE_MAP = {
  1:1,2:2,3:50,4:77,5:106,6:128,7:151,8:177,9:187,10:208,
  11:221,12:235,13:249,14:255,15:262,16:267,17:282,18:293,
  19:305,20:312,21:322,22:332,23:342,24:350,25:359,26:367,
  27:377,28:385,29:396,30:404,31:410,32:415,33:417,34:428,
  35:434,36:440,37:446,38:453,39:458,40:467,41:477,42:483,
  43:489,44:496,45:499,46:502,47:507,48:511,49:515,50:518,
  51:520,52:523,53:526,54:528,55:531,56:534,57:537,58:542,
  59:545,60:549,61:551,62:553,63:554,64:556,65:558,66:559,
  67:562,68:564,69:566,70:568,71:570,72:572,73:574,74:575,
  75:577,76:578,77:580,78:582,79:583,80:585,81:586,82:587,
  83:587,84:589,85:590,86:591,87:591,88:592,89:593,90:594,
  91:595,92:595,93:596,94:596,95:597,96:597,97:598,98:598,
  99:599,100:599,101:600,102:600,103:601,104:601,105:601,
  106:602,107:602,108:602,109:603,110:603,111:603,112:604,
  113:604,114:604
};

const getSurahPage = (surahNum) => SURAH_PAGE_MAP[Number(surahNum)] || 1;

const getAyahPage = (surahNum, ayahNum) => {
  const idx = SURAH_AYAH_DATA.findIndex(s => s.number === Number(surahNum));
  if (idx === -1) return 1;
  const surah = SURAH_AYAH_DATA[idx];
  const startPage = getSurahPage(surahNum);
  const endPage = idx < SURAH_AYAH_DATA.length - 1
    ? getSurahPage(SURAH_AYAH_DATA[idx + 1].number) - 1
    : 604;
  const totalPages = endPage - startPage + 1;
  const aN = Math.min(Math.max(1, Number(ayahNum)), surah.ayahCount);
  const pageOffset = Math.floor(((aN - 1) / surah.ayahCount) * totalPages);
  return Math.min(startPage + pageOffset, endPage);
};

const JUZ_PAGE_MAP = [1,22,42,62,82,102,122,142,162,182,202,222,242,262,282,302,322,342,362,382,402,422,442,462,482,502,522,542,562,582];

const getJuzFromPage = (page) => {
  for (let j = JUZ_PAGE_MAP.length - 1; j >= 0; j--) {
    if (page >= JUZ_PAGE_MAP[j]) return j + 1;
  }
  return 1;
};

const JuzhaliPicker = ({ value, onChange, jadeedValue }) => {
  const jadeedParts = (jadeedValue || '').split(':');
  const jadeedSurah = jadeedParts[0];
  const jadeedAyah = jadeedParts[1];
  const jadeedAyahPage = jadeedSurah && jadeedAyah ? getAyahPage(jadeedSurah, jadeedAyah) : 0;
  const juz = getJuzFromPage(jadeedAyahPage);
  const isLastFiveJuz = juz >= 26;
  const rangeStart = isLastFiveJuz ? Math.min(604, jadeedAyahPage + 1) : Math.max(1, jadeedAyahPage - 10);
  const rangeEnd = isLastFiveJuz ? Math.min(604, jadeedAyahPage + 10) : Math.max(1, jadeedAyahPage - 1);
  const pages = [];
  for (let p = rangeStart; p <= rangeEnd; p++) {
    pages.push(p);
  }

  const parts = (value || '').split(':');
  const fromVal = parts[0] || '';
  const toVal = parts[1] || '';

  const valid = fromVal && toVal && Number(fromVal) <= Number(toVal);

  const handleFrom = (e) => {
    const f = e.target.value;
    const t = toVal && Number(toVal) >= Number(f) ? toVal : f;
    onChange(f && t ? `${f}:${t}` : '');
  };

  const handleTo = (e) => {
    const t = e.target.value;
    const f = fromVal && Number(fromVal) <= Number(t) ? fromVal : t;
    onChange(f && t ? `${f}:${t}` : '');
  };

  return (
    <div className="jadwal-jadeed-picker" style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
      <select
        value={fromVal}
        onChange={handleFrom}
        style={{
          padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--border-color, #d4af37)',
          background: '#fff', fontSize: '12px', minWidth: '90px',
        }}
      >
        <option value="">From</option>
        {pages.map(p => (
          <option key={p} value={String(p)}>Page {p}</option>
        ))}
      </select>
      <span style={{ fontSize: '12px', color: 'var(--soft-brown)' }}>–</span>
      <select
        value={toVal}
        onChange={handleTo}
        style={{
          padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--border-color, #d4af37)',
          background: '#fff', fontSize: '12px', minWidth: '90px',
        }}
      >
        <option value="">To</option>
        {pages.filter(p => !fromVal || Number(p) >= Number(fromVal)).map(p => (
          <option key={p} value={String(p)}>Page {p}</option>
        ))}
      </select>
    </div>
  );
};

const formatJuzhali = (val) => {
  if (!val) return '-';
  const parts = val.split(':');
  if (parts.length === 2 && parts[0] && parts[1]) {
    return `${parts[0]}-${parts[1]}`;
  }
  return val;
};

const formatJadeed = (val) => {
  if (!val) return '-';
  const parts = val.split(':');
  if (parts.length === 2 && parts[0] && parts[1]) {
    const surah = SURAH_AYAH_DATA.find(s => s.number === Number(parts[0]));
    const surahName = surah ? surah.nameEn : parts[0];
    return `${surahName}:${parts[1]}`;
  }
  return val;
};

const JadeedPicker = ({ value, onChange }) => {
  const parts = (value || '').split(':');
  const [surahNum, setSurahNum] = useState(parts[0] || '');
  const [ayahNum, setAyahNum] = useState(parts[1] || '');

  useEffect(() => {
    const p = (value || '').split(':');
    setSurahNum(p[0] || '');
    setAyahNum(p[1] || '');
  }, [value]);

  const surah = SURAH_AYAH_DATA.find(s => String(s.number) === surahNum);
  const ayahCount = surah?.ayahCount || 0;

  const handleSurah = (e) => {
    const num = e.target.value;
    setSurahNum(num);
    setAyahNum('1');
    onChange(num ? `${num}:1` : '');
  };

  const handleAyah = (e) => {
    const ayah = e.target.value;
    setAyahNum(ayah);
    onChange(surahNum ? `${surahNum}:${ayah}` : '');
  };

  return (
    <div className="jadwal-jadeed-picker">
      <select
        value={surahNum}
        onChange={handleSurah}
        style={{
          padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--border-color, #d4af37)',
          background: '#fff', fontSize: '12px', minWidth: '120px', fontFamily: "'Kanz al Marjaan', serif",
          direction: (surahNum && SURAH_AYAH_DATA.find(s => String(s.number) === surahNum)?.nameAr) ? 'rtl' : 'ltr',
        }}
      >
        <option value="" style={{ direction: 'ltr' }}>-- Surah --</option>
        {SURAH_AYAH_DATA.map(s => (
          <option key={s.number} value={String(s.number)}>
            {s.number}. {s.nameAr}
          </option>
        ))}
      </select>
      <select
        value={ayahNum}
        onChange={handleAyah}
        disabled={!surahNum}
        style={{
          padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--border-color, #d4af37)',
          background: '#fff', fontSize: '12px', minWidth: '70px',
        }}
      >
        <option value="">Ayah</option>
        {ayahCount > 0 && Array.from({ length: ayahCount }, (_, i) => (
          <option key={i + 1} value={String(i + 1)}>{i + 1}</option>
        ))}
      </select>
    </div>
  );
};

const handleDownloadPDF = async (studentName, scheduleData, mode = 'juz-wise', theme = {}, style = 'table', dayDates = []) => {
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

  const fatemiDates = pdfDays.map((_, idx) => {
    if (dayDates && dayDates[idx]) return dayDates[idx];
    const dayIdx = DAYS.indexOf(pdfDays[idx]);
    if (dayIdx === -1) return '';
    const now = new Date();
    const monday = new Date(now);
    monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    const d = new Date(monday);
    d.setDate(d.getDate() + dayIdx);
    return getFatemiDateStr(d.toISOString().split('T')[0]);
  });

  const containerWidth = style === 'calendar' ? 1100 : 850;
  const bgImageStyle = t.backgroundUrl
    ? `background-image: url('${t.backgroundUrl}'); background-size: cover; background-position: center; background-repeat: no-repeat;`
    : '';

  const contentCss = "font-family: 'Al-Kanz', 'Segoe UI', sans-serif; font-size: 14px; line-height: 1.6; direction: ltr;";
  const jadeedCss = "font-family: 'Kanz al Marjaan', serif; font-size: 14px; line-height: 1.6; direction: rtl;";

  const buildCardHtml = (day, idx) => {
    const row = scheduleData[day] || {};
    if (style === 'calendar') {
      const stars = row.star ? '\u2B50'.repeat(parseInt(row.star)) : '-';
      return `
        <div style="flex: 1 1 calc(33.33% - 20px); min-width: 300px;  border: 1.5px solid ${t.accentColor}; border-radius: 14px; padding: 18px; background: ${idx % 2 === 0 ? '#fff' : `${t.backgroundColor}f2`}; box-sizing: border-box;">
          <div style="border-bottom: 2px solid ${t.accentColor}; padding-bottom: 10px; margin-bottom: 12px;">
            <div style="font-size: 16px; font-weight: 800; color: ${t.primaryColor}; letter-spacing: 0.5px; text-transform: uppercase;">${day}</div>
            <div style="font-family: 'Kanz al Marjaan', serif; font-size: 13px; color: ${t.accentColor}; margin-top: 4px; direction: rtl;">${fatemiDates[idx]}</div>
          </div>
          ${mode === 'juz-wise'
            ? ['juz1', 'juz2', 'juz3', 'juz4'].map(juz => {
                const label = juz.charAt(0).toUpperCase() + juz.slice(1).replace(/\d/, ' $&');
                return `<div style="display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid rgba(212, 175, 55, 0.15);">
                  <span style="font-size: 11px; font-weight: 600; color: ${t.accentColor}; text-transform: uppercase; letter-spacing: 0.5px;">${label}</span>
                  <span style="${contentCss} font-size: 14px; font-weight: 500; color: #333;">${row[juz] || '-'}</span>
                </div>`;
              }).join('')
            : `<div style="display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid rgba(212, 175, 55, 0.15);">
              <span style="font-size: 11px; font-weight: 600; color: ${t.accentColor}; text-transform: uppercase; letter-spacing: 0.5px;">MURAJAH</span>
              <span style="${contentCss} font-size: 14px; font-weight: 500; color: #333;">${row.murajah || '-'}</span>
            </div>`
          }
          <div style="display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid rgba(212, 175, 55, 0.15);">
            <span style="font-size: 11px; font-weight: 600; color: ${t.accentColor}; text-transform: uppercase; letter-spacing: 0.5px;">JADEED</span>
            <span style="${jadeedCss} color: #333;">${formatJadeed(row.jadeed)}</span>
          </div>
          <div style="display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid rgba(212, 175, 55, 0.15);">
            <span style="font-size: 11px; font-weight: 600; color: ${t.accentColor}; text-transform: uppercase; letter-spacing: 0.5px;">JUZHALI</span>
            <span style="${contentCss} font-size: 14px; font-weight: 500; color: #333;">${formatJuzhali(row.juzhali)}</span>
          </div>
          <div style="display: flex; justify-content: space-between; padding: 6px 0;">
            <span style="font-size: 11px; font-weight: 600; color: ${t.accentColor}; text-transform: uppercase; letter-spacing: 0.5px;">STAR</span>
            <span style="font-size: 16px; color: #FFD700; letter-spacing: 1px;">${stars}</span>
          </div>
        </div>`;
    }
    const stars = row.star ? '\u2B50'.repeat(parseInt(row.star)) : '-';
    const bg = idx % 2 === 0 ? t.backgroundColor : `${t.backgroundColor}f2`;
    const dayTd = `<td style="padding: 12px 14px; border: 1px solid ${t.accentColor}; font-weight: bold; font-size: 13px; color: ${t.primaryColor}; text-align: left;">${day}<div style="font-family: 'Kanz al Marjaan', serif; font-size: 11px; color: ${t.accentColor}; margin-top: 4px; direction: rtl;">${fatemiDates[idx]}</div></td>`;
    const starTd = `<td style="padding: 12px 14px; border: 1px solid ${t.accentColor}; font-size: 16px; color: #FFD700; text-align: center; letter-spacing: 1px;">${stars}</td>`;
    const tdStyle = `style="padding: 12px 14px; border: 1px solid ${t.accentColor}; font-size: 14px; color: #333; text-align: center; font-weight: 500; ${contentCss}"`;
    const jadeedTdStyle = `style="padding: 12px 14px; border: 1px solid ${t.accentColor}; font-size: 14px; color: #333; text-align: center; font-weight: 500; ${jadeedCss}"`;
    if (mode === 'juz-wise') {
      return `<tr style="background: ${bg};">${dayTd}`
        + `<td ${tdStyle}>${row.juz1 || '-'}</td>`
        + `<td ${tdStyle}>${row.juz2 || '-'}</td>`
        + `<td ${tdStyle}>${row.juz3 || '-'}</td>`
        + `<td ${tdStyle}>${row.juz4 || '-'}</td>`
        + `<td ${jadeedTdStyle}>${formatJadeed(row.jadeed)}</td>`
        + `<td ${tdStyle}>${formatJuzhali(row.juzhali)}</td>`
        + `${starTd}</tr>`;
    }
    return `<tr style="background: ${bg};">${dayTd}`
      + `<td ${tdStyle}>${row.murajah || '-'}</td>`
      + `<td ${jadeedTdStyle}>${formatJadeed(row.jadeed)}</td>`
      + `<td ${tdStyle}>${formatJuzhali(row.juzhali)}</td>`
      + `${starTd}</tr>`;
  };

  const pageFrameHtml = (inner) => `
    <div style="border: 2px solid ${t.accentColor}; border-radius: 16px; padding: 30px; background: ${t.backgroundColor}; box-sizing: border-box; ${bgImageStyle}">
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid ${t.accentColor}; padding-bottom: 20px; margin-bottom: 25px;">
        <div>
          <h1 style="margin: 0; font-size: 26px; color: ${t.primaryColor}; font-family: 'Cinzel', serif; font-weight: bold; letter-spacing: 1px;">MAUZE TAHFEEZ ATFAL</h1>
           <p style="margin: 5px 0 0 0; font-size: 14px; color: ${t.accentColor}; font-weight: 600; letter-spacing: 0.5px;">${t.jadwalType === 'miqaat' ? 'Miqaāt' : 'Weekly'} Quran Jadwal (Timetable)</p>
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
      ${inner}
      <div style="margin-top: 35px; border-top: 1px dashed ${t.accentColor}; padding-top: 15px; text-align: center;">
        <p style="margin: 0; font-size: 12px; color: ${t.accentColor}; font-style: italic; font-weight: 600;">
          "And We have indeed made the Quran easy to understand and remember..."
        </p>
      </div>
    </div>`;

  const tableHeaders = mode === 'juz-wise'
    ? `<tr style="background: ${t.primaryColor}; color: #ffffff;">`
      + `<th style="padding: 10px 14px; border: 1px solid ${t.accentColor}; font-size: 11px; text-transform: uppercase; font-weight: bold; text-align: left; width: 120px;">DAYS</th>`
      + `<th style="padding: 10px 14px; border: 1px solid ${t.accentColor}; font-size: 11px; text-transform: uppercase; font-weight: bold; text-align: center;">MUR 1</th>`
      + `<th style="padding: 10px 14px; border: 1px solid ${t.accentColor}; font-size: 11px; text-transform: uppercase; font-weight: bold; text-align: center;">MUR 2</th>`
      + `<th style="padding: 10px 14px; border: 1px solid ${t.accentColor}; font-size: 11px; text-transform: uppercase; font-weight: bold; text-align: center;">MUR 3</th>`
      + `<th style="padding: 10px 14px; border: 1px solid ${t.accentColor}; font-size: 11px; text-transform: uppercase; font-weight: bold; text-align: center;">MUR 4</th>`
      + `<th style="padding: 10px 14px; border: 1px solid ${t.accentColor}; font-size: 11px; text-transform: uppercase; font-weight: bold; text-align: center;">JADEED</th>`
      + `<th style="padding: 10px 14px; border: 1px solid ${t.accentColor}; font-size: 11px; text-transform: uppercase; font-weight: bold; text-align: center;">JUZHALI</th>`
      + `<th style="padding: 10px 14px; border: 1px solid ${t.accentColor}; font-size: 11px; text-transform: uppercase; font-weight: bold; text-align: center; width: 90px;">STAR</th>`
      + '</tr>'
    : `<tr style="background: ${t.primaryColor}; color: #ffffff;">`
      + `<th style="padding: 10px 14px; border: 1px solid ${t.accentColor}; font-size: 11px; text-transform: uppercase; font-weight: bold; text-align: left; width: 120px;">DAYS</th>`
      + `<th style="padding: 10px 14px; border: 1px solid ${t.accentColor}; font-size: 11px; text-transform: uppercase; font-weight: bold; text-align: center;">MURAJAH</th>`
      + `<th style="padding: 10px 14px; border: 1px solid ${t.accentColor}; font-size: 11px; text-transform: uppercase; font-weight: bold; text-align: center;">JADEED</th>`
      + `<th style="padding: 10px 14px; border: 1px solid ${t.accentColor}; font-size: 11px; text-transform: uppercase; font-weight: bold; text-align: center;">JUZHALI</th>`
      + `<th style="padding: 10px 14px; border: 1px solid ${t.accentColor}; font-size: 11px; text-transform: uppercase; font-weight: bold; text-align: center; width: 90px;">STAR</th>`
      + '</tr>';

  // Load fonts first, with timeout
  try {
    await Promise.race([
      document.fonts.ready,
      new Promise(resolve => setTimeout(resolve, 5000)),
    ]);
    const kanzFamily = ['Kanz al Marjaan', 'Al-Kanz'];
    for (const family of kanzFamily) {
      if (!document.fonts.check('1em "' + family + '"', 'abcdefghijklmnopqrstuvwxyz0123456789')) {
        const fontSrc = family === 'Kanz al Marjaan'
          ? "url(/Kanz%20al%20Marjaan/kanz-al-marjaan-webfont.woff2) format('woff2'),url(/Kanz%20al%20Marjaan/kanz-al-marjaan-webfont.woff) format('woff'),url(/Kanz%20al%20Marjaan/kanz-al-marjaan-webfont.ttf) format('truetype')"
          : "url(/fonts/al-kanz.ttf) format('truetype')";
        const ff = new FontFace(family, fontSrc);
        await Promise.race([ff.load(), new Promise(resolve => setTimeout(resolve, 5000))]);
        document.fonts.add(ff);
      }
    }
    await Promise.race([
      document.fonts.ready,
      new Promise(resolve => setTimeout(resolve, 5000)),
    ]);
  } catch (e) {
    console.warn('Custom font loading for Jadwal PDF failed:', e);
  }

  const allCards = pdfDays.map((_, idx) => buildCardHtml(pdfDays[idx], idx));

  // Measure-based page splitting for both styles
  const measureEl = document.createElement("div");
  measureEl.style.cssText = `position:absolute;left:-9999px;top:-9999px;width:${containerWidth}px;padding:40px;background:${t.backgroundColor};font-family:'Inter','Segoe UI',sans-serif;color:#2c1e11;`;
  document.body.appendChild(measureEl);

  const pageLimit = containerWidth * (297 / 210);
  let pageGroups = [];
  let currentGroup = [];
  if (style === 'calendar') {
    for (const card of allCards) {
      measureEl.innerHTML = pageFrameHtml(`<div style="display:flex;flex-wrap:wrap;gap:20px;margin-top:20px;">${[...currentGroup, card].join('')}</div>`);
      if (measureEl.scrollHeight > pageLimit && currentGroup.length > 0) {
        pageGroups.push([...currentGroup]);
        currentGroup = [card];
      } else {
        currentGroup.push(card);
      }
    }
  } else {
    for (const card of allCards) {
      measureEl.innerHTML = pageFrameHtml(`<table style="width:100%;border-collapse:collapse;margin-top:10px;border-radius:8px;overflow:hidden;"><thead>${tableHeaders}</thead><tbody>${[...currentGroup, card].join('')}</tbody></table>`);
      if (measureEl.scrollHeight > pageLimit && currentGroup.length > 0) {
        pageGroups.push([...currentGroup]);
        currentGroup = [card];
      } else {
        currentGroup.push(card);
      }
    }
  }
  if (currentGroup.length > 0) pageGroups.push(currentGroup);
  document.body.removeChild(measureEl);

  // Render each page group as a separate html2canvas → PDF page
  const pdf = new jsPDF({ orientation: "p", unit: "mm", format: "a4" });

  for (let pi = 0; pi < pageGroups.length; pi++) {
    const group = pageGroups[pi];
    const container = document.createElement("div");
    container.style.cssText = `position:absolute;left:-9999px;top:-9999px;width:${containerWidth}px;padding:40px;background:${t.backgroundColor};font-family:'Inter','Segoe UI',sans-serif;color:#2c1e11;`;
    if (style === 'calendar') {
      container.innerHTML = pageFrameHtml(`<div style="display:flex;flex-wrap:wrap;gap:20px;margin-top:20px;">${group.join('')}</div>`);
    } else {
      container.innerHTML = pageFrameHtml(`<table style="width:100%;border-collapse:collapse;margin-top:10px;border-radius:8px;overflow:hidden;"><thead>${tableHeaders}</thead><tbody>${group.join('')}</tbody></table>`);
    }
    document.body.appendChild(container);

    const canvas = await html2canvas(container, {
      scale: 3,
      useCORS: true,
      allowTaint: true,
      backgroundColor: t.backgroundColor,
      onclone: (clonedDoc) => {
        const style = clonedDoc.createElement('style');
        style.textContent = FONT_FACE_CSS;
        clonedDoc.head.appendChild(style);
      },
    });

    const imgData = canvas.toDataURL("image/png");
    if (pi > 0) pdf.addPage();
    pdf.addImage(imgData, "PNG", 0, 0, 210, (canvas.height * 210) / canvas.width);
    document.body.removeChild(container);
  }

  pdf.save(`${studentName.replace(/[^a-z0-9]/gi, '_')}_Jadwal.pdf`);
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
                <th rowSpan="2">Jadeed</th>
                <th rowSpan="2">Juzhali</th>
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
              <th>Jadeed</th>
              <th>Juzhali</th>
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
                  {['juz1', 'juz2', 'juz3', 'juz4'].map(juz => {
                    const label = juz.charAt(0).toUpperCase() + juz.slice(1).replace(/\d/, ' $&');
                    return (
                      <td key={juz} data-label={label}>
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
                    );
                  })}
                  <td data-label="Jadeed">
                    {readOnly ? (
                      <span>{scheduleData[day]?.jadeed || '-'}</span>
                    ) : (
                      <JadeedPicker
                        value={scheduleData[day]?.jadeed || ''}
                        onChange={(val) => onCellChange(day, 'jadeed', val)}
                      />
                    )}
                  </td>
                  <td data-label="Juzhali">
                    {readOnly ? (
                      <span>{formatJuzhali(scheduleData[day]?.juzhali)}</span>
                    ) : (
                      <JuzhaliPicker
                        value={scheduleData[day]?.juzhali || ''}
                        onChange={(val) => onCellChange(day, 'juzhali', val)}
                        jadeedValue={scheduleData[day]?.jadeed || ''}
                      />
                    )}
                  </td>
                </>
              ) : (
                <>
                  <td data-label="Murajah">
                    {readOnly ? (
                      <span>{scheduleData[day]?.murajah || '-'}</span>
                    ) : (
                      <input
                        type="text"
                        value={scheduleData[day]?.murajah || ''}
                        onChange={(e) => onCellChange(day, 'murajah', e.target.value)}
                        placeholder="-"
                        style={{ direction: /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/.test(scheduleData[day]?.murajah || '') ? 'rtl' : 'ltr' }}
                      />
                    )}
                  </td>
                  <td data-label="Jadeed">
                    {readOnly ? (
                      <span>{scheduleData[day]?.jadeed || '-'}</span>
                    ) : (
                      <JadeedPicker
                        value={scheduleData[day]?.jadeed || ''}
                        onChange={(val) => onCellChange(day, 'jadeed', val)}
                      />
                    )}
                  </td>
                  <td data-label="Juzhali">
                    {readOnly ? (
                      <span>{formatJuzhali(scheduleData[day]?.juzhali)}</span>
                    ) : (
                      <JuzhaliPicker
                        value={scheduleData[day]?.juzhali || ''}
                        onChange={(val) => onCellChange(day, 'juzhali', val)}
                        jadeedValue={scheduleData[day]?.jadeed || ''}
                      />
                    )}
                  </td>
                </>
              )}
              <td className="star-cell" data-label="Star">
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
          <div className="jadwal-calendar-field">
            <label>Jadeed</label>
            {readOnly ? (
              <span>{row.jadeed || '-'}</span>
            ) : (
              <JadeedPicker
                value={row.jadeed || ''}
                onChange={(val) => onCellChange(day, 'jadeed', val)}
              />
            )}
          </div>
          <div className="jadwal-calendar-field">
            <label>Juzhali</label>
            {readOnly ? (
              <span>{formatJuzhali(row.juzhali)}</span>
            ) : (
              <JuzhaliPicker
                value={row.juzhali || ''}
                onChange={(val) => onCellChange(day, 'juzhali', val)}
                jadeedValue={row.jadeed || ''}
              />
            )}
          </div>
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
          <div className="jadwal-calendar-field">
            <label>Jadeed</label>
            {readOnly ? (
              <span>{row.jadeed || '-'}</span>
            ) : (
              <JadeedPicker
                value={row.jadeed || ''}
                onChange={(val) => onCellChange(day, 'jadeed', val)}
              />
            )}
          </div>
          <div className="jadwal-calendar-field">
            <label>Juzhali</label>
            {readOnly ? (
              <span>{formatJuzhali(row.juzhali)}</span>
            ) : (
              <JuzhaliPicker
                value={row.juzhali || ''}
                onChange={(val) => onCellChange(day, 'juzhali', val)}
                jadeedValue={row.jadeed || ''}
              />
            )}
          </div>
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
  const [teacherDisplayStyle, setTeacherDisplayStyle] = useState(displayStyle);
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
            <div className="jadwal-actions-row">
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
onClick={() => handleDownloadPDF(studentName, scheduleData, mode, theme, teacherDisplayStyle, dayDates)}
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
          <div className="jadwal-mode-row">
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
            <select
              value={teacherDisplayStyle}
              onChange={(e) => setTeacherDisplayStyle(e.target.value)}
              className="jadwal-style-select"
            >
              <option value="table">Table</option>
              <option value="calendar">Calendar</option>
              <option value="single_day_card">Single Day Card</option>
            </select>
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
  const customDays = theme.jadwalType === 'miqaat' ? getDaysFromRange(theme.weekStart, theme.weekEnd) : null;

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
  };

  if (loading) return <div className="loading-spinner">Loading Jadwal...</div>;

  return (
    <div className="jadwal-container parent-view">
      <div className="jadwal-header">
        <h2>{theme.jadwalType === 'miqaat' ? "Miqaāt Jadwal Schedule" : "Weekly Jadwal Schedule"}</h2>
        <button
          className="jadwal-save-btn"
          onClick={() => handleDownloadPDF(studentName, scheduleData, mode, theme, displayStyle, dayDates)}
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
