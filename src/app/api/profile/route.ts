import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Get the current user from the auth token
async function getCurrentUser(req: Request) {
  const auth = req.headers.get('authorization') || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  if (!token) return null

  const { data: userData, error } = await supabase.auth.getUser(token)
  if (error || !userData?.user) return null

  return userData.user
}

// GET - Get current user's profile
export async function GET(req: Request) {
  try {
    const user = await getCurrentUser(req)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user data from users table (now includes email, phone, display_name, etc.)
    const { data: userData } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single()

    // Get operator record if exists (match by email)
    const { data: operator } = await supabase
      .from('operators')
      .select('*')
      .ilike('email', user.email || '')
      .single()

    // Get trained jobs if operator exists
    let trainedJobs: any[] = []
    if (operator) {
      const { data: links } = await supabase
        .from('operator_jobs')
        .select('job_id')
        .eq('operator_id', operator.id)

      if (links && links.length > 0) {
        const jobIds = links.map(l => l.job_id)
        const { data: jobs } = await supabase
          .from('jobs')
          .select('id, title')
          .in('id', jobIds)
        trainedJobs = jobs || []
      }
    }

    return NextResponse.json({
      id: user.id,
      email: userData?.email || user.email,
      displayName: userData?.display_name,
      phone: userData?.phone,
      role: userData?.role || 'OPER',
      createdAt: userData?.created_at || user.created_at,
      updatedAt: userData?.updated_at,
      operator: operator ? {
        id: operator.id,
        name: operator.name,
        employeeId: operator.employeeid || operator.employee_id || operator.employeeId,
        phone: operator.phone,
        team: operator.team,
        operatorRole: operator.role,
        letter: operator.letter,
        status: operator.status,
        consoles: operator.consoles,
        trainedJobs
      } : null
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch profile' }, { status: 500 })
  }
}

// PUT - Update current user's profile
export async function PUT(req: Request) {
  try {
    const user = await getCurrentUser(req)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { phone, email, displayName, currentPassword, newPassword } = body

    // Get operator record
    const { data: operator } = await supabase
      .from('operators')
      .select('*')
      .ilike('email', user.email || '')
      .single()

    // Build users table update
    const userUpdate: any = { updated_at: new Date().toISOString() }
    if (phone !== undefined) userUpdate.phone = phone
    if (displayName !== undefined) userUpdate.display_name = displayName

    // Update phone/displayName in users table
    if (Object.keys(userUpdate).length > 1) {
      const { error: userError } = await supabase
        .from('users')
        .update(userUpdate)
        .eq('id', user.id)

      if (userError) throw userError
    }

    // Also update phone in operator record if exists
    if (phone !== undefined && operator) {
      await supabase
        .from('operators')
        .update({ phone })
        .eq('id', operator.id)
    }

    // Update email if provided
    if (email && email !== user.email) {
      // Update in Supabase Auth (trigger will sync to users table)
      const { error: authError } = await supabase.auth.admin.updateUserById(
        user.id,
        { email }
      )
      if (authError) throw authError

      // Update in operators table if exists
      if (operator) {
        await supabase
          .from('operators')
          .update({ email })
          .eq('id', operator.id)
      }
    }

    // Update password if provided
    if (currentPassword && newPassword) {
      // Verify current password by attempting to sign in
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email!,
        password: currentPassword
      })

      if (signInError) {
        return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 })
      }

      // Update to new password
      const { error: pwError } = await supabase.auth.admin.updateUserById(
        user.id,
        { password: newPassword }
      )

      if (pwError) throw pwError
    }

    return NextResponse.json({ success: true, message: 'Profile updated successfully' })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to update profile' }, { status: 500 })
  }
}
