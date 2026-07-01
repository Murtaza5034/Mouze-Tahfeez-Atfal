import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { GoogleAuth } from "npm:google-auth-library@9.6.3"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const DAYS = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];

function isZilhaj30(dateStr: string): boolean {
  if (!dateStr) return false;
  try {
    const date = new Date(dateStr);
    const parts = new Intl.DateTimeFormat('en-u-ca-islamic-tbla-nu-latn', {
      day: 'numeric', month: 'numeric', year: 'numeric'
    }).formatToParts(date);
    const d = parseInt(parts.find(p => p.type === 'day')!.value);
    const m = parseInt(parts.find(p => p.type === 'month')!.value);
    return m === 12 && d === 30;
  } catch { return false; }
}

const SURAH_AYAH_DATA = [
  { number: 1, nameEn: 'Al-Fatiha', nameAr: 'الفاتحة' },
  { number: 2, nameEn: "Al-Baqarah", nameAr: 'البقرة' },
  { number: 3, nameEn: "Aal-e-Imran", nameAr: 'آل عمران' },
  { number: 4, nameEn: "An-Nisa", nameAr: 'النساء' },
  { number: 5, nameEn: "Al-Ma'idah", nameAr: 'المائدة' },
  { number: 6, nameEn: "Al-An'am", nameAr: 'الأنعام' },
  { number: 7, nameEn: "Al-A'raf", nameAr: 'الأعراف' },
  { number: 8, nameEn: "Al-Anfal", nameAr: 'الأنفال' },
  { number: 9, nameEn: "At-Tawbah", nameAr: 'التوبة' },
  { number: 10, nameEn: "Yunus", nameAr: 'يونس' },
  { number: 11, nameEn: "Hud", nameAr: 'هود' },
  { number: 12, nameEn: "Yusuf", nameAr: 'يوسف' },
  { number: 13, nameEn: "Ar-Ra'd", nameAr: 'الرعد' },
  { number: 14, nameEn: "Ibrahim", nameAr: 'إبراهيم' },
  { number: 15, nameEn: "Al-Hijr", nameAr: 'الحجر' },
  { number: 16, nameEn: "An-Nahl", nameAr: 'النحل' },
  { number: 17, nameEn: "Al-Isra", nameAr: 'الإسراء' },
  { number: 18, nameEn: "Al-Kahf", nameAr: 'الكهف' },
  { number: 19, nameEn: "Maryam", nameAr: 'مريم' },
  { number: 20, nameEn: "Ta-Ha", nameAr: 'طه' },
  { number: 21, nameEn: "Al-Anbiya", nameAr: 'الأنبياء' },
  { number: 22, nameEn: "Al-Hajj", nameAr: 'الحج' },
  { number: 23, nameEn: "Al-Mu'minun", nameAr: 'المؤمنون' },
  { number: 24, nameEn: "An-Nur", nameAr: 'النور' },
  { number: 25, nameEn: "Al-Furqan", nameAr: 'الفرقان' },
  { number: 26, nameEn: "Ash-Shu'ara", nameAr: 'الشعراء' },
  { number: 27, nameEn: "An-Naml", nameAr: 'النمل' },
  { number: 28, nameEn: "Al-Qasas", nameAr: 'القصص' },
  { number: 29, nameEn: "Al-Ankabut", nameAr: 'العنكبوت' },
  { number: 30, nameEn: "Ar-Rum", nameAr: 'الروم' },
  { number: 31, nameEn: "Luqman", nameAr: 'لقمان' },
  { number: 32, nameEn: "As-Sajdah", nameAr: 'السجدة' },
  { number: 33, nameEn: "Al-Ahzab", nameAr: 'الأحزاب' },
  { number: 34, nameEn: "Saba", nameAr: 'سبأ' },
  { number: 35, nameEn: "Fatir", nameAr: 'فاطر' },
  { number: 36, nameEn: "Ya-Sin", nameAr: 'يس' },
  { number: 37, nameEn: "As-Saffat", nameAr: 'الصافات' },
  { number: 38, nameEn: "Sad", nameAr: 'ص' },
  { number: 39, nameEn: "Az-Zumar", nameAr: 'الزمر' },
  { number: 40, nameEn: "Ghafir", nameAr: 'غافر' },
  { number: 41, nameEn: "Fussilat", nameAr: 'فصلت' },
  { number: 42, nameEn: "Ash-Shura", nameAr: 'الشورى' },
  { number: 43, nameEn: "Az-Zukhruf", nameAr: 'الزخرف' },
  { number: 44, nameEn: "Ad-Dukhan", nameAr: 'الدخان' },
  { number: 45, nameEn: "Al-Jathiyah", nameAr: 'الجاثية' },
  { number: 46, nameEn: "Al-Ahqaf", nameAr: 'الأحقاف' },
  { number: 47, nameEn: "Muhammad", nameAr: 'محمد' },
  { number: 48, nameEn: "Al-Fath", nameAr: 'الفتح' },
  { number: 49, nameEn: "Al-Hujurat", nameAr: 'الحجرات' },
  { number: 50, nameEn: "Qaf", nameAr: 'ق' },
  { number: 51, nameEn: "Adh-Dhariyat", nameAr: 'الذاريات' },
  { number: 52, nameEn: "At-Tur", nameAr: 'الطور' },
  { number: 53, nameEn: "An-Najm", nameAr: 'النجم' },
  { number: 54, nameEn: "Al-Qamar", nameAr: 'القمر' },
  { number: 55, nameEn: "Ar-Rahman", nameAr: 'الرحمن' },
  { number: 56, nameEn: "Al-Waqi'ah", nameAr: 'الواقعة' },
  { number: 57, nameEn: "Al-Hadid", nameAr: 'الحديد' },
  { number: 58, nameEn: "Al-Mujadilah", nameAr: 'المجادلة' },
  { number: 59, nameEn: "Al-Hashr", nameAr: 'الحشر' },
  { number: 60, nameEn: "Al-Mumtahanah", nameAr: 'الممتحنة' },
  { number: 61, nameEn: "As-Saff", nameAr: 'الصف' },
  { number: 62, nameEn: "Al-Jumu'ah", nameAr: 'الجمعة' },
  { number: 63, nameEn: "Al-Munafiqun", nameAr: 'المنافقون' },
  { number: 64, nameEn: "At-Taghabun", nameAr: 'التغابن' },
  { number: 65, nameEn: "At-Talaq", nameAr: 'الطلاق' },
  { number: 66, nameEn: "At-Tahrim", nameAr: 'التحريم' },
  { number: 67, nameEn: "Al-Mulk", nameAr: 'الملك' },
  { number: 68, nameEn: "Al-Qalam", nameAr: 'القلم' },
  { number: 69, nameEn: "Al-Haqqah", nameAr: 'الحاقة' },
  { number: 70, nameEn: "Al-Ma'arij", nameAr: 'المعارج' },
  { number: 71, nameEn: "Nuh", nameAr: 'نوح' },
  { number: 72, nameEn: "Al-Jinn", nameAr: 'الجن' },
  { number: 73, nameEn: "Al-Muzzammil", nameAr: 'المزمل' },
  { number: 74, nameEn: "Al-Muddaththir", nameAr: 'المدثر' },
  { number: 75, nameEn: "Al-Qiyamah", nameAr: 'القيامة' },
  { number: 76, nameEn: "Al-Insan", nameAr: 'الإنسان' },
  { number: 77, nameEn: "Al-Mursalat", nameAr: 'المرسلات' },
  { number: 78, nameEn: "An-Naba", nameAr: 'النبأ' },
  { number: 79, nameEn: "An-Nazi'at", nameAr: 'النازعات' },
  { number: 80, nameEn: "Abasa", nameAr: 'عبس' },
  { number: 81, nameEn: "At-Takwir", nameAr: 'التكوير' },
  { number: 82, nameEn: "Al-Infitar", nameAr: 'الإنفطار' },
  { number: 83, nameEn: "Al-Mutaffifin", nameAr: 'المطففين' },
  { number: 84, nameEn: "Al-Inshiqaq", nameAr: 'الإنشقاق' },
  { number: 85, nameEn: "Al-Buruj", nameAr: 'البروج' },
  { number: 86, nameEn: "At-Tariq", nameAr: 'الطارق' },
  { number: 87, nameEn: "Al-Ala", nameAr: 'الأعلى' },
  { number: 88, nameEn: "Al-Ghashiyah", nameAr: 'الغاشية' },
  { number: 89, nameEn: "Al-Fajr", nameAr: 'الفجر' },
  { number: 90, nameEn: "Al-Balad", nameAr: 'البلد' },
  { number: 91, nameEn: "Ash-Shams", nameAr: 'الشمس' },
  { number: 92, nameEn: "Al-Layl", nameAr: 'الليل' },
  { number: 93, nameEn: "Ad-Duha", nameAr: 'الضحى' },
  { number: 94, nameEn: "Ash-Sharh", nameAr: 'الشرح' },
  { number: 95, nameEn: "At-Tin", nameAr: 'التين' },
  { number: 96, nameEn: "Al-Alaq", nameAr: 'العلق' },
  { number: 97, nameEn: "Al-Qadr", nameAr: 'القدر' },
  { number: 98, nameEn: "Al-Bayyinah", nameAr: 'البينة' },
  { number: 99, nameEn: "Az-Zalzalah", nameAr: 'الزلزلة' },
  { number: 100, nameEn: "Al-Adiyat", nameAr: 'العاديات' },
  { number: 101, nameEn: "Al-Qari'ah", nameAr: 'القارعة' },
  { number: 102, nameEn: "At-Takathur", nameAr: 'التكاثر' },
  { number: 103, nameEn: "Al-Asr", nameAr: 'العصر' },
  { number: 104, nameEn: "Al-Humazah", nameAr: 'الهمزة' },
  { number: 105, nameEn: "Al-Fil", nameAr: 'الفيل' },
  { number: 106, nameEn: "Quraysh", nameAr: 'قريش' },
  { number: 107, nameEn: "Al-Ma'un", nameAr: 'الماعون' },
  { number: 108, nameEn: "Al-Kawthar", nameAr: 'الكوثر' },
  { number: 109, nameEn: "Al-Kafirun", nameAr: 'الكافرون' },
  { number: 110, nameEn: "An-Nasr", nameAr: 'النصر' },
  { number: 111, nameEn: "Al-Masad", nameAr: 'المسد' },
  { number: 112, nameEn: "Al-Ikhlas", nameAr: 'الإخلاص' },
  { number: 113, nameEn: "Al-Falaq", nameAr: 'الفلق' },
  { number: 114, nameEn: "An-Nas", nameAr: 'الناس' },
];

