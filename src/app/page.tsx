// src/app/page.tsx
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export default async function Home() {
  const supabase = createServerComponentClient({ cookies })
  const { data: { session } } = await supabase.auth.getSession()

  if (session?.user) {
    redirect('/operators') // or wherever logged-in users go
  } else {
    redirect('/auth/login')
  }
}
