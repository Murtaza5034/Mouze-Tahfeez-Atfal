import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface RankRequest {
  student_id?: string
  week_date?: string
  return_all?: boolean
  preview?: {
    murajazah?: number
    juz_hali?: number
    takhteet?: number
    jadeed?: number
    total_jadeed_pages?: number | string
    attendance_count?: number
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const bodyText = await req.text().catch(() => '{}')
    const { student_id, week_date, return_all, preview }: RankRequest = JSON.parse(bodyText)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set')
    }
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { data: rawResults, error } = await supabase
      .from('weekly_results')
      .select('student_id, murajazah, juz_hali, takhteet, jadeed, total_jadeed_pages, attendance_count, total_score')
      .order('week_date', { ascending: false })

    if (error) throw error

    const latestResultMap = new Map<string, any>()

    for (const result of rawResults || []) {
      const resultId = String(result.student_id || '').trim().toLowerCase()
      if (resultId && !latestResultMap.has(resultId)) {
        latestResultMap.set(resultId, result)
      }
    }

    if (preview && student_id) {
      const targetKey = String(student_id).trim().toLowerCase()
      const existingTarget = latestResultMap.get(targetKey)
      latestResultMap.set(targetKey, {
        ...(existingTarget || {}),
        student_id,
        murajazah: preview.murajazah ?? 0,
        juz_hali: preview.juz_hali ?? 0,
        takhteet: preview.takhteet ?? 0,
        jadeed: preview.jadeed ?? 0,
        total_jadeed_pages: preview.total_jadeed_pages ?? (existingTarget?.total_jadeed_pages ?? ""),
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
        JSON.stringify({ rank: null, ranks: {}, total: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    const ranked = results
      .map(r => {
        let totalScore = (r.total_score !== undefined && r.total_score !== null && r.total_score !== "")
          ? Number(r.total_score)
          : (Number(r.murajazah) || 0) + (Number(r.juz_hali) || 0) + (Number(r.takhteet) || 0) + (Number(r.jadeed) || 0)
        let jadeedVal = Number(r.jadeed) || 0
        let jadeedPagesVal = Number(String(r.total_jadeed_pages ?? "").replace(/[^0-9.]/g, "")) || 0
        let attendanceVal = Number(r.attendance_count) || 0

        if (preview && student_id && String(r.student_id) === String(student_id)) {
          totalScore = (preview.murajazah ?? r.murajazah ?? 0) +
            (preview.juz_hali ?? r.juz_hali ?? 0) +
            (preview.takhteet ?? r.takhteet ?? 0) +
            (preview.jadeed ?? r.jadeed ?? 0)
          jadeedVal = preview.jadeed ?? jadeedVal
          jadeedPagesVal = Number(String(preview.total_jadeed_pages ?? r.total_jadeed_pages ?? "").replace(/[^0-9.]/g, "")) || 0
          attendanceVal = preview.attendance_count ?? attendanceVal
        }

        return { student_id: r.student_id, totalScore, jadeed: jadeedVal, jadeedPages: jadeedPagesVal, attendance: attendanceVal }
      })
      .sort((a, b) => {
        if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore
        if (b.jadeed !== a.jadeed) return b.jadeed - a.jadeed
        if (b.jadeedPages !== a.jadeedPages) return b.jadeedPages - a.jadeedPages
        return b.attendance - a.attendance
      })

    // Build global ranks map for ALL students
    const allRanks: Record<string, number> = {}
    let globalPrevRank = 1
    ranked.forEach((r, idx) => {
      let currentRank = idx + 1
      if (idx > 0) {
        const prev = ranked[idx - 1]
        if (prev.totalScore === r.totalScore && prev.jadeed === r.jadeed && prev.jadeedPages === r.jadeedPages && prev.attendance === r.attendance) {
          currentRank = globalPrevRank
        }
      }
      globalPrevRank = currentRank
      allRanks[String(r.student_id).toLowerCase()] = currentRank
    })

    // return_all mode: send back all ranks at once
    if (return_all) {
      return new Response(
        JSON.stringify({ ranks: allRanks, total: ranked.length }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    // Single-student mode: find and return just one rank
    if (!student_id) {
      throw new Error('Missing required field: student_id')
    }

    const targetRank = allRanks[String(student_id).trim().toLowerCase()] || null

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
