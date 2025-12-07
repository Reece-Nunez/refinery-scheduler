'use client'

import { useState, useEffect } from 'react'
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameMonth, isSameDay, addMonths, subMonths } from 'date-fns'

type Job = {
  id: string
  title: string
}

type Shift = {
  id: string
  operatorId: string
  jobId: string
  startTime: string
  endTime: string
  shiftType: 'day' | 'night'
  isOverridden: boolean
  isCallOut?: boolean
  isOutage?: boolean
  isOvertime?: boolean
  operator: {
    id: string
    name: string
    employeeId: string
    team: string
  }
  job?: Job
}

type Vacation = {
  id: string
  operatorId: string
  startTime: string
  endTime: string
  status: string
  operator?: {
    id: string
    name: string
    employeeId: string
    team: string
  }
}

type Mandate = {
  id: string
  operatorId: string
  mandateDate: string
  shiftType: 'day' | 'night'
  startTime: string
  endTime: string
  reason?: string
  operator?: {
    id: string
    name: string
    employeeid: string
    team: string
  }
  job?: Job
}

type Props = {
  canManage?: boolean
}

const teamColors: Record<string, { bg: string; text: string }> = {
  A: { bg: 'bg-blue-500', text: 'text-white' },
  B: { bg: 'bg-green-500', text: 'text-white' },
  C: { bg: 'bg-purple-500', text: 'text-white' },
  D: { bg: 'bg-orange-500', text: 'text-white' },
}

