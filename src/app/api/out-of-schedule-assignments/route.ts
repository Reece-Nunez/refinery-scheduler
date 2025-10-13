import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function getUser(req: Request) {
  const auth = req.headers.get('authorization') || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  if (!token) return null
  const { data: userData } = await supabase.auth.getUser(token)
  return userData?.user || null
}

async function requireAdmin(req: Request) {
  const user = await getUser(req)
  if (!user) return false
  const { data } = await supabase.from('users').select('role').eq('id', user.id).single()
  return data?.role === 'ADMIN'
}

// GET - Fetch out-of-schedule assignments
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const operatorId = searchParams.get('operatorId')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    let query = supabase
      .from('out_of_schedule_assignments')
      .select(`
        *,
        operator:operators(id, name, employeeid, team, role, letter),
        job:out_of_schedule_jobs(id, title, description)
      `)
      .order('startTime', { ascending: true })

    if (operatorId) {
      query = query.eq('operatorId', operatorId)
    }

    if (startDate && endDate) {
      query = query
        .gte('startTime', startDate)
        .lte('endTime', endDate)
    }

    const { data: assignments, error } = await query

    if (error) {
      console.error('Supabase error fetching assignments:', error)
      throw error
    }

    return NextResponse.json(assignments || [])
  } catch (error: any) {
    console.error('Error fetching out-of-schedule assignments:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch assignments', details: error },
      { status: 500 }
    )
  }
}

// POST - Create out-of-schedule assignment
export async function POST(req: Request) {
  try {
    const isAdmin = await requireAdmin(req)
    if (!isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const user = await getUser(req)
    const body = await req.json()
    const { operatorId, jobId, startTime, endTime, shiftType, notes } = body

    if (!operatorId || !jobId || !startTime || !endTime || !shiftType) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const { data: assignment, error: assignmentError } = await supabase
      .from('out_of_schedule_assignments')
      .insert([{
        operatorId,
        jobId,
        startTime,
        endTime,
        shiftType,
        notes,
        createdBy: user?.id
      }])
      .select()
      .single()

    if (assignmentError) throw assignmentError

    return NextResponse.json(assignment)
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to create assignment' },
      { status: 500 }
    )
  }
}

// DELETE - Remove out-of-schedule assignment
export async function DELETE(req: Request) {
  try {
    const isAdmin = await requireAdmin(req)
    if (!isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Assignment ID required' }, { status: 400 })
    }

    const { error } = await supabase
      .from('out_of_schedule_assignments')
      .delete()
      .eq('id', id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to delete assignment' },
      { status: 500 }
    )
  }
}
