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

// POST - Validate a shift without creating it (dry-run)
export async function POST(req: Request) {
  try {
    const isAdmin = await requireAdmin(req)
    if (!isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await req.json()
    const { operatorId, jobId, startTime, endTime, isOverridden, isOvertime, isOutage, shiftType } = body

    if (!operatorId || !startTime || !endTime) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Load existing shifts for validation
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

    // Validation passed
    return NextResponse.json({ valid: true })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Validation failed' },
      { status: 500 }
    )
  }
}
