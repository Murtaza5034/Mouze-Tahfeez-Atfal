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
    const { student_id, return_all, preview }: RankRequest = JSON.parse(bodyText)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set')
    }
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // ── FAST PATH: no preview → compute the whole leaderboard in SQL.
    // The get_global_ranks_any() RPC reads latest-result-per-student via a
    // single ordered index scan (see 20260809...migration). It never scans
    // the full weekly_results table, so it drops to microseconds and removes
    // the disk IO wait. ──────────────────────────────────────────────────────
    if (!preview) {
      const { data, error } = await supabase.rpc("get_global_ranks_any")
      if (!error && data && typeof data === 'object') {
        const ranks = data.ranks || {}
        const total = data.total || 0

        if (return_all) {
          return new Response(
            JSON.stringify({ ranks, total }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
          )
        }
        if (!student_id) {
          throw new Error('Missing required field: student_id')
        }
        const targetRank = ranks[String(student_id).trim().toLowerCase()] || null
        return new Response(
          JSON.stringify({ rank: targetRank, total }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        )
      }
      // RPC missing (migration not applied yet) → fall through to legacy path.
    }

    // ── LEGACY / PREVIEW path: only download ONE row per student (the latest),
    // not the entire table. Used when a teacher previews an unsaved score. ──
    const { data: latestRows, error: latestErr } = await supabase
      .rpc("get_latest_weekly_results")
    if (latestErr) {
      throw new Error(`Failed to fetch latest results: ${latestErr.message}`)
    }

    const latestResultMap = new Map<string, any>()
    for (const result of latestRows || []) {
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

    const { data: childProfiles } = await supabase
      .from('child_profiles')
      .select('student_id')
    const validStudentIds = new Set<string>()
    if (childProfiles) {
      for (const p of childProfiles) {
        const id = String(p.student_id || '').trim().toLowerCase()
        if (id) validStudentIds.add(id)
      }
    }
    const filteredResults = validStudentIds.size > 0
      ? results.filter(r => validStudentIds.has(String(r.student_id || '').trim().toLowerCase()))
      : results

    const ranked = filteredResults
      .map(r => {
        let totalScore = (r.total_score !== undefined && r.total_score !== null && r.total_score !== "")
          ? Number(r.total_score)
          : (Number(r.murajazah) || 0) + (Number(r.juz_hali) || 0) + (Number(r.takhteet) || 0) + (Number(r.jadeed) || 0)
        let jadeedVal = Number(r.jadeed) || 0
        let jadeedPagesVal = Number(String(r.total_jadeed_pages ?? "").replace(/[^0-9.]/g, "")) || 0
        let attendanceVal = Number(r.attendance_count) || 0

        if (preview && student_id && String(r.student_id).trim() === String(student_id).trim()) {
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
      allRanks[String(r.student_id).trim().toLowerCase()] = currentRank
    })

    if (return_all) {
      return new Response(
        JSON.stringify({ ranks: allRanks, total: ranked.length }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

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