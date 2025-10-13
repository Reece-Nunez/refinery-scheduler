'use client'

import { useState, useEffect } from 'react'
import { useToast } from '@/contexts/ToastContext'
import axios from 'axios'
import { createBrowserClient } from '@supabase/ssr'
import AssignmentDetailsModal from './AssignmentDetailsModal'

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
  isActive: boolean
}

interface OutOfScheduleAssignment {
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

interface OutOfScheduleViewProps {
  operators: Operator[]
  onAssignmentChange?: () => void
}

export default function OutOfScheduleView({ operators, onAssignmentChange }: OutOfScheduleViewProps) {
  const { showToast } = useToast()
  const [jobs, setJobs] = useState<OutOfScheduleJob[]>([])
  const [assignments, setAssignments] = useState<OutOfScheduleAssignment[]>([])
  const [loading, setLoading] = useState(false)
  const [viewMode, setViewMode] = useState<'jobs' | 'assignments'>('assignments')
  const [viewDays, setViewDays] = useState<7 | 14>(7)
  const [startDate, setStartDate] = useState<Date>(new Date())
  const [dateRange, setDateRange] = useState<Date[]>([])

  // Job form state
  const [showJobModal, setShowJobModal] = useState(false)
  const [jobForm, setJobForm] = useState({
    title: '',
    description: ''
  })

  // Assignment form state
  const [showAssignmentModal, setShowAssignmentModal] = useState(false)
  const [assignmentForm, setAssignmentForm] = useState({
    operatorId: '',
    jobId: '',
    startDate: '',
    endDate: '',
    shiftType: 'day' as 'day' | 'night',
    notes: ''
  })
  const [selectedAssignment, setSelectedAssignment] = useState<OutOfScheduleAssignment | null>(null)
  const [showDetailsModal, setShowDetailsModal] = useState(false)

  useEffect(() => {
    fetchJobs()
    fetchAssignments()
  }, [])

  useEffect(() => {
    // Generate date range based on viewDays
    const dates: Date[] = []
    const start = new Date(startDate)
    start.setHours(0, 0, 0, 0)

    for (let i = 0; i < viewDays; i++) {
      const date = new Date(start)
      date.setDate(start.getDate() + i)
      dates.push(date)
    }
    setDateRange(dates)
  }, [startDate, viewDays])

  const fetchJobs = async () => {
    try {
      const { data } = await axios.get('/api/out-of-schedule-jobs?activeOnly=true')
      setJobs(data)
    } catch (err) {
      showToast('Failed to load jobs', 'error')
    }
  }

  const fetchAssignments = async () => {
    try {
      const { data } = await axios.get('/api/out-of-schedule-assignments')
      setAssignments(data)
    } catch (err) {
      showToast('Failed to load assignments', 'error')
    }
  }

  const handleCreateJob = async (e: React.FormEvent) => {
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

      await axios.post('/api/out-of-schedule-jobs', jobForm, { headers })
      showToast('Job created successfully', 'success')
      setShowJobModal(false)
      setJobForm({ title: '', description: '' })
      fetchJobs()
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to create job', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateAssignment = async (e: React.FormEvent) => {
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
      const [startYear, startMonth, startDay] = assignmentForm.startDate.split('-').map(Number)
      const [endYear, endMonth, endDay] = assignmentForm.endDate.split('-').map(Number)

      const startTime = new Date(startYear, startMonth - 1, startDay)
      const endTime = new Date(endYear, endMonth - 1, endDay)

      // Set times based on shift type
      if (assignmentForm.shiftType === 'day') {
        startTime.setHours(4, 45, 0, 0)
        endTime.setHours(16, 45, 0, 0)
      } else {
        startTime.setHours(16, 45, 0, 0)
        endTime.setDate(endTime.getDate() + 1)
        endTime.setHours(4, 45, 0, 0)
      }

      await axios.post('/api/out-of-schedule-assignments', {
        operatorId: assignmentForm.operatorId,
        jobId: assignmentForm.jobId,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        shiftType: assignmentForm.shiftType,
        notes: assignmentForm.notes
      }, { headers })

      showToast('Assignment created successfully', 'success')
      setShowAssignmentModal(false)
      setAssignmentForm({
        operatorId: '',
        jobId: '',
        startDate: '',
        endDate: '',
        shiftType: 'day',
        notes: ''
      })
      fetchAssignments()
      onAssignmentChange?.()
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to create assignment', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteAssignment = async (id: string) => {
    if (!confirm('Are you sure you want to delete this assignment?')) return

    try {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      const headers = token ? { Authorization: `Bearer ${token}` } : undefined

      await axios.delete(`/api/out-of-schedule-assignments?id=${id}`, { headers })
      showToast('Assignment deleted successfully', 'success')
      fetchAssignments()
      onAssignmentChange?.()
    } catch (err) {
      showToast('Failed to delete assignment', 'error')
    }
  }

  const formatDate = (date: Date) => {
    return date.toISOString().split('T')[0]
  }

  const formatDisplayDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', weekday: 'short' })
  }

