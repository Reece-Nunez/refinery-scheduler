'use client'

import { useState, useEffect } from 'react'
import axios from 'axios'

interface RP755Rule {
  id: string
  category: 'normal' | 'outage' | 'exception'
  name: string
  description: string
  limit: number
  unit: string
  enabled: boolean
  isHighRisk?: boolean
}

const rp755Rules: RP755Rule[] = [
  // Normal Operations Rules
  {
    id: 'shift_length',
    category: 'normal',
    name: 'Maximum Shift Length',
    description: 'Total hours (including hand-offs, holdovers, and overtime) shall not exceed 14 hours per shift',
    limit: 14,
    unit: 'hours per shift',
    enabled: true
  },
  {
    id: 'work_set_normal',
    category: 'normal', 
    name: 'Work-set Hour Limit (Normal Operations)',
    description: 'Total hours shall not exceed 92 hours per work-set (105 hours for straight day assignments)',
    limit: 92,
    unit: 'hours per work-set',
    enabled: true
  },
  {
    id: 'rest_period_normal',
    category: 'normal',
    name: 'Minimum Rest Period (Normal)',
    description: 'Work-set complete when employee is off work for at least 34 hours (46 hours if 4+ night shifts)',
    limit: 34,
    unit: 'hours off work',
    enabled: true
  },
  {
    id: 'minimum_rest',
    category: 'normal',
    name: 'Minimum Rest Between Shifts',
    description: 'Minimum 8 hours off between shifts (RP-755 best practice)',
    limit: 8,
    unit: 'hours off work',
    enabled: true
  },
  {
    id: 'consecutive_shifts_12hr',
    category: 'normal',
    name: 'Maximum Consecutive 12-Hour Shifts',
    description: 'Maximum 7 consecutive 12-hour shifts during normal operations',
    limit: 7,
    unit: 'consecutive shifts',
    enabled: true
  },
  {
    id: 'consecutive_shifts_10hr',
    category: 'normal',
    name: 'Maximum Consecutive 10-Hour Shifts',
    description: 'Maximum 9 consecutive 10-hour shifts during normal operations',
    limit: 9,
    unit: 'consecutive shifts',
    enabled: true
  },
  {
    id: 'consecutive_shifts_8hr',
    category: 'normal',
    name: 'Maximum Consecutive 8-Hour Shifts',
    description: 'Maximum 10 consecutive 8-hour shifts during normal operations',
    limit: 10,
    unit: 'consecutive shifts',
    enabled: true
  },

  // Outage Rules
  {
    id: 'work_set_outage',
    category: 'outage',
    name: 'Work-set Hour Limit (Outages)',
    description: 'Total hours shall not exceed 182 hours per work-set during planned outages',
    limit: 182,
    unit: 'hours per work-set',
    enabled: true
  },
  {
    id: 'rest_period_outage',
    category: 'outage',
    name: 'Minimum Rest Period (Outages)',
    description: 'Work-set complete when employee is off work for at least 34 hours after the work-set',
    limit: 34,
    unit: 'hours off work',
    enabled: true
  },
  {
    id: 'consecutive_shifts_12hr_outage',
    category: 'outage',
    name: 'Maximum Consecutive 12-Hour Shifts (Outages)',
    description: 'Maximum 14 consecutive 12-hour shifts during planned outages',
    limit: 14,
    unit: 'consecutive shifts',
    enabled: true
  },
  {
    id: 'consecutive_shifts_10hr_outage',
    category: 'outage',
    name: 'Maximum Consecutive 10-Hour Shifts (Outages)',
    description: 'Maximum 14 consecutive 10-hour shifts during planned outages',
    limit: 14,
    unit: 'consecutive shifts',
    enabled: true
  },
  {
    id: 'consecutive_shifts_8hr_outage',
    category: 'outage',
    name: 'Maximum Consecutive 8-Hour Shifts (Outages)',
    description: 'Maximum 19 consecutive 8-hour shifts during planned outages',
    limit: 19,
    unit: 'consecutive shifts',
    enabled: true
  },

  // High Risk Exception Thresholds
  {
    id: 'high_risk_shift',
    category: 'exception',
    name: 'High Risk - Extended Shift',
    description: 'Work more than 18 hours in a single shift requires senior management notification',
    limit: 18,
    unit: 'hours per shift',
    enabled: true,
    isHighRisk: true
  },
  {
    id: 'high_risk_rest',
    category: 'exception',
    name: 'High Risk - Insufficient Rest',
    description: 'Return to work prior to having 8 hours off requires senior management notification',
    limit: 8,
    unit: 'hours off work',
    enabled: true,
    isHighRisk: true
  },
  {
    id: 'high_risk_extended',
    category: 'exception',
    name: 'High Risk - Multiple Extended Shifts',
    description: 'Work more than one extended shift (>14 hours) per work-set requires senior management notification',
    limit: 1,
    unit: 'extended shifts per work-set',
    enabled: true,
    isHighRisk: true
  }
]

