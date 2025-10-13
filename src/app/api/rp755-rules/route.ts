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

// GET - Fetch all RP-755 rules
export async function GET(req: Request) {
  try {
    const { data: rules, error } = await supabase
      .from('rp755_rules')
      .select('*')
      .order('category', { ascending: true })
      .order('id', { ascending: true })

    if (error) throw error

    return NextResponse.json(rules || [])
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to fetch RP-755 rules' },
      { status: 500 }
    )
  }
}

// PUT - Update an RP-755 rule
export async function PUT(req: Request) {
  try {
    const isAdmin = await requireAdmin(req)
    if (!isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Rule ID required' }, { status: 400 })
    }

    const body = await req.json()
    const { limit, unit, enabled } = body

    const { data: rule, error: ruleError } = await supabase
      .from('rp755_rules')
      .update({
        limit: limit !== undefined ? limit : undefined,
        unit: unit !== undefined ? unit : undefined,
        enabled: enabled !== undefined ? enabled : undefined
      })
      .eq('id', id)
      .select()
      .single()

    if (ruleError) throw ruleError

    return NextResponse.json(rule)
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to update RP-755 rule' },
      { status: 500 }
    )
  }
}