export default function OperatorShiftCalendar({ canManage = false }: Props) {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [shifts, setShifts] = useState<Shift[]>([])
  const [jobs, setJobs] = useState<Job[]>([])
  const [vacations, setVacations] = useState<Vacation[]>([])
  const [mandates, setMandates] = useState<Mandate[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchAllData()
  }, [])

  const fetchAllData = async () => {
    try {
      const [shiftsRes, jobsRes, vacationsRes, mandatesRes] = await Promise.all([
        fetch('/api/shifts'),
        fetch('/api/jobs'),
        fetch('/api/vacation'),
        fetch('/api/mandates')
      ])

      const shiftsData = await shiftsRes.json()
      const jobsData = await jobsRes.json()
      const vacationsData = await vacationsRes.json()
      const mandatesData = await mandatesRes.json()

      setJobs(jobsData)
      setVacations(vacationsData)
      setMandates(mandatesData)

      // Enrich shifts with job information
      const jobMap = new Map(jobsData.map((j: Job) => [j.id, j]))
      const enrichedShifts = shiftsData.map((shift: Shift) => ({
        ...shift,
        job: jobMap.get(shift.jobId)
      }))

      setShifts(enrichedShifts)
    } catch (error) {
      console.error('Failed to fetch data:', error)
    } finally {
      setLoading(false)
    }
  }

  // Get shifts for a specific date (based on shift START date only)
  const getShiftsForDate = (date: Date): Shift[] => {
    return shifts.filter(shift => {
      const shiftStart = new Date(shift.startTime)

      // Only show shifts on the day they START (prevents overnight shifts appearing twice)
      const dateStart = new Date(date)
      dateStart.setHours(0, 0, 0, 0)
      const dateEnd = new Date(date)
      dateEnd.setHours(23, 59, 59, 999)

      return shiftStart >= dateStart && shiftStart <= dateEnd
    })
  }

  // Get vacations for a specific date
  const getVacationsForDate = (date: Date): Vacation[] => {
    return vacations.filter(vacation => {
      const vacStart = new Date(vacation.startTime)
      const vacEnd = new Date(vacation.endTime)

      const dateStart = new Date(date)
      dateStart.setHours(0, 0, 0, 0)
      const dateEnd = new Date(date)
      dateEnd.setHours(23, 59, 59, 999)

      return vacStart <= dateEnd && vacEnd >= dateStart
    })
  }

  // Get mandates for a specific date
  const getMandatesForDate = (date: Date): Mandate[] => {
    return mandates.filter(mandate => {
      const mandateDate = new Date(mandate.mandateDate)
      return isSameDay(mandateDate, date)
    })
  }

  // Generate calendar days
  const generateCalendarDays = () => {
    const monthStart = startOfMonth(currentMonth)
    const monthEnd = endOfMonth(monthStart)
    const startDate = startOfWeek(monthStart)
    const endDate = endOfWeek(monthEnd)

    const days = []
    let day = startDate

    while (day <= endDate) {
      days.push(day)
      day = addDays(day, 1)
    }

    return days
  }

  const days = generateCalendarDays()
  const selectedDateShifts = selectedDate ? getShiftsForDate(selectedDate) : []
  const selectedDateVacations = selectedDate ? getVacationsForDate(selectedDate) : []
  const selectedDateMandates = selectedDate ? getMandatesForDate(selectedDate) : []

  // Separate day and night shifts
  const dayShifts = selectedDateShifts.filter(s => s.shiftType === 'day')
  const nightShifts = selectedDateShifts.filter(s => s.shiftType === 'night')

  // Group shifts by job for better organization
  const shiftsByJob = selectedDateShifts.reduce((acc, shift) => {
    const jobName = shift.job?.title || 'Unassigned'
    if (!acc[jobName]) acc[jobName] = []
    acc[jobName].push(shift)
    return acc
  }, {} as Record<string, Shift[]>)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black"></div>
      </div>
    )
  }

  return (
    <div className="flex gap-6">
      {/* Calendar */}
      <div className="flex-1">
        {/* Legend */}
        <div className="mb-4 bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex flex-wrap items-center gap-4 mb-3">
            <div className="text-sm font-medium text-gray-700">Team Colors:</div>
            {Object.entries(teamColors).map(([team, colors]) => (
              <div key={team} className="flex items-center gap-2">
                <div className={`w-4 h-4 rounded ${colors.bg}`}></div>
                <span className="text-sm text-gray-600">Team {team}</span>
              </div>
            ))}
            <div className="border-l border-gray-300 pl-4 flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span>☀️</span>
                <span className="text-sm text-gray-600">Day</span>
              </div>
              <div className="flex items-center gap-2">
                <span>🌙</span>
                <span className="text-sm text-gray-600">Night</span>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-gray-200">
            <div className="text-sm font-medium text-gray-700">Status:</div>
            <div className="flex items-center gap-1">
              <span className="text-xs px-1.5 py-0.5 rounded bg-red-100 text-red-800">📋 Mandate</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">🏖️ Vacation</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-700">📞 Call-out</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-xs px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-800">🔧 Outage</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-xs px-1.5 py-0.5 rounded bg-blue-100 text-blue-800">⏰ Overtime</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-xs px-1.5 py-0.5 rounded bg-red-100 text-red-700">⚠️ RP-755 Override</span>
            </div>
          </div>
        </div>

        {/* Calendar Header */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between p-4 border-b border-gray-200">
            <button
              onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
              className="p-2 hover:bg-gray-100 rounded-lg transition"
            >
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h2 className="text-xl font-semibold text-gray-900">
              {format(currentMonth, 'MMMM yyyy')}
            </h2>
            <button
              onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
              className="p-2 hover:bg-gray-100 rounded-lg transition"
            >
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {/* Day Headers */}
          <div className="grid grid-cols-7 border-b border-gray-200">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="py-3 text-center text-sm font-medium text-gray-500">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7">
            {days.map((day, idx) => {
              const dayShifts = getShiftsForDate(day)
              const isCurrentMonth = isSameMonth(day, currentMonth)
              const isSelected = selectedDate && isSameDay(day, selectedDate)
              const isToday = isSameDay(day, new Date())

              // Group shifts by team for the dots
              const teamCounts = dayShifts.reduce((acc, shift) => {
                const team = shift.operator?.team || 'A'
                acc[team] = (acc[team] || 0) + 1
                return acc
              }, {} as Record<string, number>)

              const dayVacations = getVacationsForDate(day)
              const dayMandates = getMandatesForDate(day)

              return (
                <div
                  key={idx}
                  onClick={() => setSelectedDate(day)}
                  className={`
                    min-h-[100px] p-2 border-b border-r border-gray-200 cursor-pointer transition
                    ${!isCurrentMonth ? 'bg-gray-100' : 'bg-white hover:bg-gray-50'}
                    ${isSelected ? 'ring-2 ring-inset ring-red-500 bg-red-50' : ''}
                    ${isToday ? 'bg-yellow-50' : ''}
                  `}
                >
                  <div className={`text-base font-semibold mb-1 ${
                    !isCurrentMonth ? 'text-gray-400' :
                    isToday ? 'text-red-600' : 'text-gray-900'
                  }`}>
                    {format(day, 'd')}
                  </div>

                  {/* Mandate indicators */}
                  {dayMandates.length > 0 && (
                    <div className="text-xs px-1.5 py-0.5 rounded truncate bg-red-100 text-red-800 mb-1">
                      📋 {dayMandates.length} mandate{dayMandates.length > 1 ? 's' : ''}
                    </div>
                  )}

                  {/* Vacation indicators */}
                  {dayVacations.length > 0 && (
                    <div className="text-xs px-1.5 py-0.5 rounded truncate bg-amber-100 text-amber-800 mb-1">
                      🏖️ {dayVacations.length} vacation{dayVacations.length > 1 ? 's' : ''}
                    </div>
                  )}

                  {/* Shift indicators */}
                  {dayShifts.length > 0 && (
                    <div className="space-y-1">
                      {/* Show up to 2 shifts, then "+X more" */}
                      {dayShifts.slice(0, 2).map((shift) => {
                        const team = shift.operator?.team || 'A'
                        const colors = teamColors[team] || teamColors.A
                        const icon = shift.shiftType === 'night' ? '🌙' : '☀️'
                        return (
                          <div
                            key={shift.id}
                            className={`text-xs px-1.5 py-0.5 rounded truncate ${colors.bg} ${colors.text}`}
                          >
                            {icon} {shift.operator?.name?.split(' ')[0]}
                          </div>
                        )
                      })}
                      {dayShifts.length > 2 && (
                        <div className="text-xs text-gray-500 font-medium">
                          +{dayShifts.length - 2} more
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Selected Day Detail Panel */}
      <div className="w-96">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 sticky top-4">
          <div className="p-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">
              {selectedDate ? format(selectedDate, 'EEEE, MMMM d, yyyy') : 'Select a date'}
            </h3>
            {selectedDate && (
              <p className="text-sm text-gray-500 mt-1">
                {selectedDateShifts.length} shift{selectedDateShifts.length !== 1 ? 's' : ''} scheduled
              </p>
            )}
          </div>

          <div className="p-4 max-h-[600px] overflow-y-auto">
            {!selectedDate ? (
              <p className="text-gray-500 text-center py-8">
                Click on a date to view shifts
              </p>
            ) : selectedDateShifts.length === 0 && selectedDateVacations.length === 0 && selectedDateMandates.length === 0 ? (
              <p className="text-gray-500 text-center py-8">
                No shifts, vacations, or mandates for this date
              </p>
            ) : (
              <div className="space-y-6">
                {/* Mandates */}
                {selectedDateMandates.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-red-700 mb-3 flex items-center gap-2">
                      <span>📋</span> Mandated Shifts ({selectedDateMandates.length})
                    </h4>
                    <div className="space-y-2">
                      {selectedDateMandates.map(mandate => (
                        <div key={mandate.id} className="rounded-lg border border-red-200 bg-red-50 px-3 py-2">
                          <div className="font-medium text-red-900">{mandate.operator?.name || 'Unknown'}</div>
                          {canManage && mandate.operator?.employeeid && (
                            <div className="text-xs text-red-700">ID: {mandate.operator.employeeid}</div>
                          )}
                          <div className="text-xs text-red-600 mt-1">
                            {mandate.shiftType === 'day' ? '☀️ Day' : '🌙 Night'} Shift
                            {mandate.job && ` - ${mandate.job.title}`}
                          </div>
                          {mandate.reason && (
                            <div className="text-xs text-red-600 mt-1">
                              Reason: {mandate.reason}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Vacations */}
                {selectedDateVacations.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-amber-700 mb-3 flex items-center gap-2">
                      <span>🏖️</span> On Vacation ({selectedDateVacations.length})
                    </h4>
                    <div className="space-y-2">
                      {selectedDateVacations.map(vacation => (
                        <div key={vacation.id} className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                          <div className="font-medium text-amber-900">{vacation.operator?.name || 'Unknown'}</div>
                          {canManage && vacation.operator?.employeeId && (
                            <div className="text-xs text-amber-700">ID: {vacation.operator.employeeId}</div>
                          )}
                          <div className="text-xs text-amber-600 mt-1">
                            {format(new Date(vacation.startTime), 'MMM d')} - {format(new Date(vacation.endTime), 'MMM d')}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Shifts grouped by Job */}
                {Object.entries(shiftsByJob).map(([jobName, jobShifts]) => {
                  const jobDayShifts = jobShifts.filter(s => s.shiftType === 'day')
                  const jobNightShifts = jobShifts.filter(s => s.shiftType === 'night')

                  return (
                    <div key={jobName} className="border border-gray-200 rounded-lg overflow-hidden">
                      <div className="bg-gray-100 px-3 py-2 border-b border-gray-200">
                        <h4 className="font-semibold text-gray-800">{jobName}</h4>
                        <p className="text-xs text-gray-500">{jobShifts.length} operator{jobShifts.length > 1 ? 's' : ''}</p>
                      </div>
                      <div className="p-3 space-y-3">
                        {/* Day Shifts for this job */}
                        {jobDayShifts.length > 0 && (
                          <div>
                            <div className="text-xs font-medium text-gray-500 mb-2 flex items-center gap-1">
                              <span>☀️</span> Day Shift
                            </div>
                            <div className="space-y-2">
                              {jobDayShifts.map(shift => (
                                <ShiftCard key={shift.id} shift={shift} showId={canManage} />
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Night Shifts for this job */}
                        {jobNightShifts.length > 0 && (
                          <div>
                            <div className="text-xs font-medium text-gray-500 mb-2 flex items-center gap-1">
                              <span>🌙</span> Night Shift
                            </div>
                            <div className="space-y-2">
                              {jobNightShifts.map(shift => (
                                <ShiftCard key={shift.id} shift={shift} showId={canManage} />
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function ShiftCard({ shift, showId = true }: { shift: Shift; showId?: boolean }) {
  const team = shift.operator?.team || 'A'
  const colors = teamColors[team] || teamColors.A
  const startTime = new Date(shift.startTime)
  const endTime = new Date(shift.endTime)

  return (
    <div className={`rounded-lg border border-gray-200 overflow-hidden`}>
      <div className={`${colors.bg} px-3 py-1.5 flex items-center justify-between`}>
        <span className={`font-medium ${colors.text}`}>{shift.operator?.name}</span>
        <span className={`text-xs ${colors.text} opacity-90`}>Team {team}</span>
      </div>
      <div className="px-3 py-2 bg-white">
        {showId && (
          <div className="text-sm text-gray-600">
            <span className="font-medium">ID:</span> {shift.operator?.employeeId}
          </div>
        )}
        <div className="text-sm text-gray-600">
          <span className="font-medium">Time:</span> {format(startTime, 'h:mm a')} - {format(endTime, 'h:mm a')}
        </div>
        {/* Shift flags */}
        <div className="flex flex-wrap gap-1 mt-1">
          {shift.isCallOut && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-700">
              📞 Call-out
            </span>
          )}
          {shift.isOutage && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-800">
              🔧 Outage
            </span>
          )}
          {shift.isOvertime && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-blue-100 text-blue-800">
              ⏰ Overtime
            </span>
          )}
          {shift.isOverridden && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-red-100 text-red-700 font-medium">
              ⚠️ RP-755 Override
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
