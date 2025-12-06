'use client'

import { useState, useEffect, useRef } from 'react'
import axios from 'axios'
import { useToast } from '@/contexts/ToastContext'
import { RP755FatiguePolicy, type Shift as FatigueShift } from '@/lib/rp755FatiguePolicy'

type Job = {
  id: string
  title: string
}

type Operator = {
  id: string
  name: string
  employeeId: string
  role: string
  team: string
  letter?: string
  trainedJobs: Job[]
}

type DailyShift = {
  date: string
  jobId: string
  shiftType: 'day' | 'night'
}

interface OutOfScheduleAssignment {
  id: string
  operatorId: string
  jobId: string
  startTime: string
  endTime: string
  shiftType: 'day' | 'night'
}

interface Shift {
  id: string
  operatorId?: string
  jobId?: string
  startTime: string
  endTime: string
  shiftType?: 'day' | 'night' | 'rotating'
  operator?: any
}

interface Vacation {
  id: string
  operatorId: string
  startTime: string
  endTime: string
  vacationType: '12hr' | '8hr' | '4hr'
  shiftType: 'day' | 'night'
  isWholeSet: boolean
}

interface MandateProtection {
  id: string
  operatorId: string
  vacationId: string
  protectionStartDate: string
  protectionEndDate: string
}

interface AdvancedShiftSchedulerProps {
  operators: Operator[]
  onShiftsScheduled: () => void
  defaultDate?: string
  defaultJobId?: string
  defaultShiftType?: 'day' | 'night'
  outOfScheduleAssignments?: OutOfScheduleAssignment[]
  shifts?: Shift[]
  vacations?: Vacation[]
  mandateProtections?: MandateProtection[]
  isOvertimeMode?: boolean
}

