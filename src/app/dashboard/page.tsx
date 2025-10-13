'use client'

import { useState, useEffect } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { RP755FatiguePolicy, type Shift, type FatigueViolation } from '@/lib/rp755FatiguePolicy'
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
  
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [shifts, setShifts] = useState<any[]>([])
  const [operators, setOperators] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [role, setRole] = useState<'ADMIN' | 'OPER'>('OPER')
  const [dbStatus, setDbStatus] = useState<'checking' | 'connected' | 'failed'>('checking')

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
      const [operatorsRes, shiftsRes, exceptionsRes] = await Promise.all([
        fetch('/api/operators'),
        fetch('/api/shifts'),
        fetch('/api/exceptions')
      ])

      const operatorsJson = await operatorsRes.json()
      const shiftsJson = await shiftsRes.json()
      const exceptionsJson = await exceptionsRes.json()

      const operatorsData = Array.isArray(operatorsJson) ? operatorsJson : []
      const shiftsData = Array.isArray(shiftsJson) ? shiftsJson : []
      const exceptionsData = Array.isArray(exceptionsJson) ? exceptionsJson : []

      setOperators(operatorsData)
      setShifts(shiftsData)

      // Calculate dashboard statistics
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

      // Generate alerts
      generateAlerts(shiftsData, violatedShifts, exceptionsData, operatorsData)

    } catch (error) {
      console.error('Failed to load dashboard data:', error)
    } finally {
      setLoading(false)
    }
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

    setAlerts(alerts.slice(0, 6)) // Limit to 6 most important alerts
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
            {role === 'ADMIN' && (
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
                  
                  <button 
                    onClick={() => alert('Exception requests page coming soon!')}
                    className="w-full flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition duration-200"
                  >
                    <svg className="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Exception Requests
                  </button>
                </div>
              </div>
            )}

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
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-600">Notifications</span>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      Enabled
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
                              {operator?.name || 'Unknown'}
                            </div>
                            <div className="text-sm text-gray-500">
                              {operator?.employeeId}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">
                              {new Date(shift.startTime).toLocaleDateString()}
                            </div>
                            <div className="text-sm text-gray-500">
                              {new Date(shift.startTime).toLocaleTimeString()} - {new Date(shift.endTime).toLocaleTimeString()}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {duration.toFixed(1)}h
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex space-x-1">
                              {shift.shiftType && (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                  {shift.shiftType}
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
