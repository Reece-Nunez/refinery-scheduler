'use client'

import { useEffect, useState } from 'react'
import axios from 'axios'
import dynamic from 'next/dynamic'
import AdvancedShiftScheduler from '@/components/AdvancedShiftScheduler'
import JobCoverageSchedule from '@/components/JobCoverageSchedule'
import VacationModal from '@/components/VacationModal'
import MandateModal from '@/components/MandateModal'
import OutOfScheduleView from '@/components/OutOfScheduleView'
import ShiftDetailsModal from '@/components/ShiftDetailsModal'
import { createBrowserClient } from '@supabase/ssr'

type Job = {
  id: string
  title: string
}

type Operator = {
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
}

type Shift = {
  id: string
  operator: Operator
  startTime: string
  endTime: string
  isOverridden: boolean
  isCallOut?: boolean
  isOutage?: boolean
  shiftType?: 'day' | 'night' | 'rotating'
  violations?: FatigueViolation[]
}

export default function ShiftsPage() {
  const [operators, setOperators] = useState<Operator[]>([])
  const [jobs, setJobs] = useState<Job[]>([])
  const [shifts, setShifts] = useState<Shift[]>([])
  const [vacations, setVacations] = useState<any[]>([])
  const [mandates, setMandates] = useState<any[]>([])
  const [outOfScheduleAssignments, setOutOfScheduleAssignments] = useState<any[]>([])
  const [mandateProtections, setMandateProtections] = useState<any[]>([])
  const [role, setRole] = useState<'ADMIN' | 'OPER'>('OPER')
  const [viewMode, setViewMode] = useState<'coverage' | 'outofschedule'>('coverage')
  const [form, setForm] = useState({
    operatorId: '',
    shiftDate: '', // <-- user picks date only
    shiftType: 'day', // 'day' or 'night'
    isOverridden: false,
    isCallOut: false,
    isOutage: false,
  })

  const [violations, setViolations] = useState<FatigueViolation[]>([])
  const [error, setError] = useState('')

  // Exception handling state
  const [showExceptionModal, setShowExceptionModal] = useState(false)
  const [pendingShift, setPendingShift] = useState<any>(null)
  const [showSchedulerModal, setShowSchedulerModal] = useState(false)
  const [schedulerDefaults, setSchedulerDefaults] = useState<any>(null)

  // Vacation and Mandate modals
  const [showVacationModal, setShowVacationModal] = useState(false)
  const [vacationDefaults, setVacationDefaults] = useState<any>(null)
  const [showMandateModal, setShowMandateModal] = useState(false)
  const [mandateDefaults, setMandateDefaults] = useState<any>(null)

  // Shift details modal
  const [showShiftDetailsModal, setShowShiftDetailsModal] = useState(false)
  const [selectedShift, setSelectedShift] = useState<any>(null)

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
        // attach auth token for admin operations
        if (data?.role === 'ADMIN' && session?.access_token) {
          (axios.defaults.headers.common as any)['Authorization'] = `Bearer ${session.access_token}`
        }
      }
      await fetchOperators()
      await fetchJobs()
      await fetchShifts()
      await fetchVacations()
      await fetchMandates()
      await fetchOutOfScheduleAssignments()
      await fetchMandateProtections()
    }
    init()
  }, [])

  const fetchOperators = async () => {
    const res = await axios.get('/api/operators')
    setOperators(res.data)
  }

  const fetchJobs = async () => {
    const res = await axios.get('/api/jobs')
    setJobs(res.data)
  }

  const fetchShifts = async () => {
    const res = await axios.get('/api/shifts')
    const parsed = res.data.map((s: any) => ({
      ...s,
      isOverridden: Boolean(s.isOverridden), // 👈 force boolean
    }))
    setShifts(parsed)
  }

  const fetchVacations = async () => {
    try {
      const res = await axios.get('/api/vacation')
      setVacations(res.data)
    } catch (err) {
      console.error('Failed to fetch vacations:', err)
    }
  }

  const fetchMandates = async () => {
    try {
      const res = await axios.get('/api/mandates')
      setMandates(res.data)
    } catch (err) {
      console.error('Failed to fetch mandates:', err)
    }
  }

  const fetchOutOfScheduleAssignments = async () => {
    try {
      const res = await axios.get('/api/out-of-schedule-assignments')
      setOutOfScheduleAssignments(res.data)
    } catch (err) {
      console.error('Failed to fetch out-of-schedule assignments:', err)
    }
  }

  const fetchMandateProtections = async () => {
    try {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )
      const { data, error } = await supabase.from('mandate_protection').select('*')
      if (error) throw error
      setMandateProtections(data || [])
    } catch (err) {
      console.error('Failed to fetch mandate protections:', err)
    }
  }

  const handleCellClick = (date: string, jobId: string, shiftType: 'day' | 'night') => {
    if (role !== 'ADMIN') return

    // Open scheduler modal with defaults
    setSchedulerDefaults({
      date,
      jobId,
      shiftType
    })
    setShowSchedulerModal(true)
  }

  const handleVacationClick = (vacation: any) => {
    if (role !== 'ADMIN') return

    // Extract dates from vacation
    const startDate = new Date(vacation.startTime).toISOString().split('T')[0]
    const endDate = new Date(vacation.endTime).toISOString().split('T')[0]

    setVacationDefaults({
      vacation: vacation, // Pass the entire vacation object for editing
      defaultOperatorId: vacation.operatorId,
      defaultDate: startDate,
      defaultShiftType: vacation.shiftType
    })
    setShowVacationModal(true)
  }

  const handleMandateClick = (date: string, shiftType: 'day' | 'night') => {
    if (role !== 'ADMIN') return

    setMandateDefaults({
      defaultDate: date,
      defaultShiftType: shiftType
    })
    setShowMandateModal(true)
  }

  const handleShiftDetails = (shift: any) => {
    setSelectedShift(shift)
    setShowShiftDetailsModal(true)
  }


  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const target = e.target as HTMLInputElement | HTMLSelectElement
    const { name, value, type } = target
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? (target as HTMLInputElement).checked : value,
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setViolations([])
    setError('')

    try {
      const { operatorId, shiftDate, shiftType, isOverridden, isCallOut, isOutage } = form

      if (!operatorId || !shiftDate) {
        setError('Operator and shift date are required.')
        return
      }

      const start = new Date(shiftDate)
      const startTime = new Date(start)
      const endTime = new Date(start)

      if (shiftType === 'day') {
        startTime.setHours(4, 45)
        endTime.setHours(16, 45)
      } else {
        startTime.setHours(16, 45)
        endTime.setDate(endTime.getDate() + 1)
        endTime.setHours(4, 45)
      }

      const payload = {
        operatorId,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        isOverridden,
        isCallOut,
        isOutage,
        shiftType
      }

      const res = await axios.post('/api/shifts', payload)

      // ✅ only clear if successful
      setForm({ operatorId: '', shiftDate: '', shiftType: 'day', isOverridden: false, isCallOut: false, isOutage: false })
      fetchShifts()
      
      // Show success message if violations were overridden
      if (res.data.violations && res.data.violations.length > 0) {
        alert(`Shift scheduled with ${res.data.violations.length} RP-755 violation(s) overridden.`)
      }
      
    } catch (err: any) {
      if (err.response?.data?.violations?.length > 0) {
        const rp755Violations = err.response.data.violations
        setViolations(rp755Violations)
        
        // Store the shift data for exception processing
        setPendingShift({
          operatorId,
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          isCallOut,
          isOutage,
          shiftType
        })
        
        // Show exception modal for RP-755 violations
        setShowExceptionModal(true)
        return // ⛔ do NOT continue or clear form
      }
      setError(err.response?.data?.error || 'Something went wrong')
    }
  }

  const handleExceptionSubmit = async (exceptionRequest: ExceptionRequest) => {
    if (!pendingShift) return
    
    try {
      // Submit the exception request
      const exceptionResponse = await axios.post('/api/exceptions', exceptionRequest)
      
      // Now submit the shift with override flag
      const shiftResponse = await axios.post('/api/shifts', {
        ...pendingShift,
        isOverridden: true
      })
      
      // Success
      setForm({ operatorId: '', shiftDate: '', shiftType: 'day', isOverridden: false, isCallOut: false, isOutage: false })
      setViolations([])
      fetchShifts()
      alert('Exception request submitted and shift scheduled successfully.')
      
    } catch (error) {
      console.error('Error processing exception:', error)
      throw error // Re-throw to be handled by the modal
    } finally {
      setPendingShift(null)
      setShowExceptionModal(false)
    }
  }

  const getOperatorName = (operatorId: string) => {
    const operator = operators.find(op => op.id === operatorId)
    return operator ? `${operator.name} (${operator.employeeId})` : 'Unknown'
  }

  const getTeamColor = (team: string) => {
    const colors = {
      'A': 'bg-blue-500',
      'B': 'bg-green-500', 
      'C': 'bg-purple-500',
      'D': 'bg-orange-500'
    }
    return colors[team as keyof typeof colors] || 'bg-gray-500'
  }

  const getShiftTypeIcon = (shiftType: string) => {
    return shiftType === 'day' ? '☀️' : '🌙'
  }

  const formatShiftTime = (startTime: string, endTime: string) => {
    const start = new Date(startTime)
    const end = new Date(endTime)
    return `${start.toLocaleDateString()} ${start.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} - ${end.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`
  }


  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Shift Management</h1>
                <p className="text-gray-600 mt-2">Schedule and manage operator shifts with RP-755 compliance</p>
              </div>
              <div className="flex items-center space-x-4">
                <div className="text-sm text-gray-500">
                  <div>Total Shifts: <span className="font-semibold text-gray-900">{shifts.length}</span></div>
                  <div>Active Operators: <span className="font-semibold text-gray-900">{operators.length}</span></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Shift Assignment Form (ADMIN only) */}
          {role === 'ADMIN' && (
          <div className="lg:col-span-1">
            <AdvancedShiftScheduler
              operators={operators}
              onShiftsScheduled={fetchShifts}
              outOfScheduleAssignments={outOfScheduleAssignments}
              shifts={shifts}
              vacations={vacations}
              mandateProtections={mandateProtections}
            />
          </div>
          )}

          {/* Rest of the old form - we'll remove this */}
          {false && role === 'ADMIN' && (
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-gray-900">OLD FORM - TO BE REMOVED</h2>
                <p className="text-sm text-gray-600 mt-1">Schedule an operator for a shift</p>
              </div>
              <form onSubmit={handleSubmit} className="p-6 space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Operator</label>
                  <select
                    name="operatorId"
                    value={form.operatorId}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 text-gray-900"
                  >
                    <option value="">Select Operator</option>
                    {operators.map((op) => (
                      <option key={op.id} value={op.id}>
                        {op.name} ({op.employeeId}) - Team {op.team} {op.role === 'APS' ? '(APS)' : op.letter ? `(${op.letter})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Shift Date</label>
                    <input
                      type="date"
                      name="shiftDate"
                      value={form.shiftDate}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 text-gray-900"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Shift Type</label>
                    <select
                      name="shiftType"
                      value={form.shiftType}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 text-gray-900"
                    >
                      <option value="day">☀️ Day Shift (4:45 AM – 4:45 PM)</option>
                      <option value="night">🌙 Night Shift (4:45 PM – 4:45 AM)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">RP-755 Options</label>
                  <div className="space-y-3">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        name="isCallOut"
                        checked={form.isCallOut}
                        onChange={handleChange}
                        className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded"
                      />
                      <span className="ml-3 text-sm text-gray-700">📞 Call-out</span>
                    </label>

                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        name="isOutage"
                        checked={form.isOutage}
                        onChange={handleChange}
                        className="h-4 w-4 text-yellow-600 focus:ring-yellow-500 border-gray-300 rounded"
                      />
                      <span className="ml-3 text-sm text-gray-700">🔧 Planned Outage</span>
                    </label>

                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        name="isOverridden"
                        checked={form.isOverridden}
                        onChange={handleChange}
                        className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded"
                      />
                      <span className="ml-3 text-sm text-gray-700">⚠️ Override RP-755 (admin only)</span>
                    </label>
                  </div>
                </div>

                <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={() =>
                      setForm({ operatorId: '', shiftDate: '', shiftType: 'day', isOverridden: false, isCallOut: false, isOutage: false })
                    }
                    className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                  >
                    Clear
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-black hover:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                  >
                    Assign Shift
                  </button>
                </div>
              </form>
            </div>
          </div>
          )}

          {/* RP-755 Violations Panel */}
          {role === 'ADMIN' && violations.length > 0 && (
            <div className="lg:col-span-1">
              <div className="bg-red-50 border border-red-200 rounded-lg">
                <div className="px-6 py-4 border-b border-red-200">
                  <div className="flex items-center">
                    <svg className="h-5 w-5 text-red-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    <h3 className="text-lg font-semibold text-red-800">RP-755 Policy Violations</h3>
                  </div>
                </div>
                <div className="p-6">
                  <div className="space-y-4">
                    {violations.map((violation, i) => (
                      <div key={i} className="bg-white border border-red-200 rounded-lg p-4">
                        <div className="flex justify-between items-start mb-2">
                          <h4 className="font-medium text-red-900">{violation.rule}</h4>
                          <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                            violation.severity === 'high-risk' ? 'bg-red-600 text-white' :
                            violation.severity === 'violation' ? 'bg-orange-500 text-white' :
                            'bg-yellow-500 text-black'
                          }`}>
                            {violation.severity.toUpperCase()}
                          </span>
                        </div>
                        <p className="text-red-700 text-sm mb-2">{violation.message}</p>
                        <p className="text-red-600 text-xs">
                          Current: {violation.currentValue} | Limit: {violation.limit}
                        </p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-6 p-4 bg-gray-100 border border-gray-200 rounded-lg">
                    <p className="text-sm text-gray-900 font-medium mb-2">ℹ️ To proceed, you must:</p>
                    <ul className="text-sm text-gray-700 space-y-1">
                      <li>• Adjust shift timing to comply with RP-755 rules</li>
                      <li>• Submit an exception request with approvals</li>
                      <li>• Use admin override (if authorized)</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="lg:col-span-3">
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-red-800 font-semibold">{error}</p>
              </div>
            </div>
          )}

          {/* Scheduled Shifts */}
          <div className={`${violations.length > 0 ? 'lg:col-span-1' : 'lg:col-span-2'}`}>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-xl font-semibold text-gray-900">Scheduled Shifts</h3>
                <p className="text-sm text-gray-600 mt-1">Current and upcoming operator shifts</p>
              </div>
              
              {shifts.length === 0 ? (
                <div className="p-12 text-center">
                  <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <h3 className="mt-2 text-sm font-medium text-gray-900">No shifts scheduled</h3>
                  <p className="mt-1 text-sm text-gray-500">Get started by assigning your first shift.</p>
                </div>
              ) : (
                <div className="overflow-hidden">
                  <div className="max-h-96 overflow-y-auto">
                    <div className="divide-y divide-gray-200">
                      {shifts.map((shift) => {
                        const operator = operators.find(op => op.id === shift.operator?.id) || shift.operator
                        return (
                          <div key={shift.id} className="p-6">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-4">
                                {/* Operator Info */}
                                <div className="flex items-center space-x-3">
                                  {operator.letter && operator.role !== 'APS' && (
                                    <div className="flex items-center justify-center w-10 h-10 bg-gray-700 text-white text-sm font-bold border-2 border-gray-800">
                                      {operator.letter}
                                    </div>
                                  )}
                                  <div>
                                    <div className="text-sm font-medium text-gray-900">{operator.name}</div>
                                    <div className="text-sm text-gray-500">ID: {operator.employeeId}</div>
                                  </div>
                                </div>
                                
                                {/* Team Badge */}
                                <span className={`inline-flex items-center justify-center w-8 h-8 text-white text-sm font-bold ${getTeamColor(operator.team || 'A')}`}>
                                  {operator.team || 'A'}
                                </span>
                                
                                {/* Role Badge */}
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                  operator.role === 'APS' 
                                    ? 'bg-red-100 text-red-800' 
                                    : 'bg-gray-100 text-gray-800'
                                }`}>
                                  {operator.role}
                                </span>
                              </div>
                              
                              <div className="text-right">
                                {/* Shift Type */}
                                <div className="flex items-center space-x-2 mb-2">
                                  <span className="text-lg">{getShiftTypeIcon(shift.shiftType || 'day')}</span>
                                  <span className="text-sm font-medium text-gray-900">
                                    {(shift.shiftType || 'day').charAt(0).toUpperCase() + (shift.shiftType || 'day').slice(1)} Shift
                                  </span>
                                </div>
                                
                                {/* Time */}
                                <div className="text-sm text-gray-600">
                                  {formatShiftTime(shift.startTime, shift.endTime)}
                                </div>
                              </div>
                            </div>
                            
                            {/* Shift Tags */}
                            <div className="mt-4 flex items-center space-x-2">
                              {shift.isCallOut && (
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                  📞 Call-out
                                </span>
                              )}
                              {shift.isOutage && (
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                                  🔧 Planned Outage
                                </span>
                              )}
                              {shift.isOverridden && (
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                  ⚠️ RP-755 Override
                                </span>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* View Toggle */}
        <div className="mt-8 flex justify-center gap-4">
          <div className="inline-flex border border-gray-300 rounded-lg">
            <button
              onClick={() => setViewMode('coverage')}
              className={`px-6 py-2 text-sm font-medium rounded-l-lg ${
                viewMode === 'coverage'
                  ? 'bg-black text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              } transition duration-200`}
            >
              Job Coverage
            </button>
            <button
              onClick={() => setViewMode('outofschedule')}
              className={`px-6 py-2 text-sm font-medium rounded-r-lg ${
                viewMode === 'outofschedule'
                  ? 'bg-black text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              } transition duration-200`}
            >
              Out of Schedule
            </button>
          </div>

          {/* Quick Action Buttons */}
          {role === 'ADMIN' && viewMode === 'coverage' && (
            <div className="flex gap-2">
              <button
                onClick={() => setShowVacationModal(true)}
                className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition duration-200 text-sm"
              >
                + Add Vacation
              </button>
              <button
                onClick={() => setShowMandateModal(true)}
                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition duration-200 text-sm"
              >
                + Add Mandate
              </button>
            </div>
          )}
        </div>

        {/* Schedule Views */}
        <div className="mt-8">
          {viewMode === 'coverage' ? (
            <JobCoverageSchedule
              jobs={jobs}
              shifts={shifts}
              vacations={vacations}
              mandates={mandates}
              onShiftClick={handleCellClick}
              onVacationClick={handleVacationClick}
              onMandateClick={handleMandateClick}
              onShiftDetails={handleShiftDetails}
            />
          ) : (
            <OutOfScheduleView operators={operators} onAssignmentChange={() => {
              fetchShifts()
              fetchOutOfScheduleAssignments()
            }} />
          )}
        </div>
      </div>

      {/* Scheduler Modal (opened from grid click) */}
      {showSchedulerModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Assign Shift</h2>
                <button
                  onClick={() => {
                    setShowSchedulerModal(false)
                    setSchedulerDefaults(null)
                  }}
                  className="text-gray-400 hover:text-gray-600 text-2xl"
                >
                  ×
                </button>
              </div>
              <AdvancedShiftScheduler
                operators={operators}
                onShiftsScheduled={() => {
                  fetchShifts()
                  setShowSchedulerModal(false)
                  setSchedulerDefaults(null)
                }}
                defaultDate={schedulerDefaults?.date}
                defaultJobId={schedulerDefaults?.jobId}
                defaultShiftType={schedulerDefaults?.shiftType}
                outOfScheduleAssignments={outOfScheduleAssignments}
                shifts={shifts}
                vacations={vacations}
                mandateProtections={mandateProtections}
              />
            </div>
          </div>
        </div>
      )}

      {/* Exception Request Modal */}
      {role === 'ADMIN' && showExceptionModal && pendingShift && (
        <ExceptionRequestModal
          isOpen={showExceptionModal}
          onClose={() => {
            setShowExceptionModal(false)
            setPendingShift(null)
            setViolations([])
          }}
          violations={violations}
          operatorId={pendingShift.operatorId}
          operatorName={getOperatorName(pendingShift.operatorId)}
          shiftDetails={{
            startTime: pendingShift.startTime,
            endTime: pendingShift.endTime
          }}
          onSubmit={handleExceptionSubmit}
        />
      )}

      {/* Vacation Modal */}
      {showVacationModal && (
        <VacationModal
          isOpen={showVacationModal}
          onClose={() => {
            setShowVacationModal(false)
            setVacationDefaults(null)
          }}
          onVacationAdded={() => {
            fetchVacations()
            setShowVacationModal(false)
            setVacationDefaults(null)
          }}
          operators={operators}
          defaultOperatorId={vacationDefaults?.defaultOperatorId}
          defaultDate={vacationDefaults?.defaultDate}
          defaultShiftType={vacationDefaults?.defaultShiftType}
          vacation={vacationDefaults?.vacation}
        />
      )}

      {/* Mandate Modal */}
      {showMandateModal && (
        <MandateModal
          isOpen={showMandateModal}
          onClose={() => {
            setShowMandateModal(false)
            setMandateDefaults(null)
          }}
          onMandateAdded={() => {
            fetchMandates()
            setShowMandateModal(false)
            setMandateDefaults(null)
          }}
          operators={operators}
          jobs={jobs}
          defaultDate={mandateDefaults?.defaultDate}
          defaultShiftType={mandateDefaults?.defaultShiftType}
        />
      )}

      {/* Shift Details Modal */}
      {showShiftDetailsModal && selectedShift && (
        <ShiftDetailsModal
          isOpen={showShiftDetailsModal}
          onClose={() => {
            setShowShiftDetailsModal(false)
            setSelectedShift(null)
          }}
          shift={selectedShift}
          onShiftUpdated={() => {
            fetchShifts()
          }}
          onShiftDeleted={() => {
            fetchShifts()
            setShowShiftDetailsModal(false)
            setSelectedShift(null)
          }}
        />
      )}
    </div>
  )
}

