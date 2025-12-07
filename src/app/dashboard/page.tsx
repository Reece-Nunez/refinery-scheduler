'use client'

import { useState, useEffect } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { RP755FatiguePolicy, type Shift, type FatigueViolation } from '@/lib/rp755FatiguePolicy'
import { getEffectiveVacationHours, getYearsOfService, getVacationWeeks } from '@/lib/vacationUtils'
import ShiftAnalyticsChart from '@/components/ShiftAnalyticsChart'
import ComplianceMonitor from '@/components/ComplianceMonitor'
import ActivityFeed from '@/components/ActivityFeed'

interface DashboardStats {
  totalOperators: number
  activeShifts: number
  shiftsToday: number
  shiftsThisWeek: number
  totalHoursThisWeek: number
  avgShiftLength: number
  rp755Violations: number
  activeExceptions: number
  operatorsOnDuty: number
  outageShifts: number
  callOuts: number
  complianceRate: number
}

interface OperatorStats {
  totalShifts: number
  overtimeHours: number
  mandateCount: number
  vacationHoursUsed: number
  vacationHoursRemaining: number
  totalVacationHours: number
  isCompliant: boolean
  violationCount: number
  upcomingShifts: any[]
  recentShifts: any[]
  nextShift: any | null
}

interface Alert {
  id: string
  type: 'high-risk' | 'violation' | 'warning' | 'info'
  title: string
  message: string
  timestamp: string
  operatorName?: string
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({
    totalOperators: 0,
    activeShifts: 0,
    shiftsToday: 0,
    shiftsThisWeek: 0,
    totalHoursThisWeek: 0,
    avgShiftLength: 0,
    rp755Violations: 0,
    activeExceptions: 0,
    operatorsOnDuty: 0,
    outageShifts: 0,
    callOuts: 0,
    complianceRate: 100
  })

  const [operatorStats, setOperatorStats] = useState<OperatorStats>({
    totalShifts: 0,
    overtimeHours: 0,
    mandateCount: 0,
    vacationHoursUsed: 0,
    vacationHoursRemaining: 80,
    totalVacationHours: 80,
    isCompliant: true,
    violationCount: 0,
    upcomingShifts: [],
    recentShifts: [],
    nextShift: null
  })

  const [alerts, setAlerts] = useState<Alert[]>([])
  const [shifts, setShifts] = useState<any[]>([])
  const [operators, setOperators] = useState<any[]>([])
  const [currentOperator, setCurrentOperator] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [role, setRole] = useState<'ADMIN' | 'OPER'>('OPER')
  const [userName, setUserName] = useState<string>('')
  const [dbStatus, setDbStatus] = useState<'checking' | 'connected' | 'failed'>('checking')

