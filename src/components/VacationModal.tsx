'use client'

import { useState, useEffect } from 'react'
import { useToast } from '@/contexts/ToastContext'
import axios from 'axios'
import { createBrowserClient } from '@supabase/ssr'

interface Operator {
  id: string
  name: string
  employeeId: string
  team: string
  letter?: string
}

interface Vacation {
  id: string
  operatorId: string
  startTime: string
  endTime: string
  vacationType: '12hr' | '8hr' | '4hr'
  shiftType: 'day' | 'night'
  isWholeSet: boolean
  notes?: string
}

interface VacationModalProps {
  isOpen: boolean
  onClose: () => void
  onVacationAdded: () => void
  operators: Operator[]
  defaultOperatorId?: string
  defaultDate?: string
  defaultShiftType?: 'day' | 'night'
  vacation?: Vacation
}

export default function VacationModal({
  isOpen,
  onClose,
  onVacationAdded,
  operators,
  defaultOperatorId,
  defaultDate,
  defaultShiftType,
  vacation
}: VacationModalProps) {
  const { showToast } = useToast()
  const [loading, setLoading] = useState(false)
  const isEditing = !!vacation

  // Helper function to detect shift type based on operator's team and date
  const detectShiftType = (operatorId: string, date: string): 'day' | 'night' => {
    if (!operatorId || !date) return 'day'

    const operator = operators.find(op => op.id === operatorId)
    if (!operator?.team) return 'day'

    return getTeamShiftType(date, operator.team)
  }

  const [form, setForm] = useState(() => {
    const operatorId = vacation?.operatorId || defaultOperatorId || ''
    const startDate = vacation ? new Date(vacation.startTime).toISOString().split('T')[0] : (defaultDate || '')

    // Auto-detect shift type if we have both operator and date
    let shiftType: 'day' | 'night' = 'day'
    if (vacation?.shiftType) {
      shiftType = vacation.shiftType
    } else if (operatorId && startDate) {
      shiftType = detectShiftType(operatorId, startDate)
    } else if (defaultShiftType) {
      shiftType = defaultShiftType
    }

    // For end date, if it's a night shift vacation, we need to subtract 1 day
    // because the database stores the actual end time (next morning), but users
    // think in terms of shift dates (the last shift date, not the morning after)
    let endDate = defaultDate || ''
    if (vacation) {
      const endTime = new Date(vacation.endTime)
      if (vacation.shiftType === 'night') {
        // Subtract 1 day to get the shift date (not the morning after)
        endTime.setDate(endTime.getDate() - 1)
      }
      endDate = endTime.toISOString().split('T')[0]
    }

    return {
      id: vacation?.id || '',
      operatorId: operatorId,
      startDate: startDate,
      endDate: endDate,
      vacationType: (vacation?.vacationType || '12hr') as '12hr' | '8hr' | '4hr',
      shiftType: shiftType,
      isWholeSet: vacation?.isWholeSet || false,
      notes: vacation?.notes || ''
    }
  })

  // Auto-detect shift type when operator or start date changes
  useEffect(() => {
    if (form.operatorId && form.startDate && !vacation) {
      const operator = operators.find(op => op.id === form.operatorId)
      if (operator?.team) {
        const detectedShiftType = getTeamShiftType(form.startDate, operator.team)
        if (detectedShiftType !== form.shiftType) {
          setForm(prev => ({
            ...prev,
            shiftType: detectedShiftType
          }))
        }
      }
    }
  }, [form.operatorId, form.startDate, operators, vacation])

  const getTeamShiftType = (date: string, team: string): 'day' | 'night' => {
    // Define start dates for each team's 28-day cycle
    const teamStarts: Record<string, Date> = {
      'A': new Date(2025, 8, 19), // Sept 19, 2025
      'B': new Date(2025, 9, 10), // Oct 10, 2025
      'C': new Date(2025, 8, 26), // Sept 26, 2025
      'D': new Date(2025, 9, 3)   // Oct 3, 2025
    }

    // DuPont 28-day cycle pattern
    const getShiftType = (dayInCycle: number): 'day' | 'night' | 'off' => {
      if (dayInCycle >= 0 && dayInCycle <= 3) return 'night'  // 4 nights
      if (dayInCycle >= 4 && dayInCycle <= 6) return 'off'    // 3 off
      if (dayInCycle >= 7 && dayInCycle <= 9) return 'day'    // 3 days
      if (dayInCycle === 10) return 'off'                      // 1 off
      if (dayInCycle >= 11 && dayInCycle <= 13) return 'night' // 3 nights
      if (dayInCycle >= 14 && dayInCycle <= 16) return 'off'   // 3 off
      if (dayInCycle >= 17 && dayInCycle <= 20) return 'day'   // 4 days
      if (dayInCycle >= 21 && dayInCycle <= 27) return 'off'   // 7 off
      return 'off'
    }

    const teamStartDate = teamStarts[team]
    if (!teamStartDate) return 'day' // Default fallback

    const checkDate = new Date(date)
    checkDate.setHours(0, 0, 0, 0)

    const startDate = new Date(teamStartDate)
    startDate.setHours(0, 0, 0, 0)

    // Calculate days since team's cycle start
    const daysSinceStart = Math.floor((checkDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))

    // Get position in 28-day cycle
    const dayInCycle = ((daysSinceStart % 28) + 28) % 28

    const shiftType = getShiftType(dayInCycle)

    // Return day or night, default to day if they're off
    return shiftType === 'off' ? 'day' : shiftType
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target
    const checked = (e.target as HTMLInputElement).checked

    // Auto-detect shift type when operator or start date changes
    if (name === 'operatorId' || name === 'startDate') {
      const operatorId = name === 'operatorId' ? value : form.operatorId
      const startDate = name === 'startDate' ? value : form.startDate

      if (operatorId && startDate) {
        const operator = operators.find(op => op.id === operatorId)
        if (operator?.team) {
          const detectedShiftType = getTeamShiftType(startDate, operator.team)
          setForm(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value,
            shiftType: detectedShiftType,
            // Also update end date to match start date if it's empty or before start
            endDate: !prev.endDate || prev.endDate < startDate ? startDate : prev.endDate
          }))
          return
        }
      }
    }

    setForm(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }))
  }

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this vacation?')) return

    setLoading(true)
    try {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      const headers = token ? { Authorization: `Bearer ${token}` } : undefined

      await axios.delete(`/api/vacation?id=${form.id}`, { headers })
      showToast('Vacation deleted successfully', 'success')
      onVacationAdded() // Refresh the data
      onClose()
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to delete vacation', 'error')
    } finally {
      setLoading(false)
    }
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

      // Parse dates as local time
      const [startYear, startMonth, startDay] = form.startDate.split('-').map(Number)
      const [endYear, endMonth, endDay] = form.endDate.split('-').map(Number)

      const startTime = new Date(startYear, startMonth - 1, startDay)
      const endTime = new Date(endYear, endMonth - 1, endDay)

      // Set times based on shift type and vacation type
      if (form.shiftType === 'day') {
        // Day shift: starts at 4:45 AM on start date, ends at 4:45 PM on end date
        startTime.setHours(4, 45, 0, 0)
        if (form.vacationType === '12hr') {
          endTime.setHours(16, 45, 0, 0)
        } else if (form.vacationType === '8hr') {
          endTime.setHours(12, 45, 0, 0)
        } else { // 4hr
          endTime.setHours(8, 45, 0, 0)
        }
      } else { // night
        // Night shift: starts at 4:45 PM on start date
        // Ends at 4:45 AM the next CALENDAR day
        // So we need to add 1 day to endTime for the calendar crossing
        startTime.setHours(16, 45, 0, 0)
        if (form.vacationType === '12hr') {
          // Add one day since night shift crosses midnight
          endTime.setDate(endTime.getDate() + 1)
          endTime.setHours(4, 45, 0, 0)
        } else if (form.vacationType === '8hr') {
          endTime.setDate(endTime.getDate() + 1)
          endTime.setHours(0, 45, 0, 0)
        } else { // 4hr
          endTime.setHours(20, 45, 0, 0)
        }
      }

      const payload = {
        operatorId: form.operatorId,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        vacationType: form.vacationType,
        shiftType: form.shiftType,
        isWholeSet: form.isWholeSet,
        notes: form.notes
      }

      if (isEditing) {
        await axios.put(`/api/vacation?id=${form.id}`, payload, { headers })
        showToast('Vacation updated successfully', 'success')
      } else {
        await axios.post('/api/vacation', payload, { headers })
        showToast('Vacation added successfully', 'success')
      }

      onVacationAdded()
      onClose()
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || `Failed to ${isEditing ? 'update' : 'add'} vacation`
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
            <h2 className="text-2xl font-bold text-gray-900">{isEditing ? 'Edit Vacation' : 'Add Vacation'}</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl"
              disabled={loading}
            >
              ×
            </button>
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
                    {op.name} ({op.employeeId}) - Team {op.team}{op.letter ? ` - ${op.letter}` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Start Date *
                </label>
                <input
                  type="date"
                  name="startDate"
                  value={form.startDate}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 text-gray-900"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  End Date *
                </label>
                <input
                  type="date"
                  name="endDate"
                  value={form.endDate}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 text-gray-900"
                  required
                />
              </div>
            </div>

            {/* Vacation Type & Shift Type */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Vacation Type *
                </label>
                <select
                  name="vacationType"
                  value={form.vacationType}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 text-gray-900"
                  required
                >
                  <option value="12hr">12 Hour</option>
                  <option value="8hr">8 Hour</option>
                  <option value="4hr">4 Hour</option>
                </select>
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

            {/* Whole Set Checkbox */}
            <div>
              <label className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  name="isWholeSet"
                  checked={form.isWholeSet}
                  onChange={handleChange}
                  className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded"
                />
                <span className="ml-3 text-sm text-gray-700">
                  Whole Set Vacation (provides mandate protection)
                </span>
              </label>
              {form.isWholeSet && (
                <p className="mt-2 text-xs text-blue-600">
                  ℹ️ Taking a whole set off protects you from mandate on the previous and next sets
                </p>
              )}
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Notes
              </label>
              <textarea
                name="notes"
                value={form.notes}
                onChange={handleChange}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 text-gray-900"
                placeholder="Optional notes..."
              />
            </div>

            {/* Actions */}
            <div className="flex justify-between pt-6 border-t border-gray-200">
              <div>
                {isEditing && (
                  <button
                    type="button"
                    onClick={handleDelete}
                    className="px-4 py-2 border border-red-300 rounded-md text-sm font-medium text-red-700 bg-white hover:bg-red-50"
                    disabled={loading}
                  >
                    Delete
                  </button>
                )}
              </div>
              <div className="flex space-x-4">
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
                  className="px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-black hover:bg-gray-900 disabled:opacity-50"
                  disabled={loading}
                >
                  {loading ? (isEditing ? 'Updating...' : 'Adding...') : (isEditing ? 'Update Vacation' : 'Add Vacation')}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
