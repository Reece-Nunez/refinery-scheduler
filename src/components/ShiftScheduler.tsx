'use client'

import { useState, useEffect } from 'react'
import ExceptionRequestModal from './ExceptionRequestModal'
import { type FatigueViolation, type ExceptionRequest } from '@/lib/rp755FatiguePolicy'

interface Operator {
  id: string
  name: string
  employeeId: string
  role: string
  team: string
}

interface Shift {
  id?: string
  operatorId: string
  startTime: string
  endTime: string
  isOverridden: boolean
  isCallOut?: boolean
  isOutage?: boolean
  shiftType?: 'day' | 'night' | 'rotating'
  violations?: FatigueViolation[]
}

export default function ShiftScheduler() {
  const [operators, setOperators] = useState<Operator[]>([])
  const [shifts, setShifts] = useState<Shift[]>([])
  const [loading, setLoading] = useState(true)
  
  // Form state
  const [selectedOperator, setSelectedOperator] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [isCallOut, setIsCallOut] = useState(false)
  const [isOutage, setIsOutage] = useState(false)
  const [shiftType, setShiftType] = useState<'day' | 'night' | 'rotating'>('day')
  
  // Exception handling
  const [showExceptionModal, setShowExceptionModal] = useState(false)
  const [pendingShift, setPendingShift] = useState<Shift | null>(null)
  const [violationsToHandle, setViolationsToHandle] = useState<FatigueViolation[]>([])

  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      try {
        const [operatorsRes, shiftsRes] = await Promise.all([
          fetch('/api/operators'),
          fetch('/api/shifts')
        ])
        
        const operatorsData = await operatorsRes.json()
        const shiftsData = await shiftsRes.json()
        
        setOperators(operatorsData)
        setShifts(shiftsData)
      } catch (error) {
        console.error('Failed to load data:', error)
      } finally {
        setLoading(false)
      }
    }
    
    loadData()
  }, [])

  const handleSubmitShift = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!selectedOperator || !startTime || !endTime) return
    
    const newShift: Shift = {
      operatorId: selectedOperator,
      startTime,
      endTime,
      isOverridden: false,
      isCallOut,
      isOutage,
      shiftType
    }
    
    try {
      const response = await fetch('/api/shifts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newShift)
      })
      
      const result = await response.json()
      
      if (!response.ok) {
        if (result.violations && result.violations.length > 0) {
          // Show exception modal for violations
          setPendingShift(newShift)
          setViolationsToHandle(result.violations)
          setShowExceptionModal(true)
          return
        }
        throw new Error(result.error || 'Failed to create shift')
      }
      
      // Shift created successfully
      setShifts([...shifts, result])
      resetForm()
      
      // Show warning if there were violations but shift was approved
      if (result.violations && result.violations.length > 0) {
        alert(`Shift scheduled with ${result.violations.length} violation(s). Please review.`)
      }
      
    } catch (error) {
      console.error('Error creating shift:', error)
      alert('Failed to create shift. Please try again.')
    }
  }

  const handleExceptionSubmit = async (exceptionRequest: ExceptionRequest) => {
    if (!pendingShift) return
    
    try {
      // Submit the exception request
      const exceptionResponse = await fetch('/api/exceptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(exceptionRequest)
      })
      
      if (!exceptionResponse.ok) {
        const error = await exceptionResponse.json()
        throw new Error(error.error || 'Failed to submit exception request')
      }
      
      // Now submit the shift with override flag
      const shiftResponse = await fetch('/api/shifts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...pendingShift,
          isOverridden: true
        })
      })
      
      const result = await shiftResponse.json()
      
      if (!shiftResponse.ok) {
        throw new Error(result.error || 'Failed to create shift')
      }
      
      // Success
      setShifts([...shifts, result])
      resetForm()
      alert('Exception request submitted and shift scheduled successfully.')
      
    } catch (error) {
      console.error('Error processing exception:', error)
      throw error // Re-throw to be handled by the modal
    } finally {
      setPendingShift(null)
      setViolationsToHandle([])
      setShowExceptionModal(false)
    }
  }

  const resetForm = () => {
    setSelectedOperator('')
    setStartTime('')
    setEndTime('')
    setIsCallOut(false)
    setIsOutage(false)
    setShiftType('day')
  }

  const getOperatorName = (operatorId: string) => {
    const operator = operators.find(op => op.id === operatorId)
    return operator ? `${operator.name} (${operator.employeeId})` : 'Unknown'
  }

  const getShiftDuration = (startTime: string, endTime: string) => {
    const start = new Date(startTime)
    const end = new Date(endTime)
    const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60)
    return `${hours.toFixed(1)} hours`
  }

  const getViolationSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high-risk': return 'text-red-600 bg-red-50 border-red-200'
      case 'violation': return 'text-orange-600 bg-orange-50 border-orange-200'
      default: return 'text-yellow-600 bg-yellow-50 border-yellow-200'
    }
  }

  if (loading) {
    return <div className="p-6 text-center">Loading scheduler...</div>
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Shift Scheduler</h2>
        <p className="text-gray-600 mt-1">Schedule shifts with RP-755 fatigue policy compliance</p>
      </div>

      {/* Schedule New Shift Form */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Schedule New Shift</h3>
        
        <form onSubmit={handleSubmitShift} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Operator Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Operator *
              </label>
              <select
                value={selectedOperator}
                onChange={(e) => setSelectedOperator(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500"
                required
              >
                <option value="">Select an operator</option>
                {operators.map(operator => (
                  <option key={operator.id} value={operator.id}>
                    {operator.name} ({operator.employeeId}) - {operator.role}
                  </option>
                ))}
              </select>
            </div>

            {/* Shift Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Shift Type
              </label>
              <select
                value={shiftType}
                onChange={(e) => setShiftType(e.target.value as any)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                <option value="day">Day Shift</option>
                <option value="night">Night Shift</option>
                <option value="rotating">Rotating Shift</option>
              </select>
            </div>

            {/* Start Time */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Start Time *
              </label>
              <input
                type="datetime-local"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500"
                required
              />
            </div>

            {/* End Time */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                End Time *
              </label>
              <input
                type="datetime-local"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500"
                required
              />
            </div>
          </div>

          {/* Checkboxes */}
          <div className="flex space-x-6">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={isCallOut}
                onChange={(e) => setIsCallOut(e.target.checked)}
                className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded"
              />
              <span className="ml-2 text-sm text-gray-700">Call-out</span>
            </label>

            <label className="flex items-center">
              <input
                type="checkbox"
                checked={isOutage}
                onChange={(e) => setIsOutage(e.target.checked)}
                className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded"
              />
              <span className="ml-2 text-sm text-gray-700">Planned Outage</span>
            </label>
          </div>

          {/* Duration Display */}
          {startTime && endTime && (
            <div className="text-sm text-gray-600">
              <span className="font-medium">Duration: </span>
              {getShiftDuration(startTime, endTime)}
            </div>
          )}

          {/* Submit Button */}
          <div className="flex justify-end">
            <button
              type="submit"
              className="bg-black text-white px-4 py-2 rounded-lg hover:bg-gray-900 transition duration-200"
            >
              Schedule Shift
            </button>
          </div>
        </form>
      </div>

      {/* Recent Shifts */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Recent Shifts</h3>
        
        {shifts.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No shifts scheduled yet</p>
        ) : (
          <div className="space-y-3">
            {shifts.slice(0, 10).map((shift, index) => (
              <div key={shift.id || index} className="border border-gray-200 rounded-lg p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-medium text-gray-900">
                      {getOperatorName(shift.operatorId)}
                    </h4>
                    <p className="text-sm text-gray-600">
                      {new Date(shift.startTime).toLocaleString()} - {new Date(shift.endTime).toLocaleString()}
                    </p>
                    <p className="text-xs text-gray-500">
                      Duration: {getShiftDuration(shift.startTime, shift.endTime)} | 
                      Type: {shift.shiftType || 'day'} | 
                      {shift.isCallOut && 'Call-out'} 
                      {shift.isOutage && 'Outage'} 
                      {shift.isOverridden && 'Override Applied'}
                    </p>
                  </div>
                  
                  <div className="flex flex-col items-end space-y-1">
                    {shift.isOverridden && (
                      <span className="px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 rounded-full">
                        Exception Approved
                      </span>
                    )}
                    
                    {shift.violations && shift.violations.length > 0 && (
                      <div className="text-right">
                        {shift.violations.map((violation, vIndex) => (
                          <div key={vIndex} className={`text-xs px-2 py-1 rounded-full border ${getViolationSeverityColor(violation.severity)}`}>
                            {violation.rule}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Exception Request Modal */}
      {showExceptionModal && pendingShift && (
        <ExceptionRequestModal
          isOpen={showExceptionModal}
          onClose={() => {
            setShowExceptionModal(false)
            setPendingShift(null)
            setViolationsToHandle([])
          }}
          violations={violationsToHandle}
          operatorId={pendingShift.operatorId}
          operatorName={getOperatorName(pendingShift.operatorId)}
          shiftDetails={{
            startTime: pendingShift.startTime,
            endTime: pendingShift.endTime
          }}
          onSubmit={handleExceptionSubmit}
        />
      )}
    </div>
  )
}