  const formatDateStr = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  const getAssignmentsForCell = (date: Date, jobId: string, shiftType: 'day' | 'night'): OutOfScheduleAssignment[] => {
    const cellDate = new Date(date)
    cellDate.setHours(0, 0, 0, 0)

    return assignments.filter(assignment => {
      if (assignment.jobId !== jobId || assignment.shiftType !== shiftType) {
        return false
      }

      // Parse start and end dates in local timezone
      const assignStart = new Date(assignment.startTime)
      const assignEnd = new Date(assignment.endTime)

      // Set to start of day for comparison
      const assignStartDay = new Date(assignStart.getFullYear(), assignStart.getMonth(), assignStart.getDate())
      const assignEndDay = new Date(assignEnd.getFullYear(), assignEnd.getMonth(), assignEnd.getDate())

      // Check if cellDate falls within the assignment range (inclusive)
      return cellDate >= assignStartDay && cellDate <= assignEndDay
    })
  }

  const goToPreviousWeek = () => {
    const newDate = new Date(startDate)
    newDate.setDate(newDate.getDate() - viewDays)
    setStartDate(newDate)
  }

  const goToNextWeek = () => {
    const newDate = new Date(startDate)
    newDate.setDate(newDate.getDate() + viewDays)
    setStartDate(newDate)
  }

  const goToToday = () => {
    setStartDate(new Date())
  }

  const handleCellClick = (date: Date, jobId: string, shiftType: 'day' | 'night', existingAssignments: OutOfScheduleAssignment[]) => {
    if (existingAssignments.length > 0) {
      // Show details for the first assignment (or we could show a list if multiple)
      setSelectedAssignment(existingAssignments[0])
      setShowDetailsModal(true)
    } else {
      setAssignmentForm({
        ...assignmentForm,
        jobId,
        startDate: formatDate(date),
        endDate: formatDate(date),
        shiftType
      })
      setShowAssignmentModal(true)
    }
  }

  // Team colors
  const teamColors: Record<string, string> = {
    'A': 'bg-blue-100 text-blue-800 border-blue-300',
    'B': 'bg-green-100 text-green-800 border-green-300',
    'C': 'bg-yellow-100 text-yellow-800 border-yellow-300',
    'D': 'bg-purple-100 text-purple-800 border-purple-300',
  }