interface FcmSendResult {
  token: string
  success: boolean
  status: "delivered" | "stale" | "failed"
  name?: string
  error?: string
}

interface ParsedFcmError {
  code?: number
  status?: string
  message?: string
  errorCode?: string
  raw: string
}

function getSurahName(surahNum: string): string {
  const num = parseInt(surahNum);
  const surah = SURAH_AYAH_DATA.find(s => s.number === num);
  return surah ? surah.nameAr : surahNum;
}

function toArabicNum(n: number): string {
  const arabicDigits = '٠١٢٣٤٥٦٧٨٩';
  return String(n).replace(/\d/g, d => arabicDigits[d]);
}

function formatTodayTasks(row: Record<string, string>, mode: string): string {
  const parts: string[] = [];

  if (mode === 'juz-wise') {
    const juzParts: string[] = [];
    for (const key of ['juz1', 'juz2', 'juz3', 'juz4']) {
      if (row[key] && row[key].trim()) {
        juzParts.push(row[key].trim());
      }
    }
    if (juzParts.length > 0) {
      parts.push(`المراجعة: الأجزاء ${juzParts.join(', ')}`);
    }
  } else {
    if (row.murajah && row.murajah.trim()) {
      parts.push(`المراجعة: ${row.murajah}`);
    }
  }

  if (row.jadeed && row.jadeed.trim()) {
    const jadeedParts = row.jadeed.split(':');
    if (jadeedParts.length === 2 && jadeedParts[0] && jadeedParts[1]) {
      const surahName = getSurahName(jadeedParts[0]);
      parts.push(`الجدبد: ${surahName} ${toArabicNum(parseInt(jadeedParts[1]))} آية`);
    } else {
      parts.push(`الجدبد: ${row.jadeed}`);
    }
  }

  if (row.juzhali && row.juzhali.trim()) {
    const juzhaliParts = row.juzhali.split(':');
    if (juzhaliParts.length === 2 && juzhaliParts[0] && juzhaliParts[1]) {
      parts.push(`الجزء الذي عليه: الصفحة ${toArabicNum(parseInt(juzhaliParts[0]))} إلى ${toArabicNum(parseInt(juzhaliParts[1]))}`);
    } else {
      parts.push(`الجزء الذي عليه: الصفحة ${row.juzhali}`);
    }
  }

  return parts.length > 0 ? parts.join(' | ') : '';
}

