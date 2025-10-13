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
    const { operators } = body

    if (!Array.isArray(operators) || operators.length === 0) {
      return NextResponse.json({ error: 'No operators provided' }, { status: 400 })
    }

    let created = 0
    let failed = 0
    const errors: string[] = []

    for (const operator of operators) {
      try {
        const { employeeId, name, role, team, email, phone, letter, trainedJobIds } = operator

        // Validate required fields
        if (!employeeId || !name || !role || !team || !email) {
          errors.push(`${name || 'Unknown'}: Missing required fields`)
          failed++
          continue
        }

        // Check if operator already exists
        const { data: existing } = await supabase
          .from('operators')
          .select('id')
          .eq('employeeid', employeeId)
          .single()

        if (existing) {
          errors.push(`${name} (${employeeId}): Already exists`)
          failed++
          continue
        }

        // Create auth user
        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
          email,
          email_confirm: true,
          password: Math.random().toString(36).slice(-12) + 'Aa1!' // Random password
        })

        if (authError) {
          errors.push(`${name}: ${authError.message}`)
          failed++
          continue
        }

        // Create operator record
        const insertPayload: any = {
          employeeid: employeeId,
          name,
          role,
          team,
          email
        }
        if (phone) insertPayload.phone = phone
        if (role !== 'APS' && letter) insertPayload.letter = letter

        const { data: operatorData, error: opError } = await supabase
          .from('operators')
          .insert([insertPayload])
          .select('*')
          .single()

        if (opError) {
          // Cleanup auth user if operator creation failed
          await supabase.auth.admin.deleteUser(authData.user.id)
          errors.push(`${name}: ${opError.message}`)
          failed++
          continue
        }

        // Add trained jobs
        if (Array.isArray(trainedJobIds) && trainedJobIds.length > 0) {
          await supabase.from('operator_jobs').insert(
            trainedJobIds.map((jobId: string) => ({
              operator_id: operatorData.id,
              job_id: jobId
            }))
          )
        }

        created++
      } catch (err: any) {
        errors.push(`${operator.name || 'Unknown'}: ${err.message}`)
        failed++
      }
    }

    return NextResponse.json({
      created,
      failed,
      total: operators.length,
      errors: errors.length > 0 ? errors : undefined
    })

  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to bulk import operators' },
      { status: 500 }
    )
  }
}
