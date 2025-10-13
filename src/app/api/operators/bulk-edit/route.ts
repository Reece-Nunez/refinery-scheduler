import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function requireAdmin(req: Request) {
  const auth = req.headers.get('authorization') || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  if (!token) return false
  const { data: userData } = await supabase.auth.getUser(token)
  const user = userData?.user
  if (!user) return false
  const { data } = await supabase.from('users').select('role').eq('id', user.id).single()
  return data?.role === 'ADMIN'
}

export async function POST(req: Request) {
  try {
    const isAdmin = await requireAdmin(req)
    if (!isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await req.json()
    const { operatorIds, jobIds, mode } = body

    if (!Array.isArray(operatorIds) || operatorIds.length === 0) {
      return NextResponse.json({ error: 'No operators provided' }, { status: 400 })
    }

    if (!Array.isArray(jobIds) || jobIds.length === 0) {
      return NextResponse.json({ error: 'No jobs provided' }, { status: 400 })
    }

    if (!['add', 'remove', 'replace'].includes(mode)) {
      return NextResponse.json({ error: 'Invalid mode' }, { status: 400 })
    }

    let updated = 0
    let failed = 0
    const errors: string[] = []

    for (const operatorId of operatorIds) {
      try {
        // Get operator name for error messages
        const { data: operator } = await supabase
          .from('operators')
          .select('name')
          .eq('id', operatorId)
          .single()

        if (!operator) {
          errors.push(`Operator ${operatorId}: Not found`)
          failed++
          continue
        }

        if (mode === 'replace') {
          // Delete all existing job assignments
          await supabase
            .from('operator_jobs')
            .delete()
            .eq('operator_id', operatorId)

          // Add new job assignments
          const insertData = jobIds.map(jobId => ({
            operator_id: operatorId,
            job_id: jobId
          }))

          const { error: insertError } = await supabase
            .from('operator_jobs')
            .insert(insertData)

          if (insertError) {
            errors.push(`${operator.name}: ${insertError.message}`)
            failed++
          } else {
            updated++
          }

        } else if (mode === 'add') {
          // Get existing job assignments to avoid duplicates
          const { data: existing } = await supabase
            .from('operator_jobs')
            .select('job_id')
            .eq('operator_id', operatorId)

          const existingJobIds = new Set((existing || []).map(oj => oj.job_id))
          const newJobIds = jobIds.filter(jobId => !existingJobIds.has(jobId))

          if (newJobIds.length > 0) {
            const insertData = newJobIds.map(jobId => ({
              operator_id: operatorId,
              job_id: jobId
            }))

            const { error: insertError } = await supabase
              .from('operator_jobs')
              .insert(insertData)

            if (insertError) {
              errors.push(`${operator.name}: ${insertError.message}`)
              failed++
            } else {
              updated++
            }
          } else {
            updated++
          }

        } else if (mode === 'remove') {
          // Remove specified job assignments
          const { error: deleteError } = await supabase
            .from('operator_jobs')
            .delete()
            .eq('operator_id', operatorId)
            .in('job_id', jobIds)

          if (deleteError) {
            errors.push(`${operator.name}: ${deleteError.message}`)
            failed++
          } else {
            updated++
          }
        }

      } catch (err: any) {
        errors.push(`Operator ${operatorId}: ${err.message}`)
        failed++
      }
    }

    return NextResponse.json({
      updated,
      failed,
      total: operatorIds.length,
      errors: errors.length > 0 ? errors : undefined
    })

  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to update operators' },
      { status: 500 }
    )
  }
}
