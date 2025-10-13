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

// GET - Fetch all mandates
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const operatorId = searchParams.get('operatorId')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    let query = supabase
      .from('mandates')
      .select(`
        *,
        operator:operators(id, name, employeeid, team, role, letter),
        job:jobs(id, title)
      `)
      .order('mandateDate', { ascending: true })

    if (operatorId) {
      query = query.eq('operatorId', operatorId)
    }

    if (startDate && endDate) {
      query = query
        .gte('mandateDate', startDate)
        .lte('mandateDate', endDate)
    }

    const { data: mandates, error } = await query

    if (error) throw error

    return NextResponse.json(mandates || [])
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to fetch mandates' },
      { status: 500 }
    )
  }
}

// POST - Create mandate
export async function POST(req: Request) {
  try {
    const isAdmin = await requireAdmin(req)
    if (!isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const user = await getUser(req)
    const body = await req.json()
    const { operatorId, mandateDate, shiftType, jobId, reason, startTime, endTime } = body

    if (!operatorId || !mandateDate || !shiftType || !startTime || !endTime) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Check if operator is protected from mandate
    const mandateDateObj = new Date(mandateDate)
    const { data: protection } = await supabase
      .from('mandate_protection')
      .select('*')
      .eq('operatorId', operatorId)
      .lte('protectionStartDate', mandateDate)
      .gte('protectionEndDate', mandateDate)
      .single()

    if (protection) {
      return NextResponse.json(
        {
          error: 'Operator is protected from mandate due to whole-set vacation',
          protection
        },
        { status: 400 }
      )
    }

    // Create mandate
    const { data: mandate, error: mandateError } = await supabase
      .from('mandates')
      .insert([{
        operatorId,
        mandateDate,
        shiftType,
        jobId,
        reason,
        startTime,
        endTime,
        createdBy: user?.id
      }])
      .select()
      .single()

    if (mandateError) throw mandateError

    return NextResponse.json(mandate)
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to create mandate' },
      { status: 500 }
    )
  }
}

// DELETE - Remove mandate
export async function DELETE(req: Request) {
  try {
    const isAdmin = await requireAdmin(req)
    if (!isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Mandate ID required' }, { status: 400 })
    }

    const { error } = await supabase.from('mandates').delete().eq('id', id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to delete mandate' },
      { status: 500 }
    )
  }
}
