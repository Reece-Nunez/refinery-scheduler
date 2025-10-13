'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'

export default function MyInfoPage() {
  const [me, setMe] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const supabase = createBrowserClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        )
        const { data: { session } } = await supabase.auth.getSession()
        const email = session?.user?.email
        if (!email) { setLoading(false); return }
        const res = await fetch('/api/operators')
        const ops = await res.json()
        const mine = Array.isArray(ops) ? ops.find((o: any) => (o.email || '').toLowerCase() === email.toLowerCase()) : null
        setMe(mine || null)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black" />
      </div>
    )
  }

  if (!me) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-2">My Info</h1>
        <p className="text-gray-600">No operator record found for your account.</p>
      </div>
    )
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">My Info</h1>
      <div className="bg-white rounded-lg shadow p-6 border border-gray-200 max-w-2xl">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <div className="text-sm text-gray-500">Name</div>
            <div className="font-medium">{me.name}</div>
          </div>
          <div>
            <div className="text-sm text-gray-500">Employee ID</div>
            <div className="font-medium">{me.employeeId}</div>
          </div>
          <div>
            <div className="text-sm text-gray-500">Team</div>
            <div className="font-medium">{me.team}</div>
          </div>
          <div>
            <div className="text-sm text-gray-500">Role</div>
            <div className="font-medium">{me.role}</div>
          </div>
          <div className="sm:col-span-2">
            <div className="text-sm text-gray-500">Email</div>
            <div className="font-medium">{me.email}</div>
          </div>
        </div>
        {me.trainedJobs && me.trainedJobs.length > 0 && (
          <div className="mt-6">
            <div className="text-sm text-gray-500 mb-2">Trained Jobs</div>
            <div className="flex flex-wrap gap-2">
              {me.trainedJobs.map((j: any) => (
                <span key={j.id} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                  {j.title}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

