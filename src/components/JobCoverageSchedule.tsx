'use client'

import { useState, useEffect } from 'react'
import { useToast } from '@/contexts/ToastContext'

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

interface Shift {
  id: string
  operatorId: string
  jobId: string
  startTime: string
  endTime: string
  shiftType: 'day' | 'night'
  operator?: Operator
}

interface Vacation {
  id: string
  operatorId: string
  startTime: string
  endTime: string
  vacationType: '12hr' | '8hr' | '4hr'
  shiftType: 'day' | 'night'
  isWholeSet: boolean
  operator?: Operator
}

interface Mandate {
  id: string
  operatorId: string
  mandateDate: string
  shiftType: 'day' | 'night'
  jobId?: string
  operator?: Operator
}

interface JobCoverageScheduleProps {
  jobs: Job[]
  shifts: Shift[]
  vacations: Vacation[]
  mandates: Mandate[]
  onShiftClick?: (date: string, jobId: string, shiftType: 'day' | 'night') => void
  onVacationClick?: (vacation: Vacation) => void
  onMandateClick?: (date: string, shiftType: 'day' | 'night') => void
  onShiftDetails?: (shift: Shift) => void
}

export default function JobCoverageSchedule({ jobs, shifts, vacations, mandates, onShiftClick, onVacationClick, onMandateClick, onShiftDetails }: JobCoverageScheduleProps) {
  const { showToast } = useToast()
  const [viewDays, setViewDays] = useState<7 | 14>(7)
  const [startDate, setStartDate] = useState<Date>(new Date())
  const [dateRange, setDateRange] = useState<Date[]>([])

  // Custom job order
  const jobOrder = ['FCC Console', 'VRU Console', 'Butamer', 'FCC Out', 'VRU Out', 'Pumper']
  const sortedJobs = [...jobs].sort((a, b) => {
    const indexA = jobOrder.indexOf(a.title)
    const indexB = jobOrder.indexOf(b.title)
    // If job not in custom order, put it at the end
    if (indexA === -1 && indexB === -1) return 0
    if (indexA === -1) return 1
    if (indexB === -1) return -1
    return indexA - indexB
  })

  // Team colors
  const teamColors: Record<string, string> = {
    'A': 'bg-blue-100 text-blue-800 border-blue-300',
    'B': 'bg-green-100 text-green-800 border-green-300',
    'C': 'bg-yellow-100 text-yellow-800 border-yellow-300',
    'D': 'bg-purple-100 text-purple-800 border-purple-300',
  }

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

  const formatDate = (date: Date) => {
    return date.toISOString().split('T')[0]
  }

  const formatDisplayDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', weekday: 'short' })
  }

  const getShiftForCell = (date: Date, jobId: string, shiftType: 'day' | 'night'): Shift | null => {
    const dateStr = formatDate(date)
    return shifts.find(shift => {
      // Extract date in local timezone instead of UTC
      const shiftStart = new Date(shift.startTime)
      const year = shiftStart.getFullYear()
      const month = String(shiftStart.getMonth() + 1).padStart(2, '0')
      const day = String(shiftStart.getDate()).padStart(2, '0')
      const shiftDate = `${year}-${month}-${day}`
      return shiftDate === dateStr && shift.jobId === jobId && shift.shiftType === shiftType
    }) || null
  }

  const getVacationsForCell = (date: Date, shiftType: 'day' | 'night'): Vacation[] => {
    const cellDate = new Date(date)
    cellDate.setHours(0, 0, 0, 0)

    return vacations.filter(vacation => {
      if (vacation.shiftType !== shiftType) {
        return false
      }

      // Get start and end dates (date portion only)
      const vacStart = new Date(vacation.startTime)
      const vacEnd = new Date(vacation.endTime)
      const vacStartDay = new Date(vacStart.getFullYear(), vacStart.getMonth(), vacStart.getDate())

      // For night shifts, the end time is stored as the next calendar day (e.g., Oct 17 4:45 AM)
      // but we want to display it on the last shift date (Oct 16), so subtract 1 day
      let vacEndDay = new Date(vacEnd.getFullYear(), vacEnd.getMonth(), vacEnd.getDate())
      if (vacation.shiftType === 'night') {
        vacEndDay.setDate(vacEndDay.getDate() - 1)
      }

      // Check if the cell date falls within the vacation range (inclusive)
      return cellDate >= vacStartDay && cellDate <= vacEndDay
    })
  }

  const getMandateForCell = (date: Date, shiftType: 'day' | 'night'): Mandate | null => {
    const dateStr = formatDate(date)
    return mandates.find(mandate => {
      return mandate.mandateDate === dateStr && mandate.shiftType === shiftType
    }) || null
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

  const getTeamsWorking = (date: Date, shiftType: 'day' | 'night'): string[] => {
    // Define start dates for each team's 28-day cycle
    // Team A: Sept 19, 2025
    // Team B: Oct 10, 2025
    // Team C: Sept 26, 2025
    // Team D: Oct 3, 2025
    const teamStarts = {
      'A': new Date(2025, 8, 19), // Sept 19, 2025
      'B': new Date(2025, 9, 10), // Oct 10, 2025
      'C': new Date(2025, 8, 26), // Sept 26, 2025
      'D': new Date(2025, 9, 3)   // Oct 3, 2025
    }

    // 28-day DuPont cycle pattern (day index in cycle: shift type)
    // Days 0-3: 4 nights, Days 4-6: off, Days 7-9: 3 days, Day 10: off,
    // Days 11-13: 3 nights, Days 14-16: off, Days 17-20: 4 days, Days 21-27: 7 off
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
    const checkDate = new Date(date)
    checkDate.setHours(0, 0, 0, 0)

    for (const [team, startDate] of Object.entries(teamStarts)) {
      const teamStartDate = new Date(startDate)
      teamStartDate.setHours(0, 0, 0, 0)

      // Calculate days since team's cycle start
      const daysSinceStart = Math.floor((checkDate.getTime() - teamStartDate.getTime()) / (1000 * 60 * 60 * 24))

      // Get position in 28-day cycle
      const dayInCycle = ((daysSinceStart % 28) + 28) % 28

      const teamShiftType = getShiftType(dayInCycle)

      if (teamShiftType === shiftType) {
        workingTeams.push(team)
      }
    }

    return workingTeams.sort()
  }

  const handleCellClick = (date: Date, jobId: string, shiftType: 'day' | 'night', existingShift: Shift | null) => {
    if (existingShift && onShiftDetails) {
      onShiftDetails(existingShift)
    } else if (onShiftClick) {
      onShiftClick(formatDate(date), jobId, shiftType)
    }
  }

  return (
    <div className="bg-white shadow rounded-lg">
      {/* Header Controls */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-bold text-gray-900">Job Coverage Schedule</h2>

            {/* View Toggle */}
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
          </div>

          {/* Navigation */}
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
          <span className="mx-2 text-gray-400">|</span>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 rounded bg-orange-50 border-2 border-orange-400"></div>
            <span className="text-gray-600">Vacation</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 rounded bg-red-50 border-2 border-red-500"></div>
            <span className="text-gray-600">Mandate</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-gray-600">🛡️ = Whole-set (Protected)</span>
          </div>
        </div>
      </div>

      {/* Schedule Grid */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50 sticky top-0">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sticky left-0 bg-gray-50 z-10 border-r border-gray-300">
                Job
              </th>
              {dateRange.map((date, idx) => {
                const dayTeams = getTeamsWorking(date, 'day')
                const nightTeams = getTeamsWorking(date, 'night')
                return (
                  <th key={idx} className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200 min-w-[140px]">
                    <div>{formatDisplayDate(date)}</div>
                    <div className="text-gray-400 font-normal">{date.getMonth() + 1}/{date.getDate()}</div>
                    <div className="mt-2 flex flex-col gap-1">
                      {dayTeams.length > 0 && (
                        <div className="text-[10px] font-normal normal-case flex flex-wrap gap-1 justify-center">
                          <span className="text-gray-600">Day:</span>
                          {dayTeams.map(team => (
                            <span key={`day-${team}`} className={`px-1.5 py-0.5 rounded ${teamColors[team]}`}>
                              {team}
                            </span>
                          ))}
                        </div>
                      )}
                      {nightTeams.length > 0 && (
                        <div className="text-[10px] font-normal normal-case flex flex-wrap gap-1 justify-center">
                          <span className="text-gray-600">Night:</span>
                          {nightTeams.map(team => (
                            <span key={`night-${team}`} className={`px-1.5 py-0.5 rounded ${teamColors[team]}`}>
                              {team}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {sortedJobs.map((job) => (
              <tr key={job.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm font-medium text-gray-900 sticky left-0 bg-white border-r border-gray-300">
                  {job.title}
                </td>
                {dateRange.map((date, idx) => {
                  const dayShift = getShiftForCell(date, job.id, 'day')
                  const nightShift = getShiftForCell(date, job.id, 'night')
                  const dayVacations = getVacationsForCell(date, 'day')
                  const nightVacations = getVacationsForCell(date, 'night')
                  const dayMandate = getMandateForCell(date, 'day')
                  const nightMandate = getMandateForCell(date, 'night')

                  return (
                    <td key={idx} className="px-2 py-2 border-r border-gray-200">
                      <div className="space-y-1">
                        {/* Day Shift */}
                        <div
                          onClick={() => handleCellClick(date, job.id, 'day', dayShift)}
                          className={`text-xs p-2 rounded border-2 cursor-pointer transition hover:shadow-md ${
                            dayShift && dayShift.operator
                              ? `${teamColors[dayShift.operator.team] || 'bg-gray-100 text-gray-800 border-gray-300'} border-l-4 border-l-yellow-400`
                              : 'bg-white border-dashed border-gray-300 text-gray-400 hover:border-gray-400'
                          }`}
                        >
                          {dayShift && dayShift.operator ? (
                            <div className="flex items-center justify-between">
                              <span className="font-medium truncate">
                                {(() => {
                                  const nameParts = dayShift.operator.name.split(' ')
                                  const firstName = nameParts[0]
                                  const lastInitial = nameParts[nameParts.length - 1]?.[0] || ''
                                  return `${firstName} ${lastInitial}.`
                                })()}
                              </span>
                              {dayShift.operator.letter && (
                                <span className="ml-1 font-bold">{dayShift.operator.letter}</span>
                              )}
                            </div>
                          ) : (
                            <span>+ Day</span>
                          )}
                        </div>

                        {/* Day Vacations */}
                        {dayVacations.length > 0 && (
                          <div className="space-y-1">
                            {dayVacations.map(vac => (
                              <div
                                key={vac.id}
                                onClick={() => onVacationClick?.(vac)}
                                className="text-xs p-1.5 rounded border-2 border-orange-400 bg-orange-50 text-orange-900 cursor-pointer transition hover:shadow-md"
                              >
                                <div className="flex items-center justify-between">
                                  <span className="font-medium truncate">
                                    {vac.operator ? (() => {
                                      const nameParts = vac.operator.name.split(' ')
                                      const firstName = nameParts[0]
                                      const lastInitial = nameParts[nameParts.length - 1]?.[0] || ''
                                      return `${firstName} ${lastInitial}.`
                                    })() : 'Vacation'}
                                  </span>
                                  <span className="ml-1 text-[10px] font-semibold">
                                    {vac.vacationType}{vac.isWholeSet ? ' 🛡️' : ''}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Day Mandate */}
                        {dayMandate && (
                          <div
                            onClick={() => onMandateClick?.(formatDate(date), 'day')}
                            className="text-xs p-1.5 rounded border-2 border-red-500 bg-red-50 text-red-900 cursor-pointer transition hover:shadow-md"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-medium truncate">
                                {dayMandate.operator ? (() => {
                                  const nameParts = dayMandate.operator.name.split(' ')
                                  const firstName = nameParts[0]
                                  const lastInitial = nameParts[nameParts.length - 1]?.[0] || ''
                                  return `${firstName} ${lastInitial}.`
                                })() : 'Mandate'}
                              </span>
                              <span className="ml-1 text-[10px] font-bold">⚠️</span>
                            </div>
                          </div>
                        )}

                        {/* Night Shift */}
                        <div
                          onClick={() => handleCellClick(date, job.id, 'night', nightShift)}
                          className={`text-xs p-2 rounded border-2 cursor-pointer transition hover:shadow-md ${
                            nightShift && nightShift.operator
                              ? `${teamColors[nightShift.operator.team] || 'bg-gray-100 text-gray-800 border-gray-300'} border-l-4 border-l-gray-700`
                              : 'bg-white border-dashed border-gray-300 text-gray-400 hover:border-gray-400'
                          }`}
                        >
                          {nightShift && nightShift.operator ? (
                            <div className="flex items-center justify-between">
                              <span className="font-medium truncate">
                                {(() => {
                                  const nameParts = nightShift.operator.name.split(' ')
                                  const firstName = nameParts[0]
                                  const lastInitial = nameParts[nameParts.length - 1]?.[0] || ''
                                  return `${firstName} ${lastInitial}.`
                                })()}
                              </span>
                              {nightShift.operator.letter && (
                                <span className="ml-1 font-bold">{nightShift.operator.letter}</span>
                              )}
                            </div>
                          ) : (
                            <span>+ Night</span>
                          )}
                        </div>

                        {/* Night Vacations */}
                        {nightVacations.length > 0 && (
                          <div className="space-y-1">
                            {nightVacations.map(vac => (
                              <div
                                key={vac.id}
                                onClick={() => onVacationClick?.(vac)}
                                className="text-xs p-1.5 rounded border-2 border-orange-400 bg-orange-50 text-orange-900 cursor-pointer transition hover:shadow-md"
                              >
                                <div className="flex items-center justify-between">
                                  <span className="font-medium truncate">
                                    {vac.operator ? (() => {
                                      const nameParts = vac.operator.name.split(' ')
                                      const firstName = nameParts[0]
                                      const lastInitial = nameParts[nameParts.length - 1]?.[0] || ''
                                      return `${firstName} ${lastInitial}.`
                                    })() : 'Vacation'}
                                  </span>
                                  <span className="ml-1 text-[10px] font-semibold">
                                    {vac.vacationType}{vac.isWholeSet ? ' 🛡️' : ''}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Night Mandate */}
                        {nightMandate && (
                          <div
                            onClick={() => onMandateClick?.(formatDate(date), 'night')}
                            className="text-xs p-1.5 rounded border-2 border-red-500 bg-red-50 text-red-900 cursor-pointer transition hover:shadow-md"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-medium truncate">
                                {nightMandate.operator ? (() => {
                                  const nameParts = nightMandate.operator.name.split(' ')
                                  const firstName = nameParts[0]
                                  const lastInitial = nameParts[nameParts.length - 1]?.[0] || ''
                                  return `${firstName} ${lastInitial}.`
                                })() : 'Mandate'}
                              </span>
                              <span className="ml-1 text-[10px] font-bold">⚠️</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Summary Footer */}
      <div className="px-4 py-3 bg-gray-50 border-t border-gray-200">
        <div className="flex items-center justify-between text-sm text-gray-600">
          <div>
            Showing coverage for {jobs.length} jobs across {viewDays} days
          </div>
          <div>
            Total shifts: {shifts.length}
          </div>
        </div>
      </div>
    </div>
  )
}
