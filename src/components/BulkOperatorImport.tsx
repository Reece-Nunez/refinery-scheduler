'use client'

import { useState } from 'react'
import { useToast } from '@/contexts/ToastContext'
import axios from 'axios'
import { createBrowserClient } from '@supabase/ssr'

interface BulkOperatorImportProps {
  isOpen: boolean
  onClose: () => void
  onImportComplete: () => void
  jobs: Array<{ id: string; title: string }>
}

export default function BulkOperatorImport({ isOpen, onClose, onImportComplete, jobs }: BulkOperatorImportProps) {
  const { showToast } = useToast()
  const [csvText, setCsvText] = useState('')
  const [loading, setLoading] = useState(false)
  const [previewData, setPreviewData] = useState<any[]>([])
  const [errors, setErrors] = useState<string[]>([])

  const formatPhoneNumber = (value: string) => {
    // Remove all non-numeric characters
    const cleaned = value.replace(/\D/g, '')
    // Format as XXX-XXX-XXXX
    if (cleaned.length <= 3) return cleaned
    if (cleaned.length <= 6) return `${cleaned.slice(0, 3)}-${cleaned.slice(3)}`
    return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6, 10)}`
  }

  const downloadTemplate = () => {
    const jobTitles = jobs.map(j => j.title).join(', ')
    const template = `Name,Employee ID,Email,Phone,Team,Role,Letter,Trained Jobs
John Doe,EMP001,john.doe@example.com,555-123-4567,A,Operator,G,"VRU Console, Pumper"
Jane Smith,EMP002,jane.smith@example.com,555-123-4568,B,Operator,H,"FCC Console, Butamer"
Bob Green,EMP003,bob.green@example.com,555-123-4569,C,APS,,"VRU Console, FCC Console, Pumper"

