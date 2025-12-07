'use client'

import OperatorShiftCalendar from '@/components/OperatorShiftCalendar'
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
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <h1 className="text-3xl font-bold text-gray-900">Shift Calendar</h1>
          <p className="text-gray-600 mt-1">View all scheduled shifts across teams</p>
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-4 py-6">
        <OperatorShiftCalendar canManage={role === 'ADMIN'} />
      </div>
    </div>
  )
}