  useEffect(() => {
    const init = async () => {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user?.id) {
        const { data } = await supabase.from('users').select('role, display_name, email').eq('id', session.user.id).single()
        if (data?.role) setRole(data.role as any)
        setUserName(data?.display_name || data?.email?.split('@')[0] || 'User')

        // If operator, find their operator record
        if (data?.role === 'OPER') {
          const { data: opData } = await supabase.from('operators').select('*').eq('email', data.email).single()
          if (opData) setCurrentOperator(opData)
        }
      }
      await loadDashboardData()
    }
    init()
  }, [])

  const loadDashboardData = async () => {
    try {
      // Check database health
      const healthRes = await fetch('/api/health')
      const healthData = await healthRes.json()
      setDbStatus(healthData.database === 'connected' ? 'connected' : 'failed')

      // Fetch data from APIs
      const [operatorsRes, shiftsRes, exceptionsRes, vacationsRes, mandatesRes] = await Promise.all([
        fetch('/api/operators'),
        fetch('/api/shifts'),
        fetch('/api/exceptions'),
        fetch('/api/vacation'),
        fetch('/api/mandates')
      ])

      const operatorsJson = await operatorsRes.json()
      const shiftsJson = await shiftsRes.json()
      const exceptionsJson = await exceptionsRes.json()
      const vacationsJson = await vacationsRes.json()
      const mandatesJson = await mandatesRes.json()

      const operatorsData = Array.isArray(operatorsJson) ? operatorsJson : []
      const shiftsData = Array.isArray(shiftsJson) ? shiftsJson : []
      const exceptionsData = Array.isArray(exceptionsJson) ? exceptionsJson : []
      const vacationsData = Array.isArray(vacationsJson) ? vacationsJson : []
      const mandatesData = Array.isArray(mandatesJson) ? mandatesJson : []

      setOperators(operatorsData)
      setShifts(shiftsData)

      // Calculate dashboard statistics (for admin)
      const now = new Date()
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const weekStart = new Date(today)
      weekStart.setDate(today.getDate() - today.getDay())

      const shiftsToday = shiftsData.filter((shift: any) =>
        new Date(shift.startTime) >= today && new Date(shift.startTime) < new Date(today.getTime() + 24 * 60 * 60 * 1000)
      )

      const shiftsThisWeek = shiftsData.filter((shift: any) =>
        new Date(shift.startTime) >= weekStart
      )

      const activeShifts = shiftsData.filter((shift: any) => {
        const start = new Date(shift.startTime)
        const end = new Date(shift.endTime)
        return start <= now && end >= now
      })

      const totalHours = shiftsThisWeek.reduce((total: number, shift: any) => {
        const duration = RP755FatiguePolicy.calculateShiftHours(
          new Date(shift.startTime),
          new Date(shift.endTime)
        )
        return total + duration
      }, 0)

      const avgShiftLength = shiftsThisWeek.length > 0 ? totalHours / shiftsThisWeek.length : 0

      const violatedShifts = shiftsData.filter((shift: any) =>
        shift.violations && shift.violations.length > 0
      )

      const outageShifts = shiftsData.filter((shift: any) => shift.isOutage).length
      const callOuts = shiftsData.filter((shift: any) => shift.isCallOut).length

      const complianceRate = shiftsData.length > 0
        ? ((shiftsData.length - violatedShifts.length) / shiftsData.length) * 100
        : 100

      setStats({
        totalOperators: operatorsData.length,
        activeShifts: activeShifts.length,
        shiftsToday: shiftsToday.length,
        shiftsThisWeek: shiftsThisWeek.length,
        totalHoursThisWeek: Math.round(totalHours),
        avgShiftLength: Math.round(avgShiftLength * 10) / 10,
        rp755Violations: violatedShifts.length,
        activeExceptions: exceptionsData.filter((ex: any) => ex.status === 'pending').length,
        operatorsOnDuty: activeShifts.length,
        outageShifts,
        callOuts,
        complianceRate: Math.round(complianceRate * 10) / 10
      })

      // Calculate operator-specific stats if we have their data
      if (currentOperator) {
        calculateOperatorStats(currentOperator, shiftsData, vacationsData, mandatesData)
      }

      // Generate alerts (admin only)
      generateAlerts(shiftsData, violatedShifts, exceptionsData, operatorsData)

    } catch (error) {
      console.error('Failed to load dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  // Recalculate operator stats when currentOperator is set
  useEffect(() => {
    if (currentOperator && shifts.length > 0) {
      const fetchAdditionalData = async () => {
        const [vacationsRes, mandatesRes] = await Promise.all([
          fetch('/api/vacation'),
          fetch('/api/mandates')
        ])
        const vacationsData = await vacationsRes.json()
        const mandatesData = await mandatesRes.json()
        calculateOperatorStats(currentOperator, shifts, vacationsData, mandatesData)
      }
      fetchAdditionalData()
    }
  }, [currentOperator, shifts])

  const calculateOperatorStats = (operator: any, allShifts: any[], vacations: any[], mandates: any[]) => {
    const now = new Date()
    const yearStart = new Date(now.getFullYear(), 0, 1)

    // Filter shifts for this operator
    const myShifts = allShifts.filter(s => s.operatorId === operator.id)

    // Calculate overtime hours (shifts marked as overtime/isOvertime)
    const overtimeShifts = myShifts.filter(s => s.isOvertime || s.isCallOut)
    const overtimeHours = overtimeShifts.reduce((total, shift) => {
      return total + RP755FatiguePolicy.calculateShiftHours(
        new Date(shift.startTime),
        new Date(shift.endTime)
      )
    }, 0)

    // Count mandates for this operator this year
    const myMandates = mandates.filter(m =>
      m.operatorId === operator.id &&
      new Date(m.mandateDate) >= yearStart
    )

    // Calculate vacation days used this year
    const myVacations = vacations.filter(v =>
      v.operatorId === operator.id &&
      new Date(v.startTime) >= yearStart
    )
    const vacationDaysUsed = myVacations.reduce((total, vac) => {
      const start = new Date(vac.startTime)
      const end = new Date(vac.endTime)
      const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1
      return total + days
    }, 0)

    // Check compliance - any violations on their shifts?
    const violatedShifts = myShifts.filter(s => s.violations && s.violations.length > 0 && !s.isOverridden)
    const isCompliant = violatedShifts.length === 0

    // Get upcoming shifts (future shifts)
    const upcomingShifts = myShifts
      .filter(s => new Date(s.startTime) > now)
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
      .slice(0, 5)

    // Get recent shifts (past 30 days)
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    const recentShifts = myShifts
      .filter(s => new Date(s.startTime) <= now && new Date(s.startTime) >= thirtyDaysAgo)
      .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
      .slice(0, 10)

    // Next shift
    const nextShift = upcomingShifts[0] || null

    // Calculate vacation hours remaining using hire date (if available) or manual setting
    const totalVacationHours = getEffectiveVacationHours({
      hireDate: operator.hireDate ?? operator.hire_date,
      vacationHours: operator.vacationHours ?? operator.vacation_hours
    })
    const vacationHoursUsed = vacationDaysUsed * 8 // Convert days to hours
    const vacationHoursRemaining = Math.max(0, totalVacationHours - vacationHoursUsed)

    setOperatorStats({
      totalShifts: myShifts.length,
      overtimeHours: Math.round(overtimeHours * 10) / 10,
      mandateCount: myMandates.length,
      vacationHoursUsed,
      vacationHoursRemaining,
      totalVacationHours,
      isCompliant,
      violationCount: violatedShifts.length,
      upcomingShifts,
      recentShifts,
      nextShift
    })
  }

  const generateAlerts = (shifts: any[], violatedShifts: any[], exceptions: any[], operators: any[]) => {
    const alerts: Alert[] = []

    // High-risk violations
    violatedShifts.forEach(shift => {
      if (shift.violations) {
        shift.violations.forEach((violation: FatigueViolation) => {
          if (violation.severity === 'high-risk') {
            const operator = operators.find(op => op.id === shift.operatorId)
            alerts.push({
              id: `hr-${shift.id}-${violation.rule}`,
              type: 'high-risk',
              title: 'High-Risk RP-755 Violation',
              message: `${violation.rule}: ${violation.message}`,
              timestamp: shift.startTime,
              operatorName: operator?.name
            })
          }
        })
      }
    })

    // Pending exceptions requiring approval
    const pendingExceptions = exceptions.filter((ex: any) => ex.status === 'pending')
    if (pendingExceptions.length > 0) {
      alerts.push({
        id: 'pending-exceptions',
        type: 'warning',
        title: 'Pending Exception Approvals',
        message: `${pendingExceptions.length} exception request(s) awaiting approval`,
        timestamp: new Date().toISOString()
      })
    }

    // Low compliance rate
    if (stats.complianceRate < 90) {
      alerts.push({
        id: 'low-compliance',
        type: 'violation',
        title: 'Low RP-755 Compliance',
        message: `Compliance rate at ${stats.complianceRate}% - below 90% target`,
        timestamp: new Date().toISOString()
      })
    }

    // Upcoming shifts requiring attention
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const upcomingShifts = shifts.filter(shift => {
      const shiftDate = new Date(shift.startTime)
      return shiftDate >= new Date() && shiftDate <= tomorrow
    })

    if (upcomingShifts.length > 10) {
      alerts.push({
        id: 'high-volume',
        type: 'info',
        title: 'High Shift Volume',
        message: `${upcomingShifts.length} shifts scheduled for next 24 hours`,
        timestamp: new Date().toISOString()
      })
    }

    setAlerts(alerts.slice(0, 6))
  }

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'high-risk':
        return (
          <svg className="h-5 w-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        )
      case 'violation':
        return (
          <svg className="h-5 w-5 text-orange-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        )
      case 'warning':
        return (
          <svg className="h-5 w-5 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        )
      default:
        return (
          <svg className="h-5 w-5 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
        )
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-black mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  // Operator Dashboard
  if (role === 'OPER') {
    return (
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white shadow">
          <div className="px-4 sm:px-6 lg:px-8">
            <div className="py-6">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-3xl font-bold text-gray-900">Welcome, {userName}</h1>
                  <p className="mt-1 text-sm text-gray-600">
                    Your personal dashboard and schedule overview
                  </p>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="text-right">
                    <p className="text-sm text-gray-500">Last updated</p>
                    <p className="text-sm font-medium text-gray-900">
                      {new Date().toLocaleTimeString()}
                    </p>
                  </div>
                  <button
                    onClick={loadDashboardData}
                    className="bg-black hover:bg-gray-900 text-white px-4 py-2 rounded-lg transition duration-200"
                  >
                    Refresh
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="px-4 sm:px-6 lg:px-8 py-6">
          {/* Compliance Status Banner */}
          <div className={`mb-6 rounded-lg p-4 ${operatorStats.isCompliant ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
            <div className="flex items-center">
              {operatorStats.isCompliant ? (
                <>
                  <svg className="h-8 w-8 text-green-500 mr-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <div>
                    <h3 className="text-lg font-semibold text-green-800">You are RP-755 Compliant</h3>
                    <p className="text-sm text-green-600">All your shifts meet fatigue management requirements</p>
                  </div>
                </>
              ) : (
                <>
                  <svg className="h-8 w-8 text-red-500 mr-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <div>
                    <h3 className="text-lg font-semibold text-red-800">Compliance Issues Detected</h3>
                    <p className="text-sm text-red-600">{operatorStats.violationCount} shift(s) with RP-755 violations - please contact your supervisor</p>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Key Personal Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {/* Overtime Hours */}
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg className="h-8 w-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Overtime Hours</dt>
                    <dd className="text-3xl font-bold text-gray-900">{operatorStats.overtimeHours}h</dd>
                  </dl>
                </div>
              </div>
              <div className="mt-4">
                <div className="text-sm text-gray-600">This year</div>
              </div>
            </div>

            {/* Times Mandated */}
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg className="h-8 w-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Times Mandated</dt>
                    <dd className="text-3xl font-bold text-gray-900">{operatorStats.mandateCount}</dd>
                  </dl>
                </div>
              </div>
              <div className="mt-4">
                <div className="text-sm text-gray-600">This year</div>
              </div>
            </div>

            {/* Vacation Used */}
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg className="h-8 w-8 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Vacation Used</dt>
                    <dd className="text-3xl font-bold text-gray-900">{operatorStats.vacationHoursUsed}h</dd>
                  </dl>
                </div>
              </div>
              <div className="mt-4">
                <div className="text-sm text-gray-600">
                  {operatorStats.vacationHoursRemaining}h remaining of {operatorStats.totalVacationHours}h ({getVacationWeeks(operatorStats.totalVacationHours)} weeks)
                </div>
              </div>
            </div>

            {/* Total Shifts */}
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg className="h-8 w-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                  </svg>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Total Shifts</dt>
                    <dd className="text-3xl font-bold text-gray-900">{operatorStats.totalShifts}</dd>
                  </dl>
                </div>
              </div>
              <div className="mt-4">
                <div className="text-sm text-gray-600">All time</div>
              </div>
            </div>
          </div>

          {/* Next Shift & Upcoming Shifts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            {/* Next Shift Card */}
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">Next Shift</h3>
              </div>
              <div className="p-6">
                {operatorStats.nextShift ? (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                        operatorStats.nextShift.shiftType === 'day'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-indigo-100 text-indigo-800'
                      }`}>
                        {operatorStats.nextShift.shiftType === 'day' ? '☀️ Day Shift' : '🌙 Night Shift'}
                      </span>
                    </div>
                    <div className="text-2xl font-bold text-gray-900 mb-1">
                      {new Date(operatorStats.nextShift.startTime).toLocaleDateString('en-US', {
                        weekday: 'long',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </div>
                    <div className="text-lg text-gray-600">
                      {new Date(operatorStats.nextShift.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(operatorStats.nextShift.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                    {operatorStats.nextShift.isOvertime && (
                      <span className="mt-2 inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800">
                        ⏰ Overtime
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <p className="mt-2">No upcoming shifts scheduled</p>
                  </div>
                )}
              </div>
            </div>

            {/* Upcoming Shifts List */}
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">Upcoming Shifts</h3>
              </div>
              <div className="p-6">
                {operatorStats.upcomingShifts.length > 0 ? (
                  <div className="space-y-3">
                    {operatorStats.upcomingShifts.map((shift, index) => (
                      <div key={shift.id || index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div>
                          <div className="font-medium text-gray-900">
                            {new Date(shift.startTime).toLocaleDateString('en-US', {
                              weekday: 'short',
                              month: 'short',
                              day: 'numeric'
                            })}
                          </div>
                          <div className="text-sm text-gray-500">
                            {new Date(shift.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(shift.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                        <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                          shift.shiftType === 'day'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-indigo-100 text-indigo-800'
                        }`}>
                          {shift.shiftType === 'day' ? '☀️' : '🌙'}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    No upcoming shifts
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Recent Shifts */}
          <div className="bg-white shadow rounded-lg">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">Recent Shifts (Last 30 Days)</h3>
            </div>
            <div className="overflow-x-auto">
              {operatorStats.recentShifts.length > 0 ? (
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Hours</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {operatorStats.recentShifts.map((shift, index) => {
                      const hours = RP755FatiguePolicy.calculateShiftHours(
                        new Date(shift.startTime),
                        new Date(shift.endTime)
                      )
                      return (
                        <tr key={shift.id || index}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {new Date(shift.startTime).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {new Date(shift.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(shift.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                              shift.shiftType === 'day'
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-indigo-100 text-indigo-800'
                            }`}>
                              {shift.shiftType === 'day' ? '☀️ Day' : '🌙 Night'}
                            </span>
                            {shift.isOvertime && (
                              <span className="ml-1 inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800">
                                OT
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {hours.toFixed(1)}h
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-800">
                              Completed
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  No recent shifts
                </div>
              )}
            </div>
          </div>

          {/* Quick Links */}
          <div className="mt-8">
            <div className="bg-white shadow rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Quick Links</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <a href="/calendar" className="flex items-center justify-center px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition">
                  <svg className="h-5 w-5 text-gray-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span className="text-sm font-medium text-gray-700">View Calendar</span>
                </a>
                <a href="/shifts" className="flex items-center justify-center px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition">
                  <svg className="h-5 w-5 text-gray-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-sm font-medium text-gray-700">Shift Schedule</span>
                </a>
                <a href="/fatigue" className="flex items-center justify-center px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition">
                  <svg className="h-5 w-5 text-gray-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  <span className="text-sm font-medium text-gray-700">RP-755 Info</span>
                </a>
                <a href="/profile" className="flex items-center justify-center px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition">
                  <svg className="h-5 w-5 text-gray-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  <span className="text-sm font-medium text-gray-700">My Profile</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Admin Dashboard (existing)
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="py-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Operations Dashboard</h1>
                <p className="mt-1 text-sm text-gray-600">
                  Real-time overview of refinery scheduling and RP-755 compliance
                </p>
              </div>
              <div className="flex items-center space-x-4">
                <div className="text-right">
                  <p className="text-sm text-gray-500">Last updated</p>
                  <p className="text-sm font-medium text-gray-900">
                    {new Date().toLocaleTimeString()}
                  </p>
                </div>
                <button
                  onClick={loadDashboardData}
                  className="bg-black hover:bg-gray-900 text-white px-4 py-2 rounded-lg transition duration-200"
                >
                  Refresh
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 sm:px-6 lg:px-8 py-6">
        {/* Key Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Active Operators */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg className="h-8 w-8 text-gray-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Operators On Duty</dt>
                  <dd className="text-3xl font-bold text-gray-900">{stats.operatorsOnDuty}</dd>
                </dl>
              </div>
            </div>
            <div className="mt-4">
              <div className="text-sm text-gray-600">
                Total Operators: {stats.totalOperators}
              </div>
            </div>
          </div>

          {/* Active Shifts */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg className="h-8 w-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Active Shifts</dt>
                  <dd className="text-3xl font-bold text-gray-900">{stats.activeShifts}</dd>
                </dl>
              </div>
            </div>
            <div className="mt-4">
              <div className="text-sm text-gray-600">
                Today: {stats.shiftsToday} | This Week: {stats.shiftsThisWeek}
              </div>
            </div>
          </div>

          {/* RP-755 Compliance */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg className="h-8 w-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">RP-755 Compliance</dt>
                  <dd className={`text-3xl font-bold ${stats.complianceRate >= 95 ? 'text-green-600' : stats.complianceRate >= 90 ? 'text-yellow-600' : 'text-red-600'}`}>
                    {stats.complianceRate}%
                  </dd>
                </dl>
              </div>
            </div>
            <div className="mt-4">
              <div className="text-sm text-gray-600">
                Violations: {stats.rp755Violations} | Exceptions: {stats.activeExceptions}
              </div>
            </div>
          </div>

          {/* Weekly Hours */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg className="h-8 w-8 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Total Hours This Week</dt>
                  <dd className="text-3xl font-bold text-gray-900">{stats.totalHoursThisWeek}</dd>
                </dl>
              </div>
            </div>
            <div className="mt-4">
              <div className="text-sm text-gray-600">
                Avg Shift: {stats.avgShiftLength}h | Outages: {stats.outageShifts} | Call-outs: {stats.callOuts}
              </div>
            </div>
          </div>
        </div>

        {/* Analytics Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          <ShiftAnalyticsChart shifts={shifts} />
          <ComplianceMonitor shifts={shifts} />
        </div>

        {/* Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Alerts and Notifications */}
          <div className="lg:col-span-2">
            <div className="bg-white shadow rounded-lg">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">Critical Alerts & Notifications</h3>
              </div>
              <div className="p-6">
                {alerts.length === 0 ? (
                  <div className="text-center py-8">
                    <svg className="mx-auto h-12 w-12 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 48 48">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <h3 className="mt-2 text-sm font-medium text-gray-900">All Good!</h3>
                    <p className="mt-1 text-sm text-gray-500">No critical alerts at this time.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {alerts.map((alert) => (
                      <div key={alert.id} className={`p-4 rounded-lg border-l-4 ${
                        alert.type === 'high-risk' ? 'border-red-500 bg-red-50' :
                        alert.type === 'violation' ? 'border-orange-500 bg-orange-50' :
                        alert.type === 'warning' ? 'border-yellow-500 bg-yellow-50' :
                        'border-gray-500 bg-gray-50'
                      }`}>
                        <div className="flex">
                          <div className="flex-shrink-0">
                            {getAlertIcon(alert.type)}
                          </div>
                          <div className="ml-3 flex-1">
                            <h4 className="text-sm font-medium text-gray-900">{alert.title}</h4>
                            <p className="mt-1 text-sm text-gray-600">{alert.message}</p>
                            <div className="mt-2 flex items-center text-xs text-gray-500">
                              <svg className="mr-1 h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                              </svg>
                              {new Date(alert.timestamp).toLocaleString()}
                              {alert.operatorName && (
                                <>
                                  <span className="mx-2">•</span>
                                  <span className="font-medium">{alert.operatorName}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Quick Actions & Recent Activity */}
          <div className="space-y-6">
            <div className="bg-white shadow rounded-lg">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">Quick Actions</h3>
              </div>
              <div className="p-6 space-y-3">
                <a
                  href="/shifts"
                  className="w-full flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-black hover:bg-gray-900 transition duration-200"
                >
                  <svg className="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  Schedule New Shift
                </a>

                <a
                  href="/operators"
                  className="w-full flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition duration-200"
                >
                  <svg className="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  Manage Operators
                </a>

                <a
                  href="/fatigue"
                  className="w-full flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition duration-200"
                >
                  <svg className="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  RP-755 Settings
                </a>
              </div>
            </div>

            {/* System Status */}
            <div className="bg-white shadow rounded-lg">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">System Status</h3>
              </div>
              <div className="p-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-600">Database Connection</span>
                    {dbStatus === 'checking' ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                        Checking...
                      </span>
                    ) : dbStatus === 'connected' ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        Connected
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                        Failed
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-600">RP-755 Validation</span>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      Active
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-600">Exception Processing</span>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      Online
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Activity Feed */}
            <ActivityFeed shifts={shifts} operators={operators} maxItems={8} />
          </div>
        </div>

        {/* Recent Shifts Table */}
        <div className="mt-8">
          <div className="bg-white shadow rounded-lg">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">Recent Shifts</h3>
            </div>
            <div className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Operator
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Shift Time
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Duration
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Type
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {shifts.slice(0, 10).map((shift, index) => {
                      const operator = operators.find(op => op.id === shift.operatorId)
                      const duration = RP755FatiguePolicy.calculateShiftHours(
                        new Date(shift.startTime),
                        new Date(shift.endTime)
                      )

                      return (
                        <tr key={shift.id || index} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">
                              {operator?.name || shift.operator?.name || 'Unknown'}
                            </div>
                            <div className="text-sm text-gray-500">
                              {operator?.employeeId || shift.operator?.employeeId}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">
                              {new Date(shift.startTime).toLocaleDateString()}
                            </div>
                            <div className="text-sm text-gray-500">
                              {new Date(shift.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(shift.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {duration.toFixed(1)}h
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex space-x-1">
                              {shift.shiftType && (
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                  shift.shiftType === 'day' ? 'bg-yellow-100 text-yellow-800' : 'bg-indigo-100 text-indigo-800'
                                }`}>
                                  {shift.shiftType === 'day' ? '☀️' : '🌙'} {shift.shiftType}
                                </span>
                              )}
                              {shift.isCallOut && (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                                  Call-out
                                </span>
                              )}
                              {shift.isOutage && (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                                  Outage
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {shift.violations && shift.violations.length > 0 ? (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                {shift.isOverridden ? 'Exception Approved' : 'Violations'}
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                Compliant
                              </span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
