'use client'

import { useEffect, useState } from 'react'

interface Job {
  id: string
  title: string
}

interface Operator {
  id: string
  name: string
  employeeId: string
  phone?: string
  role: string
  team: string
  letter?: string
  trainedJobs: Job[]
  status: string
  consoles?: string[]
}

interface Shift {
  id: string
  operatorId: string
  startTime: string
  endTime: string
  duration: number
  violations?: any[]
  isOverridden?: boolean
  status: string
}

interface OperatorAnalyticsProps {
  operators: Operator[]
  shifts: Shift[]
}

interface TeamStats {
  team: string
  count: number
  activeCount: number
  totalHours: number
  violations: number
}

interface RoleStats {
  role: string
  count: number
  percentage: number
}

export default function OperatorAnalytics({ operators, shifts }: OperatorAnalyticsProps) {
  const [teamStats, setTeamStats] = useState<TeamStats[]>([])
  const [roleStats, setRoleStats] = useState<RoleStats[]>([])
  const [overallMetrics, setOverallMetrics] = useState({
    totalOperators: 0,
    activeOperators: 0,
    totalShifts: 0,
    totalHours: 0,
    averageJobsPerOperator: 0,
    complianceRate: 0,
    utilizationRate: 0
  })

  useEffect(() => {
    calculateAnalytics()
  }, [operators, shifts])

  const calculateAnalytics = () => {
    // Add null checks
    if (!operators || !shifts) {
      return
    }

    // Overall metrics
    const totalOperators = operators.length
    const activeOperators = operators.filter(op => op.status === 'active').length
    const totalShifts = shifts.length
    const totalHours = shifts.reduce((acc, shift) => acc + (shift.duration || 0), 0)
    const totalJobs = operators.reduce((acc, op) => acc + (op.trainedJobs?.length || 0), 0)
    const averageJobsPerOperator = totalOperators > 0 ? Math.round(totalJobs / totalOperators * 10) / 10 : 0
    
    const shiftsWithViolations = shifts.filter(shift => shift.violations && shift.violations.length > 0).length
    const complianceRate = totalShifts > 0 ? Math.round(((totalShifts - shiftsWithViolations) / totalShifts) * 100) : 100
    
    // Calculate utilization rate (assuming 40 hours/week as full utilization)
    const expectedWeeklyHours = activeOperators * 40
    const currentWeek = new Date()
    const weekStart = new Date(currentWeek.setDate(currentWeek.getDate() - currentWeek.getDay()))
    const weekShifts = shifts.filter(shift => shift.startTime && new Date(shift.startTime) >= weekStart)
    const weeklyHours = weekShifts.reduce((acc, shift) => acc + (shift.duration || 0), 0)
    const utilizationRate = expectedWeeklyHours > 0 ? Math.round((weeklyHours / expectedWeeklyHours) * 100) : 0

    setOverallMetrics({
      totalOperators,
      activeOperators,
      totalShifts,
      totalHours,
      averageJobsPerOperator,
      complianceRate,
      utilizationRate
    })

    // Team statistics
    const teams = ['A', 'B', 'C', 'D']
    const teamData: TeamStats[] = teams.map(team => {
      const teamOperators = operators.filter(op => op.team === team)
      const teamShifts = shifts.filter(shift => {
        const operator = operators.find(op => op.id === shift.operatorId)
        return operator && operator.team === team
      })
      const teamViolations = teamShifts.filter(shift => shift.violations && shift.violations.length > 0).length

      return {
        team,
        count: teamOperators.length,
        activeCount: teamOperators.filter(op => op.status === 'active').length,
        totalHours: teamShifts.reduce((acc, shift) => acc + (shift.duration || 0), 0),
        violations: teamViolations
      }
    })
    setTeamStats(teamData)

    // Role statistics
    const roleCounts = operators.reduce((acc, op) => {
      acc[op.role] = (acc[op.role] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    const roleData: RoleStats[] = Object.entries(roleCounts).map(([role, count]) => ({
      role,
      count,
      percentage: Math.round((count / totalOperators) * 100)
    }))
    setRoleStats(roleData)
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

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-lg shadow border">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-black rounded-md flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
                </svg>
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-700">Total Operators</p>
              <p className="text-2xl font-semibold text-gray-900">{overallMetrics.totalOperators}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow border">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-green-600 rounded-md flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-700">Active Now</p>
              <p className="text-2xl font-semibold text-gray-900">{overallMetrics.activeOperators}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow border">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-purple-600 rounded-md flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                </svg>
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-700">Total Shifts</p>
              <p className="text-2xl font-semibold text-gray-900">{overallMetrics.totalShifts}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow border">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-orange-600 rounded-md flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                </svg>
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-700">Total Hours</p>
              <p className="text-2xl font-semibold text-gray-900">{overallMetrics.totalHours}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-lg shadow border">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Compliance Rate</h3>
          <div className="flex items-center">
            <div className="flex-1">
              <div className="flex justify-between text-sm text-gray-600 mb-1">
                <span>Policy Compliance</span>
                <span>{overallMetrics.complianceRate}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-green-600 h-2 rounded-full" 
                  style={{ width: `${overallMetrics.complianceRate}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow border">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Utilization Rate</h3>
          <div className="flex items-center">
            <div className="flex-1">
              <div className="flex justify-between text-sm text-gray-600 mb-1">
                <span>Weekly Utilization</span>
                <span>{overallMetrics.utilizationRate}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-black h-2 rounded-full" 
                  style={{ width: `${Math.min(overallMetrics.utilizationRate, 100)}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow border">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Training Coverage</h3>
          <div className="flex items-center">
            <div className="flex-1">
              <div className="flex justify-between text-sm text-gray-600 mb-1">
                <span>Avg Jobs/Operator</span>
                <span>{overallMetrics.averageJobsPerOperator}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-purple-600 h-2 rounded-full" 
                  style={{ width: `${Math.min(overallMetrics.averageJobsPerOperator * 10, 100)}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Team and Role Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Team Statistics */}
        <div className="bg-white p-6 rounded-lg shadow border">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Team Distribution</h3>
          <div className="space-y-4">
            {teamStats.map(team => (
              <div key={team.team} className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className={`w-4 h-4 rounded-full ${getTeamColor(team.team)}`}></div>
                  <span className="text-sm font-medium text-gray-900">Team {team.team}</span>
                </div>
                <div className="flex items-center space-x-4 text-sm text-gray-600">
                  <span>{team.count} total</span>
                  <span className="text-green-600">{team.activeCount} active</span>
                  <span>{team.totalHours}h</span>
                  {team.violations > 0 && (
                    <span className="text-red-600">{team.violations} violations</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Role Distribution */}
        <div className="bg-white p-6 rounded-lg shadow border">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Role Distribution</h3>
          <div className="space-y-4">
            {roleStats.map(role => (
              <div key={role.role} className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-900">{role.role}</span>
                <div className="flex items-center space-x-2">
                  <div className="w-20 bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-black h-2 rounded-full" 
                      style={{ width: `${role.percentage}%` }}
                    ></div>
                  </div>
                  <span className="text-sm text-gray-600 w-12 text-right">
                    {role.count} ({role.percentage}%)
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Performance Insights */}
      <div className="bg-white p-6 rounded-lg shadow border">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Key Insights</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="text-center p-4 bg-gray-100 rounded-lg">
            <p className="text-2xl font-bold text-gray-900">{Math.round((overallMetrics.activeOperators / overallMetrics.totalOperators) * 100)}%</p>
            <p className="text-sm text-gray-600">Workforce Active</p>
          </div>
          <div className="text-center p-4 bg-green-50 rounded-lg">
            <p className="text-2xl font-bold text-green-600">{overallMetrics.totalShifts > 0 ? Math.round(overallMetrics.totalHours / overallMetrics.totalShifts * 10) / 10 : 0}</p>
            <p className="text-sm text-gray-600">Avg Shift Hours</p>
          </div>
          <div className="text-center p-4 bg-purple-50 rounded-lg">
            <p className="text-2xl font-bold text-purple-600">{teamStats.length > 0 ? Math.max(...teamStats.map(t => t.count)) : 0}</p>
            <p className="text-sm text-gray-600">Largest Team Size</p>
          </div>
          <div className="text-center p-4 bg-orange-50 rounded-lg">
            <p className="text-2xl font-bold text-orange-600">{overallMetrics.averageJobsPerOperator}</p>
            <p className="text-sm text-gray-600">Cross-training Index</p>
          </div>
        </div>
      </div>
    </div>
  )
}
