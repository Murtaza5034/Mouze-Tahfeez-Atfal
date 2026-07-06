import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface RankRequest {
  student_id: string
  week_date: string
  preview?: {
    murajazah?: number
    juz_hali?: number
    takhteet?: number
    jadeed?: number
    attendance_count?: number
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const bodyText = await req.text().catch(() => '{}')
    const { student_id, week_date, preview }: RankRequest = JSON.parse(bodyText)

    if (!student_id || !week_date) {
      throw new Error('Missing required fields: student_id, week_date')
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set')
    }
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { data: rawResults, error } = await supabase
      .from('weekly_results')
      .select('student_id, murajazah, juz_hali, takhteet, jadeed, attendance_count, total_score')
      .order('week_date', { ascending: false })

    if (error) throw error
    const latestResultMap = new Map<string, any>()

    for (const result of rawResults || []) {
      const resultId = String(result.student_id || '').trim().toLowerCase()
      if (resultId && !latestResultMap.has(resultId)) {
        latestResultMap.set(resultId, result)
      }
    }

    const targetKey = String(student_id).trim().toLowerCase()
    const existingTarget = latestResultMap.get(targetKey)

    if (preview) {
      latestResultMap.set(targetKey, {
        ...(existingTarget || {}),
        student_id,
        murajazah: preview.murajazah ?? 0,
        juz_hali: preview.juz_hali ?? 0,
        takhteet: preview.takhteet ?? 0,
        jadeed: preview.jadeed ?? 0,
        attendance_count: preview.attendance_count ?? 0,
        total_score: (preview.murajazah ?? 0) +
          (preview.juz_hali ?? 0) +
          (preview.takhteet ?? 0) +
          (preview.jadeed ?? 0),
      })
    }

    const results = Array.from(latestResultMap.values())

    if (!results || results.length === 0) {
      return new Response(
        JSON.stringify({ rank: null, total: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    const ranked = results
      .map(r => {
        const isTarget = String(r.student_id) === String(student_id)
        let totalScore = (r.total_score !== undefined && r.total_score !== null && r.total_score !== "")
          ? Number(r.total_score)
          : (Number(r.murajazah) || 0) + (Number(r.juz_hali) || 0) + (Number(r.takhteet) || 0) + (Number(r.jadeed) || 0)
        let jadeedVal = Number(r.jadeed) || 0
        let attendanceVal = Number(r.attendance_count) || 0

        if (isTarget && preview) {
          totalScore = (preview.murajazah ?? r.murajazah ?? 0) +
            (preview.juz_hali ?? r.juz_hali ?? 0) +
            (preview.takhteet ?? r.takhteet ?? 0) +
            (preview.jadeed ?? r.jadeed ?? 0)
          jadeedVal = preview.jadeed ?? jadeedVal
          attendanceVal = preview.attendance_count ?? attendanceVal
        }

        return { student_id: r.student_id, totalScore, jadeed: jadeedVal, attendance: attendanceVal, isTarget }
      })
      .sort((a, b) => {
        if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore
        if (b.jadeed !== a.jadeed) return b.jadeed - a.jadeed
        return b.attendance - a.attendance
      })

    let targetRank = null;
    let currentRank = 1;
    let prevRank = 1;
    for (let i = 0; i < ranked.length; i++) {
      const r = ranked[i];
      currentRank = i + 1;
      if (i > 0) {
        const prev = ranked[i - 1];
        if (prev.totalScore === r.totalScore && prev.jadeed === r.jadeed && prev.attendance === r.attendance) {
          currentRank = prevRank;
        }
      }
      prevRank = currentRank;
      if (r.isTarget) {
        targetRank = currentRank;
        break;
      }
    }

    if (targetRank === null) {
      return new Response(
        JSON.stringify({ rank: null, total: ranked.length, message: 'Student not found in latest results' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    return new Response(
      JSON.stringify({ rank: targetRank, total: ranked.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
