'use client'

import { useState } from 'react'
import { useToast } from '@/contexts/ToastContext'
import axios from 'axios'
import { createBrowserClient } from '@supabase/ssr'

interface Operator {
  id: string
  name: string
  employeeid: string
  team: string
  role: string
  letter?: string
}

interface OutOfScheduleJob {
  id: string
  title: string
  description?: string
}

interface Assignment {
  id: string
  operatorId: string
  jobId: string
  startTime: string
  endTime: string
  shiftType: 'day' | 'night'
  notes?: string
  operator?: Operator
  job?: OutOfScheduleJob
}

interface AssignmentDetailsModalProps {
  isOpen: boolean
  onClose: () => void
  assignment: Assignment
  onAssignmentUpdated: () => void
  onAssignmentDeleted: () => void
}

export default function AssignmentDetailsModal({
  isOpen,
  onClose,
  assignment,
  onAssignmentUpdated,
  onAssignmentDeleted
}: AssignmentDetailsModalProps) {
  const { showToast } = useToast()
  const [loading, setLoading] = useState(false)

  if (!isOpen) return null

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this assignment?')) return

    setLoading(true)
    try {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      const headers = token ? { Authorization: `Bearer ${token}` } : undefined

      await axios.delete(`/api/out-of-schedule-assignments?id=${assignment.id}`, { headers })
      showToast('Assignment deleted successfully', 'success')
      onAssignmentDeleted()
      onClose()
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to delete assignment', 'error')
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
            <h2 className="text-2xl font-bold text-gray-900">Assignment Details</h2>
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
                    {assignment.operator?.name || 'Unknown'}
                  </div>
                  <div className="text-sm text-gray-600">
                    ID: {assignment.operator?.employeeid || 'N/A'} • Team {assignment.operator?.team || 'N/A'}
                    {assignment.operator?.role === 'APS' && ' • APS'}
                    {assignment.operator?.letter && ` • ${assignment.operator.letter}`}
                  </div>
                </div>
              </div>
            </div>

            {/* Job Info */}
            {assignment.job && (
              <div>
                <div className="text-sm text-gray-500 mb-1">Job</div>
                <div className="text-lg font-semibold text-gray-900">{assignment.job.title}</div>
                {assignment.job.description && (
                  <div className="text-sm text-gray-600 mt-1">{assignment.job.description}</div>
                )}
              </div>
            )}

            {/* Assignment Time */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-gray-500 mb-1">Start Time</div>
                <div className="text-gray-900">{formatDateTime(assignment.startTime)}</div>
              </div>
              <div>
                <div className="text-sm text-gray-500 mb-1">End Time</div>
                <div className="text-gray-900">{formatDateTime(assignment.endTime)}</div>
              </div>
            </div>

            {/* Shift Type */}
            <div>
              <div className="text-sm text-gray-500 mb-1">Shift Type</div>
              <div className="flex items-center gap-2">
                <span className={`px-3 py-1 text-sm rounded ${
                  assignment.shiftType === 'day'
                    ? 'bg-yellow-100 text-yellow-800'
                    : 'bg-gray-700 text-white'
                }`}>
                  {assignment.shiftType === 'day' ? '☀️ Day Shift' : '🌙 Night Shift'}
                </span>
              </div>
            </div>

            {/* Notes */}
            {assignment.notes && (
              <div>
                <div className="text-sm text-gray-500 mb-1">Notes</div>
                <div className="text-gray-900 bg-gray-50 rounded p-3">{assignment.notes}</div>
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
              onClick={handleDelete}
              className="px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50"
              disabled={loading}
            >
              {loading ? 'Deleting...' : 'Delete Assignment'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
