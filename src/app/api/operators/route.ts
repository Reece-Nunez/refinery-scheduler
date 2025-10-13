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

export async function GET() {
  try {
    const { data: operators, error } = await supabase
      .from('operators')
      .select('*')

    if (error) throw error

    // Attempt to enrich with trained jobs via link table if present
    const { data: links } = await supabase.from('operator_jobs').select('operator_id, job_id')
    const { data: jobs } = await supabase.from('jobs').select('id, title')

    const jobMap = new Map((jobs || []).map((j: any) => [j.id, { id: j.id, title: j.title }]))
    const trainedByOp = new Map<string, any[]>()
    ;(links || []).forEach((l: any) => {
      const arr = trainedByOp.get(l.operator_id) || []
      const job = jobMap.get(l.job_id)
      if (job) arr.push(job)
      trainedByOp.set(l.operator_id, arr)
    })

    const result = (operators || []).map((op: any) => ({
      id: op.id,
      employeeId: op.employeeid ?? op.employee_id ?? op.employeeId,
      name: op.name,
      email: op.email,
      phone: op.phone ?? null,
      role: op.role,
      team: op.team,
      letter: op.letter ?? null,
      status: op.status ?? 'active',
      consoles: op.consoles ?? null,
      createdAt: op.created_at ?? op.createdAt ?? op.createdat,
      trainedJobs: trainedByOp.get(op.id) || []
    }))

    return NextResponse.json(result)
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Failed to fetch operators' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const isAdmin = await requireAdmin(req)
    if (!isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    const body = await req.json()
    const { employeeId, name, role, team, email, phone, letter, status, consoles, trainedJobIds } = body

    if (!employeeId || !name || !role || !team || !email) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const insertPayload: any = { 
      employeeid: employeeId,
      name,
      role,
      team,
      email
    }
    if (phone) insertPayload.phone = phone
    if (role !== 'APS' && letter) insertPayload.letter = letter
    if (status) insertPayload.status = status
    if (consoles) insertPayload.consoles = consoles

    const { data, error } = await supabase
      .from('operators')
      .insert([insertPayload])
      .select('*')
      .single()

    if (error) throw error

    if (Array.isArray(trainedJobIds) && trainedJobIds.length > 0) {
      await supabase.from('operator_jobs').insert(
        trainedJobIds.map((jobId: string) => ({ operator_id: data.id, job_id: jobId }))
      )
    }

    return NextResponse.json({ operator: {
      id: data.id,
      employeeId: data.employeeid ?? data.employee_id ?? employeeId,
      name: data.name,
      email: data.email,
      phone: data.phone ?? null,
      role: data.role,
      team: data.team,
      letter: data.letter ?? null,
      status: data.status ?? 'active',
      consoles: data.consoles ?? null,
      createdAt: data.created_at ?? data.createdAt ?? data.createdat,
      trainedJobs: []
    } })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Failed to create operator' }, { status: 500 })
  }
}

export async function PUT(req: Request) {
  try {
    const isAdmin = await requireAdmin(req)
    if (!isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    const body = await req.json()
    const { id, name, employeeId, role, team, letter, phone, trainedJobIds } = body
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    const update: any = { name, role, team }
    if (employeeId) update.employeeid = employeeId
    if (phone !== undefined) update.phone = phone
    update.letter = role === 'APS' ? null : (letter || null)

    const { data, error } = await supabase
      .from('operators')
      .update(update)
      .eq('id', id)
      .select('*')
      .single()

    if (error) throw error

    // Replace trained jobs links if provided
    if (Array.isArray(trainedJobIds)) {
      await supabase.from('operator_jobs').delete().eq('operator_id', id)
      if (trainedJobIds.length > 0) {
        await supabase.from('operator_jobs').insert(
          trainedJobIds.map((jobId: string) => ({ operator_id: id, job_id: jobId }))
        )
      }
    }

    return NextResponse.json(data)
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Update failed' }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const isAdmin = await requireAdmin(req)
    if (!isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    const body = await req.json()
    const { id } = body
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    await supabase.from('operator_jobs').delete().eq('operator_id', id)
    const { error } = await supabase.from('operators').delete().eq('id', id)
    if (error) throw error

    return NextResponse.json({ message: 'Operator deleted successfully' })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Delete failed' }, { status: 500 })
  }
}

