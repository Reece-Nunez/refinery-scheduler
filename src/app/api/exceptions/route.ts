import { NextResponse } from 'next/server'
import { RP755FatiguePolicy } from '@/lib/rp755FatiguePolicy'
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
    const { data, error } = await supabase.from('exceptions').select('*')
    if (error) throw error
    return NextResponse.json(data || [])
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Failed to fetch exceptions' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const isAdmin = await requireAdmin(req)
    if (!isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    const body = await req.json()
    const exceptionRequest = {
      shift_id: body.shiftId || null,
      operator_id: body.operatorId,
      violation_type: body.violationType,
      justification: body.justification,
      supervisor_approval: body.supervisorApproval,
      management_approval: body.managementApproval || null,
      risk_assessment: body.riskAssessment,
      mitigation_plan: body.mitigationPlan,
      is_high_risk: Boolean(body.isHighRisk),
      status: 'pending'
    }

    const validationErrors = RP755FatiguePolicy.validateExceptionRequest({
      operatorId: body.operatorId,
      shiftId: body.shiftId,
      violationType: body.violationType,
      justification: body.justification,
      supervisorApproval: body.supervisorApproval,
      managementApproval: body.managementApproval,
      riskAssessment: body.riskAssessment,
      mitigationPlan: body.mitigationPlan,
      isHighRisk: Boolean(body.isHighRisk),
      createdAt: new Date()
    } as any)
    if (validationErrors.length > 0) {
      return NextResponse.json({ error: 'Invalid exception request', validationErrors }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('exceptions')
      .insert([exceptionRequest])
      .select('*')
      .single()
    if (error) throw error
    return NextResponse.json(data)
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to create exception request' }, { status: 500 })
  }
}

export async function PUT(req: Request) {
  try {
    const isAdmin = await requireAdmin(req)
    if (!isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    const body = await req.json()
    const { id, status, approverNotes } = body
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    const { data, error } = await supabase
      .from('exceptions')
      .update({ status, approver_notes: approverNotes, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .single()
    if (error) throw error
    return NextResponse.json(data)
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to update exception' }, { status: 500 })
  }
}