async function getAccessToken(serviceAccountJson: string) {
  try {
    const credentials = JSON.parse(serviceAccountJson);
    const auth = new GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/firebase.messaging'],
    });
    const client = await auth.getClient();
    const token = await client.getAccessToken();
    return { token: token.token, projectId: credentials.project_id };
  } catch (error) {
    throw new Error('Failed to generate access token from Service Account: ' + error.message);
  }
}

function parseFcmError(errText: string): ParsedFcmError {
  try {
    const parsed = JSON.parse(errText);
    const error = parsed?.error || parsed;
    const details = Array.isArray(error?.details) ? error.details : [];
    const fcmDetail = details.find((detail: { errorCode?: string }) => typeof detail?.errorCode === 'string');
    return {
      code: error?.code,
      status: error?.status,
      message: error?.message,
      errorCode: fcmDetail?.errorCode,
      raw: errText,
    };
  } catch {
    return { raw: errText };
  }
}

function isStaleTokenError(responseStatus: number, parsedError: ParsedFcmError) {
  const haystack = [String(responseStatus), parsedError.code, parsedError.status, parsedError.message, parsedError.errorCode, parsedError.raw]
    .filter(Boolean).join(' ').toLowerCase();
  return haystack.includes('unregistered') || haystack.includes('notregistered') || haystack.includes('registration-token-not-registered') || (responseStatus === 404 && haystack.includes('requested entity was not found'));
}

