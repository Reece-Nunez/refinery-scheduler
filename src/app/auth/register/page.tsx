'use client'

import { useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'

export default function RegisterPage() {
  const router = useRouter()
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    employeeId: '',
    team: 'A',
    role: 'Operator',
    phone: '',
    letter: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [pendingEmail, setPendingEmail] = useState(false)

  const onChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )

      const { data, error } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
      })
      if (error) throw error

      const userId = data.user?.id
      if (!userId) {
        // Email confirmation likely required; show message and stop here
        setPendingEmail(true)
        return
      }

      // Create operator + profile server-side
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          operator: {
            name: form.name,
            email: form.email,
            employeeId: form.employeeId,
            team: form.team,
            role: form.role,
            phone: form.phone || undefined,
            letter: form.role === 'APS' ? undefined : (form.letter || undefined),
          }
        })
      })
      if (!res.ok) {
        const j = await res.json()
        throw new Error(j.error || 'Failed to finalize registration')
      }

      router.push('/dashboard')
    } catch (err: any) {
      setError(err.message || 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white/10 backdrop-blur-sm border border-white/20 p-6 rounded-xl shadow-lg text-white">
        <h1 className="text-2xl font-bold mb-1">Create Your Operator Account</h1>
        <p className="text-sm text-white/70 mb-6">Join the refinery scheduler</p>

        {error && (
          <div className="mb-4 p-2 rounded-md bg-red-600/20 border border-red-600 text-sm">{error}</div>
        )}

        {pendingEmail && (
          <div className="mb-4 p-2 rounded-md bg-yellow-600/20 border border-yellow-600 text-sm">
            Check your email to confirm your account. After confirming, return to <a href="/auth/login" className="underline">Sign in</a>.
          </div>
        )}

        <form onSubmit={onSubmit} className="space-y-3">
          <input name="name" value={form.name} onChange={onChange} placeholder="Full name" className="w-full px-3 py-2 rounded bg-white/10 border border-white/30 placeholder-white/70 focus:outline-none focus:ring-2 focus:ring-red-500" />
          <input name="email" type="email" value={form.email} onChange={onChange} placeholder="Email" className="w-full px-3 py-2 rounded bg-white/10 border border-white/30 placeholder-white/70 focus:outline-none focus:ring-2 focus:ring-red-500" />
          <input name="password" type="password" value={form.password} onChange={onChange} placeholder="Password" className="w-full px-3 py-2 rounded bg-white/10 border border-white/30 placeholder-white/70 focus:outline-none focus:ring-2 focus:ring-red-500" />
          <input name="employeeId" value={form.employeeId} onChange={onChange} placeholder="Employee ID" className="w-full px-3 py-2 rounded bg-white/10 border border-white/30 placeholder-white/70 focus:outline-none focus:ring-2 focus:ring-red-500" />
          <div className="grid grid-cols-2 gap-3">
            <select name="team" value={form.team} onChange={onChange} className="w-full px-3 py-2 rounded bg-white/10 border border-white/30 focus:outline-none focus:ring-2 focus:ring-red-500">
              {['A','B','C','D'].map(t => <option key={t} value={t}>Team {t}</option>)}
            </select>
            <select name="role" value={form.role} onChange={onChange} className="w-full px-3 py-2 rounded bg-white/10 border border-white/30 focus:outline-none focus:ring-2 focus:ring-red-500">
              {['Operator','APS'].map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          {form.role !== 'APS' && (
            <input name="letter" value={form.letter} onChange={onChange} placeholder="Schedule Code (Letter)" className="w-full px-3 py-2 rounded bg-white/10 border border-white/30 placeholder-white/70 focus:outline-none focus:ring-2 focus:ring-red-500" />
          )}
          <input name="phone" value={form.phone} onChange={onChange} placeholder="Phone (optional)" className="w-full px-3 py-2 rounded bg-white/10 border border-white/30 placeholder-white/70 focus:outline-none focus:ring-2 focus:ring-red-500" />

          <button disabled={loading} className="w-full mt-2 py-2 rounded bg-black hover:bg-gray-900 transition font-semibold disabled:opacity-50">
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <div className="mt-4 text-center text-sm text-white/80">
          Already have an account? <a href="/auth/login" className="underline">Sign in</a>
        </div>
      </div>
    </div>
  )
}
