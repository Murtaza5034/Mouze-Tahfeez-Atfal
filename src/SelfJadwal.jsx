import React, { useState, useEffect, useRef, useMemo } from 'react';
import { supabase } from './supabaseClient';
import { Download, Save, Loader2, ChevronLeft, ChevronRight, Calendar, BookOpen, Sparkles, Repeat, Calculator, Crown, Star, Award, Lock, Gem, Info } from 'lucide-react';
import { useFatemiCalendar, summarizeMiqaats } from './fatemiCalendarApi';
import MiqaatPopup from './MiqaatPopup';
import './jadwal.css';

const DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];

const getFatemiDateStr = (dateStr) => {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    const parts = new Intl.DateTimeFormat('en-u-ca-islamic-tbla-nu-latn', {
      day: 'numeric', month: 'numeric', year: 'numeric'
    }).formatToParts(date);
    let d = parseInt(parts.find(p => p.type === 'day').value);
    let m = parseInt(parts.find(p => p.type === 'month').value);
    let y = parseInt(parts.find(p => p.type === 'year').value);
    const arabicMonths = [
      "محرم الحرام", "صفر المظفر", "ربيع الأول", "ربيع الآخر",
      "جمادى الأولى", "جمادى الآخرة", "رجب الأصب", "شعبان الكريم",
      "رمضان المعظم", "شوال المكرم", "ذي القعدة الحرام", "ذي الحجة الحرام"
    ];
    if (m === 12 && d === 30) {
      return `1 ${arabicMonths[0]} ${y + 1}`;
    }
    if (m === 1) d++;
    return `${d} ${arabicMonths[m - 1] || ''} ${y}`;
  } catch { return ''; }
};

