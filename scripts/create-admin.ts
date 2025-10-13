import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function createAdminUser() {
  const email = 'admin@refinery.com'
  const password = 'admin123'

  try {
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

    // Create user profile with ADMIN role
    const { data: profileData, error: profileError } = await supabase
      .from('users')
      .insert([{
        id: authData.user.id,
        email: email,
        role: 'ADMIN'
      }])
      .select()
      .single()

    if (profileError) {
      console.error('Error creating user profile:', profileError)
      return
    }

    console.log('User profile created with ADMIN role')
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