# Instructions:
# - Name: Full name of operator (required)
# - Employee ID: Unique employee identifier (required)
# - Email: Email address (required)
# - Phone: Phone number (optional)
# - Team: A, B, C, or D (required)
# - Role: Operator or APS (required)
# - Letter: Single letter for operators (A-Z), leave empty for APS
# - Trained Jobs: Comma-separated list of job titles (must match existing jobs)
#
# Available Jobs: ${jobTitles}
`
    const blob = new Blob([template], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'operator_import_template.csv'
    a.click()
    window.URL.revokeObjectURL(url)
    showToast('Template downloaded', 'success')
  }

  const parseCSV = (text: string) => {
    const lines = text.split('\n').filter(line => line.trim() && !line.trim().startsWith('#'))
    if (lines.length < 2) {
      setErrors(['CSV must have at least a header row and one data row'])
      return []
    }

    const headers = lines[0].split(',').map(h => h.trim())
    const requiredHeaders = ['Name', 'Employee ID', 'Email', 'Team', 'Role']
    const missingHeaders = requiredHeaders.filter(h => !headers.includes(h))

    if (missingHeaders.length > 0) {
      setErrors([`Missing required columns: ${missingHeaders.join(', ')}`])
      return []
    }

    const data: any[] = []
    const parseErrors: string[] = []

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line) continue

      // Handle quoted values with commas
      const values: string[] = []
      let currentValue = ''
      let inQuotes = false

      for (let char of line) {
        if (char === '"') {
          inQuotes = !inQuotes
        } else if (char === ',' && !inQuotes) {
          values.push(currentValue.trim())
          currentValue = ''
        } else {
          currentValue += char
        }
      }
      values.push(currentValue.trim())

      const row: any = {}
      headers.forEach((header, index) => {
        row[header] = values[index] || ''
      })

      // Validate row
      const rowNum = i + 1
      if (!row['Name']) parseErrors.push(`Row ${rowNum}: Name is required`)
      if (!row['Employee ID']) parseErrors.push(`Row ${rowNum}: Employee ID is required`)
      if (!row['Email']) parseErrors.push(`Row ${rowNum}: Email is required`)
      if (!row['Team'] || !['A', 'B', 'C', 'D'].includes(row['Team'])) {
        parseErrors.push(`Row ${rowNum}: Team must be A, B, C, or D`)
      }
      if (!row['Role'] || !['Operator', 'APS'].includes(row['Role'])) {
        parseErrors.push(`Row ${rowNum}: Role must be Operator or APS`)
      }
      if (row['Role'] === 'Operator' && !row['Letter']) {
        parseErrors.push(`Row ${rowNum}: Letter is required for Operators`)
      }

      data.push(row)
    }

    setErrors(parseErrors)
    return data
  }

  const handlePreview = () => {
    const data = parseCSV(csvText)
    setPreviewData(data)
  }

  const handleImport = async () => {
    if (previewData.length === 0) {
      showToast('No data to import', 'error')
      return
    }

    if (errors.length > 0) {
      showToast('Please fix errors before importing', 'error')
      return
    }

    setLoading(true)
    try {
      // Get auth token
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      const headers = token ? { Authorization: `Bearer ${token}` } : undefined

      // Convert CSV data to operator format
      const operators = previewData.map(row => {
        // Parse trained jobs
        const trainedJobTitles = row['Trained Jobs']
          ? row['Trained Jobs'].split(',').map((t: string) => t.trim()).filter((t: string) => t)
          : []

        const trainedJobIds = trainedJobTitles
          .map((title: string) => jobs.find(j => j.title === title)?.id)
          .filter((id: string | undefined) => id)

        return {
          name: row['Name'],
          employeeId: row['Employee ID'],
          email: row['Email'],
          phone: row['Phone'] ? formatPhoneNumber(row['Phone']) : null,
          team: row['Team'],
          role: row['Role'],
          letter: row['Role'] === 'APS' ? null : row['Letter'],
          trainedJobIds
        }
      })

      // Import operators via API
      const response = await axios.post('/api/operators/bulk', { operators }, { headers })

      showToast(`Successfully imported ${response.data.created} operator(s)`, 'success')

      if (response.data.failed > 0) {
        showToast(`Failed to import ${response.data.failed} operator(s)`, 'warning')
      }

      setCsvText('')
      setPreviewData([])
      setErrors([])
      onImportComplete()
      onClose()

    } catch (err: any) {
      const errorMsg = err.response?.data?.error || 'Failed to import operators'
      showToast(errorMsg, 'error')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Bulk Import Operators</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl"
              disabled={loading}
            >
              ×
            </button>
          </div>

          {/* Instructions */}
          <div className="mb-6 bg-blue-50 border border-blue-200 rounded-md p-4">
            <h3 className="text-sm font-medium text-blue-800 mb-2">How to import operators:</h3>
            <ol className="text-sm text-blue-700 space-y-1 list-decimal list-inside">
              <li>Download the CSV template</li>
              <li>Fill in operator information (one operator per row)</li>
              <li>Paste the CSV content below or upload the file</li>
              <li>Click "Preview" to validate the data</li>
              <li>Click "Import" to add operators to the system</li>
            </ol>
          </div>

          {/* Download Template Button */}
          <div className="mb-4">
            <button
              onClick={downloadTemplate}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              📥 Download CSV Template
            </button>
          </div>

          {/* CSV Input */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Paste CSV Content or Upload File
            </label>
            <textarea
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              placeholder="Paste CSV content here..."
              className="w-full h-40 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 text-gray-900 font-mono text-sm"
              disabled={loading}
            />
            <input
              type="file"
              accept=".csv"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) {
                  const reader = new FileReader()
                  reader.onload = (event) => {
                    setCsvText(event.target?.result as string)
                  }
                  reader.readAsText(file)
                }
              }}
              className="mt-2 text-sm text-gray-600"
            />
          </div>

          {/* Preview Button */}
          <div className="mb-4">
            <button
              onClick={handlePreview}
              disabled={!csvText || loading}
              className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              👁️ Preview Data
            </button>
          </div>

          {/* Errors */}
          {errors.length > 0 && (
            <div className="mb-4 bg-red-50 border border-red-200 rounded-md p-4">
              <h3 className="text-sm font-medium text-red-800 mb-2">Validation Errors:</h3>
              <ul className="text-sm text-red-700 space-y-1">
                {errors.map((error, index) => (
                  <li key={index}>• {error}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Preview Table */}
          {previewData.length > 0 && (
            <div className="mb-4">
              <h3 className="text-sm font-medium text-gray-700 mb-2">
                Preview ({previewData.length} operator{previewData.length > 1 ? 's' : ''})
              </h3>
              <div className="border border-gray-300 rounded-md overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-300">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Emp ID</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Team</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Letter</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Jobs</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {previewData.map((row, index) => (
                      <tr key={index}>
                        <td className="px-3 py-2 text-sm text-gray-900">{row['Name']}</td>
                        <td className="px-3 py-2 text-sm text-gray-900">{row['Employee ID']}</td>
                        <td className="px-3 py-2 text-sm text-gray-900">{row['Email']}</td>
                        <td className="px-3 py-2 text-sm text-gray-900">{row['Team']}</td>
                        <td className="px-3 py-2 text-sm text-gray-900">{row['Role']}</td>
                        <td className="px-3 py-2 text-sm text-gray-900">{row['Letter']}</td>
                        <td className="px-3 py-2 text-sm text-gray-900">{row['Trained Jobs']}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

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
              onClick={handleImport}
              disabled={loading || previewData.length === 0 || errors.length > 0}
              className="px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-black hover:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Importing...' : `Import ${previewData.length} Operator${previewData.length > 1 ? 's' : ''}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
