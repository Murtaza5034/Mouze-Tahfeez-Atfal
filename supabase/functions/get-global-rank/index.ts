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
    const { student_id, week_date, preview }: RankRequest = await req.json()

    if (!student_id || !week_date) {
      throw new Error('Missing required fields: student_id, week_date')
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { data: results, error } = await supabase
      .from('weekly_results')
      .select('student_id, murajazah, juz_hali, takhteet, jadeed, attendance_count, total_score')
      .eq('week_date', week_date)

    if (error) throw error
    if (!results || results.length === 0) {
      return new Response(
        JSON.stringify({ rank: null, total: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    const ranked = results
      .map(r => {
        const isTarget = String(r.student_id) === String(student_id)
        let totalScore = Number(r.total_score) || 0
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

    const targetIdx = ranked.findIndex(r => r.isTarget)

    if (targetIdx === -1) {
      return new Response(
        JSON.stringify({ rank: null, total: ranked.length, message: 'Student not found for this week' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    return new Response(
      JSON.stringify({ rank: targetIdx + 1, total: ranked.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
