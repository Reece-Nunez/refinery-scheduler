'use client'

import { useState, useEffect } from 'react'
import OperatorCard from '@/components/OperatorCard'
import OperatorModal from '@/components/OperatorModal'
import OperatorDetailModal from '@/components/OperatorDetailModal'
import OperatorAnalytics from '@/components/OperatorAnalytics'
import BulkOperatorImport from '@/components/BulkOperatorImport'
import BulkEditOperators from '@/components/BulkEditOperators'
import { useToast } from '@/contexts/ToastContext'

interface Job {
  id: string
  title: string
  description: string
}

interface Operator {
  id: string
  name: string
  employeeId: string
  role: string
  team: string
  email: string
  trainedJobs: Job[]
  createdAt: string
  status: 'active' | 'inactive' | 'on_leave'
  certifications?: string[]
  contactInfo?: {
    phone: string
    emergencyContact: string
  }
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

export default function OperatorsPage() {
  const { showToast } = useToast()
  const [operators, setOperators] = useState<Operator[]>([])
  const [jobs, setJobs] = useState<Job[]>([])
  const [shifts, setShifts] = useState<Shift[]>([])
  const [loading, setLoading] = useState(true)
  const [role, setRole] = useState<'ADMIN' | 'OPER'>('OPER')
  
  // UI State
  const [view, setView] = useState<'grid' | 'table'>('grid')
  const [searchTerm, setSearchTerm] = useState('')
  const [teamFilter, setTeamFilter] = useState<string>('all')
  const [roleFilter, setRoleFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  
  // Modal State
  const [showAddModal, setShowAddModal] = useState(false)
  const [showBulkImport, setShowBulkImport] = useState(false)
  const [showBulkEdit, setShowBulkEdit] = useState(false)
  const [editingOperator, setEditingOperator] = useState<Operator | null>(null)
  const [viewingOperator, setViewingOperator] = useState<Operator | null>(null)
  const [selectedOperators, setSelectedOperators] = useState<string[]>([])

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    const fetchRole = async () => {
      try {
        const { createBrowserClient } = await import('@supabase/ssr')
        const supabase = createBrowserClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        )
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.user?.id) {
          const { data } = await supabase.from('users').select('role').eq('id', session.user.id).single()
          if (data?.role) setRole(data.role as any)
        }
      } catch {}
    }
    fetchRole()
  }, [])

  const formatPhoneNumber = (value: string) => {
    if (!value) return ''
    // Remove all non-numeric characters
    const cleaned = value.replace(/\D/g, '')
    // Format as XXX-XXX-XXXX
    if (cleaned.length <= 3) return cleaned
    if (cleaned.length <= 6) return `${cleaned.slice(0, 3)}-${cleaned.slice(3)}`
    return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6, 10)}`
  }

  const loadData = async () => {
    try {
      const [operatorsRes, jobsRes, shiftsRes] = await Promise.all([
        fetch('/api/operators'),
        fetch('/api/jobs'),
        fetch('/api/shifts')
      ])

      const operatorsData = await operatorsRes.json()
      const jobsData = await jobsRes.json()
      const shiftsData = await shiftsRes.json()

      // Add mock status and additional fields for enhanced operators
      const enhancedOperators = operatorsData.map((op: any) => ({
        ...op,
        status: 'active' as const,
        email: op.email || `${op.employeeId.toLowerCase()}@refinery.com`,
        certifications: ['Basic Safety', 'Process Control'],
        contactInfo: {
          phone: op.phone ? formatPhoneNumber(op.phone) : '',
          emergencyContact: 'Emergency Contact'
        },
        createdAt: new Date().toISOString()
      }))

      // Calculate duration for each shift and add status
      const enhancedShifts = shiftsData.map((shift: any) => {
        const start = new Date(shift.startTime)
        const end = new Date(shift.endTime)
        const duration = (end.getTime() - start.getTime()) / (1000 * 60 * 60) // Convert to hours
        return {
          ...shift,
          duration,
          status: 'completed',
          violations: shift.violations || []
        }
      })

      setOperators(enhancedOperators)
      setJobs(jobsData)
      setShifts(enhancedShifts)
    } catch (error) {
      console.error('Failed to load data:', error)
    } finally {
      setLoading(false)
    }
  }

  // Filter operators based on search and filters
  const filteredOperators = operators.filter(operator => {
    const matchesSearch = operator.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         operator.employeeId.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesTeam = teamFilter === 'all' || operator.team === teamFilter
    const matchesRole = roleFilter === 'all' || operator.role === roleFilter
    const matchesStatus = statusFilter === 'all' || operator.status === statusFilter

    return matchesSearch && matchesTeam && matchesRole && matchesStatus
  })

  const handleOperatorSaved = () => {
    loadData()
    setShowAddModal(false)
    setEditingOperator(null)
  }

  const handleOperatorDeleted = (operatorId: string) => {
    setOperators(operators.filter(op => op.id !== operatorId))
    showToast('Operator deleted successfully', 'success')
  }

  const toggleSelectOperator = (operatorId: string) => {
    setSelectedOperators(prev => 
      prev.includes(operatorId) 
        ? prev.filter(id => id !== operatorId)
        : [...prev, operatorId]
    )
  }

  const selectAllOperators = () => {
    if (selectedOperators.length === filteredOperators.length) {
      setSelectedOperators([])
    } else {
      setSelectedOperators(filteredOperators.map(op => op.id))
    }
  }

  const teams = ['A', 'B', 'C', 'D']
  const roles = [...new Set(operators.map(op => op.role))]
  const statuses = ['active', 'inactive', 'on_leave']

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-black mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading operators...</p>
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
                <h1 className="text-3xl font-bold text-gray-900">Operators</h1>
                <p className="mt-1 text-sm text-gray-600">
                  Manage refinery operators, certifications, and assignments
                </p>
              </div>
              <div className="flex items-center space-x-4">
                {role === 'ADMIN' && (
                  <>
                    <button
                      onClick={() => setShowAddModal(true)}
                      className="bg-black hover:bg-gray-900 text-white px-4 py-2 rounded-lg flex items-center transition duration-200"
                    >
                      <svg className="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                      Add Operator
                    </button>
                    <button
                      onClick={() => setShowBulkImport(true)}
                      className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                    >
                      <svg className="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                      Bulk Import
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 sm:px-6 lg:px-8 py-6">
        {/* Analytics Overview */}
        <OperatorAnalytics operators={operators} shifts={shifts} />

        {/* Filters and Search */}
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
            {/* Search */}
            <div className="lg:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
              <div className="relative">
                <svg className="absolute left-3 top-3 h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  placeholder="Search operators..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>
            </div>

            {/* Team Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Team</label>
              <select
                value={teamFilter}
                onChange={(e) => setTeamFilter(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                <option value="all">All Teams</option>
                {teams.map(team => (
                  <option key={team} value={team}>Team {team}</option>
                ))}
              </select>
            </div>

            {/* Role Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Role</label>
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                <option value="all">All Roles</option>
                {roles.map(role => (
                  <option key={role} value={role}>{role}</option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                <option value="all">All Status</option>
                {statuses.map(status => (
                  <option key={status} value={status}>
                    {status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')}
                  </option>
                ))}
              </select>
            </div>

            {/* View Toggle */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">View</label>
              <div className="flex border border-gray-300 rounded-lg">
                <button
                  onClick={() => setView('grid')}
                  className={`flex-1 py-2 px-3 rounded-l-lg ${
                    view === 'grid' ? 'bg-black text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
                  } transition duration-200`}
                >
                  <svg className="h-4 w-4 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                  </svg>
                </button>
                <button
                  onClick={() => setView('table')}
                  className={`flex-1 py-2 px-3 rounded-r-lg ${
                    view === 'table' ? 'bg-black text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
                  } transition duration-200`}
                >
                  <svg className="h-4 w-4 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {/* Results Summary and Bulk Actions */}
          <div className="mt-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="text-sm text-gray-600">
                Showing {filteredOperators.length} of {operators.length} operators
                {selectedOperators.length > 0 && (
                  <span className="ml-2 text-red-600 font-medium">
                    ({selectedOperators.length} selected)
                  </span>
                )}
              </div>
              {role === 'ADMIN' && filteredOperators.length > 0 && (
                <button
                  onClick={selectAllOperators}
                  className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                >
                  {selectedOperators.length === filteredOperators.length ? 'Deselect All' : 'Select All'}
                </button>
              )}
            </div>

            {selectedOperators.length > 0 && role === 'ADMIN' && (
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setShowBulkEdit(true)}
                  className="text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1 rounded transition duration-200"
                >
                  Bulk Edit
                </button>
                <button className="text-sm bg-red-100 hover:bg-red-200 text-red-700 px-3 py-1 rounded transition duration-200">
                  Bulk Delete
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Operators Display */}
        {view === 'grid' ? (
          /* Grid View */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredOperators.map(operator => (
              <OperatorCard
                key={operator.id}
                operator={operator}
                jobs={jobs}
                isSelected={selectedOperators.includes(operator.id)}
                onSelect={() => toggleSelectOperator(operator.id)}
                onEdit={() => setEditingOperator(operator)}
                onViewDetails={() => setViewingOperator(operator)}
                onDelete={() => handleOperatorDeleted(operator.id)}
                canManage={role === 'ADMIN'}
              />
            ))}
          </div>
        ) : (
          /* Table View */
          <div className="bg-white shadow rounded-lg overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {role === 'ADMIN' && (
                    <th className="px-6 py-3 text-left">
                      <input
                        type="checkbox"
                        checked={selectedOperators.length === filteredOperators.length && filteredOperators.length > 0}
                        onChange={selectAllOperators}
                        className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded"
                      />
                    </th>
                  )}
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Operator
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Team & Role
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Certifications
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredOperators.map((operator) => (
                  <tr key={operator.id} className="hover:bg-gray-50">
                    {role === 'ADMIN' && (
                      <td className="px-6 py-4">
                        <input
                          type="checkbox"
                          checked={selectedOperators.includes(operator.id)}
                          onChange={() => toggleSelectOperator(operator.id)}
                          className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded"
                        />
                      </td>
                    )}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="h-10 w-10 flex-shrink-0">
                          <div className="h-10 w-10 rounded-full bg-black flex items-center justify-center">
                            <span className="text-sm font-medium text-white">
                              {operator.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">{operator.name}</div>
                          <div className="text-sm text-gray-500">{operator.employeeId}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">Team {operator.team}</div>
                      <div className="text-sm text-gray-500">{operator.role}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {operator.trainedJobs.slice(0, 2).map((job) => (
                          <span key={job.id} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                            {job.title}
                          </span>
                        ))}
                        {operator.trainedJobs.length > 2 && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                            +{operator.trainedJobs.length - 2}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        operator.status === 'active' ? 'bg-green-100 text-green-800' :
                        operator.status === 'inactive' ? 'bg-red-100 text-red-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {operator.status === 'on_leave' ? 'On Leave' : operator.status.charAt(0).toUpperCase() + operator.status.slice(1)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => setViewingOperator(operator)}
                          className="text-gray-900 hover:text-gray-700 transition duration-200"
                        >
                          View
                        </button>
                        {role === 'ADMIN' && (
                          <button
                            onClick={() => setEditingOperator(operator)}
                            className="text-gray-700 hover:text-gray-900 transition duration-200"
                          >
                            Edit
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {filteredOperators.length === 0 && (
          <div className="text-center py-12">
            <svg className="mx-auto h-12 w-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 48 48">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M34 40h10v-4a6 6 0 00-10.712-3.714M34 40H14m20 0v-4a9.971 9.971 0 00-.712-3.714M14 40H4v-4a6 6 0 0110.712-3.714M14 40v-4a9.971 9.971 0 01.712-3.714M34 40v-4a9.971 9.971 0 00-.712-3.714M14 40v-4a9.971 9.971 0 01.712-3.714m7.44-6.758a4.5 4.5 0 00-.08-1.423" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No operators found</h3>
            <p className="mt-1 text-sm text-gray-500">
              {searchTerm || teamFilter !== 'all' || roleFilter !== 'all' || statusFilter !== 'all'
                ? 'Try adjusting your search criteria or filters.'
                : 'Get started by adding your first operator.'}
            </p>
            {role === 'ADMIN' && !searchTerm && teamFilter === 'all' && roleFilter === 'all' && statusFilter === 'all' && (
              <div className="mt-6">
                <button
                  onClick={() => setShowAddModal(true)}
                  className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-black hover:bg-gray-900 transition duration-200"
                >
                  <svg className="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  Add Operator
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modals */}
      {showAddModal && (
        <OperatorModal
          isOpen={showAddModal}
          onClose={() => setShowAddModal(false)}
          onSave={handleOperatorSaved}
          jobs={jobs}
        />
      )}

      {editingOperator && (
        <OperatorModal
          isOpen={!!editingOperator}
          onClose={() => setEditingOperator(null)}
          onSave={handleOperatorSaved}
          operator={editingOperator}
          jobs={jobs}
        />
      )}

      {viewingOperator && (
        <OperatorDetailModal
          isOpen={!!viewingOperator}
          onClose={() => setViewingOperator(null)}
          operator={viewingOperator}
          onEdit={(op) => {
            setViewingOperator(null)
            setEditingOperator(op)
          }}
          canManage={role === 'ADMIN'}
        />
      )}

      {/* Bulk Import Modal */}
      <BulkOperatorImport
        isOpen={showBulkImport}
        onClose={() => setShowBulkImport(false)}
        onImportComplete={() => {
          loadData()
          setShowBulkImport(false)
        }}
        jobs={jobs}
      />

      {/* Bulk Edit Modal */}
      <BulkEditOperators
        isOpen={showBulkEdit}
        onClose={() => setShowBulkEdit(false)}
        onComplete={() => {
          loadData()
          setShowBulkEdit(false)
          setSelectedOperators([])
        }}
        selectedOperators={operators.filter(op => selectedOperators.includes(op.id))}
        jobs={jobs}
      />
    </div>
  )
}

