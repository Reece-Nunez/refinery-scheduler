import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { userId, operator } = body

    if (!userId) {
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 })
    }
    if (!operator?.employeeId || !operator?.name || !operator?.team || !operator?.role || !operator?.email) {
      return NextResponse.json({ error: 'Missing operator fields' }, { status: 400 })
    }

    // Skip creating profile row here to avoid FK issues before email confirmation.
    // Sidebar defaults to OPER when profile row is missing.

    // Create operator record
    const { data: op, error: opErr } = await supabase
      .from('operators')
      .insert([{ 
        employeeid: operator.employeeId,
        name: operator.name,
        team: operator.team,
        role: operator.role,
        email: operator.email,
        phone: operator.phone || null,
        letter: operator.role === 'APS' ? null : (operator.letter || null),
        status: 'active',
        consoles: operator.consoles || null
      }])
      .select('*')
      .single()
    if (opErr) throw opErr

    return NextResponse.json({ userId, operator: op })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Registration failed' }, { status: 500 })
  }
}
