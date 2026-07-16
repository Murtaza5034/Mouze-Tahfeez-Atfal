import { useState, useEffect, useMemo } from 'react';
import { supabase } from './supabaseClient';
import {
  Calendar, Users, X, ChevronRight, CheckCircle, AlertCircle, Loader2,
  GraduationCap, Sparkles, Eye, BookOpen, Repeat, Download, User,
  BarChart3, Info
} from 'lucide-react';

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
  { number: 87, nameEn: "Al-A'la", nameAr: 'الأعلى', ayahCount: 19 },
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

const NO_VALUE = 'NO';
const CACHE_PREFIX = 'jadwal_tracking_';
const CACHE_DURATION = 120000;

const toArabicNum = (n) => {
  const arabicDigits = '٠١٢٣٤٥٦٧٨٩';
  return String(n).replace(/\d/g, d => arabicDigits[d]);
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

const formatMurajah = (val) => {
  if (!val) return '-';
  if (val === NO_VALUE) return 'NO';
  const parts = val.split(' til ');
  if (parts.length >= 2) {
    const from = SURAH_AYAH_DATA.find(s => s.nameEn.toLowerCase() === parts[0].toLowerCase() || s.nameAr === parts[0]);
    const till = SURAH_AYAH_DATA.find(s => s.nameEn.toLowerCase() === parts[1].toLowerCase() || s.nameAr === parts[1]);
    const fromName = from ? from.nameAr : parts[0];
    const tillName = till ? till.nameAr : parts[1];
    return `${fromName} إلى ${tillName}`;
  }
  const single = SURAH_AYAH_DATA.find(s => s.nameEn.toLowerCase() === val.toLowerCase() || s.nameAr === val);
  return single ? single.nameAr : val;
};

const formatJuzhali = (val) => {
  if (!val) return '-';
  if (val === NO_VALUE) return 'NO';
  if (val.includes(' til ')) {
    const parts = val.split(/\s+til\s+/i);
    const fromSurah = SURAH_AYAH_DATA.find(s => s.nameEn.toLowerCase() === (parts[0] || '').toLowerCase() || s.nameAr === parts[0]);
    const toSurah = SURAH_AYAH_DATA.find(s => s.nameEn.toLowerCase() === (parts[1] || '').toLowerCase() || s.nameAr === (parts[1] || ''));
    const fromName = fromSurah ? fromSurah.nameAr : (parts[0] || '');
    const toName = toSurah ? toSurah.nameAr : (parts[1] || '');
    return `${fromName} إلى ${toName}`;
  }
  const parts = val.split(':');
  if (parts.length === 2 && parts[0] && parts[1]) {
    return `${toArabicNum(parts[0])}-${toArabicNum(parts[1])} صــ`;
  }
  return `${toArabicNum(val)} صــ`;
};

const isFieldFilled = (val) => val && val.toString().trim() !== '';

const getDayCompletion = (dayData, mode) => {
  if (!dayData) return { completed: false, total: 0, filled: 0 };
  if (mode === 'juz-wise') {
    const fields = ['juz1', 'juz2', 'juz3', 'juz4', 'jadeed', 'juzhali'];
    const filled = fields.filter(f => isFieldFilled(dayData[f])).length;
    return { completed: filled === fields.length, total: fields.length, filled };
  }
  const fields = ['murajah', 'jadeed', 'juzhali'];
  const filled = fields.filter(f => isFieldFilled(dayData[f])).length;
  return { completed: filled === fields.length, total: fields.length, filled };
};

const getScheduleMode = (scheduleData) => {
  return scheduleData?._mode || 'juz-wise';
};

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

const getWeekRange = (mode, settings) => {
  if (mode === 'miqaat' && settings?.jadwal_week_start && settings?.jadwal_week_end) {
    return { start: settings.jadwal_week_start, end: settings.jadwal_week_end };
  }
  const now = new Date();
  const day = now.getDay();
  const monOffset = day === 0 ? -6 : 1 - day;
  const start = new Date(now);
  start.setDate(now.getDate() + monOffset);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0],
  };
};

const getDayDateStrings = (range) => {
  if (!range?.start || !range?.end) return [];
  const start = new Date(range.start + 'T00:00:00Z');
  const end = new Date(range.end + 'T00:00:00Z');
  const dates = [];
  const cur = new Date(start);
  while (cur <= end) {
    dates.push(cur.toISOString().split('T')[0]);
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  if (dates.length > 19) dates.pop();
  return dates;
};

const getDayKeys = (scheduleData, dayDateStrings) => {
  if (!scheduleData) return [];
  const keys = Object.keys(scheduleData).filter(k => k !== '_mode' && k !== '_star' && k !== '_editHistory');
  if (!keys.length) return keys;

  const DAY_NAMES = ['SUNDAY','MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY'];
  if (dayDateStrings?.length) {
    const ordered = [];
    dayDateStrings.forEach((dateStr, idx) => {
      const d = new Date(dateStr + 'T00:00:00Z');
      const dayName = DAY_NAMES[d.getUTCDay()];
      const key = idx >= 6 ? `${dayName}_${idx}` : dayName;
      if (keys.includes(key)) ordered.push(key);
    });
    return ordered;
  }
  return keys.sort((a, b) => {
    const aParts = a.split('_');
    const bParts = b.split('_');
    const DAY_ORDER = { MONDAY:0, TUESDAY:1, WEDNESDAY:2, THURSDAY:3, FRIDAY:4, SATURDAY:5, SUNDAY:6 };
    const aIdx = aParts.length > 1 ? Number(aParts[1]) : DAY_ORDER[aParts[0]] ?? 99;
    const bIdx = bParts.length > 1 ? Number(bParts[1]) : DAY_ORDER[bParts[0]] ?? 99;
    return aIdx - bIdx;
  });
};

const getDayData = (scheduleData, dayKey) => {
  if (!scheduleData || !dayKey) return null;
  return scheduleData[dayKey] || null;
};

const getCache = (key) => {
  try {
    const raw = sessionStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts > CACHE_DURATION) {
      sessionStorage.removeItem(CACHE_PREFIX + key);
      return null;
    }
    return data;
  } catch { return null; }
};

