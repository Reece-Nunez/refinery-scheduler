'use client'

import { useEffect, useState } from 'react'
import axios from 'axios'
import { supabase } from '@/lib/supabaseClient'
import { useToast } from '@/contexts/ToastContext'
import { calculateVacationHours, getYearsOfService } from '@/lib/vacationUtils'

interface Job {
  id: string
  title: string
}

interface Operator {
  id: string
  name: string
  employeeId: string
  phone?: string
  role: string
  team: string
  letter?: string
  trainedJobs: Job[]
  email?: string
  status?: string
  consoles?: string[]
  vacationHours?: number
  hireDate?: string | null
}

interface OperatorModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: () => void
  operator?: Operator | null
}

const teamOptions = ['A', 'B', 'C', 'D']
const roleOptions = ['Operator', 'APS', 'Green Hat', 'Replacement']

export default function OperatorModal({ isOpen, onClose, onSave, operator }: OperatorModalProps) {
  const { showToast } = useToast()
  const [form, setForm] = useState({
    id: '',
    name: '',
    employeeId: '',
    email: '',
    phone: '',
    role: 'Operator',
    team: 'A',
    letter: '',
    isReplacement: false,
    trainedJobIds: [] as string[],
    vacationHours: 80, // Default 2 weeks * 40 hours
    hireDate: '',
  })
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  const isEditing = !!operator

  useEffect(() => {
    if (isOpen) {
      fetchJobs()
      if (operator) {
        const letter = operator.letter || ''
        const isReplacement = letter.length > 0 && letter === letter.toLowerCase()
        setForm({
          id: operator.id,
          name: operator.name,
          employeeId: operator.employeeId,
          email: operator.email || '',
          phone: operator.phone || '',
          role: operator.role,
          team: operator.team,
          letter: isReplacement ? letter.toUpperCase() : letter,
          isReplacement,
          trainedJobIds: operator.trainedJobs.map(j => j.id),
          vacationHours: operator.vacationHours ?? 80,
          hireDate: operator.hireDate || '',
        })
      } else {
        resetForm()
      }
      setMessage('')
      setErrors({})
    }
  }, [isOpen, operator])

  const fetchJobs = async () => {
    try {
      const res = await axios.get('/api/jobs')
      setJobs(res.data)
    } catch (err) {
      console.error('Error fetching jobs:', err)
    }
  }

  const resetForm = () => {
    setForm({
      id: '',
      name: '',
      employeeId: '',
      email: '',
      phone: '',
      role: 'Operator',
      team: 'A',
      letter: '',
      isReplacement: false,
      trainedJobIds: [],
      vacationHours: 80,
      hireDate: '',
    })
  }

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (!form.name.trim()) {
      newErrors.name = 'Name is required'
    }

    if (!form.employeeId.trim()) {
      newErrors.employeeId = 'Employee ID is required'
    }

    if (!isEditing && !form.email.trim()) {
      newErrors.email = 'Email is required for new operators'
    }

    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      newErrors.email = 'Invalid email format'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const formatPhoneNumber = (value: string) => {
    // Remove all non-numeric characters
    const cleaned = value.replace(/\D/g, '')
    // Format as XXX-XXX-XXXX
    if (cleaned.length <= 3) return cleaned
    if (cleaned.length <= 6) return `${cleaned.slice(0, 3)}-${cleaned.slice(3)}`
    return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6, 10)}`
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target
    const checked = (e.target as HTMLInputElement).checked

    // If role changes to APS, clear the letter
    if (name === 'role' && value === 'APS') {
      setForm(prev => ({ ...prev, [name]: value, letter: '', isReplacement: false }))
    } else if (name === 'role' && (value === 'Replacement' || value === 'Green Hat')) {
      // Replacement operators and Green Hats have lowercase letters
      setForm(prev => ({ ...prev, [name]: value, isReplacement: true }))
    } else if (name === 'role' && value === 'Operator') {
      // Regular operators have uppercase letters
      setForm(prev => ({ ...prev, [name]: value, isReplacement: false }))
    } else if (name === 'phone') {
      setForm(prev => ({ ...prev, [name]: formatPhoneNumber(value) }))
    } else if (type === 'checkbox') {
      setForm(prev => ({ ...prev, [name]: checked }))
    } else {
      setForm(prev => ({ ...prev, [name]: value }))
    }

    // Clear error for this field
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }))
    }
  }

  const toggleJob = (jobId: string) => {
    setForm(prev => ({
      ...prev,
      trainedJobIds: prev.trainedJobIds.includes(jobId)
        ? prev.trainedJobIds.filter(id => id !== jobId)
        : [...prev.trainedJobIds, jobId],
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) {
      return
    }

    setLoading(true)
    setMessage('')

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      const headers = token ? { Authorization: `Bearer ${token}` } : undefined

      // Convert letter to lowercase if role is Replacement or Green Hat
      const submittedForm = {
        ...form,
        letter: (form.role === 'Replacement' || form.role === 'Green Hat') && form.letter ? form.letter.toLowerCase() : form.letter
      }

      if (isEditing) {
        await axios.put('/api/operators', submittedForm, { headers })
        showToast('Operator updated successfully', 'success')
      } else {
        await axios.post('/api/operators', submittedForm, { headers })
        showToast('Operator created successfully', 'success')
      }

      onSave()
      onClose()
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || 'Error saving operator'
      setMessage(errorMsg)
      showToast(errorMsg, 'error')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">
              {isEditing ? 'Edit Operator' : 'Add New Operator'}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl"
              disabled={loading}
            >
              ×
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Information */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Name *
                </label>
                <input
                  type="text"
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  className={`w-full px-3 py-2 border text-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 ${
                    errors.name ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="Enter operator name"
                  disabled={loading}
                />
                {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Employee ID *
                </label>
                <input
                  type="text"
                  name="employeeId"
                  value={form.employeeId}
                  onChange={handleChange}
                  className={`w-full px-3 py-2 border text-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 ${
                    errors.employeeId ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="Enter employee ID"
                  disabled={loading}
                />
                {errors.employeeId && <p className="mt-1 text-sm text-red-600">{errors.employeeId}</p>}
              </div>
            </div>

            {/* Email and Phone */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {!isEditing && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email *
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={form.email}
                    onChange={handleChange}
                    className={`w-full px-3 py-2 border text-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 ${
                      errors.email ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="Enter email address"
                    disabled={loading}
                  />
                  {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email}</p>}
                </div>
              )}
              <div className={!isEditing ? '' : 'sm:col-span-2'}>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Phone Number
                </label>
                <input
                  type="tel"
                  name="phone"
                  value={form.phone}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 text-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                  placeholder="123-123-1234"
                  disabled={loading}
                />
              </div>
            </div>

            {/* Hire Date and Vacation Hours */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Hire Date
                </label>
                <input
                  type="date"
                  name="hireDate"
                  value={form.hireDate}
                  onChange={handleChange}
                  className="w-48 px-3 py-2 border border-gray-300 text-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                  disabled={loading}
                />
                {form.hireDate && (
                  <p className="mt-1 text-sm text-gray-600">
                    {getYearsOfService(form.hireDate)} years of service
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Annual Vacation Hours
                </label>
                {form.hireDate ? (
                  <div className="bg-green-50 border border-green-200 rounded-md p-3">
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-semibold text-green-800">
                        {calculateVacationHours(form.hireDate)} hours
                      </span>
                      <span className="text-sm text-green-600">
                        ({(calculateVacationHours(form.hireDate) || 0) / 40} weeks)
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-green-700">
                      Auto-calculated from hire date based on years of service
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-3">
                      <input
                        type="number"
                        name="vacationHours"
                        value={form.vacationHours}
                        onChange={handleChange}
                        min={0}
                        max={300}
                        step={40}
                        className="w-32 px-3 py-2 border border-gray-300 text-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                        disabled={loading}
                      />
                      <span className="text-sm text-gray-500">
                        ({form.vacationHours / 40} weeks)
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-gray-500">
                      Set hire date for auto-calculation, or manually set hours (40h = 1 week)
                    </p>
                  </>
                )}
              </div>

              {/* Vacation tier reference */}
              <div className="bg-gray-50 border border-gray-200 rounded-md p-3 text-xs text-gray-600">
                <p className="font-medium mb-1">Vacation Tiers:</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                  <span>0-3 years: 2 weeks (80h)</span>
                  <span>4-8 years: 3 weeks (120h)</span>
                  <span>9-19 years: 4 weeks (160h)</span>
                  <span>20-24 years: 5 weeks (200h)</span>
                  <span>25+ years: 6 weeks (240h)</span>
                </div>
              </div>
            </div>

            {/* Role, Team, and Letter */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Role
                </label>
                <select
                  name="role"
                  value={form.role}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border text-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                  disabled={loading}
                >
                  {roleOptions.map(role => (
                    <option key={role} value={role}>{role}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Team
                </label>
                <select
                  name="team"
                  value={form.team}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border text-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                  disabled={loading}
                >
                  {teamOptions.map(team => (
                    <option key={team} value={team}>Team {team}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Letter
                  {form.role === 'APS' && (
                    <span className="text-xs text-gray-500"> (N/A for APS)</span>
                  )}
                  {(form.role === 'Replacement' || form.role === 'Green Hat') && (
                    <span className="text-xs text-gray-500"> (lowercase)</span>
                  )}
                </label>
                <input
                  type="text"
                  name="letter"
                  value={form.letter}
                  onChange={handleChange}
                  maxLength={1}
                  className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 text-center font-bold uppercase ${
                    form.role === 'APS' ? 'bg-gray-100 cursor-not-allowed text-gray-500' : 'text-gray-700'
                  }`}
                  placeholder={form.role === 'APS' ? 'N/A' : 'G'}
                  disabled={loading || form.role === 'APS'}
                />
              </div>
            </div>

            {/* Info boxes for special roles */}
            {form.role === 'Green Hat' && (
              <div className="bg-green-50 border border-green-200 rounded-md p-4">
                <p className="text-sm text-green-800">
                  <strong>Green Hat:</strong> Probationary position. Still in training. Assigned to a team for vacation picks.
                </p>
              </div>
            )}

            {form.role === 'Replacement' && (
              <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                <p className="text-sm text-blue-800">
                  <strong>Replacement Operator:</strong> Out of probationary period but not permanently assigned to a team. Used to fill in when regular operators are on vacation or out of schedule.
                </p>
                <p className="mt-2 text-xs text-blue-600">
                  ℹ️ Letter will be saved as lowercase to indicate replacement status. Assigned to a team for vacation picks.
                </p>
              </div>
            )}

            {/* Trained Jobs */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Trained Jobs ({form.trainedJobIds.length} selected)
              </label>
              <div className="border border-gray-300 rounded-md p-4 max-h-60 overflow-y-auto">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {jobs.map(job => (
                    <label key={job.id} className="flex items-center space-x-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.trainedJobIds.includes(job.id)}
                        onChange={() => toggleJob(job.id)}
                        className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded"
                        disabled={loading}
                      />
                      <span className="text-sm text-gray-700">{job.title}</span>
                    </label>
                  ))}
                </div>
                {jobs.length === 0 && (
                  <p className="text-sm text-gray-600 text-center py-4">No jobs available</p>
                )}
              </div>
            </div>

            {/* Message */}
            {message && (
              <div className={`p-3 rounded-md ${
                message.includes('✅') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
              }`}>
                {message}
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-black hover:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={loading}
              >
                {loading ? 'Saving...' : isEditing ? 'Update Operator' : 'Create Operator'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
