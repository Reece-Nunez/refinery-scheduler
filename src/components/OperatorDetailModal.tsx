'use client'

import { useEffect, useState } from 'react'
import axios from 'axios'

interface Job {
  id: string
  title: string
}

interface Shift {
  id: string
  operatorId: string
  jobId: string
  jobTitle: string
  startTime: string
  endTime: string
  duration: number
  violations?: any[]
  isOverridden?: boolean
  status: string
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
  email?: string
  status: string
  lastActive?: string
  createdAt?: string
  consoles?: string[]
}

interface OperatorDetailModalProps {
  isOpen: boolean
  onClose: () => void
  operator: Operator | null
  onEdit: (operator: Operator) => void
  canManage?: boolean
}

export default function OperatorDetailModal({ isOpen, onClose, operator, onEdit, canManage = true }: OperatorDetailModalProps) {
  const [shifts, setShifts] = useState<Shift[]>([])
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'overview' | 'shifts' | 'performance'>('overview')

  useEffect(() => {
    if (isOpen && operator) {
      fetchShifts()
    }
  }, [isOpen, operator])

  const fetchShifts = async () => {
    if (!operator) return
    
    setLoading(true)
    try {
      const res = await axios.get(`/api/shifts?operatorId=${operator.id}`)
      setShifts(res.data || [])
    } catch (err) {
      console.error('Error fetching shifts:', err)
      setShifts([])
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen || !operator) return null

  const recentShifts = shifts.slice(0, 10)
  const totalShifts = shifts.length
  const totalHours = shifts.reduce((acc, shift) => acc + shift.duration, 0)
  const averageHours = totalShifts > 0 ? (totalHours / totalShifts).toFixed(1) : '0'
  const violationsCount = shifts.filter(shift => shift.violations && shift.violations.length > 0).length
  const overridesCount = shifts.filter(shift => shift.isOverridden).length

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active': return 'bg-green-100 text-green-800 border-green-200'
      case 'inactive': return 'bg-red-100 text-red-800 border-red-200'
      case 'on-leave': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getShiftStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed': return 'bg-green-100 text-green-800'
      case 'in-progress': return 'bg-gray-100 text-gray-800'
      case 'scheduled': return 'bg-gray-100 text-gray-800'
      case 'cancelled': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="flex-shrink-0">
                <div className="w-16 h-16 bg-black rounded-full flex items-center justify-center text-white text-xl font-bold">
                  {operator.name.split(' ').map(n => n[0]).join('').substring(0, 2)}
                </div>
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">{operator.name}</h2>
                <p className="text-sm text-gray-700">Employee ID: {operator.employeeId}</p>
                {operator.phone && <p className="text-sm text-gray-600">Phone: {operator.phone}</p>}
                <div className="flex items-center space-x-2 mt-1">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(operator.status)}`}>
                    {operator.status}
                  </span>
                  <span className="text-sm text-gray-700">Team {operator.team}</span>
                  <span className="text-sm text-gray-600">•</span>
                  <span className="text-sm text-gray-700">{operator.role}</span>
                  {operator.letter && (
                    <>
                      <span className="text-sm text-gray-600">•</span>
                      <span className="text-sm text-gray-700">Schedule Code: {operator.letter.toUpperCase()}</span>
                    </>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              {canManage && (
                <button
                  onClick={() => onEdit(operator)}
                  className="px-4 py-2 text-sm font-medium text-gray-900 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                >
                  Edit Operator
                </button>
              )}
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 text-2xl"
              >
                ×
              </button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            {[
              { id: 'overview', label: 'Overview' },
              { id: 'shifts', label: 'Recent Shifts' },
              { id: 'performance', label: 'Performance' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.id
                    ? 'border-black text-black'
                    : 'border-transparent text-gray-600 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 200px)' }}>
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Basic Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Basic Information</h3>
                  <dl className="space-y-3">
                    <div>
                      <dt className="text-sm font-medium text-gray-700">Email</dt>
                      <dd className="text-sm text-gray-900">{operator.email || 'Not provided'}</dd>
                    </div>
                    {operator.phone && (
                      <div>
                        <dt className="text-sm font-medium text-gray-700">Phone Number</dt>
                        <dd className="text-sm text-gray-900">{operator.phone}</dd>
                      </div>
                    )}
                    {operator.letter && (
                      <div>
                        <dt className="text-sm font-medium text-gray-700">Schedule Code</dt>
                        <dd className="text-sm text-gray-900 font-mono text-lg">{operator.letter.toUpperCase()}</dd>
                      </div>
                    )}
                    <div>
                      <dt className="text-sm font-medium text-gray-700">Last Active</dt>
                      <dd className="text-sm text-gray-900">
                        {operator.lastActive ? formatDate(operator.lastActive) : 'Unknown'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-gray-700">Joined</dt>
                      <dd className="text-sm text-gray-900">
                        {operator.createdAt ? formatDate(operator.createdAt) : 'Unknown'}
                      </dd>
                    </div>
                  </dl>
                </div>

                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Quick Stats</h3>
                  <dl className="space-y-3">
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Total Shifts</dt>
                      <dd className="text-2xl font-bold text-gray-900">{totalShifts}</dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Total Hours</dt>
                      <dd className="text-2xl font-bold text-green-600">{totalHours}h</dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Average Shift</dt>
                      <dd className="text-2xl font-bold text-purple-600">{averageHours}h</dd>
                    </div>
                  </dl>
                </div>
              </div>

              {/* Console Training */}
              {operator.consoles && operator.consoles.length > 0 && (
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Console Training</h3>
                  <div className="flex gap-3 mb-6">
                    {operator.consoles.map(console => (
                      <div key={console} className={`flex items-center p-3 border rounded-md ${
                        console === 'FCC' ? 'bg-gray-100 border-gray-200' :
                        console === 'VRU' ? 'bg-purple-50 border-purple-200' :
                        'bg-gray-50 border-gray-200'
                      }`}>
                        <div className="flex-shrink-0">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                            console === 'FCC' ? 'bg-black' :
                            console === 'VRU' ? 'bg-purple-600' :
                            'bg-gray-600'
                          }`}>
                            <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" clipRule="evenodd" />
                            </svg>
                          </div>
                        </div>
                        <div className="ml-3">
                          <p className={`text-sm font-medium ${
                            console === 'VRU' ? 'text-purple-900' :
                            'text-gray-900'
                          }`}>{console} Console</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Trained Jobs */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Trained Jobs ({operator.trainedJobs.length})</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {operator.trainedJobs.map(job => (
                    <div key={job.id} className="flex items-center p-3 bg-gray-100 border border-gray-200 rounded-md">
                      <div className="flex-shrink-0">
                        <div className="w-8 h-8 bg-black rounded-full flex items-center justify-center">
                          <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                        </div>
                      </div>
                      <div className="ml-3">
                        <p className="text-sm font-medium text-gray-900">{job.title}</p>
                      </div>
                    </div>
                  ))}
                  {operator.trainedJobs.length === 0 && (
                    <div className="col-span-full text-center py-8 text-gray-600">
                      <p>No trained jobs assigned</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'shifts' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900">Recent Shifts</h3>
                {loading && <span className="text-sm text-gray-600">Loading...</span>}
              </div>

              {recentShifts.length > 0 ? (
                <div className="space-y-3">
                  {recentShifts.map(shift => (
                    <div key={shift.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="text-md font-medium text-gray-900">{shift.jobTitle}</h4>
                          <p className="text-sm text-gray-600">
                            {formatDate(shift.startTime)} • {formatTime(shift.startTime)} - {formatTime(shift.endTime)}
                          </p>
                          <p className="text-sm text-gray-600">Duration: {shift.duration} hours</p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getShiftStatusColor(shift.status)}`}>
                            {shift.status}
                          </span>
                          {shift.violations && shift.violations.length > 0 && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                              {shift.violations.length} violation{shift.violations.length > 1 ? 's' : ''}
                            </span>
                          )}
                          {shift.isOverridden && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                              Override
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-600">
                  <p>No shifts found</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'performance' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-gray-100 rounded-lg p-6">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <div className="w-8 h-8 bg-black rounded-md flex items-center justify-center">
                        <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                      </div>
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-900">Compliance Rate</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {totalShifts > 0 ? Math.round(((totalShifts - violationsCount) / totalShifts) * 100) : 100}%
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-red-50 rounded-lg p-6">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <div className="w-8 h-8 bg-red-600 rounded-md flex items-center justify-center">
                        <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                      </div>
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-red-900">Policy Violations</p>
                      <p className="text-2xl font-bold text-red-600">{violationsCount}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-yellow-50 rounded-lg p-6">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <div className="w-8 h-8 bg-yellow-600 rounded-md flex items-center justify-center">
                        <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                        </svg>
                      </div>
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-yellow-900">Overrides Used</p>
                      <p className="text-2xl font-bold text-yellow-600">{overridesCount}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Additional Performance Metrics */}
              <div className="bg-gray-50 rounded-lg p-6">
                <h4 className="text-md font-medium text-gray-900 mb-4">Performance Summary</h4>
                <dl className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <dt className="font-medium text-gray-700">Total Hours Worked</dt>
                    <dd className="text-gray-900">{totalHours} hours</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-gray-700">Average Shift Duration</dt>
                    <dd className="text-gray-900">{averageHours} hours</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-gray-700">Jobs Qualified For</dt>
                    <dd className="text-gray-900">{operator.trainedJobs.length} positions</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-gray-700">Current Status</dt>
                    <dd className="text-gray-900">{operator.status}</dd>
                  </div>
                </dl>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
