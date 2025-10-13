'use client'

import { useState } from 'react'
import { useToast } from '@/contexts/ToastContext'
import axios from 'axios'
import { createBrowserClient } from '@supabase/ssr'

interface Operator {
  id: string
  name: string
  employeeId: string
  team: string
  role: string
  letter?: string
}

interface Job {
  id: string
  title: string
}

interface MandateModalProps {
  isOpen: boolean
  onClose: () => void
  onMandateAdded: () => void
  operators: Operator[]
  jobs: Job[]
  defaultOperatorId?: string
  defaultDate?: string
  defaultShiftType?: 'day' | 'night'
}

export default function MandateModal({
  isOpen,
  onClose,
  onMandateAdded,
  operators,
  jobs,
  defaultOperatorId,
  defaultDate,
  defaultShiftType
}: MandateModalProps) {
  const { showToast } = useToast()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    operatorId: defaultOperatorId || '',
    mandateDate: defaultDate || '',
    shiftType: defaultShiftType || 'day' as 'day' | 'night',
    jobId: '',
    reason: ''
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      const headers = token ? { Authorization: `Bearer ${token}` } : undefined

      // Parse date as local time
      const [year, month, day] = form.mandateDate.split('-').map(Number)
      const startTime = new Date(year, month - 1, day)
      const endTime = new Date(year, month - 1, day)

      // Set times based on shift type
      if (form.shiftType === 'day') {
        startTime.setHours(4, 45, 0, 0)
        endTime.setHours(16, 45, 0, 0)
      } else {
        startTime.setHours(16, 45, 0, 0)
        endTime.setDate(endTime.getDate() + 1)
        endTime.setHours(4, 45, 0, 0)
      }

      await axios.post('/api/mandates', {
        operatorId: form.operatorId,
        mandateDate: form.mandateDate,
        shiftType: form.shiftType,
        jobId: form.jobId || null,
        reason: form.reason,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString()
      }, { headers })

      showToast('Mandate added successfully', 'success')
      onMandateAdded()
      onClose()
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || 'Failed to add mandate'
      if (err.response?.data?.protection) {
        showToast('Operator is protected from mandate due to whole-set vacation', 'error')
      } else {
        showToast(errorMsg, 'error')
      }
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
            <h2 className="text-2xl font-bold text-gray-900">Add Mandate</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl"
              disabled={loading}
            >
              ×
            </button>
          </div>

          <div className="mb-6 bg-yellow-50 border border-yellow-200 rounded-md p-4">
            <p className="text-sm text-yellow-800">
              ⚠️ Mandates can only be assigned on operators' days off. Operators with whole-set vacation are protected from mandates.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Operator Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Operator *
              </label>
              <select
                name="operatorId"
                value={form.operatorId}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 text-gray-900"
                required
              >
                <option value="">Select operator...</option>
                {operators.map(op => (
                  <option key={op.id} value={op.id}>
                    {op.name} ({op.employeeId}) - Team {op.team} {op.role === 'APS' ? '(Green Hat)' : op.letter ? `(${op.letter})` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Mandate Date & Shift Type */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Mandate Date *
                </label>
                <input
                  type="date"
                  name="mandateDate"
                  value={form.mandateDate}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 text-gray-900"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Shift Type *
                </label>
                <select
                  name="shiftType"
                  value={form.shiftType}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 text-gray-900"
                  required
                >
                  <option value="day">Day Shift</option>
                  <option value="night">Night Shift</option>
                </select>
              </div>
            </div>

            {/* Job Assignment */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Job Assignment (Optional)
              </label>
              <select
                name="jobId"
                value={form.jobId}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 text-gray-900"
              >
                <option value="">No specific job</option>
                {jobs.map(job => (
                  <option key={job.id} value={job.id}>
                    {job.title}
                  </option>
                ))}
              </select>
            </div>

            {/* Reason */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Reason *
              </label>
              <textarea
                name="reason"
                value={form.reason}
                onChange={handleChange}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 text-gray-900"
                placeholder="e.g., Coverage needed due to shortage"
                required
              />
            </div>

            {/* Actions */}
            <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50"
                disabled={loading}
              >
                {loading ? 'Adding...' : 'Add Mandate'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