async function sendFCMNotification(token: string, title: string, body: string, accessToken: string, projectId: string, studentId: string): Promise<FcmSendResult> {
  const message = {
    message: {
      token,
      notification: { title, body },
      data: {
        title,
        body,
        url: '/',
        redirectPage: 'Jadwal',
        studentId,
      },
      webpush: {
        headers: { Urgency: 'high' },
        notification: {
          title,
          body,
          icon: '/logo.png',
          badge: '/logo.png',
          tag: 'jadwal-reminder',
          renotify: true,
          requireInteraction: true,
          data: { url: '/', redirectPage: 'Jadwal', studentId },
          actions: [
            { action: 'open', title: 'View Jadwal' },
            { action: 'dismiss', title: 'Dismiss' },
          ],
        },
        fcm_options: { link: '/' },
      },
      android: {
        priority: 'high',
        notification: {
          sound: 'default',
          channel_id: 'mauze-tahfeez-notifications',
          icon: 'ic_notification',
          color: '#26A69A',
          visibility: 'PUBLIC',
        },
      },
      apns: {
        payload: { aps: { sound: 'default', 'content-available': 1 } },
      },
    },
  };

  try {
    const response = await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(message),
    });

    if (!response.ok) {
      const errText = await response.text();
      const parsedError = parseFcmError(errText);
      const stale = isStaleTokenError(response.status, parsedError);
      if (stale) {
        return { token, success: false, status: 'stale', error: `FCM token is no longer registered (${response.status}).` };
      }
      return { token, success: false, status: 'failed', error: `FCM API Error (${response.status}): ${errText}` };
    }

    const result = await response.json().catch(() => ({}));
    return { token, success: true, status: 'delivered', name: result?.name };
  } catch (err) {
    return { token, success: false, status: 'failed', error: err.message };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const now = new Date();

    // Use IST for everything (user schedules reminder in Indian Standard Time)
    const istParts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: false,
      weekday: 'long',
    }).formatToParts(now);

    const DAY_MAP: Record<string, string> = {
      sunday: 'SUNDAY', monday: 'MONDAY', tuesday: 'TUESDAY',
      wednesday: 'WEDNESDAY', thursday: 'THURSDAY', friday: 'FRIDAY',
      saturday: 'SATURDAY',
    };
    const getPart = (type: string) => istParts.find(p => p.type === type)!.value;
    const todayDayName = DAY_MAP[getPart('weekday').toLowerCase()] || DAYS[now.getDay()];
    const todayDateStr = `${getPart('year')}-${getPart('month')}-${getPart('day')}`;
    const todayHour = Number(getPart('hour'));
    const todayMinute = Number(getPart('minute'));

    console.log(`jadwal-reminder: Running for ${todayDayName} (${todayDateStr}) at ${todayHour}:${todayMinute} IST`);

    // Check jadwal_settings for notification enabled, time, and type
    const { data: jadwalSettings, error: settingsError } = await supabase
      .from('jadwal_settings')
      .select('jadwal_notification_enabled, jadwal_notification_time, jadwal_type, jadwal_week_start, jadwal_week_end')
      .eq('id', 1)
      .maybeSingle();

    if (settingsError) {
      console.warn('Failed to read jadwal_settings:', settingsError.message);
    }

    const notifEnabled = jadwalSettings?.jadwal_notification_enabled !== false;
    const notifTimeStr: string = jadwalSettings?.jadwal_notification_time || '07:00:00';
    const [notifHour, notifMin] = notifTimeStr.split(':').map(Number);

    // For miqaat mode, determine if we need indexed key lookup
    const isMiqaat = jadwalSettings?.jadwal_type === 'miqaat' && jadwalSettings?.jadwal_week_start && jadwalSettings?.jadwal_week_end;
    const miqaatWeekStart = isMiqaat ? jadwalSettings.jadwal_week_start : null;

    // Allow a 15-minute window around the target time
    const currentMinutes = todayHour * 60 + todayMinute;
    const targetMinutes = notifHour * 60 + notifMin;
    const minutesDiff = Math.abs(currentMinutes - targetMinutes);

    if (!notifEnabled) {
      console.log('jadwal-reminder: Notifications disabled via settings');
      return new Response(
        JSON.stringify({ success: true, message: 'NOTIFICATIONS_DISABLED', sentCount: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    if (minutesDiff > 15) {
      console.log(`jadwal-reminder: Skipping — current ${todayHour}:${todayMinute} not within 15 min of target ${notifTimeStr} (diff ${minutesDiff} min)`);
      return new Response(
        JSON.stringify({ success: true, message: 'NOT_YET_TIME', sentCount: 0, info: `Target time: ${notifTimeStr}, current: ${todayHour}:${todayMinute}` }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Get all jadawal records with their schedule_data
    const { data: jadawalRecords, error: jadawalError } = await supabase
      .from('jadawal')
      .select('student_id, schedule_data');

    if (jadawalError) {
      throw new Error(`Failed to fetch jadawal records: ${jadawalError.message}`);
    }

    if (!jadawalRecords || jadawalRecords.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'NO_JADAWAL_RECORDS', sentCount: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Get student details (name + parent_user_id) from child_profiles
    const studentIds = jadawalRecords.map(r => r.student_id);
    const { data: childProfiles, error: profileError } = await supabase
      .from('child_profiles')
      .select('student_id, full_name, parent_user_id')
      .in('student_id', studentIds);

    if (profileError) {
      throw new Error(`Failed to fetch child profiles: ${profileError.message}`);
    }

    const profileMap = new Map<string, { full_name: string; parent_user_id: string | null }>();
    for (const p of childProfiles || []) {
      profileMap.set(p.student_id, { full_name: p.full_name, parent_user_id: p.parent_user_id });
    }

    // FCM setup
    const serviceAccount = Deno.env.get('FIREBASE_SERVICE_ACCOUNT_KEY');
    if (!serviceAccount) {
      throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY environment variable is missing.');
    }
    const { token: accessToken, projectId } = await getAccessToken(serviceAccount);

    // Process each student
    let sentCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    const details: Array<{ studentId: string; status: string; message?: string }> = [];

    for (const record of jadawalRecords) {
      const { student_id, schedule_data } = record;
      const profile = profileMap.get(student_id);
      const studentName = profile?.full_name || 'Student';
      const parentUserId = profile?.parent_user_id;

      if (!parentUserId) {
        details.push({ studentId: student_id, status: 'skipped', message: 'No parent_user_id' });
        skippedCount++;
        continue;
      }

      // Get today's row from schedule_data
      // In miqaat mode with custom date range, keys may include index suffix (e.g. MONDAY_6)
      // Determine correct key by iterating week_start→today, skipping 30th Zilhaj
      let dayData: Record<string, string> | undefined;
      if (isMiqaat && miqaatWeekStart) {
        let idx = 0;
        const cur = new Date(miqaatWeekStart + 'T00:00:00Z');
        const todayEnd = new Date(todayDateStr + 'T00:00:00Z');
        while (cur < todayEnd) {
          const ds = cur.toISOString().split('T')[0];
          if (!isZilhaj30(ds)) {
            idx++;
          }
          cur.setUTCDate(cur.getUTCDate() + 1);
        }
        // idx now equals today's position in the adjusted range
        const key = idx >= 6 ? `${todayDayName}_${idx}` : todayDayName;
        dayData = schedule_data?.[key];
      }
      if (!dayData) {
        // Fallback / non-miqaat: simple day name key
        dayData = schedule_data?.[todayDayName];
      }
      if (!dayData) {
        details.push({ studentId: student_id, status: 'skipped', message: 'No data for today' });
        skippedCount++;
        continue;
      }

      const mode = schedule_data?._mode || 'juz-wise';
      const tasks = formatTodayTasks(dayData, mode);

      if (!tasks) {
        details.push({ studentId: student_id, status: 'skipped', message: 'Empty tasks for today' });
        skippedCount++;
        continue;
      }

      const title = `📖 جدول ${studentName} اليوم`;
      const body = tasks;

      // Get parent's FCM tokens
      const { data: parentTokens, error: tokenError } = await supabase
        .from('user_fcm_tokens')
        .select('fcm_token')
        .eq('user_id', parentUserId);

      if (tokenError) {
        details.push({ studentId: student_id, status: 'error', message: `Token lookup failed: ${tokenError.message}` });
        errorCount++;
        continue;
      }

      if (!parentTokens || parentTokens.length === 0) {
        details.push({ studentId: student_id, status: 'skipped', message: 'No FCM tokens for parent' });
        skippedCount++;
        continue;
      }

      // Send to all parent devices
      const staleTokens: string[] = [];
      for (const { fcm_token } of parentTokens) {
        const result = await sendFCMNotification(fcm_token, title, body, accessToken, projectId, student_id);
        if (result.status === 'stale') {
          staleTokens.push(fcm_token);
        }
        if (result.success) {
          sentCount++;
        } else if (result.status !== 'stale') {
          errorCount++;
        }
      }

      // Clean stale tokens
      if (staleTokens.length > 0) {
        await supabase
          .from('user_fcm_tokens')
          .delete()
          .in('fcm_token', staleTokens);
      }

      details.push({ studentId: student_id, status: 'sent', message: `Sent to ${parentTokens.length} device(s)` });

      // Small delay to avoid rate limiting (process in waves)
      if (jadawalRecords.length > 10) {
        await new Promise(r => setTimeout(r, 50));
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed ${jadawalRecords.length} students. Sent: ${sentCount}, Skipped: ${skippedCount}, Errors: ${errorCount}`,
        summary: { total: jadawalRecords.length, sent: sentCount, skipped: skippedCount, errors: errorCount },
        details,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message, details: 'Check Edge Function logs' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
