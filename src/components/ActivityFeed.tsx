'use client'

import { useState, useEffect } from 'react'

interface ActivityItem {
  id: string
  type: 'shift_scheduled' | 'violation' | 'exception_submitted' | 'operator_added' | 'shift_completed'
  title: string
  description: string
  timestamp: string
  operatorName?: string
  severity?: 'low' | 'medium' | 'high'
}

interface ActivityFeedProps {
  shifts: any[]
  operators: any[]
  maxItems?: number
}

export default function ActivityFeed({ shifts, operators, maxItems = 10 }: ActivityFeedProps) {
  const [activities, setActivities] = useState<ActivityItem[]>([])

  useEffect(() => {
    generateActivities()
  }, [shifts, operators])

  const generateActivities = () => {
    const activityList: ActivityItem[] = []

    // Generate activities from shifts
    shifts.forEach(shift => {
      const operator = operators.find(op => op.id === shift.operatorId)
      const operatorName = operator?.name || 'Unknown Operator'

      // Shift scheduled activity
      activityList.push({
        id: `shift-${shift.id}`,
        type: 'shift_scheduled',
        title: 'Shift Scheduled',
        description: `${operatorName} scheduled for ${new Date(shift.startTime).toLocaleDateString()}`,
        timestamp: shift.createdAt || shift.startTime,
        operatorName,
        severity: 'low'
      })

      // Violation activities
      if (shift.violations && shift.violations.length > 0) {
        shift.violations.forEach((violation: any, index: number) => {
          activityList.push({
            id: `violation-${shift.id}-${index}`,
            type: 'violation',
            title: 'RP-755 Violation',
            description: `${violation.rule}: ${violation.message}`,
            timestamp: shift.startTime,
            operatorName,
            severity: violation.severity === 'high-risk' ? 'high' : 'medium'
          })
        })
      }

      // Exception submitted activity
      if (shift.isOverridden) {
        activityList.push({
          id: `exception-${shift.id}`,
          type: 'exception_submitted',
          title: 'Exception Approved',
          description: `Override applied for ${operatorName}'s shift`,
          timestamp: shift.startTime,
          operatorName,
          severity: 'medium'
        })
      }

      // Shift completed activity (for shifts that have ended)
      const now = new Date()
      const shiftEnd = new Date(shift.endTime)
      if (shiftEnd < now) {
        activityList.push({
          id: `completed-${shift.id}`,
          type: 'shift_completed',
          title: 'Shift Completed',
          description: `${operatorName} completed shift successfully`,
          timestamp: shift.endTime,
          operatorName,
          severity: 'low'
        })
      }
    })

    // Generate activities from operators
    operators.forEach(operator => {
      activityList.push({
        id: `operator-${operator.id}`,
        type: 'operator_added',
        title: 'Operator Added',
        description: `${operator.name} (${operator.employeeId}) added to system`,
        timestamp: operator.createdAt || new Date().toISOString(),
        operatorName: operator.name,
        severity: 'low'
      })
    })

    // Sort by timestamp (most recent first)
    activityList.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

    // Limit to maxItems
    setActivities(activityList.slice(0, maxItems))
  }

  const getActivityIcon = (type: string, severity?: string) => {
    const iconClass = `h-5 w-5 ${
      severity === 'high' ? 'text-red-500' :
      severity === 'medium' ? 'text-yellow-500' :
      'text-green-500'
    }`

    switch (type) {
      case 'shift_scheduled':
        return (
          <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )
      case 'violation':
        return (
          <svg className={iconClass} fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        )
      case 'exception_submitted':
        return (
          <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )
      case 'operator_added':
        return (
          <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        )
      case 'shift_completed':
        return (
          <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
          </svg>
        )
      default:
        return (
          <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )
    }
  }

  const getTimeAgo = (timestamp: string) => {
    const now = new Date()
    const time = new Date(timestamp)
    const diff = now.getTime() - time.getTime()

    const minutes = Math.floor(diff / (1000 * 60))
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))

    if (days > 0) return `${days}d ago`
    if (hours > 0) return `${hours}h ago`
    if (minutes > 0) return `${minutes}m ago`
    return 'Just now'
  }

  return (
    <div className="bg-white shadow rounded-lg">
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-lg font-medium text-gray-900">Recent Activity</h3>
      </div>
      
      <div className="p-6">
        {activities.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <svg className="mx-auto h-12 w-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 48 48">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M34 40h10v-4a6 6 0 00-10.712-3.714M34 40H14m20 0v-4a9.971 9.971 0 00-.712-3.714M14 40H4v-4a6 6 0 0110.712-3.714M14 40v-4a9.971 9.971 0 01.712-3.714M34 40v-4a9.971 9.971 0 00-.712-3.714M14 40v-4a9.971 9.971 0 01.712-3.714m7.44-6.758a4.5 4.5 0 00-.08-1.423" />
            </svg>
            <p className="mt-2 text-sm text-gray-500">No recent activity</p>
          </div>
        ) : (
          <div className="flow-root">
            <ul className="-mb-8">
              {activities.map((activity, index) => (
                <li key={activity.id}>
                  <div className="relative pb-8">
                    {index !== activities.length - 1 ? (
                      <span className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-gray-200" aria-hidden="true" />
                    ) : null}
                    
                    <div className="relative flex space-x-3">
                      <div className={`flex h-8 w-8 items-center justify-center rounded-full ring-8 ring-white ${
                        activity.severity === 'high' ? 'bg-red-100' :
                        activity.severity === 'medium' ? 'bg-yellow-100' :
                        'bg-green-100'
                      }`}>
                        {getActivityIcon(activity.type, activity.severity)}
                      </div>
                      
                      <div className="flex min-w-0 flex-1 justify-between space-x-4 pt-1.5">
                        <div>
                          <p className="text-sm font-medium text-gray-900">{activity.title}</p>
                          <p className="text-sm text-gray-500">{activity.description}</p>
                          {activity.operatorName && (
                            <p className="text-xs text-gray-400 mt-1">Operator: {activity.operatorName}</p>
                          )}
                        </div>
                        
                        <div className="whitespace-nowrap text-right text-sm text-gray-500">
                          <time dateTime={activity.timestamp}>
                            {getTimeAgo(activity.timestamp)}
                          </time>
                          {activity.severity && activity.severity !== 'low' && (
                            <div className={`mt-1 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              activity.severity === 'high' ? 'bg-red-100 text-red-800' :
                              'bg-yellow-100 text-yellow-800'
                            }`}>
                              {activity.severity.toUpperCase()}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}