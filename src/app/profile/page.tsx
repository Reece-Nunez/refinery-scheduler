'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useToast } from '@/contexts/ToastContext'
import axios from 'axios'

interface Profile {
  id: string
  email: string
  displayName: string | null
  phone: string | null
  role: 'ADMIN' | 'OPER'
  createdAt: string
  updatedAt: string | null
  operator: {
    id: string
    name: string
    employeeId: string
    phone: string | null
    team: string
    operatorRole: string
    letter: string | null
    status: string
    consoles: string[] | null
    trainedJobs: { id: string; title: string }[]
  } | null
}

export default function ProfilePage() {
  const { showToast } = useToast()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Edit states
  const [isEditingContact, setIsEditingContact] = useState(false)
  const [isChangingPassword, setIsChangingPassword] = useState(false)

  // Form states
  const [displayName, setDisplayName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  useEffect(() => {
    loadProfile()
  }, [])

  const loadProfile = async () => {
    try {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )
      const { data: { session } } = await supabase.auth.getSession()

      if (!session?.access_token) {
        setLoading(false)
        return
      }

      const res = await axios.get('/api/profile', {
        headers: { Authorization: `Bearer ${session.access_token}` }
      })

      setProfile(res.data)
      setDisplayName(res.data.displayName || res.data.operator?.name || '')
      setPhone(res.data.phone || res.data.operator?.phone || '')
      setEmail(res.data.email || '')
    } catch (error) {
      console.error('Failed to load profile:', error)
      showToast('Failed to load profile', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleSaveContact = async () => {
    if (!profile) return

    setSaving(true)
    try {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )
      const { data: { session } } = await supabase.auth.getSession()

      await axios.put('/api/profile', {
        displayName,
        phone,
        email: email !== profile.email ? email : undefined
      }, {
        headers: { Authorization: `Bearer ${session?.access_token}` }
      })

      showToast('Contact information updated successfully', 'success')
      setIsEditingContact(false)
      await loadProfile()
    } catch (error: any) {
      showToast(error.response?.data?.error || 'Failed to update contact info', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      showToast('New passwords do not match', 'error')
      return
    }

    if (newPassword.length < 6) {
      showToast('Password must be at least 6 characters', 'error')
      return
    }

    setSaving(true)
    try {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )
      const { data: { session } } = await supabase.auth.getSession()

      await axios.put('/api/profile', {
        currentPassword,
        newPassword
      }, {
        headers: { Authorization: `Bearer ${session?.access_token}` }
      })

      showToast('Password changed successfully', 'success')
      setIsChangingPassword(false)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (error: any) {
      showToast(error.response?.data?.error || 'Failed to change password', 'error')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black"></div>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Profile</h1>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <p className="text-gray-600">Please sign in to view your profile.</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <h1 className="text-3xl font-bold text-gray-900">My Profile</h1>
          <p className="text-gray-600 mt-1">View and manage your account information</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Account Info Card */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">Account Information</h2>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <div className="text-sm font-medium text-gray-500">Email</div>
                <div className="mt-1 text-gray-900">{profile.email}</div>
              </div>
              <div>
                <div className="text-sm font-medium text-gray-500">Account Role</div>
                <div className="mt-1">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    profile.role === 'ADMIN'
                      ? 'bg-red-100 text-red-800'
                      : 'bg-blue-100 text-blue-800'
                  }`}>
                    {profile.role === 'ADMIN' ? 'Administrator' : 'Operator'}
                  </span>
                </div>
              </div>
              <div>
                <div className="text-sm font-medium text-gray-500">Account Created</div>
                <div className="mt-1 text-gray-900">
                  {new Date(profile.createdAt).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Operator Info Card (if operator record exists) */}
        {profile.operator && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Operator Information</h2>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                <div>
                  <div className="text-sm font-medium text-gray-500">Name</div>
                  <div className="mt-1 text-lg font-semibold text-gray-900">{profile.operator.name}</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-500">Employee ID</div>
                  <div className="mt-1 text-gray-900 font-mono">{profile.operator.employeeId}</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-500">Team</div>
                  <div className="mt-1">
                    <span className={`inline-flex items-center justify-center w-8 h-8 text-white text-sm font-bold rounded ${
                      profile.operator.team === 'A' ? 'bg-blue-500' :
                      profile.operator.team === 'B' ? 'bg-green-500' :
                      profile.operator.team === 'C' ? 'bg-purple-500' :
                      profile.operator.team === 'D' ? 'bg-orange-500' : 'bg-gray-500'
                    }`}>
                      {profile.operator.team}
                    </span>
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-500">Operator Role</div>
                  <div className="mt-1">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      profile.operator.operatorRole === 'APS' ? 'bg-green-100 text-green-800' :
                      profile.operator.operatorRole === 'Green Hat' ? 'bg-green-100 text-green-800' :
                      profile.operator.operatorRole === 'Replacement' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {profile.operator.operatorRole}
                    </span>
                  </div>
                </div>
                {profile.operator.letter && (
                  <div>
                    <div className="text-sm font-medium text-gray-500">Letter</div>
                    <div className="mt-1">
                      <span className="inline-flex items-center justify-center w-8 h-8 bg-gray-700 text-white text-sm font-bold rounded">
                        {profile.operator.letter}
                      </span>
                    </div>
                  </div>
                )}
                <div>
                  <div className="text-sm font-medium text-gray-500">Status</div>
                  <div className="mt-1">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      profile.operator.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                    }`}>
                      {profile.operator.status || 'Active'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Trained Jobs */}
              {profile.operator.trainedJobs && profile.operator.trainedJobs.length > 0 && (
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <div className="text-sm font-medium text-gray-500 mb-3">Trained Jobs</div>
                  <div className="flex flex-wrap gap-2">
                    {profile.operator.trainedJobs.map(job => (
                      <span
                        key={job.id}
                        className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800"
                      >
                        {job.title}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Contact Information Card */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">Contact Information</h2>
            {!isEditingContact && (
              <button
                onClick={() => setIsEditingContact(true)}
                className="text-sm text-blue-600 hover:text-blue-800 font-medium"
              >
                Edit
              </button>
            )}
          </div>
          <div className="p-6">
            {isEditingContact ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Display Name</label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Your name"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                  />
                  <p className="mt-1 text-xs text-gray-500">Changing your email will require you to sign in again.</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="(555) 123-4567"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                  />
                </div>
                <div className="flex justify-end gap-3 pt-4">
                  <button
                    onClick={() => {
                      setIsEditingContact(false)
                      setDisplayName(profile.displayName || profile.operator?.name || '')
                      setPhone(profile.phone || profile.operator?.phone || '')
                      setEmail(profile.email)
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                    disabled={saving}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveContact}
                    disabled={saving}
                    className="px-4 py-2 bg-black text-white rounded-md text-sm font-medium hover:bg-gray-800 disabled:opacity-50"
                  >
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                <div>
                  <div className="text-sm font-medium text-gray-500">Display Name</div>
                  <div className="mt-1 text-gray-900">{profile.displayName || profile.operator?.name || 'Not set'}</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-500">Email</div>
                  <div className="mt-1 text-gray-900">{profile.email}</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-500">Phone Number</div>
                  <div className="mt-1 text-gray-900">{profile.phone || profile.operator?.phone || 'Not set'}</div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Password Change Card */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">Security</h2>
            {!isChangingPassword && (
              <button
                onClick={() => setIsChangingPassword(true)}
                className="text-sm text-blue-600 hover:text-blue-800 font-medium"
              >
                Change Password
              </button>
            )}
          </div>
          <div className="p-6">
            {isChangingPassword ? (
              <div className="space-y-4 max-w-md">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                  />
                </div>
                <div className="flex justify-end gap-3 pt-4">
                  <button
                    onClick={() => {
                      setIsChangingPassword(false)
                      setCurrentPassword('')
                      setNewPassword('')
                      setConfirmPassword('')
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                    disabled={saving}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleChangePassword}
                    disabled={saving || !currentPassword || !newPassword || !confirmPassword}
                    className="px-4 py-2 bg-black text-white rounded-md text-sm font-medium hover:bg-gray-800 disabled:opacity-50"
                  >
                    {saving ? 'Changing...' : 'Change Password'}
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <div className="text-sm text-gray-600">
                  Your password was last changed on your account creation. Click "Change Password" to update it.
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
