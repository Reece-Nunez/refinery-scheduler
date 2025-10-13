'use client'

import ScheduleCalendar from '@/components/ScheduleCalendar'
import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'

export default function CalendarPage() {
  const [role, setRole] = useState<'ADMIN' | 'OPER'>('OPER')

  useEffect(() => {
    const init = async () => {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user?.id) {
        const { data } = await supabase.from('users').select('role').eq('id', session.user.id).single()
        if (data?.role) setRole(data.role as any)
      }
    }
    init()
  }, [])

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Shift Calendar</h1>
      <ScheduleCalendar canManage={role === 'ADMIN'} />
    </div>
  )
}

