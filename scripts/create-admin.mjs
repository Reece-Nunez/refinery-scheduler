import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function createAdminUser() {
  const email = 'admin@refinery.com'
  const password = 'admin123'

  try {
    // Try to get existing user first
    const { data: users } = await supabase.auth.admin.listUsers()
    const existingUser = users?.users?.find(u => u.email === email)

    let userId

    if (existingUser) {
      console.log('User already exists:', existingUser.id)
      userId = existingUser.id
    } else {
      // Create auth user
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true
      })

      if (authError) {
        console.error('Error creating auth user:', authError)
        return
      }

      console.log('Auth user created:', authData.user.id)
      userId = authData.user.id
    }

    // Check if profile exists
    const { data: existingProfile } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single()

    if (existingProfile) {
      // Update existing profile to ADMIN
      const { error: updateError } = await supabase
        .from('users')
        .update({ role: 'ADMIN' })
        .eq('id', userId)

      if (updateError) {
        console.error('Error updating user profile:', updateError)
        return
      }
      console.log('User profile updated to ADMIN role')
    } else {
      // Create user profile with ADMIN role
      const { error: profileError } = await supabase
        .from('users')
        .insert([{
          id: userId,
          role: 'ADMIN'
        }])

      if (profileError) {
        console.error('Error creating user profile:', profileError)
        return
      }
      console.log('User profile created with ADMIN role')
    }

    console.log('---')
    console.log('Admin credentials:')
    console.log('Email:', email)
    console.log('Password:', password)
    console.log('---')
    console.log('You can now log in with these credentials!')

  } catch (error) {
    console.error('Error:', error)
  }
}

createAdminUser()