const getCurrentWeekRange = () => {
  const now = new Date();
  const today = now.getDay();
  let sat;
  if (today === 5) {
    sat = new Date(now);
    sat.setDate(now.getDate() + 1);
  } else {
    const daysBack = (today - 6 + 7) % 7;
    sat = new Date(now);
    sat.setDate(now.getDate() - daysBack);
  }
  const fri = new Date(sat);
  fri.setDate(sat.getDate() + 6);
  return { weekStart: sat.toISOString().split('T')[0], weekEnd: fri.toISOString().split('T')[0] };
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

const DEFAULT_SCHEDULE = {};
DAYS.forEach(day => {
  DEFAULT_SCHEDULE[day] = { juz1: '', juz2: '', juz3: '', juz4: '', murajah: '', juzhali: '', jadeed: '', star: '' };
});

const NO_VALUE = 'NO';

const getCellEdited = (editHistory, day, field) => {
  if (!editHistory) return false;
  const ts = editHistory[`${day}_${field}`];
  return ts && (Date.now() - new Date(ts).getTime() < 30000);
};

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
  let endPage = 604;
  if (idx < SURAH_AYAH_DATA.length - 1) {
    for (let i = idx + 1; i < SURAH_AYAH_DATA.length; i++) {
      const nextStart = getSurahPage(SURAH_AYAH_DATA[i].number);
      if (nextStart > startPage) {
        endPage = nextStart - 1;
        break;
      }
    }
  }
  const totalPages = Math.max(1, endPage - startPage + 1);
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

const toArabicNum = (n) => {
  const arabicDigits = '٠١٢٣٤٥٦٧٨٩';
  return String(n).replace(/\d/g, d => arabicDigits[d]);
};

const findSurahByName = (name) => {
  const clean = name.trim().replace(/^["']|["']$/g, '');
  if (!clean) return null;
  return SURAH_AYAH_DATA.find(s =>
    s.nameEn.toLowerCase() === clean.toLowerCase() || s.nameAr === clean
  );
};

const calcTotalPages = (row, mode) => {
  if (!row) return 0;
  let murajahPages = 0;
  if (mode === 'juz-wise') {
    ['juz1', 'juz2', 'juz3', 'juz4'].forEach(f => {
      if (row[f] && row[f].toString().trim()) murajahPages += 20;
    });
  } else {
    const val = (row.murajah || '').trim();
    if (val && val !== NO_VALUE) {
      const juzMatch = val.match(/[Jj]uz\s*(\d+)/);
      if (juzMatch) {
        murajahPages = 20;
      } else {
        const tilMatch = val.match(/(.+?)\s+til\s+(.+)/i);
        if (tilMatch) {
          const startSurah = findSurahByName(tilMatch[1]);
          const endSurah = findSurahByName(tilMatch[2]);
          if (startSurah && endSurah) {
            const startPage = SURAH_PAGE_MAP[startSurah.number] || 1;
            const endIdx = SURAH_AYAH_DATA.findIndex(s => s.number === endSurah.number);
            let endPage = 604;
            if (endIdx < SURAH_AYAH_DATA.length - 1) {
              const endStartPage = SURAH_PAGE_MAP[endSurah.number] || 1;
              for (let i = endIdx + 1; i < SURAH_AYAH_DATA.length; i++) {
                const nextStart = SURAH_PAGE_MAP[SURAH_AYAH_DATA[i].number];
                if (nextStart > endStartPage) {
                  endPage = nextStart - 1;
                  break;
                }
              }
            }
            const fromPage = Math.min(startPage, endPage);
            const toPage = Math.max(startPage, endPage);
            murajahPages = toPage - fromPage + 1;
          }
        } else {
          const surah = findSurahByName(val);
          if (surah) {
            const startPage = SURAH_PAGE_MAP[surah.number] || 1;
            const idx = SURAH_AYAH_DATA.findIndex(s => s.number === surah.number);
            let endPage = 604;
            if (idx < SURAH_AYAH_DATA.length - 1) {
              const endStartPage = SURAH_PAGE_MAP[surah.number] || 1;
              for (let i = idx + 1; i < SURAH_AYAH_DATA.length; i++) {
                const nextStart = SURAH_PAGE_MAP[SURAH_AYAH_DATA[i].number];
                if (nextStart > endStartPage) {
                  endPage = nextStart - 1;
                  break;
                }
              }
            }
            const fromPage = Math.min(startPage, endPage);
            const toPage = Math.max(startPage, endPage);
            murajahPages = toPage - fromPage + 1;
          }
        }
      }
    }
  }
  let juzhaliPages = 0;
  const juzhaliVal = (row.juzhali || '').trim();
  if (juzhaliVal && juzhaliVal !== NO_VALUE) {
    const tilMatch = juzhaliVal.match(/(.+?)\s+til\s+(.+)/i);
    if (tilMatch) {
      const startSurah = findSurahByName(tilMatch[1]);
      const endSurah = findSurahByName(tilMatch[2]);
      if (startSurah && endSurah) {
        const startPage = SURAH_PAGE_MAP[startSurah.number] || 1;
        const endIdx = SURAH_AYAH_DATA.findIndex(s => s.number === endSurah.number);
        let endPage = 604;
        if (endIdx < SURAH_AYAH_DATA.length - 1) {
          const endStartPage = SURAH_PAGE_MAP[endSurah.number] || 1;
          for (let i = endIdx + 1; i < SURAH_AYAH_DATA.length; i++) {
            const nextStart = SURAH_PAGE_MAP[SURAH_AYAH_DATA[i].number];
            if (nextStart > endStartPage) {
              endPage = nextStart - 1;
              break;
            }
          }
        }
        const fromPage = Math.min(startPage, endPage);
        const toPage = Math.max(startPage, endPage);
        juzhaliPages = toPage - fromPage + 1;
      }
    } else {
      const parts = juzhaliVal.split(':');
      if (parts.length === 2 && parts[0] && parts[1]) {
        const from = parseInt(parts[0]);
        const to = parseInt(parts[1]);
        if (!isNaN(from) && !isNaN(to) && to >= from) {
          juzhaliPages = to - from + 1;
        }
      }
    }
  }
  return murajahPages + juzhaliPages;
};

const formatMurajah = (val) => {
  if (!val) return '-';
  if (val === NO_VALUE) return 'NO';
  const parts = val.split(' til ');
  if (parts.length >= 2) {
    const from = findSurahByName(parts[0]);
    const till = findSurahByName(parts[1]);
    const fromName = from ? from.nameAr : parts[0];
    const tillName = till ? till.nameAr : parts[1];
    return `${fromName} إلى ${tillName}`;
  }
  const single = findSurahByName(val);
  return single ? single.nameAr : val;
};

const formatJadeed = (val) => {
  if (!val) return '-';
  if (val === NO_VALUE) return 'NO';
  const parts = val.split(':');
  if (parts.length === 2 && parts[0] && parts[1]) {
    const surah = SURAH_AYAH_DATA.find(s => s.number === Number(parts[0]));
    const surahName = surah ? surah.nameAr : parts[0];
    return `${surahName}: ${toArabicNum(parts[1])} آية`;
  }
  return val;
};

const formatJuzhali = (val) => {
  if (!val) return '-';
  if (val === NO_VALUE) return 'NO';
  if (val.includes(' til ')) {
    const parts = val.split(/\s+til\s+/i);
    const fromSurah = SURAH_AYAH_DATA.find(s => s.nameEn.toLowerCase() === parts[0].toLowerCase() || s.nameAr === parts[0]);
    const toSurah = SURAH_AYAH_DATA.find(s => s.nameEn.toLowerCase() === (parts[1] || '').toLowerCase() || s.nameAr === (parts[1] || ''));
    const fromName = fromSurah ? fromSurah.nameAr : parts[0];
    const toName = toSurah ? toSurah.nameAr : (parts[1] || '');
    return `${fromName} إلى ${toName}`;
  }
  const parts = val.split(':');
  if (parts.length === 2 && parts[0] && parts[1]) {
    return `${toArabicNum(parts[0])}-${toArabicNum(parts[1])} صــ`;
  }
  return `${toArabicNum(val)} صــ`;
};

const NoToggleButton = ({ value, onChange, label }) => {
  const isNo = value === NO_VALUE;
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onChange(isNo ? '' : NO_VALUE);
      }}
      title={isNo ? `Clear ${label}` : `Mark ${label} as not applicable`}
      style={{
        padding: '4px 10px',
        borderRadius: '6px',
        border: isNo ? '2px solid #c62828' : '1px solid #ccc',
        background: isNo ? '#ffebee' : '#f5f5f5',
        color: isNo ? '#c62828' : '#999',
        fontSize: '11px',
        fontWeight: isNo ? 800 : 500,
        cursor: 'pointer',
        fontFamily: 'Inter, sans-serif',
        letterSpacing: '0.5px',
        transition: 'all 0.15s ease',
        whiteSpace: 'nowrap',
        flexShrink: 0,
        lineHeight: 1,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'scale(1.05)';
        e.currentTarget.style.boxShadow = '0 2px 6px rgba(0,0,0,0.12)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'scale(1)';
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      {isNo ? '✕ NO' : 'NO'}
    </button>
  );
};

const JuzSelect = ({ value, onChange }) => (
  <select
    value={value || ''}
    onChange={(e) => onChange(e.target.value)}
    style={{
      padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--border-color, #d4af37)',
      background: '#fff', fontSize: '12px', fontFamily: "'Kanz al Marjaan', serif",
    }}
  >
    <option value="">-</option>
    {Array.from({ length: 30 }, (_, i) => (
      <option key={i + 1} value={String(i + 1)} style={{ fontFamily: "'Al-Kanz', 'Kanz al Marjaan', serif", direction: 'rtl' }}>{toArabicNum(i + 1)}</option>
    ))}
  </select>
);

const JadeedPicker = ({ value, onChange, defaultSurah }) => {
  const parts = (value || '').split(':');
  const [surahNum, setSurahNum] = useState(parts[0] || defaultSurah || '');
  const [ayahNum, setAyahNum] = useState(parts[1] || '');

  useEffect(() => {
    const p = (value || '').split(':');
    setSurahNum(p[0] || defaultSurah || '');
    setAyahNum(p[1] || '');
  }, [value, defaultSurah]);

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
    <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
      <select
        value={surahNum}
        onChange={handleSurah}
        style={{
          padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--border-color, #d4af37)',
          background: '#fff', fontSize: '12px', fontFamily: "'Kanz al Marjaan', serif",
          direction: (surahNum && SURAH_AYAH_DATA.find(s => String(s.number) === surahNum)?.nameAr) ? 'rtl' : 'ltr',
        }}
      >
        <option value="" style={{ direction: 'ltr' }}>-- Surah --</option>
        {SURAH_AYAH_DATA.map(s => (
          <option key={s.number} value={String(s.number)}>
            {s.nameAr}
          </option>
        ))}
      </select>
      <select
        value={ayahNum}
        onChange={handleAyah}
        disabled={!surahNum}
        style={{
          padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--border-color, #d4af37)',
          background: '#fff', fontSize: '12px',
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

const JuzhaliPicker = ({ value, onChange, jadeedValue, mode }) => {
  const jadeedParts = (jadeedValue || '').split(':');
  const jadeedSurah = jadeedParts[0];
  const jadeedAyah = jadeedParts[1];
  const jadeedSurahNum = parseInt(jadeedSurah);

  if (mode === 'surah-wise') {
    const parts = (value || '').split(/\s+til\s+/i);
    const fromSurah = parts[0] || '';
    const tillSurah = parts[1] || '';

    const startFrom = !isNaN(jadeedSurahNum) ? jadeedSurahNum : 0;
    const fromSurahs = SURAH_AYAH_DATA.filter(s => s.number > startFrom);
    const fromSurahObj = SURAH_AYAH_DATA.find(s => s.nameEn === fromSurah);
    const fromNum = fromSurahObj ? fromSurahObj.number : 0;

    const handleFrom = (e) => {
      const from = e.target.value;
      if (!from) { onChange(''); return; }
      onChange(from && tillSurah ? `${from} til ${tillSurah}` : `${from} til ${from}`);
    };

    const handleTill = (e) => {
      const till = e.target.value;
      if (!till) { onChange(''); return; }
      onChange(fromSurah && till ? `${fromSurah} til ${till}` : `${till} til ${till}`);
    };

    const selectStyle = {
      padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--border-color, #d4af37)',
      background: '#fff', fontSize: '12px', fontFamily: "'Kanz al Marjaan', serif",
    };

    return (
      <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
        <select value={fromSurah} onChange={handleFrom} style={selectStyle}>
          <option value="" style={{ direction: 'ltr' }}>From Sûrah</option>
          {fromSurahs.map(s => (
            <option key={s.number} value={s.nameEn}>{s.nameAr}</option>
          ))}
        </select>
        <select value={tillSurah} onChange={handleTill} style={selectStyle}>
          <option value="" style={{ direction: 'ltr' }}>Till Sûrah</option>
          {SURAH_AYAH_DATA.filter(s => s.number >= fromNum).map(s => (
            <option key={s.number} value={s.nameEn}>{s.nameAr}</option>
          ))}
        </select>
      </div>
    );
  }

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
    <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
      <select
        value={fromVal}
        onChange={handleFrom}
        style={{
          padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--border-color, #d4af37)',
          background: '#fff', fontSize: '12px',
        }}
      >
        <option value="">From</option>
        {pages.map(p => (
          <option key={p} value={String(p)}>{p} صــ</option>
        ))}
      </select>
      <select
        value={toVal}
        onChange={handleTo}
        style={{
          padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--border-color, #d4af37)',
          background: '#fff', fontSize: '12px',
        }}
      >
        <option value="">To</option>
        {pages.filter(p => !fromVal || Number(p) >= Number(fromVal)).map(p => (
          <option key={p} value={String(p)}>{p} صــ</option>
        ))}
      </select>
    </div>
  );
};

const SurahRangePicker = ({ value, onChange }) => {
  const parts = (value || '').split(/\s+til\s+/i);
  const fromSurah = parts[0] || '';
  const tillSurah = parts[1] || '';

  const handleFrom = (e) => {
    const from = e.target.value;
    if (!from) { onChange(''); return; }
    onChange(from && tillSurah ? `${from} til ${tillSurah}` : `${from} til ${from}`);
  };

  const handleTill = (e) => {
    const till = e.target.value;
    if (!till) { onChange(''); return; }
    onChange(fromSurah && till ? `${fromSurah} til ${till}` : `${till} til ${till}`);
  };

  return (
    <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
      <select
        value={fromSurah}
        onChange={handleFrom}
        style={{
          padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--border-color, #d4af37)',
          background: '#fff', fontSize: '12px', fontFamily: "'Kanz al Marjaan', serif",
        }}
      >
        <option value="">From Surah</option>
        {SURAH_AYAH_DATA.map(s => (
          <option key={s.number} value={s.nameEn}>{s.nameAr}</option>
        ))}
      </select>
      <select
        value={tillSurah}
        onChange={handleTill}
        style={{
          padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--border-color, #d4af37)',
          background: '#fff', fontSize: '12px', fontFamily: "'Kanz al Marjaan', serif",
        }}
      >
        <option value="">Till Surah</option>
        {SURAH_AYAH_DATA.map(s => (
          <option key={s.number} value={s.nameEn}>{s.nameAr}</option>
        ))}
      </select>
    </div>
  );
};

const SelfJadwalTableStyle = ({ mode, scheduleData, onCellChange, readOnly, editHistory, dayDates, customDays, onMiqaatClick }) => {
  const daysToRender = React.useMemo(() => customDays || DAYS.map((day, idx) => ({ dayName: day, fatemiDate: dayDates?.[idx] || '' })), [dayDates, customDays]);

  const defaultJadeedSurah = React.useMemo(() => {
    for (const dayObj of daysToRender) {
      const day = dayObj.dayName;
      const row = scheduleData[day] || {};
      if (row && row.jadeed) {
        return row.jadeed.split(':')[0];
      }
    }
    return '';
  }, [scheduleData, daysToRender]);

  return (
    <div className="jadwal-table-wrapper">
      <table className="jadwal-table">
        <thead>
          {mode === 'juz-wise' ? (
            <>
              <tr>
                <th rowSpan="2">Days</th>
                <th colSpan="4" style={{ textAlign: 'center', borderBottom: 'none' }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', justifyContent: 'center' }}>
                    <BookOpen size={14} /> <span>Murajah</span>
                  </div>
                </th>
                <th rowSpan="2">
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', justifyContent: 'center', flexDirection: 'column' }}>
                    <Sparkles size={14} /> <span>Jadeed</span>
                  </div>
                </th>
                <th rowSpan="2">
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', justifyContent: 'center', flexDirection: 'column' }}>
                    <Repeat size={14} /> <span>Juzhali</span>
                  </div>
                </th>
                <th rowSpan="2">
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', justifyContent: 'center', flexDirection: 'column' }}>
                    <Calculator size={14} /> <span>Total</span>
                  </div>
                </th>
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
              <th>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', justifyContent: 'center' }}>
                  <BookOpen size={14} /> <span>Murajah</span>
                </div>
              </th>
              <th>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', justifyContent: 'center' }}>
                  <Sparkles size={14} /> <span>Jadeed</span>
                </div>
              </th>
              <th>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', justifyContent: 'center' }}>
                  <Repeat size={14} /> <span>Juzhali</span>
                </div>
              </th>
              <th>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', justifyContent: 'center' }}>
                  <Calculator size={14} /> <span>Total</span>
                </div>
              </th>
            </tr>
          )}
        </thead>
        <tbody>
          {daysToRender.map((dayObj, idx) => {
            const day = dayObj.dayName;
            const row = scheduleData[day] || {};
            return (
            <tr key={`${day}-${idx}`}>
              <td className="day-cell">
                <div className="day-cell-content">
                  <span className="day-cell-name">{day}</span>
                  {dayObj.miqaats && dayObj.miqaats.length > 0 && (
                    <span
                      className="miqaat-badge"
                      data-tooltip={dayObj.miqaatSummary?.summary || dayObj.miqaats.map(e => e.name).join(', ')}
                      onClick={(e) => { e.stopPropagation(); onMiqaatClick && onMiqaatClick(dayObj); }}
                    >
                      <Sparkles size={10} className="miqaat-icon-pulse" />
                      <span className="miqaat-text">Miqaat</span>
                    </span>
                  )}
                </div>
                {dayObj.fatemiDate ? <div className="day-fatemi-date">{dayObj.fatemiDate}</div> : null}
              </td>
              {mode === 'juz-wise' ? (
                <>
                      {['juz1', 'juz2', 'juz3', 'juz4'].map(juz => {
                    const label = juz.charAt(0).toUpperCase() + juz.slice(1).replace(/\d/, ' $&');
                    const juzVal = row[juz] || '';
                    return (
                      <td key={juz} data-label={label} className={getCellEdited(editHistory, day, juz) ? 'jadwal-cell-edited' : ''}>
                        {readOnly ? (
                          <span style={{ fontFamily: "'Al-Kanz', 'Kanz al Marjaan', serif", direction: 'rtl', fontSize: '14px' }}>{toArabicNum(juzVal) || '-'}</span>
                        ) : (
                          <JuzSelect
                            value={juzVal}
                            onChange={(val) => onCellChange(day, juz, val)}
                          />
                        )}
                      </td>
                    );
                  })}
                    <td data-label="Jadeed" className={getCellEdited(editHistory, day, 'jadeed') ? 'jadwal-cell-edited' : ''}>
                    {readOnly ? (
                      <span style={{ fontFamily: "'Kanz al Marjaan', serif", direction: 'rtl', fontSize: '14px' }}>{formatJadeed(row.jadeed)}</span>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'nowrap' }}>
                        {row.jadeed === NO_VALUE ? (
                          <span style={{ fontFamily: "'Inter', sans-serif", fontSize: '12px', fontWeight: 700, color: '#c62828', padding: '4px 8px', background: '#ffebee', borderRadius: '4px', border: '1px solid #ef9a9a' }}>NO</span>
                        ) : (
                          <JadeedPicker
                            value={row.jadeed || ''}
                            onChange={(val) => onCellChange(day, 'jadeed', val)}
                            defaultSurah={defaultJadeedSurah}
                          />
                        )}
                        <NoToggleButton value={row.jadeed || ''} onChange={(val) => onCellChange(day, 'jadeed', val)} label="Jadeed" />
                      </div>
                    )}
                  </td>
                  <td data-label="Juzhali" className={getCellEdited(editHistory, day, 'juzhali') ? 'jadwal-cell-edited' : ''}>
                    {readOnly ? (
                      <span style={{ fontFamily: "'Al-Kanz', 'Kanz al Marjaan', serif", direction: 'rtl', fontSize: '14px' }}>{formatJuzhali(row.juzhali)}</span>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'nowrap' }}>
                        {row.juzhali === NO_VALUE ? (
                          <span style={{ fontFamily: "'Inter', sans-serif", fontSize: '12px', fontWeight: 700, color: '#c62828', padding: '4px 8px', background: '#ffebee', borderRadius: '4px', border: '1px solid #ef9a9a' }}>NO</span>
                        ) : (
                          <JuzhaliPicker
                            value={row.juzhali || ''}
                            onChange={(val) => onCellChange(day, 'juzhali', val)}
                            jadeedValue={row.jadeed || ''}
                            mode={mode}
                          />
                        )}
                        <NoToggleButton value={row.juzhali || ''} onChange={(val) => onCellChange(day, 'juzhali', val)} label="Juzhali" />
                      </div>
                    )}
                  </td>
                </>
              ) : (
                <>
                  <td data-label="Murajah" className={getCellEdited(editHistory, day, 'murajah') ? 'jadwal-cell-edited' : ''}>
                    {readOnly ? (
                      <span style={{ fontFamily: "'Kanz al Marjaan', serif", direction: 'rtl', fontSize: '14px' }}>{formatMurajah(row.murajah)}</span>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'nowrap' }}>
                        {row.murajah === NO_VALUE ? (
                          <span style={{ fontFamily: "'Inter', sans-serif", fontSize: '12px', fontWeight: 700, color: '#c62828', padding: '4px 8px', background: '#ffebee', borderRadius: '4px', border: '1px solid #ef9a9a' }}>NO</span>
                        ) : (
                          <SurahRangePicker
                            value={row.murajah || ''}
                            onChange={(val) => onCellChange(day, 'murajah', val)}
                          />
                        )}
                        <NoToggleButton value={row.murajah || ''} onChange={(val) => onCellChange(day, 'murajah', val)} label="Murajah" />
                      </div>
                    )}
                  </td>
                  <td data-label="Jadeed" className={getCellEdited(editHistory, day, 'jadeed') ? 'jadwal-cell-edited' : ''}>
                    {readOnly ? (
                      <span style={{ fontFamily: "'Kanz al Marjaan', serif", direction: 'rtl', fontSize: '14px' }}>{formatJadeed(row.jadeed)}</span>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'nowrap' }}>
                        {row.jadeed === NO_VALUE ? (
                          <span style={{ fontFamily: "'Inter', sans-serif", fontSize: '12px', fontWeight: 700, color: '#c62828', padding: '4px 8px', background: '#ffebee', borderRadius: '4px', border: '1px solid #ef9a9a' }}>NO</span>
                        ) : (
                          <JadeedPicker
                            value={row.jadeed || ''}
                            onChange={(val) => onCellChange(day, 'jadeed', val)}
                            defaultSurah={defaultJadeedSurah}
                          />
                        )}
                        <NoToggleButton value={row.jadeed || ''} onChange={(val) => onCellChange(day, 'jadeed', val)} label="Jadeed" />
                      </div>
                    )}
                  </td>
                  <td data-label="Juzhali" className={getCellEdited(editHistory, day, 'juzhali') ? 'jadwal-cell-edited' : ''}>
                    {readOnly ? (
                      <span style={{ fontFamily: "'Al-Kanz', 'Kanz al Marjaan', serif", direction: 'rtl', fontSize: '14px' }}>{formatJuzhali(row.juzhali)}</span>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'nowrap' }}>
                        {row.juzhali === NO_VALUE ? (
                          <span style={{ fontFamily: "'Inter', sans-serif", fontSize: '12px', fontWeight: 700, color: '#c62828', padding: '4px 8px', background: '#ffebee', borderRadius: '4px', border: '1px solid #ef9a9a' }}>NO</span>
                        ) : (
                          <JuzhaliPicker
                            value={row.juzhali || ''}
                            onChange={(val) => onCellChange(day, 'juzhali', val)}
                            jadeedValue={row.jadeed || ''}
                            mode={mode}
                          />
                        )}
                        <NoToggleButton value={row.juzhali || ''} onChange={(val) => onCellChange(day, 'juzhali', val)} label="Juzhali" />
                      </div>
                    )}
                  </td>
                </>
              )}
              <td className="star-cell" data-label="Total">
                <span style={{ fontWeight: 700, color: '#d4af37', fontSize: '16px' }}>{calcTotalPages(row, mode)} Pages to do</span>
              </td>
            </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

const premiumHeaderStyle = {
  background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
  padding: '24px 28px',
  borderRadius: '16px',
  marginBottom: '24px',
  border: '1px solid rgba(212, 175, 55, 0.3)',
  boxShadow: '0 8px 32px rgba(0,0,0,0.15), inset 0 1px 0 rgba(212, 175, 55, 0.1)',
  position: 'relative',
  overflow: 'hidden',
};

const premiumHeaderGlow = {
  position: 'absolute',
  top: '-50%',
  left: '-20%',
  width: '140%',
  height: '200%',
  background: 'radial-gradient(ellipse at center, rgba(212, 175, 55, 0.06) 0%, transparent 70%)',
  pointerEvents: 'none',
};

const premiumTitleStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '14px',
  color: '#d4af37',
  fontFamily: 'Inter, sans-serif',
  fontWeight: 700,
  fontSize: '22px',
  letterSpacing: '0.5px',
  position: 'relative',
  zIndex: 1,
};

const premiumBadgeStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  background: 'linear-gradient(135deg, #d4af37, #b8962e)',
  color: '#1a1a2e',
  padding: '4px 14px',
  borderRadius: '20px',
  fontSize: '11px',
  fontWeight: 800,
  letterSpacing: '0.8px',
  textTransform: 'uppercase',
  fontFamily: 'Inter, sans-serif',
};

const premiumCardStyle = {
  background: 'linear-gradient(135deg, #ffffff 0%, #fdfaf4 100%)',
  borderRadius: '16px',
  border: '1px solid rgba(212, 175, 55, 0.2)',
  boxShadow: '0 4px 24px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)',
  overflow: 'hidden',
};

export const SelfJadwalParentView = ({ userId, userEmail, showAction }) => {
  const [scheduleData, setScheduleData] = useState(DEFAULT_SCHEDULE);
  const [mode, setMode] = useState('juz-wise');
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState('My Schedule');
  const [hasUnseenChanges, setHasUnseenChanges] = useState(false);
  const [showWelcomePopup, setShowWelcomePopup] = useState(false);
  const [editHistory, setEditHistory] = useState({});
  const [miqaatPopup, setMiqaatPopup] = useState(null);

  const autoSaveTimerRef = useRef(null);
  const lastSavedSnapshotRef = useRef('');

  const weekRange = useMemo(() => getCurrentWeekRange(), []);
  const dayDates = useMemo(() => weekRange ? DAYS.map((_, idx) => getDayDate(weekRange.weekStart, idx)) : [], [weekRange]);
  const customDays = useMemo(() => weekRange ? getDaysFromRange(weekRange.weekStart, weekRange.weekEnd) : null, [weekRange]);

  // Fatemi calendar & miqaat API (like aajnodin.com)
  const { loading: fatemiLoading, fatemiData } = useFatemiCalendar(
    weekRange?.weekStart,
    weekRange?.weekEnd
  );

  // Compute enriched days directly from fatemiData (no useEffect needed)
  const enrichedDays = useMemo(() => {
    if (!customDays || !fatemiData || Object.keys(fatemiData).length === 0) {
      console.log('🔍 SelfJadwalParentView: useMemo skipping (no data)');
      return null;
    }
    console.log('🔍 SelfJadwalParentView: useMemo enriching', { daysCount: customDays.length, dataKeys: Object.keys(fatemiData) });
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
    console.log('🔍 SelfJadwalParentView: useMemo done', enriched.length, 'days,', miqaatDays.length, 'with miqaats', miqaatDays.map(d => ({ day: d.dayName, date: d.date, count: d.miqaats.length })));
    return enriched;
  }, [customDays, fatemiData]);

  useEffect(() => {
    if (userId) {
      fetchSelfJadwal().then(() => markAsViewed());
      fetchUserName();
      checkWelcomePopup();
    }
  }, [userId]);

  // Auto-save whenever schedule or mode changes
  useEffect(() => {
    if (!userId || loading) return;
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);

    const currentSnapshot = JSON.stringify({ data: scheduleData, mode });
    if (currentSnapshot === lastSavedSnapshotRef.current) return;

    autoSaveTimerRef.current = setTimeout(async () => {
      const now = Date.now();
      const mergedHistory = { ...(scheduleData._editHistory || {}), ...editHistory };
      const cleanHistory = {};
      for (const [key, ts] of Object.entries(mergedHistory)) {
        if (now - new Date(ts).getTime() < 60000) cleanHistory[key] = ts;
      }
      const { error } = await supabase
        .from('self_jadwal')
        .upsert({
          user_id: userId,
          schedule_data: { ...scheduleData, _mode: mode, _editHistory: cleanHistory },
          updated_at: new Date().toISOString(),
          parent_viewed_at: new Date().toISOString()
        }, { onConflict: 'user_id' });

      if (!error) {
        lastSavedSnapshotRef.current = currentSnapshot;
        try {
          await supabase.functions.invoke('fcm-notification', {
            body: {
              title: 'Self Jadwal Updated ✏️',
              body: `${userName} has updated their Self Jadwal schedule.`,
              targetRole: null,
              targetUser: userId,
              data: { redirectPage: 'Self Jadwal', timestamp: new Date().toISOString() }
            }
          });
        } catch (_) {}
      }
    }, 1500);

    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [scheduleData, mode, userId, loading]);

  const fetchUserName = async () => {
    try {
      const { data: userData } = await supabase
        .from('user_portal_access')
        .select('full_name')
        .eq('user_id', userId)
        .single();
      if (userData?.full_name) {
        setUserName(userData.full_name);
      }
    } catch (e) {
      // silent
    }
  };

  const fetchSelfJadwal = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('self_jadwal')
      .select('schedule_data, has_unseen_changes')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Failed to fetch self Jadwal:', error);
    } else if (data && data.schedule_data) {
      const savedMode = data.schedule_data._mode || 'juz-wise';
      setMode(savedMode);
      const history = data.schedule_data._editHistory || {};
      setEditHistory(history);
      const loaded = { ...DEFAULT_SCHEDULE, ...data.schedule_data, _mode: savedMode };
      setScheduleData(loaded);
      setHasUnseenChanges(data.has_unseen_changes || false);
      lastSavedSnapshotRef.current = JSON.stringify({ data: loaded, mode: savedMode });
    } else {
      setScheduleData(DEFAULT_SCHEDULE);
      setHasUnseenChanges(false);
      setEditHistory({});
      lastSavedSnapshotRef.current = JSON.stringify({ data: DEFAULT_SCHEDULE, mode: 'juz-wise' });
    }
    setLoading(false);
  };

  const checkWelcomePopup = async () => {
    try {
      const { data, error } = await supabase
        .from('self_jadwal_notifications')
        .select('id')
        .eq('user_id', userId)
        .eq('notification_type', 'welcome')
        .single();

      if (error && error.code === 'PGRST116') {
        // No record found, show popup
        setShowWelcomePopup(true);
      }
    } catch (e) {
      console.error('Failed to check welcome popup:', e);
    }
  };

  const dismissWelcomePopup = async () => {
    setShowWelcomePopup(false);
    try {
      await supabase
        .from('self_jadwal_notifications')
        .insert({
          user_id: userId,
          notification_type: 'welcome',
          dismissed_at: new Date().toISOString()
        });
    } catch (e) {
      console.error('Failed to dismiss welcome popup:', e);
    }
  };

  const markAsViewed = async () => {
    try {
      await supabase
        .from('self_jadwal')
        .update({
          has_unseen_changes: false,
          parent_viewed_at: new Date().toISOString()
        })
        .eq('user_id', userId);
      setHasUnseenChanges(false);
    } catch (e) {
      console.error('Failed to mark as viewed:', e);
    }
  };

  const handleCellChange = (day, field, value) => {
    setScheduleData(prev => ({
      ...prev,
      [day]: {
        ...(prev[day] || {}),
        [field]: value
      }
    }));
    const key = `${day}_${field}`;
    setEditHistory(prev => ({ ...prev, [key]: new Date().toISOString() }));
  };

  const handleMiqaatClick = (dayObj) => {
    setMiqaatPopup({
      events: dayObj.miqaats || [],
      dayName: dayObj.dayName,
      fatemiDate: dayObj.fatemiDate || '',
    });
  };

  if (loading) {
    return (
      <div className="jadwal-container parent-view">
        <div className="jadwal-header">
          <div className="skeleton-el" style={{ height: '32px', width: '280px', borderRadius: '8px' }} />
          <div className="skeleton-el" style={{ height: '40px', width: '100%', borderRadius: '10px', marginTop: '12px' }} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px', padding: '20px 0' }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton-el" style={{ height: '120px', borderRadius: '12px' }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      {showWelcomePopup && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999
        }}>
          <div style={{
            background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
            padding: '32px',
            borderRadius: '20px',
            maxWidth: '500px',
            width: '90%',
            border: '2px solid #d4af37',
            boxShadow: '0 8px 32px rgba(0,0,0,0.3)'
          }}>
            <div style={{ textAlign: 'center' }}>
              <Crown size={48} style={{ color: '#d4af37', marginBottom: '16px' }} />
              <h2 style={{
                color: '#d4af37',
                fontSize: '24px',
                fontWeight: 700,
                marginBottom: '12px',
                fontFamily: 'Inter, sans-serif'
              }}>
                Welcome to Self Jadwal!
              </h2>
              <p style={{
                color: '#e8d5a3',
                fontSize: '16px',
                lineHeight: 1.6,
                marginBottom: '24px',
                fontFamily: 'Inter, sans-serif'
              }}>
                Create your personal Quran study schedule. Teachers can also help you set up and edit your timetable.
              </p>
              <button
                onClick={dismissWelcomePopup}
                style={{
                  padding: '12px 32px',
                  borderRadius: '12px',
                  border: 'none',
                  background: 'linear-gradient(135deg, #d4af37, #b8962e)',
                  color: '#1a1a2e',
                  fontSize: '16px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontFamily: 'Inter, sans-serif',
                  transition: 'transform 0.2s'
                }}
                onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
              >
                Get Started
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="jadwal-container parent-view">
        <div style={premiumHeaderStyle}>
          <div style={premiumHeaderGlow} />
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
              <div style={premiumTitleStyle}>
                <Crown size={24} style={{ color: '#d4af37' }} />
                <span>Self Jadwal Schedule</span>
              </div>
              <span style={premiumBadgeStyle}>
                <Gem size={12} /> Premium
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.06)', borderRadius: '10px', padding: '8px 16px' }}>
                <Star size={14} style={{ color: '#d4af37' }} />
                <span style={{ color: '#e8d5a3', fontSize: '14px', fontWeight: 500, fontFamily: 'Inter, sans-serif' }}>
                  {userName}
                </span>
                {hasUnseenChanges && (
                  <div style={{
                    width: '10px',
                    height: '10px',
                    borderRadius: '50%',
                    background: '#4ade80',
                    boxShadow: '0 0 8px #4ade80',
                    animation: 'pulse 2s infinite'
                  }} />
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.06)', borderRadius: '10px', padding: '8px 16px' }}>
                <Award size={14} style={{ color: '#d4af37' }} />
                <span style={{ color: '#e8d5a3', fontSize: '13px', fontFamily: 'Inter, sans-serif', opacity: 0.8 }}>
                  Personal Timetable
                </span>
              </div>
            </div>
          </div>
        </div>

        <div style={premiumCardStyle}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(212, 175, 55, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <label style={{ fontWeight: 600, color: '#5d4037', fontSize: '14px' }}>Mode:</label>
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value)}
                className="premium-select"
                style={{ padding: '8px 16px', borderRadius: '10px', border: '1px solid #dfcbb5', background: '#fdfaf4', fontFamily: 'Inter, sans-serif', fontSize: '13px', cursor: 'pointer' }}
              >
                <option value="juz-wise">Juz Wise</option>
                <option value="surah-wise">Surah Wise</option>
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {hasUnseenChanges && (
                <button
                  onClick={markAsViewed}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '8px',
                    border: '1px solid #4ade80',
                    background: '#f0fdf4',
                    color: '#16a34a',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontFamily: 'Inter, sans-serif'
                  }}
                >
                  ✓ Mark as Viewed
                </button>
              )}
              <span style={{ fontSize: '12px', color: '#5d4037', fontStyle: 'italic', fontFamily: 'Inter, sans-serif', fontWeight: 600 }}>✏️ Auto-saved</span>
            </div>
          </div>
          <div style={{ padding: '20px' }}>            <SelfJadwalTableStyle
              mode={mode}
              scheduleData={scheduleData}
              onCellChange={handleCellChange}
              editHistory={editHistory}
              dayDates={dayDates}
              customDays={enrichedDays || customDays}
              onMiqaatClick={handleMiqaatClick}
            />
          </div>
        </div>
      </div>

      {miqaatPopup && (
        <MiqaatPopup
          events={miqaatPopup.events}
          dayName={miqaatPopup.dayName}
          fatemiDate={miqaatPopup.fatemiDate}
          onClose={() => setMiqaatPopup(null)}
        />
      )}
    </>
  );
};