export default function AdvancedShiftScheduler({ operators, onShiftsScheduled, defaultDate, defaultJobId, defaultShiftType, outOfScheduleAssignments = [], shifts = [], vacations = [], mandateProtections = [], isOvertimeMode = false }: AdvancedShiftSchedulerProps) {
  const { showToast } = useToast()
  const [selectedOperator, setSelectedOperator] = useState<Operator | null>(null)
  const [assignmentMode, setAssignmentMode] = useState<'single' | 'multi'>('single')
  const [numDays, setNumDays] = useState(4)
  const [startDate, setStartDate] = useState(defaultDate || '')
  const [baseShiftType, setBaseShiftType] = useState<'day' | 'night'>(defaultShiftType || 'day')
  const [dailyShifts, setDailyShifts] = useState<DailyShift[]>([])
  const [isOvertime, setIsOvertime] = useState(isOvertimeMode)
  const [isOutage, setIsOutage] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [filterByJob, setFilterByJob] = useState<string | null>(defaultJobId || null)
  const [operatorDropdownOpen, setOperatorDropdownOpen] = useState(false)
  const operatorDropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (operatorDropdownRef.current && !operatorDropdownRef.current.contains(event.target as Node)) {
        setOperatorDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const getTeamsWorking = (date: string, shiftType: 'day' | 'night'): string[] => {
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

    const workingTeams: string[] = []
    // Parse date as local time to avoid timezone issues
    const [year, month, day] = date.split('-').map(Number)
    const checkDate = new Date(year, month - 1, day)
    checkDate.setHours(0, 0, 0, 0)

    for (const [team, startDate] of Object.entries(teamStarts)) {
      const teamStartDate = new Date(startDate)
      teamStartDate.setHours(0, 0, 0, 0)

      // Calculate days since team's cycle start
      const daysSinceStart = Math.floor((checkDate.getTime() - teamStartDate.getTime()) / (1000 * 60 * 60 * 24))

      // Get position in 28-day cycle
      const dayInCycle = ((daysSinceStart % 28) + 28) % 28

      const teamShiftType = getShiftType(dayInCycle)

      // Debug logging for Oct 13
      if (date === '2025-10-13') {
        console.log(`Team ${team}: daysSinceStart=${daysSinceStart}, dayInCycle=${dayInCycle}, teamShiftType=${teamShiftType}, looking for=${shiftType}`)
      }

      if (teamShiftType === shiftType) {
        workingTeams.push(team)
      }
    }

    return workingTeams
  }

  // Filter operators based on:
  // 1. Team working on the selected date/shift (or Green Hat/Replacement)
  // 2. Trained for the selected job
  // 3. Exclude APS
  const filteredOperators = (() => {
    const workingTeams = startDate && baseShiftType ? getTeamsWorking(startDate, baseShiftType) : []

    console.log('Filtering operators for date:', startDate, 'shift:', baseShiftType, 'working teams:', workingTeams, 'total shifts:', shifts.length)

    return operators.filter(op => {
      // Exclude APS
      if (op.role === 'APS') return false

      // Exclude operators already assigned on this date/shift
      if (startDate && baseShiftType) {
        // Parse date as local time to avoid timezone issues
        const [year, month, day] = startDate.split('-').map(Number)
        const selectedDate = new Date(year, month - 1, day)
        selectedDate.setHours(0, 0, 0, 0)

        // Check for existing regular shift assignments on this date (ANY shift type)
        const hasShiftAssignment = shifts.some(shift => {
          // Handle both operatorId and operator.id formats
          const shiftOperatorId = shift.operatorId || shift.operator?.id
          if (shiftOperatorId !== op.id) return false

          // Use START time to determine the shift date (not end time)
          // because night shifts cross midnight (Oct 12 9:45 PM to Oct 13 9:45 AM is the Oct 12 night shift)
          const shiftDate = new Date(shift.startTime)
          const shiftDateOnly = new Date(shiftDate.getFullYear(), shiftDate.getMonth(), shiftDate.getDate())

          const matches = selectedDate.getTime() === shiftDateOnly.getTime()

          if (matches) {
            console.log('Filtering out operator with existing shift:', op.name, 'existing shift type:', shift.shiftType, 'on date:', shiftDateOnly)
          }

          return matches
        })

        if (hasShiftAssignment) return false

        // Check for out-of-schedule assignments on this date (ANY shift type)
        const hasOutOfScheduleAssignment = outOfScheduleAssignments.some(assignment => {
          if (assignment.operatorId !== op.id) return false

          // Parse assignment start and end times
          const assignmentStart = new Date(assignment.startTime)
          const assignmentEnd = new Date(assignment.endTime)

          // Get just the date portion for comparison
          const assignmentStartDate = new Date(assignmentStart.getFullYear(), assignmentStart.getMonth(), assignmentStart.getDate())
          const assignmentEndDate = new Date(assignmentEnd.getFullYear(), assignmentEnd.getMonth(), assignmentEnd.getDate())

          // Check if selected date falls within the assignment range
          return selectedDate >= assignmentStartDate && selectedDate <= assignmentEndDate
        })

        if (hasOutOfScheduleAssignment) return false

        // Check for vacation on this date (exclude unless it's overtime)
        if (!isOvertime) {
          const hasVacation = vacations.some(vacation => {
            if (vacation.operatorId !== op.id) return false

            // Parse vacation start and end times
            const vacStart = new Date(vacation.startTime)
            const vacEnd = new Date(vacation.endTime)

            // Get date portion only
            const vacStartDay = new Date(vacStart.getFullYear(), vacStart.getMonth(), vacStart.getDate())
            let vacEndDay = new Date(vacEnd.getFullYear(), vacEnd.getMonth(), vacEnd.getDate())

            // For night shift vacations, subtract 1 day from end date
            // because the end time is stored as next morning but we want the shift date
            if (vacation.shiftType === 'night') {
              vacEndDay.setDate(vacEndDay.getDate() - 1)
            }

            // Check if selected date falls within vacation range
            return selectedDate >= vacStartDay && selectedDate <= vacEndDay
          })

          if (hasVacation) return false
        }

        // Check for mandate protection on this date (exclude unless it's overtime)
        if (!isOvertime) {
          const hasProtection = mandateProtections.some(protection => {
            if (protection.operatorId !== op.id) return false

            // Parse protection dates (these are stored as date strings like '2025-10-06')
            const [startYear, startMonth, startDay] = protection.protectionStartDate.split('-').map(Number)
            const [endYear, endMonth, endDay] = protection.protectionEndDate.split('-').map(Number)

            const protectionStart = new Date(startYear, startMonth - 1, startDay)
            const protectionEnd = new Date(endYear, endMonth - 1, endDay)
            protectionStart.setHours(0, 0, 0, 0)
            protectionEnd.setHours(0, 0, 0, 0)

            // Check if selected date falls within protection period
            return selectedDate >= protectionStart && selectedDate <= protectionEnd
          })

          if (hasProtection) return false
        }

        // Check work-set rest period requirements (34 or 46 hours) - unless it's overtime
        if (!isOvertime) {
          const [yearCheck, monthCheck, dayCheck] = startDate.split('-').map(Number)
          let startDateTime = new Date(yearCheck, monthCheck - 1, dayCheck)

          // Use actual shift start times
          if (baseShiftType === 'night') {
            startDateTime.setHours(21, 45, 0, 0)
          } else {
            startDateTime.setHours(9, 45, 0, 0)
          }

          // Get operator's existing shifts
          const operatorShifts = shifts.filter(s => {
            const shiftOperatorId = s.operatorId || s.operator?.id
            return shiftOperatorId === op.id
          })

          if (operatorShifts.length > 0) {
            console.log(`Checking work-set rest for ${op.name}, has ${operatorShifts.length} existing shifts`)

            // Convert to FatigueShift format
            const existingFatigueShifts: FatigueShift[] = operatorShifts.map(s => ({
              operatorId: s.operatorId || s.operator?.id || '',
              startTime: new Date(s.startTime),
              endTime: new Date(s.endTime),
              isOverridden: s.isOverridden || false,
              isOvertime: s.isOvertime,
              isOutage: s.isOutage,
              shiftType: s.shiftType
            }))

            const tempShift: FatigueShift = {
              operatorId: op.id,
              startTime: startDateTime,
              endTime: new Date(startDateTime.getTime() + 12 * 60 * 60 * 1000),
              isOverridden: false,
              isOvertime: isOvertime,
              isOutage: isOutage,
              shiftType: baseShiftType
            }

            // Check rest period violations
            const restViolations = RP755FatiguePolicy.validateRestPeriods(tempShift, existingFatigueShifts)
            console.log(`Rest violations for ${op.name}:`, restViolations)

            const hasWorkSetRestViolation = restViolations.some(v => v.rule.includes('Work-set'))

            if (hasWorkSetRestViolation) {
              console.log('✗ Filtering out operator due to work-set rest violation:', op.name)
              return false
            }
          }
        }
      }

      // Include if they're on a working team, Green Hat/Replacement, OR it's overtime
      const isOnWorkingTeam = workingTeams.includes(op.team)
      const isGreenHatOrReplacement = op.role === 'Green Hat' || op.role === 'Replacement'

      // For overtime shifts, allow all operators regardless of team schedule
      // Only apply team filter if a date is selected (otherwise show all operators)
      if (!isOvertime && startDate && !isOnWorkingTeam && !isGreenHatOrReplacement) return false

      // Filter by job training if a job is selected
      if (filterByJob) {
        return op.trainedJobs.some(job => job.id === filterByJob)
      }

      return true
    })
  })()

  useEffect(() => {
    if (assignmentMode === 'multi' && startDate && selectedOperator) {
      // Initialize daily shifts array when switching to multi-day mode
      const shifts: DailyShift[] = []
      // Use defaultJobId if provided and operator is trained for it, otherwise use first trained job
      const initialJobId = defaultJobId && selectedOperator.trainedJobs.some(j => j.id === defaultJobId)
        ? defaultJobId
        : selectedOperator.trainedJobs[0]?.id || ''

      for (let i = 0; i < numDays; i++) {
        const date = new Date(startDate)
        date.setDate(date.getDate() + i)
        shifts.push({
          date: date.toISOString().split('T')[0],
          jobId: initialJobId,
          shiftType: baseShiftType
        })
      }
      setDailyShifts(shifts)
    } else if (assignmentMode === 'single' && startDate && selectedOperator) {
      // Initialize single shift
      // Use defaultJobId if provided and operator is trained for it, otherwise use first trained job
      const initialJobId = defaultJobId && selectedOperator.trainedJobs.some(j => j.id === defaultJobId)
        ? defaultJobId
        : selectedOperator.trainedJobs[0]?.id || ''

      setDailyShifts([{
        date: startDate,
        jobId: initialJobId,
        shiftType: baseShiftType
      }])
    }
  }, [assignmentMode, numDays, startDate, selectedOperator, baseShiftType, defaultJobId])

  const handleOperatorChange = (operatorId: string) => {
    const operator = operators.find(op => op.id === operatorId)
    setSelectedOperator(operator || null)
    // Reset daily shifts when operator changes
    setDailyShifts([])
  }

  const updateDailyShift = (index: number, field: 'jobId' | 'shiftType', value: string) => {
    setDailyShifts(prev => {
      const updated = [...prev]
      updated[index] = { ...updated[index], [field]: value }
      return updated
    })
  }

  const validateShifts = (): string | null => {
    // Check if all shifts have jobs assigned
    if (dailyShifts.some(s => !s.jobId)) {
      return 'Please assign a job for each shift'
    }

    // Check for duplicate dates with same shift type (day/night)
    const dateShiftTypeMap = new Map<string, Set<string>>()
    for (const shift of dailyShifts) {
      const key = shift.date
      if (!dateShiftTypeMap.has(key)) {
        dateShiftTypeMap.set(key, new Set())
      }
      const shiftTypes = dateShiftTypeMap.get(key)!
      if (shiftTypes.has(shift.shiftType)) {
        return `Cannot assign multiple ${shift.shiftType} shifts on the same date (${new Date(shift.date).toLocaleDateString()})`
      }
      shiftTypes.add(shift.shiftType)
    }

    // Check if operator is working both day and night on the same date
    for (const [date, shiftTypes] of dateShiftTypeMap.entries()) {
      if (shiftTypes.has('day') && shiftTypes.has('night')) {
        return `Operator cannot work both day and night shifts on ${new Date(date).toLocaleDateString()}`
      }
    }

    // Check for duplicate job assignments on the same date AND shift type
    // Note: Same job on day shift and night shift is allowed (different shift types)
    const dateShiftJobMap = new Map<string, Set<string>>()
    for (const shift of dailyShifts) {
      const key = `${shift.date}-${shift.shiftType}` // Combine date AND shift type
      if (!dateShiftJobMap.has(key)) {
        dateShiftJobMap.set(key, new Set())
      }
      const jobs = dateShiftJobMap.get(key)!
      if (jobs.has(shift.jobId)) {
        const job = selectedOperator?.trainedJobs.find(j => j.id === shift.jobId)
        return `Cannot assign the same job (${job?.title}) to multiple ${shift.shiftType} shifts on ${new Date(shift.date).toLocaleDateString()}`
      }
      jobs.add(shift.jobId)
    }

    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (!selectedOperator) {
        setError('Please select an operator')
        setLoading(false)
        return
      }

      if (dailyShifts.length === 0) {
        setError('Please configure at least one shift')
        setLoading(false)
        return
      }

      // Validate shifts
      const validationError = validateShifts()
      if (validationError) {
        setError(validationError)
        showToast(validationError, 'error')
        setLoading(false)
        return
      }

      const shiftsToCreate = dailyShifts.map(shift => {
        // Parse date as local time to avoid timezone issues
        const [year, month, day] = shift.date.split('-').map(Number)
        const startTime = new Date(year, month - 1, day)
        const endTime = new Date(year, month - 1, day)

        if (shift.shiftType === 'day') {
          startTime.setHours(4, 45, 0, 0)
          endTime.setHours(16, 45, 0, 0)
        } else {
          startTime.setHours(16, 45, 0, 0)
          endTime.setDate(endTime.getDate() + 1)
          endTime.setHours(4, 45, 0, 0)
        }

        return {
          operatorId: selectedOperator.id,
          jobId: shift.jobId,
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          shiftType: shift.shiftType,
          isOvertime,
          isOutage,
          isOverridden: false
        }
      })

      // Validate ALL shifts first before creating any
      // This prevents partial creation if a later shift fails validation
      const validationResults = []
      for (let i = 0; i < shiftsToCreate.length; i++) {
        const shift = shiftsToCreate[i]
        try {
          // Dry-run validation: send validate=true flag
          await axios.post('/api/shifts/validate', shift)
          validationResults.push({ success: true, index: i })
        } catch (validationError: any) {
          // If ANY shift fails validation, show the error and stop
          const errorData = validationError.response?.data

          if (errorData?.violations && Array.isArray(errorData.violations)) {
            const violationMessages = errorData.violations.map((v: any) =>
              `${v.rule}: ${v.message} (Current: ${v.currentValue}, Limit: ${v.limit})`
            ).join('\n')

            const shiftDate = shiftsToCreate[i].startTime.split('T')[0]
            const fullErrorMsg = `Cannot schedule shift on ${shiftDate} (shift ${i + 1} of ${shiftsToCreate.length}):\n\n${violationMessages}`
            setError(fullErrorMsg)
            showToast(fullErrorMsg, 'error')
          } else {
            const errorMsg = errorData?.error || `Validation failed for shift ${i + 1}`
            setError(errorMsg)
            showToast(errorMsg, 'error')
          }
          setLoading(false)
          return // Stop here - don't create any shifts
        }
      }

      // All shifts validated successfully - now create them
      for (const shift of shiftsToCreate) {
        await axios.post('/api/shifts', shift)
      }

      showToast(
        `${shiftsToCreate.length} shift${shiftsToCreate.length > 1 ? 's' : ''} scheduled successfully!`,
        'success'
      )

      // Reset form
      setSelectedOperator(null)
      setStartDate('')
      setDailyShifts([])
      setIsOvertime(false)
      setIsOutage(false)
      setError('')
      onShiftsScheduled()

    } catch (err: any) {
      const errorData = err.response?.data

      // Check if it's a fatigue policy violation with detailed violations
      if (errorData?.violations && Array.isArray(errorData.violations)) {
        const violationMessages = errorData.violations.map((v: any) =>
          `${v.rule}: ${v.message} (Current: ${v.currentValue}, Limit: ${v.limit})`
        ).join('\n')

        const fullErrorMsg = `RP-755 Fatigue Policy Violation:\n\n${violationMessages}`
        setError(fullErrorMsg)
        showToast(fullErrorMsg, 'error')
      } else {
        const errorMsg = errorData?.error || 'Failed to schedule shift(s)'
        setError(errorMsg)
        showToast(errorMsg, 'error')
      }
    } finally {
      setLoading(false)
    }
  }

  const availableJobs = selectedOperator?.trainedJobs || []

  // Calculate maximum consecutive days based on fatigue policy
  const calculateMaxAllowedDays = (): number => {
    if (!selectedOperator || !startDate) {
      return selectedOperator?.role === 'APS' ? 7 : 4
    }

    // Get operator's existing shifts
    const operatorShifts = shifts.filter(s => {
      const shiftOperatorId = s.operatorId || s.operator?.id
      return shiftOperatorId === selectedOperator.id
    })

    // Convert to FatigueShift format
    const existingFatigueShifts: FatigueShift[] = operatorShifts.map(s => ({
      operatorId: s.operatorId || s.operator?.id || '',
      startTime: new Date(s.startTime),
      endTime: new Date(s.endTime),
      isOverridden: s.isOverridden || false,
      isOvertime: s.isOvertime,
      isOutage: s.isOutage,
      shiftType: s.shiftType
    }))

    // Determine shift length based on shift type (12-hour shifts for night, could be 8, 10, or 12 for day)
    const shiftHours = baseShiftType === 'night' ? 12 : 12 // Assuming 12-hour shifts

    // Get max consecutive shifts from RP-755 based on shift length
    let maxConsecutiveShifts: number
    if (shiftHours <= 8) {
      maxConsecutiveShifts = isOutage ? 19 : 10
    } else if (shiftHours <= 10) {
      maxConsecutiveShifts = isOutage ? 14 : 9
    } else {
      // 12-hour shifts
      maxConsecutiveShifts = isOutage ? 14 : 7
    }

    // Count how many consecutive shifts operator already has leading up to start date
    const [year, month, day] = startDate.split('-').map(Number)
    let startDateTime = new Date(year, month - 1, day)

    // Use actual shift start times for accurate consecutive counting
    if (baseShiftType === 'night') {
      startDateTime.setHours(21, 45, 0, 0) // Night shifts start at 9:45 PM
    } else {
      startDateTime.setHours(9, 45, 0, 0) // Day shifts start at 9:45 AM
    }

    // Create a temporary shift for the start date to check consecutive count
    const tempShift: FatigueShift = {
      operatorId: selectedOperator.id,
      startTime: startDateTime,
      endTime: new Date(startDateTime.getTime() + shiftHours * 60 * 60 * 1000),
      isOverridden: false,
      isOvertime: isOvertime,
      isOutage: isOutage,
      shiftType: baseShiftType
    }

    const consecutiveShifts = RP755FatiguePolicy.getConsecutiveShifts(tempShift, existingFatigueShifts)
    const currentConsecutiveCount = consecutiveShifts.length

    // Calculate how many more days can be added
    const remainingDays = maxConsecutiveShifts - currentConsecutiveCount

    // Never exceed the absolute max (7 for APS, 4 for others in UI)
    const absoluteMax = selectedOperator.role === 'APS' ? 7 : 4

    return Math.min(Math.max(1, remainingDays), absoluteMax)
  }

  const maxDays = calculateMaxAllowedDays()

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-xl font-semibold text-gray-900">Assign Shifts</h2>
        <p className="text-sm text-gray-600 mt-1">Schedule operator shifts with job assignments</p>
      </div>

      <form onSubmit={handleSubmit} className="p-6 space-y-6">
        {/* Overtime Toggle - only show if not in overtime mode */}
        {!isOvertimeMode && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={isOvertime}
                onChange={(e) => setIsOvertime(e.target.checked)}
                className="mr-3 h-5 w-5 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <div>
                <span className="text-sm font-medium text-gray-900">Schedule as Overtime Shift</span>
                <p className="text-xs text-gray-600 mt-1">
                  Allows scheduling operators from any team, bypasses vacation and mandate protection
                </p>
              </div>
            </label>
          </div>
        )}

        {/* Operator Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Operator * {filterByJob && <span className="text-xs text-blue-600">(Filtered by job)</span>}
          </label>
          <div className="relative" ref={operatorDropdownRef}>
            <button
              type="button"
              onClick={() => setOperatorDropdownOpen(!operatorDropdownOpen)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 text-gray-900 bg-white text-left flex items-center justify-between"
            >
              <span className={selectedOperator ? 'text-gray-900' : 'text-gray-500'}>
                {selectedOperator
                  ? `${selectedOperator.name} (${selectedOperator.employeeId}) - Team ${selectedOperator.team} ${selectedOperator.role === 'APS' ? '(Green Hat)' : selectedOperator.letter ? `(${selectedOperator.letter})` : ''}`
                  : 'Choose an operator...'}
              </span>
              <svg className={`w-5 h-5 text-gray-400 transition-transform ${operatorDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {operatorDropdownOpen && (
              <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                <div
                  className="px-3 py-2 hover:bg-gray-100 cursor-pointer text-gray-500"
                  onClick={() => {
                    handleOperatorChange('')
                    setOperatorDropdownOpen(false)
                  }}
                >
                  Choose an operator...
                </div>
                {filteredOperators.map(op => (
                  <div
                    key={op.id}
                    className={`px-3 py-2 hover:bg-gray-100 cursor-pointer text-gray-900 ${selectedOperator?.id === op.id ? 'bg-red-50' : ''}`}
                    onClick={() => {
                      handleOperatorChange(op.id)
                      setOperatorDropdownOpen(false)
                    }}
                  >
                    {op.name} ({op.employeeId}) - Team {op.team} {op.role === 'APS' ? '(Green Hat)' : op.letter ? `(${op.letter})` : ''}
                  </div>
                ))}
              </div>
            )}
          </div>
          {filterByJob && (
            <p className="mt-1 text-xs text-blue-600">
              Showing only operators trained for this job ({filteredOperators.length} available)
            </p>
          )}
          {selectedOperator && (
            <p className="mt-1 text-xs text-gray-500">
              Trained for: {availableJobs.map(j => j.title).join(', ') || 'No jobs assigned'}
            </p>
          )}
        </div>

        {selectedOperator && (
          <>
            {/* Assignment Mode */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Assignment Type
              </label>
              <div className="flex gap-4">
                <label className="flex items-center cursor-pointer">
                  <input
                    type="radio"
                    value="single"
                    checked={assignmentMode === 'single'}
                    onChange={(e) => setAssignmentMode(e.target.value as 'single')}
                    className="mr-2 text-red-600 focus:ring-red-500"
                  />
                  <span className="text-sm text-gray-700">Single Day</span>
                </label>
                <label className="flex items-center cursor-pointer">
                  <input
                    type="radio"
                    value="multi"
                    checked={assignmentMode === 'multi'}
                    onChange={(e) => setAssignmentMode(e.target.value as 'multi')}
                    className="mr-2 text-red-600 focus:ring-red-500"
                  />
                  <span className="text-sm text-gray-700">Multiple Days</span>
                </label>
              </div>
            </div>

            {assignmentMode === 'multi' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Number of Days *
                </label>
                <select
                  value={numDays > maxDays ? maxDays : numDays}
                  onChange={(e) => setNumDays(parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 text-gray-900"
                >
                  {Array.from({ length: maxDays }, (_, i) => i + 1).map(n => (
                    <option key={n} value={n}>{n} day{n > 1 ? 's' : ''}</option>
                  ))}
                </select>
                {(() => {
                  const operatorShifts = shifts.filter(s => {
                    const shiftOperatorId = s.operatorId || s.operator?.id
                    return shiftOperatorId === selectedOperator.id
                  })
                  const existingFatigueShifts: FatigueShift[] = operatorShifts.map(s => ({
                    operatorId: s.operatorId || s.operator?.id || '',
                    startTime: new Date(s.startTime),
                    endTime: new Date(s.endTime),
                    isOverridden: s.isOverridden || false,
                    isOvertime: s.isOvertime,
                    isOutage: s.isOutage,
                    shiftType: s.shiftType
                  }))

                  if (!startDate) return null

                  const [year, month, day] = startDate.split('-').map(Number)
                  let startDateTime = new Date(year, month - 1, day)

                  // Use actual shift start times for accurate consecutive counting
                  if (baseShiftType === 'night') {
                    startDateTime.setHours(21, 45, 0, 0) // Night shifts start at 9:45 PM
                  } else {
                    startDateTime.setHours(9, 45, 0, 0) // Day shifts start at 9:45 AM
                  }

                  const shiftHours = 12
                  const tempShift: FatigueShift = {
                    operatorId: selectedOperator.id,
                    startTime: startDateTime,
                    endTime: new Date(startDateTime.getTime() + shiftHours * 60 * 60 * 1000),
                    isOverridden: false,
                    isOvertime: isOvertime,
                    isOutage: isOutage,
                    shiftType: baseShiftType
                  }
                  const consecutiveShifts = RP755FatiguePolicy.getConsecutiveShifts(tempShift, existingFatigueShifts)
                  const currentConsecutiveCount = consecutiveShifts.length
                  const maxConsecutive = isOutage ? 14 : 7

                  if (currentConsecutiveCount > 0) {
                    return (
                      <p className="mt-1 text-xs text-orange-600">
                        ⚠️ Operator already has {currentConsecutiveCount} consecutive shift{currentConsecutiveCount > 1 ? 's' : ''}.
                        Max allowed: {maxDays} more day{maxDays > 1 ? 's' : ''} (RP-755 limit: {maxConsecutive} total)
                      </p>
                    )
                  }

                  return (
                    <p className="mt-1 text-xs text-gray-500">
                      {selectedOperator.role === 'APS'
                        ? '🟢 Green hats (APS) can work up to 7 days consecutively'
                        : '👷 Regular operators: maximum 4 days consecutively'}
                    </p>
                  )
                })()}
              </div>
            )}

            {/* Start Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {assignmentMode === 'single' ? 'Shift Date *' : 'Start Date *'}
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                onClick={(e) => (e.target as HTMLInputElement).showPicker?.()}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 text-gray-900 cursor-pointer"
                required
              />
            </div>

            {/* Base Shift Type (for initialization) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {assignmentMode === 'single' ? 'Shift Type *' : 'Default Shift Type'}
              </label>
              <div className="flex gap-4">
                <label className="flex items-center cursor-pointer">
                  <input
                    type="radio"
                    value="day"
                    checked={baseShiftType === 'day'}
                    onChange={(e) => setBaseShiftType(e.target.value as 'day')}
                    className="mr-2 text-red-600 focus:ring-red-500"
                  />
                  <span className="text-sm text-gray-700">☀️ Day (4:45 AM - 4:45 PM)</span>
                </label>
                <label className="flex items-center cursor-pointer">
                  <input
                    type="radio"
                    value="night"
                    checked={baseShiftType === 'night'}
                    onChange={(e) => setBaseShiftType(e.target.value as 'night')}
                    className="mr-2 text-red-600 focus:ring-red-500"
                  />
                  <span className="text-sm text-gray-700">🌙 Night (4:45 PM - 4:45 AM)</span>
                </label>
              </div>
            </div>

            {/* Job Assignment */}
            {startDate && availableJobs.length > 0 && dailyShifts.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Job Assignment{assignmentMode === 'multi' ? 's' : ''} *
                </label>

                {assignmentMode === 'single' ? (
                  <select
                    value={dailyShifts[0]?.jobId || ''}
                    onChange={(e) => updateDailyShift(0, 'jobId', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 text-gray-900"
                    required
                  >
                    <option value="">Select a job...</option>
                    {availableJobs.map(job => (
                      <option key={job.id} value={job.id}>{job.title}</option>
                    ))}
                  </select>
                ) : (
                  <div className="border border-gray-300 rounded-md divide-y max-h-96 overflow-y-auto">
                    {dailyShifts.map((shift, index) => (
                      <div key={index} className="p-4 bg-gray-50 hover:bg-gray-100 transition-colors">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-gray-900">
                            Day {index + 1} - {new Date(shift.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs text-gray-600 mb-1">Job Assignment</label>
                            <select
                              value={shift.jobId}
                              onChange={(e) => updateDailyShift(index, 'jobId', e.target.value)}
                              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-red-500 text-gray-900"
                              required
                            >
                              <option value="">Select...</option>
                              {availableJobs.map(job => (
                                <option key={job.id} value={job.id}>{job.title}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs text-gray-600 mb-1">Shift Type</label>
                            <select
                              value={shift.shiftType}
                              onChange={(e) => updateDailyShift(index, 'shiftType', e.target.value)}
                              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-red-500 text-gray-900"
                            >
                              <option value="day">☀️ Day</option>
                              <option value="night">🌙 Night</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {availableJobs.length === 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-yellow-800">No Trained Jobs</h3>
                    <p className="text-sm text-yellow-700 mt-1">
                      This operator has no trained jobs assigned. Please add trained jobs on the Operators page first.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Additional Flags */}
            {!isOvertimeMode && (
              <div className="space-y-2">
                <label className="flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isOutage}
                    onChange={(e) => setIsOutage(e.target.checked)}
                    className="mr-2 h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded"
                  />
                  <span className="text-sm text-gray-700">Mark as Outage Work</span>
                </label>
              </div>
            )}
          </>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-3">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {/* Submit */}
        <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
          {selectedOperator && (
            <button
              type="button"
              onClick={() => {
                setSelectedOperator(null)
                setStartDate('')
                setDailyShifts([])
                setIsCallOut(false)
                setIsOutage(false)
                setError('')
              }}
              className="px-6 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            disabled={loading || !selectedOperator || availableJobs.length === 0 || dailyShifts.length === 0 || dailyShifts.some(s => !s.jobId)}
            className="px-6 py-2 bg-black text-white rounded-md hover:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Scheduling...' : assignmentMode === 'single' ? 'Schedule Shift' : `Schedule ${numDays} Shifts`}
          </button>
        </div>
      </form>
    </div>
  )
}