const setCache = (key, data) => {
  try {
    sessionStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ data, ts: Date.now() }));
  } catch { }
};

const JadwalTrackingView = ({ students, onShowAction, portalAccessList }) => {
  const [viewMode, setViewMode] = useState('miqaat');
  const [jadwalData, setJadwalData] = useState({});
  const [selfJadwalData, setSelfJadwalData] = useState({});
  const [portalUserMap, setPortalUserMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [expandedStudent, setExpandedStudent] = useState(null);
  const [jadwalSettings, setJadwalSettings] = useState(null);

  const range = useMemo(() => getWeekRange(viewMode, jadwalSettings), [viewMode, jadwalSettings]);
  const dayDateStrings = useMemo(() => getDayDateStrings(range), [range]);

  useEffect(() => {
    if (portalAccessList?.length) {
      const map = {};
      portalAccessList.forEach(a => { if (a.user_id) map[a.user_id] = a.full_name || a.email || a.user_id; });
      setPortalUserMap(map);
    }
  }, [portalAccessList]);

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    await Promise.all([
      fetchJadwalSettings(),
      fetchTeacherJadwal(),
      fetchSelfJadwal(),
    ]);
    setLoading(false);
  };

  const fetchJadwalSettings = async () => {
    let data = getCache('settings');
    if (data) { setJadwalSettings(data); return; }
    try {
      const { data: result } = await supabase
        .from('jadwal_settings')
        .select('*')
        .eq('id', 1)
        .single();
      if (result) {
        setCache('settings', result);
        setJadwalSettings(result);
      }
    } catch { }
  };

  const fetchTeacherJadwal = async () => {
    let data = getCache('teacher_jadwal');
    if (data) { setJadwalData(data); return; }
    try {
      const { data: result, error } = await supabase
        .from('jadawal')
        .select('student_id, schedule_data');
      if (error) {
        if (onShowAction) onShowAction('error', 'Failed to fetch teacher jadwal');
        return;
      }
      const jadwalMap = {};
      (result || []).forEach(item => {
        const sid = String(item.student_id).trim();
        jadwalMap[sid] = item.schedule_data;
      });
      setCache('teacher_jadwal', jadwalMap);
      setJadwalData(jadwalMap);
    } catch (err) {
      console.error("Teacher jadwal fetch error:", err);
    }
  };

  const fetchSelfJadwal = async () => {
    let data = getCache('self_jadwal');
    if (data) { setSelfJadwalData(data); return; }
    try {
      const { data: result, error } = await supabase
        .from('self_jadwal')
        .select('user_id, schedule_data');
      if (error) {
        console.warn("Self jadwal fetch (RLS may apply):", error?.message);
        return;
      }
      const jadwalMap = {};
      (result || []).forEach(item => {
        jadwalMap[item.user_id] = item.schedule_data;
      });
      setCache('self_jadwal', jadwalMap);
      setSelfJadwalData(jadwalMap);
    } catch (err) {
      console.error("Self jadwal fetch error:", err);
    }
  };

  const teacherJadwalStats = useMemo(() => {
    const teacherMap = {};
    students.forEach(student => {
      const teacherName = student.teacherName || "Unassigned teacher";
      if (!teacherMap[teacherName]) {
        teacherMap[teacherName] = { teacherName, children: [], totalStudents: 0 };
      }
      const sid = String(student.student_id || '').trim();
      const studentIds = student.allIds || [sid];
      let scheduleData = null;
      for (const id of studentIds) {
        if (jadwalData[id]) { scheduleData = jadwalData[id]; break; }
      }
      const mode = getScheduleMode(scheduleData);
      const dayKeys = getDayKeys(scheduleData, dayDateStrings);
      const totalDays = dayKeys.length;
      let totalFilled = 0;
      let totalFields = 0;
      const dayDetails = dayKeys.map(dayKey => {
        const dayData = getDayData(scheduleData, dayKey);
        const completion = getDayCompletion(dayData, mode);
        totalFilled += completion.filled;
        totalFields += completion.total;
        return { dayKey, ...completion, dayData };
      });
      const fillPercent = totalFields > 0 ? Math.round((totalFilled / totalFields) * 100) : 0;
      teacherMap[teacherName].children.push({
        student_id: student.student_id,
        name: student.name || 'Unnamed',
        groupName: student.groupName || 'Ungrouped',
        fillPercent,
        hasJadwal: scheduleData !== null,
        mode,
        dayDetails,
        totalDays,
        scheduleData,
      });
      teacherMap[teacherName].totalStudents += 1;
    });
    return Object.values(teacherMap).map(teacher => ({
      ...teacher,
      jadwalFilledCount: teacher.children.filter(c => c.hasJadwal).length,
      avgFillPercent: teacher.children.length > 0
        ? Math.round(teacher.children.reduce((sum, c) => sum + c.fillPercent, 0) / teacher.children.length)
        : 0,
    }));
  }, [students, jadwalData, dayDateStrings]);

  const selfJadwalStats = useMemo(() => {
    const teacherMap = {};
    students.forEach(student => {
      const teacherName = student.teacherName || "Unassigned teacher";
      if (!teacherMap[teacherName]) {
        teacherMap[teacherName] = { teacherName, children: [], totalStudents: 0 };
      }
      const userId = student.user_id;
      const scheduleData = userId && selfJadwalData[userId] ? selfJadwalData[userId] : null;
      const mode = getScheduleMode(scheduleData);
      const dayKeys = getDayKeys(scheduleData, dayDateStrings);
      const totalDays = dayKeys.length;
      let totalFilled = 0;
      let totalFields = 0;
      const dayDetails = dayKeys.map(dayKey => {
        const dayData = getDayData(scheduleData, dayKey);
        const completion = getDayCompletion(dayData, mode);
        totalFilled += completion.filled;
        totalFields += completion.total;
        return { dayKey, ...completion, dayData };
      });
      const fillPercent = totalFields > 0 ? Math.round((totalFilled / totalFields) * 100) : 0;
      teacherMap[teacherName].children.push({
        student_id: student.student_id,
        name: student.name || 'Unnamed',
        groupName: student.groupName || 'Ungrouped',
        fillPercent,
        hasJadwal: scheduleData !== null,
        mode,
        dayDetails,
        totalDays,
        scheduleData,
        userId,
        parentName: portalUserMap[userId] || null,
      });
      teacherMap[teacherName].totalStudents += 1;
    });
    return Object.values(teacherMap).map(teacher => ({
      ...teacher,
      jadwalFilledCount: teacher.children.filter(c => c.hasJadwal).length,
      avgFillPercent: teacher.children.length > 0
        ? Math.round(teacher.children.reduce((sum, c) => sum + c.fillPercent, 0) / teacher.children.length)
        : 0,
    }));
  }, [students, selfJadwalData, dayDateStrings, portalUserMap]);

  const activeStats = viewMode === 'miqaat' ? teacherJadwalStats : selfJadwalStats;
  const totalWithData = activeStats.reduce((s, t) => s + t.jadwalFilledCount, 0);
  const totalStudents = activeStats.reduce((s, t) => s + t.totalStudents, 0);
  const overallAvg = activeStats.length > 0
    ? Math.round(activeStats.reduce((sum, t) => sum + t.avgFillPercent, 0) / activeStats.length)
    : 0;

  const downloadCSV = () => {
    const BOM = '\uFEFF';
    let maxDays = 0;
    activeStats.forEach(t => {
      t.children.forEach(c => {
        if (c.dayDetails.length > maxDays) maxDays = c.dayDetails.length;
      });
    });
    const headers = ['Student Name', 'Teacher Group', 'Mode', 'Parent User'];
    for (let d = 0; d < maxDays; d++) {
      const dateStr = dayDateStrings[d] || '';
      const engDate = dateStr
        ? new Date(dateStr + 'T00:00:00Z').toLocaleDateString('en-GB', { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric' })
        : `Day ${d + 1}`;
      headers.push(`Day ${d + 1} (${engDate}) - Murajah`);
      headers.push(`Day ${d + 1} - Jadeed`);
      headers.push(`Day ${d + 1} - Juzhali`);
    }
    const rows = [];
    activeStats.forEach(t => {
      t.children.forEach(c => {
        const row = [c.name, c.groupName, c.mode === 'juz-wise' ? 'Juz Wise' : 'Surah Wise', c.parentName || ''];
        for (let d = 0; d < maxDays; d++) {
          const dd = c.dayDetails[d];
          if (dd && dd.dayData) {
            const data = dd.dayData;
            if (c.mode === 'juz-wise') {
              const juzVals = ['juz1', 'juz2', 'juz3', 'juz4'].map(j => data[j] ? toArabicNum(data[j]) : '').filter(Boolean).join(' - ');
              row.push(juzVals || '');
            } else {
              row.push(isFieldFilled(data.murajah) ? formatMurajah(data.murajah) : '');
            }
            row.push(isFieldFilled(data.jadeed) ? formatJadeed(data.jadeed) : '');
            row.push(isFieldFilled(data.juzhali) ? formatJuzhali(data.juzhali) : '');
          } else {
            row.push('', '', '');
          }
        }
        rows.push(row);
      });
    });
    const esc = (val) => {
      const s = String(val || '');
      if (s.includes(',') || s.includes('"') || s.includes('\n')) return '"' + s.replace(/"/g, '""') + '"';
      return s;
    };
    const csvContent = BOM + [headers, ...rows].map(r => r.map(esc).join(',')).join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    import("./downloadUtils").then(m => m.downloadFile(blob, `Jadwal_Tracking_${viewMode}_${new Date().toISOString().split('T')[0]}.csv`));
  };

  const renderDayCell = (dayDetail, mode) => {
    const dayData = dayDetail.dayData || {};
    if (mode === 'juz-wise') {
      const juzVals = ['juz1', 'juz2', 'juz3', 'juz4'].map(j => dayData[j]).filter(v => v).join(', ');
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '11px', lineHeight: 1.3 }}>
          <span style={{ fontFamily: "'Al-Kanz', serif", direction: 'rtl', color: dayData.juz1 || dayData.juz2 || dayData.juz3 || dayData.juz4 ? '#2e7d32' : '#ccc' }}>
            {juzVals || '—'}
          </span>
          <span style={{ fontFamily: "'Al-Kanz', 'Kanz al Marjaan', serif", direction: 'rtl', color: isFieldFilled(dayData.jadeed) ? '#5d4037' : '#ddd' }}>
            {isFieldFilled(dayData.jadeed) ? formatJadeed(dayData.jadeed) : '—'}
          </span>
          <span style={{ fontFamily: "'Al-Kanz', serif", direction: 'rtl', color: isFieldFilled(dayData.juzhali) ? '#5d4037' : '#ddd' }}>
            {isFieldFilled(dayData.juzhali) ? formatJuzhali(dayData.juzhali) : '—'}
          </span>
        </div>
      );
    }
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '11px', lineHeight: 1.3 }}>
        <span style={{ fontFamily: "'Al-Kanz', 'Kanz al Marjaan', serif", direction: 'rtl', color: isFieldFilled(dayData.murajah) ? '#2e7d32' : '#ccc' }}>
          {isFieldFilled(dayData.murajah) ? formatMurajah(dayData.murajah) : '—'}
        </span>
        <span style={{ fontFamily: "'Al-Kanz', 'Kanz al Marjaan', serif", direction: 'rtl', color: isFieldFilled(dayData.jadeed) ? '#5d4037' : '#ddd' }}>
          {isFieldFilled(dayData.jadeed) ? formatJadeed(dayData.jadeed) : '—'}
        </span>
        <span style={{ fontFamily: "'Al-Kanz', serif", direction: 'rtl', color: isFieldFilled(dayData.juzhali) ? '#5d4037' : '#ddd' }}>
          {isFieldFilled(dayData.juzhali) ? formatJuzhali(dayData.juzhali) : '—'}
        </span>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="overview-container fade-in" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton-el" style={{ height: i === 0 ? '52px' : '80px', borderRadius: '14px' }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="overview-container fade-in" style={{ paddingTop: '8px', paddingBottom: '32px' }}>
      <div className="overview-selection-header card-appear" style={{ marginBottom: '16px' }}>
        <div className="selection-box" style={{ border: 'none', padding: '18px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Calendar size={28} className="gold-icon" />
              <div>
                <h3 style={{ margin: 0, color: 'var(--deep-brown)', fontSize: '1.3rem' }}>
                  {viewMode === 'miqaat' ? 'Miqaat Jadwal Tracking' : 'Weekly Jadwal Tracking'}
                </h3>
                <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  {activeStats.length} teachers · {totalWithData}/{totalStudents} with data · Avg {overallAvg}% filled
                  {dayDateStrings.length > 0 && ` · ${dayDateStrings[0]} to ${dayDateStrings[dayDateStrings.length - 1]}`}
                </p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button
                className="action-button"
                onClick={downloadCSV}
                style={{ background: '#2e7d32', color: 'white', padding: '8px 16px', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '6px', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
              >
                <Download size={14} /> Download CSV
              </button>
              <button
                className="action-button"
                onClick={loadAllData}
                style={{ background: 'var(--soft-brown)', color: 'white', padding: '8px 16px', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '6px', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
              >
                <Loader2 size={14} /> Refresh
              </button>
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', padding: '0 4px' }}>
        <button
          onClick={() => { setViewMode('miqaat'); setSelectedGroup(null); setExpandedStudent(null); }}
          style={{
            flex: 1,
            padding: '12px 16px',
            border: 'none',
            borderRadius: '12px',
            cursor: 'pointer',
            fontWeight: viewMode === 'miqaat' ? 700 : 500,
            fontSize: '0.88rem',
            background: viewMode === 'miqaat'
              ? 'linear-gradient(135deg, #d4af37, #b8941f)'
              : 'rgba(0,0,0,0.04)',
            color: viewMode === 'miqaat' ? 'white' : 'var(--text-muted)',
            transition: 'all 0.2s ease',
            boxShadow: viewMode === 'miqaat' ? '0 4px 16px rgba(212,175,55,0.3)' : 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
          }}
        >
          <Sparkles size={18} />
          <span>Miqaat Jadwal</span>
          {viewMode === 'miqaat' && (
            <span style={{ background: 'rgba(255,255,255,0.25)', borderRadius: '20px', padding: '2px 10px', fontSize: '0.7rem', fontWeight: 600 }}>
              Teacher Jadwal
            </span>
          )}
        </button>
        <button
          onClick={() => { setViewMode('weekly'); setSelectedGroup(null); setExpandedStudent(null); }}
          style={{
            flex: 1,
            padding: '12px 16px',
            border: 'none',
            borderRadius: '12px',
            cursor: 'pointer',
            fontWeight: viewMode === 'weekly' ? 700 : 500,
            fontSize: '0.88rem',
            background: viewMode === 'weekly'
              ? 'linear-gradient(135deg, #5d4037, #4e342e)'
              : 'rgba(0,0,0,0.04)',
            color: viewMode === 'weekly' ? 'white' : 'var(--text-muted)',
            transition: 'all 0.2s ease',
            boxShadow: viewMode === 'weekly' ? '0 4px 16px rgba(93,64,55,0.3)' : 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
          }}
        >
          <Calendar size={18} />
          <span>Weekly Jadwal</span>
          {viewMode === 'weekly' && (
            <span style={{ background: 'rgba(255,255,255,0.2)', borderRadius: '20px', padding: '2px 10px', fontSize: '0.7rem', fontWeight: 600 }}>
              Self Jadwal
            </span>
          )}
        </button>
      </div>

      {viewMode === 'miqaat' && selfJadwalData && Object.keys(selfJadwalData).length === 0 && (
        <div style={{
          background: 'linear-gradient(135deg, #fff8e1, #fff3cd)',
          borderRadius: '12px',
          padding: '14px 18px',
          marginBottom: '16px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          fontSize: '0.82rem',
          color: '#856404',
          border: '1px solid #ffeeba',
        }}>
          <Info size={18} />
          Self Jadwal data may require admin RLS policy. Run the migration at <code>supabase/migrations/20260709000000_add_admin_self_jadwal_policy.sql</code> to enable admin access.
        </div>
      )}

      <div className="jadwal-summary-cards" style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
        gap: '12px',
        marginBottom: '20px',
      }}>
        <div className="premium-card card-appear" style={{ padding: '16px 18px', borderRadius: '14px', background: 'linear-gradient(135deg, rgba(212,175,55,0.08), rgba(212,175,55,0.02))', border: '1px solid rgba(212,175,55,0.15)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <GraduationCap size={20} style={{ color: 'var(--primary-gold)' }} />
            <div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Teachers</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--deep-brown)' }}>{activeStats.length}</div>
            </div>
          </div>
        </div>
        <div className="premium-card card-appear" style={{ padding: '16px 18px', borderRadius: '14px', background: 'linear-gradient(135deg, rgba(46,125,50,0.08), rgba(46,125,50,0.02))', border: '1px solid rgba(46,125,50,0.15)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Users size={20} style={{ color: '#2e7d32' }} />
            <div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>With Data</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#2e7d32' }}>{totalWithData}/{totalStudents}</div>
            </div>
          </div>
        </div>
        <div className="premium-card card-appear" style={{ padding: '16px 18px', borderRadius: '14px', background: 'linear-gradient(135deg, rgba(245,127,23,0.08), rgba(245,127,23,0.02))', border: '1px solid rgba(245,127,23,0.15)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <BarChart3 size={20} style={{ color: '#f57f17' }} />
            <div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Avg Fill</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#f57f17' }}>{overallAvg}%</div>
            </div>
          </div>
        </div>
        <div className="premium-card card-appear" style={{ padding: '16px 18px', borderRadius: '14px', background: 'linear-gradient(135deg, rgba(33,150,243,0.08), rgba(33,150,243,0.02))', border: '1px solid rgba(33,150,243,0.15)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Calendar size={20} style={{ color: '#2196f3' }} />
            <div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Days</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#2196f3' }}>{dayDateStrings.length}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="jadwal-teacher-grid" style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(min(320px, 100%), 1fr))',
        gap: '16px',
        width: '100%',
        boxSizing: 'border-box',
      }}>
        {activeStats.map(teacher => (
          <div
            key={teacher.teacherName}
            className="premium-card card-appear"
            style={{
              padding: '20px',
              cursor: 'pointer',
              transition: 'transform 0.2s ease, box-shadow 0.2s ease',
              borderLeft: teacher.jadwalFilledCount > 0
                ? '4px solid var(--primary-gold)'
                : '4px solid #e0d6c8',
              borderRadius: '14px',
              background: 'var(--premium-white)',
              boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
              position: 'relative',
              overflow: 'hidden',
            }}
            onClick={() => setSelectedGroup(teacher)}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 12px 30px rgba(0,0,0,0.1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = '';
              e.currentTarget.style.boxShadow = '';
            }}
          >
            <div style={{
              position: 'absolute',
              top: 0,
              right: 0,
              width: '80px',
              height: '80px',
              borderRadius: '0 14px 0 80px',
              background: teacher.avgFillPercent >= 80
                ? 'rgba(46,125,50,0.06)'
                : teacher.avgFillPercent >= 50
                  ? 'rgba(245,127,23,0.06)'
                  : 'rgba(198,40,40,0.05)',
            }} />
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', position: 'relative', zIndex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '46px',
                  height: '46px',
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
                    {teacher.totalStudents} students · {teacher.jadwalFilledCount} with data
                  </p>
                </div>
              </div>
              <ChevronRight size={18} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            </div>
            <div style={{ marginTop: '14px', position: 'relative', zIndex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Fill Rate</span>
                <span style={{
                  fontSize: '0.85rem',
                  fontWeight: 'bold',
                  color: teacher.avgFillPercent >= 80 ? '#2e7d32' : teacher.avgFillPercent >= 50 ? '#f57f17' : '#c62828'
                }}>
                  {teacher.avgFillPercent}%
                </span>
              </div>
              <div style={{
                height: '8px',
                borderRadius: '4px',
                background: 'rgba(0,0,0,0.06)',
                overflow: 'hidden',
              }}>
                <div style={{
                  height: '100%',
                  borderRadius: '4px',
                  width: `${teacher.avgFillPercent}%`,
                  background: teacher.avgFillPercent >= 80
                    ? 'linear-gradient(90deg, #66bb6a, #43a047)'
                    : teacher.avgFillPercent >= 50
                      ? 'linear-gradient(90deg, #ffb300, #ff8f00)'
                      : 'linear-gradient(90deg, #ef5350, #d32f2f)',
                  transition: 'width 0.8s ease',
                }} />
              </div>
              {teacher.jadwalFilledCount > 0 && (
                <div style={{ marginTop: '8px', display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                  <span style={{
                    fontSize: '0.68rem',
                    background: teacher.avgFillPercent >= 80 ? 'rgba(46,125,50,0.1)' : 'rgba(245,127,23,0.1)',
                    color: teacher.avgFillPercent >= 80 ? '#2e7d32' : '#e65100',
                    padding: '2px 8px',
                    borderRadius: '20px',
                    fontWeight: 600,
                  }}>
                    {teacher.jadwalFilledCount}/{teacher.totalStudents} filled
                  </span>
                  <span style={{
                    fontSize: '0.68rem',
                    background: 'rgba(33,150,243,0.1)',
                    color: '#1565c0',
                    padding: '2px 8px',
                    borderRadius: '20px',
                    fontWeight: 600,
                  }}>
                    {Math.round(teacher.children.reduce((s, c) => s + c.dayDetails.filter(d => d.completed).length, 0) / Math.max(1, teacher.children.length))}/{teacher.children[0]?.dayDetails.length || 0} days avg
                  </span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {activeStats.length === 0 && (
        <div className="empty-overview card-appear" style={{ textAlign: 'center', padding: '60px 20px' }}>
          {viewMode === 'miqaat' ? <Sparkles size={64} className="empty-icon" /> : <Calendar size={64} className="empty-icon" />}
          <h3>No {viewMode === 'miqaat' ? 'Miqaat' : 'Weekly'} Jadwal Data</h3>
          <p>No teachers or students found for {viewMode === 'miqaat' ? 'the miqaat period' : 'the current week'}.</p>
        </div>
      )}

      {selectedGroup && (
        <div
          className="notifications-panel-overlay"
          style={{ zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', boxSizing: 'border-box' }}
          onClick={() => { setSelectedGroup(null); setExpandedStudent(null); }}
        >
          <div
            className="premium-card"
            style={{
              position: 'relative',
              width: 'min(1100px, 94vw)',
              maxHeight: '88vh',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              padding: 0,
              borderRadius: '20px',
              boxShadow: '0 30px 80px rgba(0,0,0,0.25)',
              animation: 'modalScaleIn 0.2s ease',
              background: 'white',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{
              padding: '20px 24px 14px',
              borderBottom: '1px solid rgba(0,0,0,0.06)',
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              flexShrink: 0,
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                  <GraduationCap size={22} style={{ color: 'var(--primary-gold)' }} />
                  <h3 style={{ margin: 0, color: 'var(--deep-brown)', fontSize: '1.15rem' }}>
                    {selectedGroup.teacherName}
                  </h3>
                </div>
                <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  {selectedGroup.children.length} students · {selectedGroup.jadwalFilledCount} with data · Avg {selectedGroup.avgFillPercent}% filled
                </p>
              </div>
              <button
                onClick={() => { setSelectedGroup(null); setExpandedStudent(null); }}
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
            <div style={{ overflow: 'auto', padding: '16px 24px 20px', flex: 1 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {selectedGroup.children.map((child, childIdx) => {
                  const isExpanded = expandedStudent === child.student_id;
                  const dayKeys = child.dayDetails;
                  return (
                    <div key={child.student_id} style={{
                      borderRadius: '12px',
                      border: '1px solid',
                      borderColor: child.hasJadwal
                        ? child.fillPercent >= 80 ? 'rgba(67,160,71,0.25)' : child.fillPercent >= 50 ? 'rgba(255,143,0,0.2)' : 'rgba(211,47,47,0.15)'
                        : 'rgba(0,0,0,0.06)',
                      background: child.hasJadwal ? 'white' : 'rgba(248,245,240,0.5)',
                      overflow: 'hidden',
                    }}>
                      <div
                        style={{
                          padding: '12px 16px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          cursor: child.hasJadwal ? 'pointer' : 'default',
                          transition: 'background 0.15s ease',
                        }}
                        onClick={() => {
                          if (!child.hasJadwal) return;
                          setExpandedStudent(isExpanded ? null : child.student_id);
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                          <div style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: '10px',
                            display: 'grid',
                            placeItems: 'center',
                            fontSize: '0.75rem',
                            fontWeight: 'bold',
                            flexShrink: 0,
                            background: child.hasJadwal
                              ? child.fillPercent >= 80 ? 'rgba(46,125,50,0.12)' : child.fillPercent >= 50 ? 'rgba(245,127,23,0.12)' : 'rgba(198,40,40,0.1)'
                              : 'rgba(0,0,0,0.04)',
                            color: child.hasJadwal
                              ? child.fillPercent >= 80 ? '#2e7d32' : child.fillPercent >= 50 ? '#e65100' : '#c62828'
                              : '#bbb',
                          }}>
                            {child.hasJadwal ? (
                              child.fillPercent >= 80 ? <CheckCircle size={16} /> : <AlertCircle size={16} />
                            ) : (
                              <X size={14} />
                            )}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{
                              fontWeight: 600,
                              color: 'var(--deep-brown)',
                              fontSize: '0.88rem',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}>
                              {child.name}
                            </div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                              <span>{child.groupName}</span>
                              <span style={{ color: '#d4af37' }}>·</span>
                              <span style={{ fontFamily: "'Al-Kanz', 'Kanz al Marjaan', serif", direction: 'rtl', fontSize: '0.75rem' }}>
                                {child.mode === 'juz-wise' ? 'جزء wise' : 'سورة wise'}
                              </span>
                              {child.parentName && (
                                <>
                                  <span style={{ color: '#d4af37' }}>·</span>
                                  <User size={11} style={{ color: 'var(--text-muted)' }} />
                                  <span>{child.parentName}</span>
                                </>
                              )}
                              <span style={{ color: '#d4af37' }}>·</span>
                              <span>{child.totalDays} days</span>
                            </div>
                          </div>
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div>
                            <div style={{
                              fontSize: '0.95rem',
                              fontWeight: 'bold',
                              color: child.hasJadwal
                                ? child.fillPercent >= 80 ? '#2e7d32' : child.fillPercent >= 50 ? '#e65100' : '#c62828'
                                : '#bbb',
                            }}>
                              {child.hasJadwal ? `${child.fillPercent}%` : '—'}
                            </div>
                            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                              {child.hasJadwal ? `${dayKeys.filter(d => d.completed).length}/${child.totalDays} days complete` : 'No Jadwal'}
                            </div>
                          </div>
                          {child.hasJadwal && (
                            <div style={{
                              transform: isExpanded ? 'rotate(90deg)' : 'none',
                              transition: 'transform 0.2s ease',
                              color: 'var(--text-muted)',
                            }}>
                              <ChevronRight size={16} />
                            </div>
                          )}
                        </div>
                      </div>
                      {isExpanded && child.hasJadwal && (
                        <div style={{
                          borderTop: '1px solid rgba(0,0,0,0.05)',
                          padding: '12px 16px 16px',
                          background: 'rgba(252,250,245,0.5)',
                        }}>
                          <div style={{
                            display: 'grid',
                            gridTemplateColumns: `100px repeat(${dayKeys.length}, 140px)`,
                            gap: '6px',
                            overflowX: 'auto',
                            paddingBottom: '4px',
                          }}>
                            <div style={{
                              fontSize: '10px', fontWeight: 700, textTransform: 'uppercase',
                              letterSpacing: '0.05em', color: 'var(--text-muted)',
                              padding: '6px 8px', display: 'flex', alignItems: 'center',
                              gap: '4px', borderBottom: '2px solid var(--primary-gold)',
                            }}>
                              <Eye size={12} /> Day
                            </div>
                            {dayKeys.map((dd, dIdx) => {
                              const dateStr = dayDateStrings[dIdx] || '';
                              const engDate = dateStr
                                ? new Date(dateStr + 'T00:00:00Z').toLocaleDateString('en-GB', { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric' })
                                : '—';
                              const fatemiDate = getFatemiDateStr(dateStr);
                              return (
                                <div key={dd.dayKey} style={{
                                  fontSize: '10px', fontWeight: 700, color: 'var(--deep-brown)',
                                  padding: '6px 8px', textAlign: 'center',
                                  borderBottom: '2px solid var(--primary-gold)',
                                  background: dd.completed ? 'rgba(46,125,50,0.05)' : dd.filled > 0 ? 'rgba(245,127,23,0.05)' : 'rgba(198,40,40,0.04)',
                                  borderRadius: '4px 4px 0 0',
                                }}>
                                  <div>Day {dIdx + 1}</div>
                                  <div style={{ fontSize: '8px', fontWeight: 400, color: 'var(--text-muted)', marginTop: '1px' }}>{engDate}</div>
                                  <div style={{ fontSize: '8px', fontWeight: 400, color: 'var(--text-muted)', marginTop: '1px', fontFamily: "'Al-Kanz', 'Kanz al Marjaan', serif", direction: 'rtl' }}>
                                    {fatemiDate}
                                  </div>
                                  <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: dd.completed ? '#43a047' : dd.filled > 0 ? '#ffb300' : '#ef5350', margin: '2px auto 0', display: 'inline-block' }} />
                                </div>
                              );
                            })}
                            <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--deep-brown)', padding: '6px 8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <BookOpen size={12} />
                              {child.mode === 'juz-wise' ? 'Juz' : 'Murajah'}
                            </div>
                            {dayKeys.map(dd => {
                              const d = dd.dayData || {};
                              if (child.mode === 'juz-wise') {
                                const vals = ['juz1', 'juz2', 'juz3', 'juz4'].map(j => d[j]).filter(v => v);
                                return (
                                  <div key={dd.dayKey} style={{ fontSize: '12px', fontFamily: "'Al-Kanz', serif", direction: 'rtl', padding: '6px 8px', textAlign: 'center', background: vals.length > 0 ? 'rgba(46,125,50,0.06)' : 'rgba(0,0,0,0.02)', borderRadius: '4px', color: vals.length > 0 ? '#2e7d32' : '#ccc' }}>
                                    {vals.length > 0 ? vals.join(', ') : '—'}
                                  </div>
                                );
                              }
                              return (
                                <div key={dd.dayKey} style={{ fontSize: '12px', fontFamily: "'Al-Kanz', 'Kanz al Marjaan', serif", direction: 'rtl', padding: '6px 8px', textAlign: 'center', background: isFieldFilled(d.murajah) ? 'rgba(46,125,50,0.06)' : 'rgba(0,0,0,0.02)', borderRadius: '4px', color: isFieldFilled(d.murajah) ? '#2e7d32' : '#ccc' }}>
                                  {isFieldFilled(d.murajah) ? formatMurajah(d.murajah) : '—'}
                                </div>
                              );
                            })}
                            <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--deep-brown)', padding: '6px 8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <Sparkles size={12} /> Jadeed
                            </div>
                            {dayKeys.map(dd => {
                              const d = dd.dayData || {};
                              return (
                                <div key={dd.dayKey} style={{ fontSize: '12px', fontFamily: "'Al-Kanz', 'Kanz al Marjaan', serif", direction: 'rtl', padding: '6px 8px', textAlign: 'center', background: isFieldFilled(d.jadeed) ? 'rgba(46,125,50,0.06)' : 'rgba(0,0,0,0.02)', borderRadius: '4px', color: isFieldFilled(d.jadeed) ? '#5d4037' : '#ccc', lineHeight: 1.3 }}>
                                  {isFieldFilled(d.jadeed) ? formatJadeed(d.jadeed) : '—'}
                                </div>
                              );
                            })}
                            <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--deep-brown)', padding: '6px 8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <Repeat size={12} /> Juzhali
                            </div>
                            {dayKeys.map(dd => {
                              const d = dd.dayData || {};
                              return (
                                <div key={dd.dayKey} style={{ fontSize: '12px', fontFamily: "'Al-Kanz', 'Kanz al Marjaan', serif", direction: 'rtl', padding: '6px 8px', textAlign: 'center', background: isFieldFilled(d.juzhali) ? 'rgba(46,125,50,0.06)' : 'rgba(0,0,0,0.02)', borderRadius: '4px', color: isFieldFilled(d.juzhali) ? '#5d4037' : '#ccc' }}>
                                  {isFieldFilled(d.juzhali) ? formatJuzhali(d.juzhali) : '—'}
                                </div>
                              );
                            })}
                          </div>
                          <div style={{ marginTop: '10px', display: 'flex', gap: '12px', flexWrap: 'wrap', fontSize: '0.72rem', color: 'var(--text-muted)', borderTop: '1px solid rgba(0,0,0,0.04)', paddingTop: '10px' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: '#43a047', display: 'inline-block' }} /> Complete
                            </span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: '#ffb300', display: 'inline-block' }} /> Partial
                            </span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: '#ef5350', display: 'inline-block' }} /> Empty
                            </span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: '#f44336', display: 'inline-block' }} /> NO (explicit skip)
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            <div style={{
              padding: '10px 24px', borderTop: '1px solid rgba(0,0,0,0.06)',
              background: 'rgba(252,250,245,0.8)', display: 'flex',
              justifyContent: 'space-between', alignItems: 'center',
              fontSize: '0.78rem', color: 'var(--text-muted)', flexShrink: 0,
            }}>
              <span>
                <Sparkles size={14} style={{ verticalAlign: 'middle', marginRight: '4px', color: 'var(--primary-gold)' }} />
                Avg fill: {selectedGroup.avgFillPercent}%
              </span>
              <span style={{ display: 'flex', gap: '12px' }}>
                <span>{selectedGroup.jadwalFilledCount}/{selectedGroup.totalStudents} with data</span>
                <span style={{ color: '#d4af37' }}>·</span>
                <span>{selectedGroup.children.reduce((s, c) => s + c.dayDetails.filter(d => d.completed).length, 0)}/{selectedGroup.children.reduce((s, c) => s + c.dayDetails.length, 0)} days complete</span>
              </span>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes modalScaleIn {
          from { opacity: 0; transform: scale(0.96); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
};

export default JadwalTrackingView;
