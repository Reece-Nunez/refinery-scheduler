'use client'

import { useState } from 'react'
import { useToast } from '@/contexts/ToastContext'
import axios from 'axios'
import { createBrowserClient } from '@supabase/ssr'

interface Operator {
  id: string
  name: string
  employeeId?: string
  employeeid?: string // fallback for different casing
  team: string
  role: string
  letter?: string
}

interface Job {
  id: string
  title: string
}

interface Shift {
  id: string
  operatorId: string
  jobId: string
  startTime: string
  endTime: string
  shiftType: 'day' | 'night'
  isOverridden?: boolean
  isOvertime?: boolean
  isOutage?: boolean
  operator?: Operator
  job?: Job
}

interface ShiftDetailsModalProps {
  isOpen: boolean
  onClose: () => void
  shift: Shift
  onShiftUpdated: () => void
  onShiftDeleted: () => void
}

export default function ShiftDetailsModal({
  isOpen,
  onClose,
  shift,
  onShiftUpdated,
  onShiftDeleted
}: ShiftDetailsModalProps) {
  const { showToast } = useToast()
  const [loading, setLoading] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  if (!isOpen) return null

  const handleDeleteClick = () => {
    setShowDeleteConfirm(true)
  }

  const handleDeleteConfirm = async () => {
    setShowDeleteConfirm(false)
    setLoading(true)
    try {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      const headers = token ? { Authorization: `Bearer ${token}` } : undefined

      await axios.delete(`/api/shifts?id=${shift.id}`, { headers })
      showToast('Shift deleted successfully', 'success')
      onShiftDeleted()
      onClose()
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to delete shift', 'error')
    } finally {
      setLoading(false)
    }
  }

  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Shift Details</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl"
              disabled={loading}
            >
              ×
            </button>
          </div>

          <div className="space-y-6">
            {/* Operator Info */}
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-gray-500 mb-1">Operator</div>
                  <div className="text-lg font-semibold text-gray-900">
                    {shift.operator?.name || 'Unknown'}
                  </div>
                  <div className="text-sm text-gray-600">
                    ID: {shift.operator?.employeeId || shift.operator?.employeeid || 'N/A'} • Team {shift.operator?.team || 'N/A'}
                    {shift.operator?.role === 'APS' && ' • APS'}
                    {shift.operator?.letter && ` • ${shift.operator.letter}`}
                  </div>
                </div>
              </div>
            </div>

            {/* Job Info */}
            {shift.job && (
              <div>
                <div className="text-sm text-gray-500 mb-1">Job</div>
                <div className="text-lg font-semibold text-gray-900">{shift.job.title}</div>
              </div>
            )}

            {/* Shift Time */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-gray-500 mb-1">Start Time</div>
                <div className="text-gray-900">{formatDateTime(shift.startTime)}</div>
              </div>
              <div>
                <div className="text-sm text-gray-500 mb-1">End Time</div>
                <div className="text-gray-900">{formatDateTime(shift.endTime)}</div>
              </div>
            </div>

            {/* Shift Type */}
            <div>
              <div className="text-sm text-gray-500 mb-1">Shift Type</div>
              <div className="flex items-center gap-2">
                <span className={`px-3 py-1 text-sm rounded ${
                  shift.shiftType === 'day'
                    ? 'bg-yellow-100 text-yellow-800'
                    : 'bg-gray-700 text-white'
                }`}>
                  {shift.shiftType === 'day' ? '☀️ Day Shift' : '🌙 Night Shift'}
                </span>
              </div>
            </div>

            {/* Shift Tags */}
            {(shift.isOvertime || shift.isOutage || shift.isOverridden) && (
              <div>
                <div className="text-sm text-gray-500 mb-2">Tags</div>
                <div className="flex flex-wrap gap-2">
                  {shift.isOvertime && (
                    <span className="px-2 py-1 text-xs rounded bg-gray-100 text-gray-800">
                      ⏰ Overtime
                    </span>
                  )}
                  {shift.isOutage && (
                    <span className="px-2 py-1 text-xs rounded bg-yellow-100 text-yellow-800">
                      🔧 Planned Outage
                    </span>
                  )}
                  {shift.isOverridden && (
                    <span className="px-2 py-1 text-xs rounded bg-red-100 text-red-800">
                      ⚠️ RP-755 Override
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              disabled={loading}
            >
              Close
            </button>
            <button
              type="button"
              onClick={handleDeleteClick}
              className="px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50"
              disabled={loading}
            >
              {loading ? 'Deleting...' : 'Delete Shift'}
            </button>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[60]">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Confirm Delete</h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete this shift for <strong>{shift.operator?.name}</strong>? This action cannot be undone.
            </p>
            <div className="flex justify-end space-x-4">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                className="px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-red-600 hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
