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

// GET - Fetch all vacation records
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const operatorId = searchParams.get('operatorId')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    let query = supabase
      .from('vacation')
      .select(`
        *,
        operator:operators(id, name, employeeid, team, role, letter)
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

    const { data: vacation, error } = await query

    if (error) throw error

    return NextResponse.json(vacation || [])
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to fetch vacation records' },
      { status: 500 }
    )
  }
}

// POST - Create vacation record
export async function POST(req: Request) {
  try {
    const isAdmin = await requireAdmin(req)
    if (!isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const user = await getUser(req)
    const body = await req.json()
    const { operatorId, startTime, endTime, vacationType, isWholeSet, shiftType, notes } = body

    if (!operatorId || !startTime || !endTime || !vacationType) {
      return NextResponse.json(
        { error: 'Missing required fields: operatorId, startTime, endTime, vacationType' },
        { status: 400 }
      )
    }

    // Validate vacation type
    if (!['12hr', '8hr', '4hr'].includes(vacationType)) {
      return NextResponse.json(
        { error: 'Invalid vacation type. Must be 12hr, 8hr, or 4hr' },
        { status: 400 }
      )
    }

    // Create vacation record
    const { data: vacation, error: vacationError } = await supabase
      .from('vacation')
      .insert([{
        operatorId,
        startTime,
        endTime,
        vacationType,
        isWholeSet: Boolean(isWholeSet),
        shiftType,
        notes,
        createdBy: user?.id
      }])
      .select()
      .single()

    if (vacationError) throw vacationError

    // If it's a whole set vacation, create mandate protection periods
    if (isWholeSet) {
      const vacationStart = new Date(startTime)
      const vacationEnd = new Date(endTime)

      // Calculate the number of "shift days" in the vacation
      // For night shifts, we count the start dates (Oct 14-16 = 3 nights, even though it ends on Oct 17 at 4:45 AM)
      // For day shifts, start and end are on the same calendar day
      let vacationDays: number
      if (shiftType === 'night') {
        // For nights, count from start date to the day BEFORE end date
        // because the end time is actually the morning of the next calendar day
        const adjustedEnd = new Date(vacationEnd)
        adjustedEnd.setDate(adjustedEnd.getDate() - 1)
        vacationDays = Math.round((adjustedEnd.getTime() - vacationStart.getTime()) / (1000 * 60 * 60 * 24)) + 1
      } else {
        vacationDays = Math.round((vacationEnd.getTime() - vacationStart.getTime()) / (1000 * 60 * 60 * 24)) + 1
      }

      // Mandate protection logic depends on which set in the DuPont rotation:
      // DuPont pattern: 4 nights (7 off before, 3 off after) → 3 days (3 off before, 1 off after) →
      //                 3 nights (1 off before, 3 off after) → 4 days (3 off before, 7 off after) → repeat

      let daysBefore: number
      let daysAfter: number

      if (shiftType === 'night' && vacationDays === 4) {
        // 4 nights: 7 days off before, 3 days off after
        daysBefore = 7
        daysAfter = 3
      } else if (shiftType === 'day' && vacationDays === 3) {
        // 3 days: 3 days off before, 1 day off after
        daysBefore = 3
        daysAfter = 1
      } else if (shiftType === 'night' && vacationDays === 3) {
        // 3 nights: 1 day off before, 3 days off after
        daysBefore = 1
        daysAfter = 3
      } else if (shiftType === 'day' && vacationDays === 4) {
        // 4 days: 3 days off before, 7 days off after
        daysBefore = 3
        daysAfter = 7
      } else {
        // Default fallback (shouldn't happen with proper whole set vacations)
        daysBefore = 3
        daysAfter = 3
      }

      const protectionStart = new Date(vacationStart)
      protectionStart.setDate(protectionStart.getDate() - daysBefore)

      const protectionEnd = new Date(vacationEnd)
      protectionEnd.setDate(protectionEnd.getDate() + daysAfter)

      await supabase.from('mandate_protection').insert([{
        operatorId,
        vacationId: vacation.id,
        protectionStartDate: protectionStart.toISOString().split('T')[0],
        protectionEndDate: protectionEnd.toISOString().split('T')[0]
      }])
    }

    return NextResponse.json(vacation)
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to create vacation record' },
      { status: 500 }
    )
  }
}

// PUT - Update vacation record
export async function PUT(req: Request) {
  try {
    const isAdmin = await requireAdmin(req)
    if (!isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Vacation ID required' }, { status: 400 })
    }

    const user = await getUser(req)
    const body = await req.json()
    const { operatorId, startTime, endTime, vacationType, isWholeSet, shiftType, notes } = body

    if (!operatorId || !startTime || !endTime || !vacationType) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Update vacation record
    const { data: vacation, error: vacationError } = await supabase
      .from('vacation')
      .update({
        operatorId,
        startTime,
        endTime,
        vacationType,
        isWholeSet: Boolean(isWholeSet),
        shiftType,
        notes
      })
      .eq('id', id)
      .select()
      .single()

    if (vacationError) throw vacationError

    // Delete old mandate protection records for this vacation
    await supabase.from('mandate_protection').delete().eq('vacationId', id)

    // If it's a whole set vacation, create new mandate protection periods
    if (isWholeSet) {
      const vacationStart = new Date(startTime)
      const vacationEnd = new Date(endTime)

      // Calculate the number of "shift days" in the vacation
      // For night shifts, we count the start dates (Oct 14-16 = 3 nights, even though it ends on Oct 17 at 4:45 AM)
      // For day shifts, start and end are on the same calendar day
      let vacationDays: number
      if (shiftType === 'night') {
        // For nights, count from start date to the day BEFORE end date
        // because the end time is actually the morning of the next calendar day
        const adjustedEnd = new Date(vacationEnd)
        adjustedEnd.setDate(adjustedEnd.getDate() - 1)
        vacationDays = Math.round((adjustedEnd.getTime() - vacationStart.getTime()) / (1000 * 60 * 60 * 24)) + 1
      } else {
        vacationDays = Math.round((vacationEnd.getTime() - vacationStart.getTime()) / (1000 * 60 * 60 * 24)) + 1
      }

      // Mandate protection logic depends on which set in the DuPont rotation
      let daysBefore: number
      let daysAfter: number

      if (shiftType === 'night' && vacationDays === 4) {
        daysBefore = 7
        daysAfter = 3
      } else if (shiftType === 'day' && vacationDays === 3) {
        daysBefore = 3
        daysAfter = 1
      } else if (shiftType === 'night' && vacationDays === 3) {
        daysBefore = 1
        daysAfter = 3
      } else if (shiftType === 'day' && vacationDays === 4) {
        daysBefore = 3
        daysAfter = 7
      } else {
        daysBefore = 3
        daysAfter = 3
      }

      const protectionStart = new Date(vacationStart)
      protectionStart.setDate(protectionStart.getDate() - daysBefore)

      const protectionEnd = new Date(vacationEnd)
      protectionEnd.setDate(protectionEnd.getDate() + daysAfter)

      await supabase.from('mandate_protection').insert([{
        operatorId,
        vacationId: id,
        protectionStartDate: protectionStart.toISOString().split('T')[0],
        protectionEndDate: protectionEnd.toISOString().split('T')[0]
      }])
    }

    return NextResponse.json(vacation)
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to update vacation record' },
      { status: 500 }
    )
  }
}

// DELETE - Remove vacation record
export async function DELETE(req: Request) {
  try {
    const isAdmin = await requireAdmin(req)
    if (!isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Vacation ID required' }, { status: 400 })
    }

    // Delete associated mandate protection records
    await supabase.from('mandate_protection').delete().eq('vacationId', id)

    // Delete vacation record
    const { error } = await supabase.from('vacation').delete().eq('id', id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to delete vacation record' },
      { status: 500 }
    )
  }
}