export default function FatiguePage() {
  const [rules, setRules] = useState<RP755Rule[]>([])
  const [activeTab, setActiveTab] = useState<'normal' | 'outage' | 'exception'>('normal')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch rules from API on mount
  useEffect(() => {
    fetchRules()
  }, [])

  const fetchRules = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await axios.get('/api/rp755-rules')
      const fetchedRules = response.data.map((rule: any) => ({
        id: rule.id,
        category: rule.category,
        name: rule.name,
        description: rule.description,
        limit: rule.limit,
        unit: rule.unit,
        enabled: rule.enabled,
        isHighRisk: rule.is_high_risk
      }))
      setRules(fetchedRules)
    } catch (err: any) {
      console.error('Failed to fetch RP-755 rules:', err)
      setError(err.response?.data?.error || 'Failed to load RP-755 rules')
    } finally {
      setLoading(false)
    }
  }

  const saveRules = async () => {
    try {
      setSaving(true)
      setError(null)

      // Save each modified rule
      for (const rule of rules) {
        await axios.put(`/api/rp755-rules?id=${rule.id}`, {
          limit: rule.limit,
          unit: rule.unit,
          enabled: rule.enabled
        })
      }

      alert('RP-755 rules updated successfully!')
    } catch (err: any) {
      console.error('Failed to save RP-755 rules:', err)
      setError(err.response?.data?.error || 'Failed to save RP-755 rules')
      alert('Failed to save RP-755 rules. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const toggleRule = (id: string) => {
    setRules(rules.map(rule => 
      rule.id === id ? { ...rule, enabled: !rule.enabled } : rule
    ))
  }

  const updateRule = (id: string, field: keyof RP755Rule, value: any) => {
    setRules(rules.map(rule =>
      rule.id === id ? { ...rule, [field]: value } : rule
    ))
  }

  const getRulesByCategory = (category: 'normal' | 'outage' | 'exception') => {
    return rules.filter(rule => rule.category === category)
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">API RP 755 Fatigue Risk Management System</h1>
        <p className="text-gray-600 mt-2">
          Fatigue Risk Management Systems for Personnel in the Refining and Petrochemical Industries (2nd Edition)
        </p>
      </div>

      <div className="bg-gray-100 border border-gray-200 rounded-lg p-4 mb-6">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-gray-700" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-gray-900">RP 755 Compliance</h3>
            <div className="mt-2 text-sm text-gray-700">
              <p>This system implements API RP 755 requirements for process safety sensitive personnel. All scheduling must comply with these fatigue management rules.</p>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error</h3>
              <div className="mt-2 text-sm text-red-700">
                <p>{error}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="mb-6">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            {[
              { id: 'normal', name: 'Normal Operations', count: getRulesByCategory('normal').length },
              { id: 'outage', name: 'Outages', count: getRulesByCategory('outage').length },
              { id: 'exception', name: 'High-Risk Exceptions', count: getRulesByCategory('exception').length }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.id
                    ? 'border-black text-black'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.name} ({tab.count})
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Rules Display */}
      {loading ? (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black"></div>
        </div>
      ) : (
        <div className="space-y-6">
          {getRulesByCategory(activeTab).map((rule) => (
          <div key={rule.id} className={`bg-white border rounded-lg p-6 ${
            rule.isHighRisk ? 'border-red-200 bg-red-50' : 'border-gray-200'
          }`}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  checked={rule.enabled}
                  onChange={() => toggleRule(rule.id)}
                  className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded"
                />
                <div>
                  <h3 className="text-lg font-medium text-gray-900">{rule.name}</h3>
                  {rule.isHighRisk && (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 mt-1">
                      High Risk - Senior Management Notification Required
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                  rule.enabled 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-gray-100 text-gray-800'
                }`}>
                  {rule.enabled ? 'Active' : 'Inactive'}
                </span>
                <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                  rule.category === 'normal' ? 'bg-gray-100 text-gray-800' :
                  rule.category === 'outage' ? 'bg-purple-100 text-purple-800' :
                  'bg-red-100 text-red-800'
                }`}>
                  {rule.category === 'normal' ? 'Normal Ops' : 
                   rule.category === 'outage' ? 'Outage' : 'Exception'}
                </span>
              </div>
            </div>
            
            <p className="text-gray-600 mb-4">{rule.description}</p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Limit
                </label>
                <input
                  type="number"
                  value={rule.limit}
                  onChange={(e) => updateRule(rule.id, 'limit', parseInt(e.target.value))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500"
                  disabled={!rule.enabled}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Unit
                </label>
                <input
                  type="text"
                  value={rule.unit}
                  onChange={(e) => updateRule(rule.id, 'unit', e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500"
                  disabled={!rule.enabled}
                />
              </div>
            </div>
            
            {rule.isHighRisk && (
              <div className="mt-4 p-3 bg-red-100 border border-red-200 rounded-md">
                <h4 className="text-sm font-medium text-red-800 mb-1">High-Risk Exception Requirements:</h4>
                <ul className="text-xs text-red-700 space-y-1">
                  <li>• Immediate supervisor approval required</li>
                  <li>• Another management representative approval required</li>
                  <li>• Risk assessment must be documented</li>
                  <li>• Mitigation plan must be in place</li>
                  <li>• Senior site management notification required by next business day</li>
                </ul>
              </div>
            )}
          </div>
          ))}
        </div>
      )}

      <div className="mt-8 flex justify-between">
        <div className="text-sm text-gray-500">
          <p className="font-medium">API RP 755 Key Requirements:</p>
          <ul className="mt-2 space-y-1">
            <li>• Applies to all process safety sensitive personnel</li>
            <li>• Includes night shifts, rotating shifts, extended hours/days, and call-outs</li>
            <li>• All call-outs count towards hours-of-service limits</li>
            <li>• Exception process required when limits are exceeded</li>
          </ul>
        </div>
        
        <button
          className="bg-black text-white px-6 py-2 rounded-lg hover:bg-gray-900 transition duration-200 disabled:bg-gray-400 disabled:cursor-not-allowed"
          onClick={saveRules}
          disabled={saving || loading}
        >
          {saving ? 'Saving...' : 'Save RP-755 Configuration'}
        </button>
      </div>
    </div>
  )
}
