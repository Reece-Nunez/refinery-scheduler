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

// GET - Fetch all out-of-schedule jobs
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const activeOnly = searchParams.get('activeOnly') === 'true'

    let query = supabase
      .from('out_of_schedule_jobs')
      .select('*')
      .order('title', { ascending: true })

    if (activeOnly) {
      query = query.eq('isActive', true)
    }

    const { data: jobs, error } = await query

    if (error) throw error

    return NextResponse.json(jobs || [])
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to fetch out-of-schedule jobs' },
      { status: 500 }
    )
  }
}

// POST - Create out-of-schedule job
export async function POST(req: Request) {
  try {
    const isAdmin = await requireAdmin(req)
    if (!isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const user = await getUser(req)
    const body = await req.json()
    const { title, description } = body

    if (!title) {
      return NextResponse.json({ error: 'Job title required' }, { status: 400 })
    }

    const { data: job, error: jobError } = await supabase
      .from('out_of_schedule_jobs')
      .insert([{
        title,
        description,
        isActive: true,
        createdBy: user?.id
      }])
      .select()
      .single()

    if (jobError) throw jobError

    return NextResponse.json(job)
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to create job' },
      { status: 500 }
    )
  }
}

// PUT - Update out-of-schedule job
export async function PUT(req: Request) {
  try {
    const isAdmin = await requireAdmin(req)
    if (!isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await req.json()
    const { id, title, description, isActive } = body

    if (!id) {
      return NextResponse.json({ error: 'Job ID required' }, { status: 400 })
    }

    const updateData: any = {}
    if (title !== undefined) updateData.title = title
    if (description !== undefined) updateData.description = description
    if (isActive !== undefined) updateData.isActive = isActive

    const { data: job, error: jobError } = await supabase
      .from('out_of_schedule_jobs')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (jobError) throw jobError

    return NextResponse.json(job)
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to update job' },
      { status: 500 }
    )
  }
}

// DELETE - Remove out-of-schedule job
export async function DELETE(req: Request) {
  try {
    const isAdmin = await requireAdmin(req)
    if (!isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Job ID required' }, { status: 400 })
    }

    // Soft delete - mark as inactive instead of deleting
    const { error } = await supabase
      .from('out_of_schedule_jobs')
      .update({ isActive: false })
      .eq('id', id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to delete job' },
      { status: 500 }
    )
  }
}
