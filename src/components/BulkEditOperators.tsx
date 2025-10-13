'use client'

import { useState, useEffect } from 'react'
import { useToast } from '@/contexts/ToastContext'
import axios from 'axios'
import { createBrowserClient } from '@supabase/ssr'

interface Job {
  id: string
  title: string
}

interface Operator {
  id: string
  name: string
  employeeId: string
}

interface BulkEditOperatorsProps {
  isOpen: boolean
  onClose: () => void
  onComplete: () => void
  selectedOperators: Operator[]
  jobs: Job[]
}

export default function BulkEditOperators({ isOpen, onClose, onComplete, selectedOperators, jobs }: BulkEditOperatorsProps) {
  const { showToast } = useToast()
  const [loading, setLoading] = useState(false)
  const [selectedJobs, setSelectedJobs] = useState<string[]>([])
  const [mode, setMode] = useState<'add' | 'remove' | 'replace'>('add')

  const toggleJob = (jobId: string) => {
    setSelectedJobs(prev =>
      prev.includes(jobId)
        ? prev.filter(id => id !== jobId)
        : [...prev, jobId]
    )
  }

  const selectAllJobs = () => {
    if (selectedJobs.length === jobs.length) {
      setSelectedJobs([])
    } else {
      setSelectedJobs(jobs.map(j => j.id))
    }
  }

  const handleSubmit = async () => {
    if (selectedJobs.length === 0) {
      showToast('Please select at least one job', 'error')
      return
    }

    setLoading(true)
    try {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      const headers = token ? { Authorization: `Bearer ${token}` } : undefined

      const response = await axios.post('/api/operators/bulk-edit', {
        operatorIds: selectedOperators.map(op => op.id),
        jobIds: selectedJobs,
        mode
      }, { headers })

      showToast(`Successfully updated ${response.data.updated} operator(s)`, 'success')

      if (response.data.failed > 0) {
        showToast(`Failed to update ${response.data.failed} operator(s)`, 'warning')
      }

      onComplete()
      onClose()
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || 'Failed to update operators'
      showToast(errorMsg, 'error')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">
              Bulk Edit Job Training
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl"
              disabled={loading}
            >
              ×
            </button>
          </div>

          {/* Selected Operators Summary */}
          <div className="mb-6 bg-blue-50 border border-blue-200 rounded-md p-4">
            <h3 className="text-sm font-medium text-blue-800 mb-2">
              Editing {selectedOperators.length} operator{selectedOperators.length > 1 ? 's' : ''}:
            </h3>
            <div className="flex flex-wrap gap-2">
              {selectedOperators.slice(0, 10).map(op => (
                <span key={op.id} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  {op.name}
                </span>
              ))}
              {selectedOperators.length > 10 && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  +{selectedOperators.length - 10} more
                </span>
              )}
            </div>
          </div>

          {/* Mode Selection */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Update Mode
            </label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <button
                onClick={() => setMode('add')}
                className={`p-4 border-2 rounded-lg text-left transition ${
                  mode === 'add'
                    ? 'border-green-500 bg-green-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center mb-2">
                  <div className={`w-5 h-5 rounded-full border-2 mr-3 flex items-center justify-center ${
                    mode === 'add' ? 'border-green-500 bg-green-500' : 'border-gray-300'
                  }`}>
                    {mode === 'add' && (
                      <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                  <span className="font-medium text-gray-900">Add Jobs</span>
                </div>
                <p className="text-xs text-gray-600 ml-8">
                  Add selected jobs to operators' existing training
                </p>
              </button>

              <button
                onClick={() => setMode('remove')}
                className={`p-4 border-2 rounded-lg text-left transition ${
                  mode === 'remove'
                    ? 'border-red-500 bg-red-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center mb-2">
                  <div className={`w-5 h-5 rounded-full border-2 mr-3 flex items-center justify-center ${
                    mode === 'remove' ? 'border-red-500 bg-red-500' : 'border-gray-300'
                  }`}>
                    {mode === 'remove' && (
                      <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                  <span className="font-medium text-gray-900">Remove Jobs</span>
                </div>
                <p className="text-xs text-gray-600 ml-8">
                  Remove selected jobs from operators' training
                </p>
              </button>

              <button
                onClick={() => setMode('replace')}
                className={`p-4 border-2 rounded-lg text-left transition ${
                  mode === 'replace'
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center mb-2">
                  <div className={`w-5 h-5 rounded-full border-2 mr-3 flex items-center justify-center ${
                    mode === 'replace' ? 'border-blue-500 bg-blue-500' : 'border-gray-300'
                  }`}>
                    {mode === 'replace' && (
                      <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                  <span className="font-medium text-gray-900">Replace Jobs</span>
                </div>
                <p className="text-xs text-gray-600 ml-8">
                  Replace all training with only selected jobs
                </p>
              </button>
            </div>
          </div>

          {/* Job Selection */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-medium text-gray-700">
                Select Jobs ({selectedJobs.length} selected)
              </label>
              <button
                onClick={selectAllJobs}
                className="text-sm text-blue-600 hover:text-blue-800 font-medium"
              >
                {selectedJobs.length === jobs.length ? 'Deselect All' : 'Select All'}
              </button>
            </div>
            <div className="border border-gray-300 rounded-md p-4 max-h-60 overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {jobs.map(job => (
                  <label key={job.id} className="flex items-center space-x-3 cursor-pointer p-2 hover:bg-gray-50 rounded">
                    <input
                      type="checkbox"
                      checked={selectedJobs.includes(job.id)}
                      onChange={() => toggleJob(job.id)}
                      className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded"
                      disabled={loading}
                    />
                    <span className="text-sm text-gray-700 font-medium">{job.title}</span>
                  </label>
                ))}
              </div>
              {jobs.length === 0 && (
                <p className="text-sm text-gray-600 text-center py-4">No jobs available</p>
              )}
            </div>
          </div>

          {/* Summary */}
          <div className="mb-6 bg-gray-50 border border-gray-200 rounded-md p-4">
            <h3 className="text-sm font-medium text-gray-700 mb-2">Summary</h3>
            <p className="text-sm text-gray-600">
              {mode === 'add' && `Add ${selectedJobs.length} job(s) to ${selectedOperators.length} operator(s)`}
              {mode === 'remove' && `Remove ${selectedJobs.length} job(s) from ${selectedOperators.length} operator(s)`}
              {mode === 'replace' && `Replace all jobs with ${selectedJobs.length} job(s) for ${selectedOperators.length} operator(s)`}
            </p>
          </div>

          {/* Actions */}
          <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading || selectedJobs.length === 0}
              className="px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-black hover:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Updating...' : 'Update Operators'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