export const SelfJadwalTeacherView
 = ({ showAction, onBroadcastNotification, students = [] }) => {
  const [selectedUserId, setSelectedUserId] = useState('');
  const [scheduleData, setScheduleData] = useState(DEFAULT_SCHEDULE);
  const [mode, setMode] = useState('juz-wise');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedUserName, setSelectedUserName] = useState('');
  const [editHistory, setEditHistory] = useState({});
  const [resolvedUserId, setResolvedUserId] = useState('');
  const [miqaatPopup, setMiqaatPopup] = useState(null);

  const autoSaveTimerRef = useRef(null);
  const lastSavedSnapshotRef = useRef('');

  const weekRange = useMemo(() => getCurrentWeekRange(), []);
  const dayDates = useMemo(() => weekRange ? DAYS.map((_, idx) => getDayDate(weekRange.weekStart, idx)) : [], [weekRange]);
  const customDays = useMemo(() => weekRange ? getDaysFromRange(weekRange.weekStart, weekRange.weekEnd) : null, [weekRange]);

  // Fatemi calendar & miqaat API (like aajnodin.com)
  const { loading: fatemiLoading, fatemiData } = useFatemiCalendar(
    weekRange?.weekStart,
    weekRange?.weekEnd
  );

  // Compute enriched days directly from fatemiData using useMemo
  const enrichedDays = useMemo(() => {
    if (!customDays || !fatemiData || Object.keys(fatemiData).length === 0) {
      console.log('🔍 SelfJadwalTeacherView: useMemo skipping (no data)');
      return null;
    }
    console.log('🔍 SelfJadwalTeacherView: useMemo enriching', { daysCount: customDays.length });
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
    console.log('🔍 SelfJadwalTeacherView: useMemo done', enriched.length, 'days,', miqaatDays.length, 'with miqaats');
    return enriched;
  }, [customDays, fatemiData]);

  useEffect(() => {
    if (selectedUserId) {
      const child = students.find(s => String(s.student_id) === String(selectedUserId) || String(s.id) === String(selectedUserId));
      if (child) {
        setSelectedUserName(child.name || child.full_name || 'Child');
        const parentUserId = child.user_id || selectedUserId;
        setResolvedUserId(parentUserId);
        fetchSelfJadwalByChildId(parentUserId);
      }
    } else {
      setScheduleData(DEFAULT_SCHEDULE);
      setResolvedUserId('');
    }
  }, [selectedUserId]);

  useEffect(() => {
    if (!resolvedUserId) return;
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);

    const currentSnapshot = JSON.stringify({ data: scheduleData, mode });
    if (currentSnapshot === lastSavedSnapshotRef.current) return;

    autoSaveTimerRef.current = setTimeout(async () => {
      if (!resolvedUserId) return;
      const now = Date.now();
      const mergedHistory = { ...(scheduleData._editHistory || {}), ...editHistory };
      const cleanHistory = {};
      for (const [key, ts] of Object.entries(mergedHistory)) {
        if (now - new Date(ts).getTime() < 60000) cleanHistory[key] = ts;
      }
      const { error } = await supabase
        .from('self_jadwal')
        .upsert({
          user_id: resolvedUserId,
          schedule_data: { ...scheduleData, _mode: mode, _editHistory: cleanHistory },
          updated_at: new Date().toISOString(),
          has_unseen_changes: true,
          last_updated_by: resolvedUserId,
          teacher_updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' });

      if (error) {
        console.error('Auto-save self Jadwal failed:', error);
      } else {
        lastSavedSnapshotRef.current = JSON.stringify({ data: scheduleData, mode });
      }
    }, 1500);

    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [scheduleData, mode, resolvedUserId]);

  const fetchSelfJadwalByChildId = async (childId) => {
    setLoading(true);
    const { data, error } = await supabase
      .from('self_jadwal')
      .select('schedule_data')
      .eq('user_id', childId)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Failed to fetch self Jadwal:', error);
    } else if (data && data.schedule_data) {
      const savedMode = data.schedule_data._mode || 'juz-wise';
      setMode(savedMode);
      const history = data.schedule_data._editHistory || {};
      setEditHistory(history);
      setScheduleData({ ...DEFAULT_SCHEDULE, ...data.schedule_data, _mode: savedMode });
      lastSavedSnapshotRef.current = JSON.stringify({ data: { ...DEFAULT_SCHEDULE, ...data.schedule_data, _mode: savedMode }, mode: savedMode });
    } else {
      setScheduleData(DEFAULT_SCHEDULE);
      setEditHistory({});
      lastSavedSnapshotRef.current = JSON.stringify({ data: DEFAULT_SCHEDULE, mode: 'juz-wise' });
    }
    setLoading(false);
  };

  const handleCellChange = (day, field, value) => {
    setScheduleData(prev => ({
      ...prev,
      [day]: {
        ...(prev[day] || {}),
        [field]: value
      }
    }));
    const key = `${day}_${field}`;
    setEditHistory(prev => ({ ...prev, [key]: new Date().toISOString() }));
  };

  const handleMiqaatClick = (dayObj) => {
    setMiqaatPopup({
      events: dayObj.miqaats || [],
      dayName: dayObj.dayName,
      fatemiDate: dayObj.fatemiDate || '',
    });
  };

  const handleNotifyUser = async () => {
    if (!selectedUserId) return;
    setSaving(true);
    if (showAction) showAction('info', 'Sending notification...');

    if (onBroadcastNotification) {
      try {
        await onBroadcastNotification(
          "Self Jadwal Timetable Updated",
          `Your personal Self Jadwal schedule has been updated by the teacher. Tap to view.`,
          "user",
          selectedUserId,
          "Self Jadwal"
        );
        if (showAction) showAction('success', 'User notified successfully');
      } catch (e) {
        console.warn("Self Jadwal notification failed:", e);
        if (showAction) showAction('error', 'Failed to send notification');
      }
    }
    setSaving(false);
  };

  return (
    <div className="jadwal-container">
      <div style={premiumHeaderStyle}>
        <div style={premiumHeaderGlow} />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
            <div style={premiumTitleStyle}>
              <Crown size={24} style={{ color: '#d4af37' }} />
              <span>Self Jadwal Editor</span>
            </div>
            <span style={premiumBadgeStyle}>
              <Gem size={12} /> Premium
            </span>
          </div>
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '13px', fontFamily: 'Inter, sans-serif', marginTop: '4px' }}>
            View and edit personal schedules for parents
          </p>
        </div>
      </div>

      <div style={premiumCardStyle}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(212, 175, 55, 0.15)' }}>
          <div className="student-selector" style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <select
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              className="premium-select"
              style={{ flex: 1, minWidth: '250px', padding: '10px 16px', borderRadius: '10px', border: '1px solid #dfcbb5', background: '#fdfaf4', fontFamily: 'Inter, sans-serif', fontSize: '13px', cursor: 'pointer' }}
            >
              <option value="">-- Select Child --</option>
              {students.length > 0 && (
                <optgroup label="👦 Group Children">
                  {students.map(s => (
                    <option key={`child-${s.student_id || s.id}`} value={s.student_id || s.id}>
                      {s.name || s.full_name}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
            {selectedUserId && (
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="jadwal-save-btn" onClick={handleNotifyUser} disabled={saving}>
                  {saving ? (
                    <><Loader2 className="animate-spin" size={16} /> <span>Notifying...</span></>
                  ) : (
                    <><Save size={16} /> <span>Notify User</span></>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>

        {loading ? (
          <div className="loading-spinner" style={{ padding: '40px', textAlign: 'center' }}>Loading...</div>
        ) : selectedUserId ? (
          <>
            <div style={{ padding: '16px 24px', borderBottom: '1px solid rgba(212, 175, 55, 0.15)', display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Star size={14} style={{ color: '#d4af37' }} />
                <span style={{ fontWeight: 600, color: '#5d4037', fontSize: '14px' }}>{selectedUserName}</span>
              </div>
              <label style={{ fontWeight: 600, color: '#5d4037', fontSize: '14px' }}>Mode:</label>
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
            </div>
            <div style={{ padding: '20px' }}>
              <SelfJadwalTableStyle
                mode={mode}
                scheduleData={scheduleData}
                onCellChange={handleCellChange}
                editHistory={editHistory}
                dayDates={dayDates}
                customDays={enrichedDays || customDays}
                onMiqaatClick={handleMiqaatClick}
              />
            </div>
          </>
        ) : (
          <div className="jadwal-empty" style={{ padding: '60px 20px', textAlign: 'center', color: '#999' }}>
            <Lock size={32} style={{ color: '#d4af37', opacity: 0.4, marginBottom: '12px' }} />
            <p style={{ fontFamily: 'Inter, sans-serif' }}>Select a parent/user from the dropdown to view and edit their Self Jadwal schedule.</p>
          </div>
        )}
      </div>

      {miqaatPopup && (
        <MiqaatPopup
          events={miqaatPopup.events}
          dayName={miqaatPopup.dayName}
          fatemiDate={miqaatPopup.fatemiDate}
          onClose={() => setMiqaatPopup(null)}
        />
      )}
    </div>
  );
};
