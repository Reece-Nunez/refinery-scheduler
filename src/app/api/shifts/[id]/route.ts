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

export async function DELETE(
  request: Request,
  context: { params: { id: string } }
) {
  const { id } = context.params
  try {
    const isAdmin = await requireAdmin(request)
    if (!isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    const { error } = await supabase.from('shifts').delete().eq('id', id)
    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/shifts/[id] error:', error)
    return NextResponse.json({ error: 'Failed to delete shift' }, { status: 500 })
  }
}


export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  const { id } = params
  const body = await req.json()

  try {
    const isAdmin = await requireAdmin(req)
    if (!isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    const { error } = await supabase
      .from('shifts')
      .update({
        start_time: body.startTime,
        end_time: body.endTime,
        is_overridden: body.isOverridden,
      })
      .eq('id', id)
    if (error) throw error
    return NextResponse.json({ id, ...body })
  } catch (error) {
    console.error('[UPDATE SHIFT]', error)
    return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  }
}
