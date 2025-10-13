'use client'

import { useState, useEffect } from 'react'

interface ComplianceData {
  rule: string
  category: 'normal' | 'outage' | 'exception'
  violations: number
  complianceRate: number
  riskLevel: 'low' | 'medium' | 'high'
}

interface ComplianceMonitorProps {
  shifts: any[]
}

export default function ComplianceMonitor({ shifts }: ComplianceMonitorProps) {
  const [complianceData, setComplianceData] = useState<ComplianceData[]>([])
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'normal' | 'outage' | 'exception'>('all')

  useEffect(() => {
    if (shifts.length === 0) return

    // Analyze compliance across different RP-755 rules
    const ruleAnalysis = new Map<string, { violations: number; total: number; category: string }>()

    shifts.forEach(shift => {
      if (shift.violations && shift.violations.length > 0) {
        shift.violations.forEach((violation: any) => {
          const key = violation.rule
          if (!ruleAnalysis.has(key)) {
            ruleAnalysis.set(key, {
              violations: 0,
              total: 0,
              category: shift.isOutage ? 'outage' : violation.severity === 'high-risk' ? 'exception' : 'normal'
            })
          }
          const data = ruleAnalysis.get(key)!
          data.violations++
          data.total++
        })
      }

      // Count total applications of each rule (even compliant ones)
      const potentialRules = [
        'Maximum Shift Length',
        'Work-set Hour Limit',
        'Minimum Rest Period',
        'High Risk - Extended Shift',
        'High Risk - Insufficient Rest'
      ]

      potentialRules.forEach(rule => {
        if (!ruleAnalysis.has(rule)) {
          ruleAnalysis.set(rule, {
            violations: 0,
            total: 1,
            category: rule.includes('High Risk') ? 'exception' : shift.isOutage ? 'outage' : 'normal'
          })
        } else {
          ruleAnalysis.get(rule)!.total++
        }
      })
    })

    const complianceResults: ComplianceData[] = []

    ruleAnalysis.forEach((data, rule) => {
      const complianceRate = data.total > 0 ? ((data.total - data.violations) / data.total) * 100 : 100
      const riskLevel: 'low' | 'medium' | 'high' = 
        complianceRate >= 95 ? 'low' :
        complianceRate >= 85 ? 'medium' : 'high'

      complianceResults.push({
        rule,
        category: data.category as 'normal' | 'outage' | 'exception',
        violations: data.violations,
        complianceRate: Math.round(complianceRate * 10) / 10,
        riskLevel
      })
    })

    // Sort by risk level and compliance rate
    complianceResults.sort((a, b) => {
      const riskOrder = { high: 3, medium: 2, low: 1 }
      if (riskOrder[a.riskLevel] !== riskOrder[b.riskLevel]) {
        return riskOrder[b.riskLevel] - riskOrder[a.riskLevel]
      }
      return a.complianceRate - b.complianceRate
    })

    setComplianceData(complianceResults)
  }, [shifts])

  const filteredData = selectedCategory === 'all' 
    ? complianceData 
    : complianceData.filter(d => d.category === selectedCategory)

  const getRiskColor = (riskLevel: string) => {
    switch (riskLevel) {
      case 'high': return 'text-red-600 bg-red-100'
      case 'medium': return 'text-yellow-600 bg-yellow-100'
      default: return 'text-green-600 bg-green-100'
    }
  }

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'outage': return 'text-purple-600 bg-purple-100'
      case 'exception': return 'text-red-600 bg-red-100'
      default: return 'text-gray-700 bg-gray-100'
    }
  }

  const overallCompliance = complianceData.length > 0
    ? Math.round((complianceData.reduce((sum, d) => sum + d.complianceRate, 0) / complianceData.length) * 10) / 10
    : 100

  return (
    <div className="bg-white shadow rounded-lg">
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-gray-900">RP-755 Compliance Monitor</h3>
          <div className="flex space-x-1">
            {(['all', 'normal', 'outage', 'exception'] as const).map((category) => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`px-3 py-1 text-xs rounded-full transition-colors ${
                  selectedCategory === category
                    ? 'bg-black text-white font-medium'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                }`}
              >
                {category.charAt(0).toUpperCase() + category.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="p-6">
        {/* Overall Compliance Score */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600">Overall Compliance Score</span>
            <span className={`text-2xl font-bold ${
              overallCompliance >= 95 ? 'text-green-600' :
              overallCompliance >= 85 ? 'text-yellow-600' : 'text-red-600'
            }`}>
              {overallCompliance}%
            </span>
          </div>
          
          {/* Progress Bar */}
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div 
              className={`h-3 rounded-full transition-all duration-500 ${
                overallCompliance >= 95 ? 'bg-green-500' :
                overallCompliance >= 85 ? 'bg-yellow-500' : 'bg-red-500'
              }`}
              style={{ width: `${Math.max(overallCompliance, 2)}%` }}
            ></div>
          </div>
        </div>

        {/* Compliance Rules List */}
        <div className="space-y-4">
          {filteredData.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No compliance data available for the selected category
            </div>
          ) : (
            filteredData.map((item, index) => (
              <div key={index} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <h4 className="text-sm font-medium text-gray-900">{item.rule}</h4>
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getCategoryColor(item.category)}`}>
                        {item.category}
                      </span>
                    </div>
                    
                    <div className="flex items-center space-x-4 text-sm text-gray-600">
                      <span>Violations: {item.violations}</span>
                      <span>Compliance: {item.complianceRate}%</span>
                    </div>
                  </div>
                  
                  <div className="flex flex-col items-end space-y-2">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getRiskColor(item.riskLevel)}`}>
                      {item.riskLevel.toUpperCase()} RISK
                    </span>
                    
                    {/* Mini Progress Bar */}
                    <div className="w-20 bg-gray-200 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full ${
                          item.complianceRate >= 95 ? 'bg-green-500' :
                          item.complianceRate >= 85 ? 'bg-yellow-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${Math.max(item.complianceRate, 2)}%` }}
                      ></div>
                    </div>
                  </div>
                </div>

                {/* Recommendations for low compliance */}
                {item.complianceRate < 90 && (
                  <div className="mt-3 p-3 bg-gray-50 rounded-md">
                    <h5 className="text-xs font-medium text-gray-700 mb-1">Recommendations:</h5>
                    <ul className="text-xs text-gray-600 space-y-1">
                      {item.rule.includes('Shift Length') && (
                        <li>• Consider breaking long shifts into shorter segments</li>
                      )}
                      {item.rule.includes('Rest Period') && (
                        <li>• Ensure adequate rest time between shifts</li>
                      )}
                      {item.rule.includes('Work-set') && (
                        <li>• Monitor cumulative work hours more closely</li>
                      )}
                      {item.rule.includes('High Risk') && (
                        <li>• Implement additional safety measures and monitoring</li>
                      )}
                      <li>• Review scheduling practices and operator workload distribution</li>
                    </ul>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Compliance Targets */}
        <div className="mt-6 pt-6 border-t border-gray-200">
          <h4 className="text-sm font-medium text-gray-900 mb-3">Compliance Targets</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="text-center p-3 bg-green-50 rounded-lg">
              <div className="font-semibold text-green-700">Excellent</div>
              <div className="text-green-600">≥ 95%</div>
            </div>
            <div className="text-center p-3 bg-yellow-50 rounded-lg">
              <div className="font-semibold text-yellow-700">Acceptable</div>
              <div className="text-yellow-600">85-94%</div>
            </div>
            <div className="text-center p-3 bg-red-50 rounded-lg">
              <div className="font-semibold text-red-700">Needs Improvement</div>
              <div className="text-red-600">&lt; 85%</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