  return (
    <div className="bg-white shadow rounded-lg">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-bold text-gray-900">Out-of-Schedule Assignments</h2>

            {viewMode === 'assignments' && (
              <div className="flex border border-gray-300 rounded-lg">
                <button
                  onClick={() => setViewDays(7)}
                  className={`px-3 py-1 text-sm rounded-l-lg ${
                    viewDays === 7 ? 'bg-black text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
                  } transition duration-200`}
                >
                  7 Days
                </button>
                <button
                  onClick={() => setViewDays(14)}
                  className={`px-3 py-1 text-sm rounded-r-lg ${
                    viewDays === 14 ? 'bg-black text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
                  } transition duration-200`}
                >
                  14 Days
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* View Toggle */}
            <div className="flex border border-gray-300 rounded-lg">
              <button
                onClick={() => setViewMode('assignments')}
                className={`px-3 py-1 text-sm rounded-l-lg ${
                  viewMode === 'assignments' ? 'bg-black text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
                } transition duration-200`}
              >
                Coverage Grid
              </button>
              <button
                onClick={() => setViewMode('jobs')}
                className={`px-3 py-1 text-sm rounded-r-lg ${
                  viewMode === 'jobs' ? 'bg-black text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
                } transition duration-200`}
              >
                Manage Jobs
              </button>
            </div>

            {viewMode === 'jobs' && (
              <button
                onClick={() => setShowJobModal(true)}
                className="px-4 py-2 bg-black text-white rounded-md hover:bg-gray-800 transition duration-200 text-sm"
              >
                + Create Job
              </button>
            )}
          </div>
        </div>

        {viewMode === 'assignments' && (
          <>
            {/* Navigation */}
            <div className="mt-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  onClick={goToPreviousWeek}
                  className="p-2 hover:bg-gray-100 rounded transition duration-200"
                  title="Previous"
                >
                  <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <button
                  onClick={goToToday}
                  className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded transition duration-200"
                >
                  Today
                </button>
                <button
                  onClick={goToNextWeek}
                  className="p-2 hover:bg-gray-100 rounded transition duration-200"
                  title="Next"
                >
                  <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>

              <div className="text-sm text-gray-600">
                Total assignments: {assignments.length}
              </div>
            </div>

            {/* Legend */}
            <div className="mt-4 flex flex-wrap items-center gap-4 text-xs">
              <span className="font-medium text-gray-700">Teams:</span>
              {Object.entries(teamColors).map(([team, colorClass]) => (
                <div key={team} className="flex items-center gap-1">
                  <div className={`w-4 h-4 rounded border ${colorClass}`}></div>
                  <span className="text-gray-600">Team {team}</span>
                </div>
              ))}
              <span className="mx-2 text-gray-400">|</span>
              <div className="flex items-center gap-1">
                <div className="w-4 h-4 rounded bg-white border-2 border-yellow-400"></div>
                <span className="text-gray-600">Day Shift</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-4 h-4 rounded bg-gray-700 border-2 border-gray-700"></div>
                <span className="text-gray-600">Night Shift</span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Assignments Grid View */}
      {viewMode === 'assignments' && (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sticky left-0 bg-gray-50 z-10 border-r border-gray-300">
                  Job
                </th>
                {dateRange.map((date, idx) => (
                  <th key={idx} className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200 min-w-[140px]">
                    <div>{formatDisplayDate(date)}</div>
                    <div className="text-gray-400 font-normal">{date.getMonth() + 1}/{date.getDate()}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {jobs.length === 0 ? (
                <tr>
                  <td colSpan={dateRange.length + 1} className="px-4 py-12 text-center text-gray-500">
                    <p className="mb-2">No out-of-schedule jobs created yet.</p>
                    <button
                      onClick={() => setViewMode('jobs')}
                      className="text-black hover:underline"
                    >
                      Create your first job
                    </button>
                  </td>
                </tr>
              ) : (
                jobs.map((job) => (
                  <tr key={job.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 sticky left-0 bg-white border-r border-gray-300">
                      {job.title}
                    </td>
                    {dateRange.map((date, idx) => {
                      const dayAssignments = getAssignmentsForCell(date, job.id, 'day')
                      const nightAssignments = getAssignmentsForCell(date, job.id, 'night')

                      return (
                        <td key={idx} className="px-2 py-2 border-r border-gray-200">
                          <div className="space-y-1">
                            {/* Day Shift */}
                            <div
                              onClick={() => handleCellClick(date, job.id, 'day', dayAssignments)}
                              className={`text-xs p-2 rounded border-2 cursor-pointer transition hover:shadow-md ${
                                dayAssignments.length > 0
                                  ? 'bg-white border-yellow-400 border-l-4'
                                  : 'bg-white border-dashed border-gray-300 text-gray-400 hover:border-gray-400'
                              }`}
                            >
                              {dayAssignments.length > 0 ? (
                                <div className="space-y-1">
                                  {dayAssignments.map(assignment => (
                                    <div
                                      key={assignment.id}
                                      className={`flex items-center justify-between p-1 rounded ${
                                        teamColors[assignment.operator?.team || 'A'] || 'bg-gray-100 text-gray-800'
                                      }`}
                                    >
                                      <span className="font-medium truncate">
                                        {assignment.operator ? (() => {
                                          const nameParts = assignment.operator.name.split(' ')
                                          const firstName = nameParts[0]
                                          const lastInitial = nameParts[nameParts.length - 1]?.[0] || ''
                                          return `${firstName} ${lastInitial}.`
                                        })() : 'Unknown'}
                                      </span>
                                      {assignment.operator?.letter && (
                                        <span className="ml-1 font-bold">{assignment.operator.letter}</span>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <span>+ Day</span>
                              )}
                            </div>

                            {/* Night Shift */}
                            <div
                              onClick={() => handleCellClick(date, job.id, 'night', nightAssignments)}
                              className={`text-xs p-2 rounded border-2 cursor-pointer transition hover:shadow-md ${
                                nightAssignments.length > 0
                                  ? 'bg-white border-gray-700 border-l-4'
                                  : 'bg-white border-dashed border-gray-300 text-gray-400 hover:border-gray-400'
                              }`}
                            >
                              {nightAssignments.length > 0 ? (
                                <div className="space-y-1">
                                  {nightAssignments.map(assignment => (
                                    <div
                                      key={assignment.id}
                                      className={`flex items-center justify-between p-1 rounded ${
                                        teamColors[assignment.operator?.team || 'A'] || 'bg-gray-100 text-gray-800'
                                      }`}
                                    >
                                      <span className="font-medium truncate">
                                        {assignment.operator ? (() => {
                                          const nameParts = assignment.operator.name.split(' ')
                                          const firstName = nameParts[0]
                                          const lastInitial = nameParts[nameParts.length - 1]?.[0] || ''
                                          return `${firstName} ${lastInitial}.`
                                        })() : 'Unknown'}
                                      </span>
                                      {assignment.operator?.letter && (
                                        <span className="ml-1 font-bold">{assignment.operator.letter}</span>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <span>+ Night</span>
                              )}
                            </div>
                          </div>
                        </td>
                      )
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Jobs View */}
      {viewMode === 'jobs' && (
        <div className="p-4">
          {jobs.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <p>No out-of-schedule jobs created yet.</p>
              <button
                onClick={() => setShowJobModal(true)}
                className="mt-4 text-black hover:underline"
              >
                Create your first job
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {jobs.map(job => (
                <div key={job.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition">
                  <h3 className="font-semibold text-gray-900 mb-2">{job.title}</h3>
                  {job.description && (
                    <p className="text-sm text-gray-600">{job.description}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Job Creation Modal */}
      {showJobModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Create Out-of-Schedule Job</h2>
                <button
                  onClick={() => setShowJobModal(false)}
                  className="text-gray-400 hover:text-gray-600 text-2xl"
                  disabled={loading}
                >
                  ×
                </button>
              </div>

              <form onSubmit={handleCreateJob} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Job Title *
                  </label>
                  <input
                    type="text"
                    value={jobForm.title}
                    onChange={(e) => setJobForm({ ...jobForm, title: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-black text-gray-900"
                    placeholder="e.g., EXTRA, Training FCC Console"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description
                  </label>
                  <textarea
                    value={jobForm.description}
                    onChange={(e) => setJobForm({ ...jobForm, description: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-black text-gray-900"
                    placeholder="Optional description..."
                  />
                </div>

                <div className="flex justify-end space-x-4 pt-4 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={() => setShowJobModal(false)}
                    className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                    disabled={loading}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-black hover:bg-gray-800 disabled:opacity-50"
                    disabled={loading}
                  >
                    {loading ? 'Creating...' : 'Create Job'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Assignment Creation Modal */}
      {showAssignmentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Create Assignment</h2>
                <button
                  onClick={() => setShowAssignmentModal(false)}
                  className="text-gray-400 hover:text-gray-600 text-2xl"
                  disabled={loading}
                >
                  ×
                </button>
              </div>

              <form onSubmit={handleCreateAssignment} className="space-y-6">
                {/* Operator Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Operator *
                  </label>
                  <select
                    value={assignmentForm.operatorId}
                    onChange={(e) => setAssignmentForm({ ...assignmentForm, operatorId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-black text-gray-900"
                    required
                  >
                    <option value="">Select operator...</option>
                    {operators.map(op => (
                      <option key={op.id} value={op.id}>
                        {op.name} ({op.employeeid}) - Team {op.team}{op.letter ? ` - ${op.letter}` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Job Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Job *
                  </label>
                  <select
                    value={assignmentForm.jobId}
                    onChange={(e) => setAssignmentForm({ ...assignmentForm, jobId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-black text-gray-900"
                    required
                  >
                    <option value="">Select job...</option>
                    {jobs.map(job => (
                      <option key={job.id} value={job.id}>
                        {job.title}
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
                      value={assignmentForm.startDate}
                      onChange={(e) => setAssignmentForm({ ...assignmentForm, startDate: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-black text-gray-900"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      End Date *
                    </label>
                    <input
                      type="date"
                      value={assignmentForm.endDate}
                      onChange={(e) => setAssignmentForm({ ...assignmentForm, endDate: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-black text-gray-900"
                      required
                    />
                  </div>
                </div>

                {/* Shift Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Shift Type *
                  </label>
                  <select
                    value={assignmentForm.shiftType}
                    onChange={(e) => setAssignmentForm({ ...assignmentForm, shiftType: e.target.value as 'day' | 'night' })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-black text-gray-900"
                    required
                  >
                    <option value="day">Day Shift</option>
                    <option value="night">Night Shift</option>
                  </select>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Notes
                  </label>
                  <textarea
                    value={assignmentForm.notes}
                    onChange={(e) => setAssignmentForm({ ...assignmentForm, notes: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-black text-gray-900"
                    placeholder="Optional notes..."
                  />
                </div>

                {/* Actions */}
                <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={() => setShowAssignmentModal(false)}
                    className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                    disabled={loading}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-black hover:bg-gray-800 disabled:opacity-50"
                    disabled={loading}
                  >
                    {loading ? 'Creating...' : 'Create Assignment'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Assignment Details Modal */}
      {showDetailsModal && selectedAssignment && (
        <AssignmentDetailsModal
          isOpen={showDetailsModal}
          onClose={() => {
            setShowDetailsModal(false)
            setSelectedAssignment(null)
          }}
          assignment={selectedAssignment}
          onAssignmentUpdated={() => {
            fetchAssignments()
            onAssignmentChange?.()
          }}
          onAssignmentDeleted={() => {
            fetchAssignments()
            onAssignmentChange?.()
            setShowDetailsModal(false)
            setSelectedAssignment(null)
          }}
        />
      )}
    </div>
  )
}
