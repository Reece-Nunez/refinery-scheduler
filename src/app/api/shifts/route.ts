import { NextResponse } from 'next/server'
import { RP755FatiguePolicy, type Shift } from '@/lib/rp755FatiguePolicy'
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
    const { data: shifts, error } = await supabase
      .from('shifts')
      .select('*')
    if (error) throw error

    // Enrich with operator if available
    const operatorIds = Array.from(new Set((shifts || []).map((s: any) => s.operatorId)))
    let operatorsById = new Map<string, any>()
    if (operatorIds.length > 0) {
      const { data: ops } = await supabase.from('operators').select('*').in('id', operatorIds)
      operatorsById = new Map((ops || []).map((o: any) => [o.id, o]))
    }

    const result = (shifts || []).map((s: any) => ({
      id: s.id,
      operatorId: s.operatorId,
      jobId: s.jobId,
      startTime: s.startTime,
      endTime: s.endTime,
      isOverridden: s.isOverridden,
      isOvertime: s.isOvertime || s.isCallOut,
      isOutage: s.isOutage,
      shiftType: s.shiftType,
      createdAt: s.createdAt,
      operator: (() => {
        const o: any = operatorsById.get(s.operatorId)
        return o ? { id: o.id, name: o.name, employeeId: o.employeeid ?? o.employee_id ?? o.employeeId, team: o.team, role: o.role, letter: o.letter } : null
      })()
    }))
    return NextResponse.json(result)
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch shifts' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const isAdmin = await requireAdmin(req)
    if (!isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    const body = await req.json()
    const { operatorId, jobId, startTime, endTime, isOverridden, isOvertime, isOutage, shiftType } = body

    if (!operatorId || !startTime || !endTime) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Load existing shifts for RP-755 validation and conflict checking
    const { data: existing, error: exErr } = await supabase
      .from('shifts')
      .select('*')
      .eq('operatorId', operatorId)
    if (exErr) throw exErr

    const newShiftStart = new Date(startTime)
    const newShiftEnd = new Date(endTime)
    const newShiftDate = newShiftStart.toISOString().split('T')[0]

    // Check if operator is on vacation (unless it's overtime)
    if (!isOvertime) {
      const { data: vacations } = await supabase
        .from('vacation')
        .select('*')
        .eq('operatorId', operatorId)

      for (const vacation of (vacations || [])) {
        const vacStart = new Date(vacation.startTime)
        const vacEnd = new Date(vacation.endTime)
        const vacStartDate = new Date(vacStart.getFullYear(), vacStart.getMonth(), vacStart.getDate())
        const vacEndDate = new Date(vacEnd.getFullYear(), vacEnd.getMonth(), vacEnd.getDate())
        const shiftDate = new Date(newShiftStart.getFullYear(), newShiftStart.getMonth(), newShiftStart.getDate())

        if (shiftDate >= vacStartDate && shiftDate <= vacEndDate) {
          return NextResponse.json(
            { error: 'Operator is on vacation during this shift. Use overtime option for voluntary work.' },
            { status: 400 }
          )
        }
      }
    }

    // Check if operator is in a mandate protection period (unless it's overtime)
    if (!isOvertime) {
      const { data: protections } = await supabase
        .from('mandate_protection')
        .select('*')
        .eq('operatorId', operatorId)
        .lte('protectionStartDate', newShiftDate)
        .gte('protectionEndDate', newShiftDate)

      if (protections && protections.length > 0) {
        return NextResponse.json(
          { error: 'Operator is in a mandate protection period. Use overtime option for voluntary work.' },
          { status: 400 }
        )
      }
    }

    // Check for overlapping shifts
    for (const existingShift of (existing || [])) {
      const existingStart = new Date(existingShift.startTime)
      const existingEnd = new Date(existingShift.endTime)
      const existingDate = existingStart.toISOString().split('T')[0]

      // Check if shifts overlap in time
      if (
        (newShiftStart >= existingStart && newShiftStart < existingEnd) ||
        (newShiftEnd > existingStart && newShiftEnd <= existingEnd) ||
        (newShiftStart <= existingStart && newShiftEnd >= existingEnd)
      ) {
        return NextResponse.json(
          { error: `Shift conflicts with existing ${existingShift.shiftType} shift on ${existingDate}` },
          { status: 400 }
        )
      }

      // Check if operator is working both day and night on same date
      if (existingDate === newShiftDate) {
        if (existingShift.shiftType !== shiftType) {
          return NextResponse.json(
            { error: 'Operator cannot work both day and night shifts on the same date' },
            { status: 400 }
          )
        }

        // Check if same job is assigned multiple times on the same date AND same shift type
        // Note: Same job on day shift and night shift is allowed
        if (jobId && existingShift.jobId === jobId && existingShift.shiftType === shiftType) {
          return NextResponse.json(
            { error: `Cannot assign the same job multiple times to the same ${shiftType} shift on the same date` },
            { status: 400 }
          )
        }
      }
    }

    const newShift: Shift = {
      operatorId,
      startTime: new Date(startTime),
      endTime: new Date(endTime),
      isOverridden: Boolean(isOverridden),
      isOvertime: Boolean(isOvertime),
      isOutage: Boolean(isOutage),
      shiftType: (shiftType as any) || 'day'
    }

    const existingShifts: Shift[] = (existing || []).map((s: any) => ({
      operatorId: s.operatorId,
      startTime: new Date(s.startTime),
      endTime: new Date(s.endTime),
      isOverridden: Boolean(s.isOverridden),
      isOvertime: Boolean(s.isOvertime || s.isCallOut),
      isOutage: Boolean(s.isOutage),
      shiftType: s.shiftType
    }))

    const violations = RP755FatiguePolicy.validateShift(newShift, existingShifts, Boolean(isOutage))

    if (violations.length > 0 && !isOverridden) {
      return NextResponse.json(
        {
          error: 'RP-755 Fatigue Policy Violation',
          violations: violations.map(v => ({
            rule: v.rule,
            severity: v.severity,
            message: v.message,
            currentValue: v.currentValue,
            limit: v.limit,
            requiresException: v.requiresException
          }))
        },
        { status: 400 }
      )
    }

    // Insert shift
    const insertPayload: any = {
      operatorId: operatorId,
      startTime: startTime,
      endTime: endTime,
      isOverridden: Boolean(isOverridden),
      isOvertime: Boolean(isOvertime),
      isOutage: Boolean(isOutage),
      shiftType: (shiftType as any) || 'day'
    }
    if (jobId) insertPayload.jobId = jobId

    const { data: inserted, error } = await supabase
      .from('shifts')
      .insert([insertPayload])
      .select('*')
      .single()
    if (error) throw error

    const result = {
      id: inserted.id,
      operatorId: inserted.operatorId,
      jobId: inserted.jobId,
      startTime: inserted.startTime,
      endTime: inserted.endTime,
      isOverridden: inserted.isOverridden,
      isOvertime: inserted.isOvertime,
      isOutage: inserted.isOutage,
      shiftType: inserted.shiftType,
      createdAt: inserted.createdAt,
      violations
    }
    return NextResponse.json(result)
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to create shift' }, { status: 500 })
  }
}

// DELETE - Remove shift
export async function DELETE(req: Request) {
  try {
    const isAdmin = await requireAdmin(req)
    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Shift ID required' }, { status: 400 })
    }

    const { error } = await supabase
      .from('shifts')
      .delete()
      .eq('id', id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to delete shift' },
      { status: 500 }
    )
  }
}
