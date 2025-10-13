'use client'

import { useState } from 'react'
import { type FatigueViolation, type ExceptionRequest, RP755FatiguePolicy } from '@/lib/rp755FatiguePolicy'

interface ExceptionRequestModalProps {
  isOpen: boolean
  onClose: () => void
  violations: FatigueViolation[]
  operatorId: string
  operatorName: string
  shiftDetails: {
    startTime: string
    endTime: string
  }
  onSubmit: (request: ExceptionRequest) => void
}

export default function ExceptionRequestModal({
  isOpen,
  onClose,
  violations,
  operatorId,
  operatorName,
  shiftDetails,
  onSubmit
}: ExceptionRequestModalProps) {
  const [formData, setFormData] = useState({
    justification: '',
    supervisorApproval: '',
    managementApproval: '',
    riskAssessment: '',
    mitigationPlan: ''
  })
  
  const [errors, setErrors] = useState<string[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)

  const highRiskViolations = violations.filter(v => v.severity === 'high-risk')
  const isHighRisk = highRiskViolations.length > 0

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setErrors([])

    // Create exception request
    const exceptionRequest = RP755FatiguePolicy.createExceptionRequest(
      {
        operatorId,
        startTime: new Date(shiftDetails.startTime),
        endTime: new Date(shiftDetails.endTime),
        isOverridden: true
      },
      violations,
      formData.justification,
      formData.supervisorApproval,
      formData.riskAssessment,
      formData.mitigationPlan
    )

    if (isHighRisk) {
      exceptionRequest.managementApproval = formData.managementApproval
    }

    // Validate the request
    const validationErrors = RP755FatiguePolicy.validateExceptionRequest(exceptionRequest)
    
    if (validationErrors.length > 0) {
      setErrors(validationErrors)
      setIsSubmitting(false)
      return
    }

    try {
      await onSubmit(exceptionRequest)
      onClose()
    } catch (error) {
      setErrors(['Failed to submit exception request. Please try again.'])
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleInputChange = (field: keyof typeof formData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-medium text-gray-900">
                RP-755 Exception Request
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                Operator: {operatorName} | Shift: {new Date(shiftDetails.startTime).toLocaleString()} - {new Date(shiftDetails.endTime).toLocaleString()}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Violations Summary */}
          <div className={`p-4 rounded-lg border ${isHighRisk ? 'bg-red-50 border-red-200' : 'bg-yellow-50 border-yellow-200'}`}>
            <h4 className={`text-sm font-medium mb-3 ${isHighRisk ? 'text-red-800' : 'text-yellow-800'}`}>
              Fatigue Policy Violations Requiring Exception:
            </h4>
            <ul className="space-y-2">
              {violations.map((violation, index) => (
                <li key={index} className={`text-sm ${isHighRisk ? 'text-red-700' : 'text-yellow-700'}`}>
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{violation.rule}</span>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      violation.severity === 'high-risk' ? 'bg-red-200 text-red-800' :
                      violation.severity === 'violation' ? 'bg-yellow-200 text-yellow-800' :
                      'bg-orange-200 text-orange-800'
                    }`}>
                      {violation.severity.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-xs mt-1">{violation.message}</p>
                  <p className="text-xs">Current: {violation.currentValue} | Limit: {violation.limit}</p>
                </li>
              ))}
            </ul>
          </div>

          {/* High Risk Warning */}
          {isHighRisk && (
            <div className="p-4 bg-red-100 border border-red-300 rounded-lg">
              <h4 className="text-sm font-medium text-red-800 mb-2">⚠️ HIGH-RISK EXCEPTION</h4>
              <p className="text-sm text-red-700 mb-2">
                This exception requires senior site management notification by the following business day.
              </p>
              <ul className="text-xs text-red-600 space-y-1">
                <li>• Additional management approval required</li>
                <li>• Enhanced risk assessment and mitigation planning mandatory</li>
                <li>• Automatic escalation to senior leadership</li>
              </ul>
            </div>
          )}

          {/* Error Messages */}
          {errors.length > 0 && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <h4 className="text-sm font-medium text-red-800 mb-2">Please correct the following errors:</h4>
              <ul className="text-sm text-red-700 space-y-1">
                {errors.map((error, index) => (
                  <li key={index}>• {error}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Justification */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Business Justification *
            </label>
            <textarea
              value={formData.justification}
              onChange={(e) => handleInputChange('justification', e.target.value)}
              rows={4}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500"
              placeholder="Explain why this exception is necessary for business operations..."
              required
            />
          </div>

          {/* Supervisor Approval */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Immediate Supervisor Approval *
            </label>
            <input
              type="text"
              value={formData.supervisorApproval}
              onChange={(e) => handleInputChange('supervisorApproval', e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500"
              placeholder="Supervisor name and approval"
              required
            />
          </div>

          {/* Management Approval (High Risk Only) */}
          {isHighRisk && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Senior Management Approval * (Required for High-Risk)
              </label>
              <input
                type="text"
                value={formData.managementApproval}
                onChange={(e) => handleInputChange('managementApproval', e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500"
                placeholder="Senior manager name and approval"
                required
              />
            </div>
          )}

          {/* Risk Assessment */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Risk Assessment *
            </label>
            <textarea
              value={formData.riskAssessment}
              onChange={(e) => handleInputChange('riskAssessment', e.target.value)}
              rows={4}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500"
              placeholder="Document the risks associated with this exception..."
              required
            />
          </div>

          {/* Mitigation Plan */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Mitigation Plan *
            </label>
            <textarea
              value={formData.mitigationPlan}
              onChange={(e) => handleInputChange('mitigationPlan', e.target.value)}
              rows={4}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500"
              placeholder="Describe the measures that will be taken to mitigate the risks..."
              required
            />
          </div>

          {/* Submit Buttons */}
          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-red-500"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className={`px-4 py-2 text-sm font-medium text-white rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 ${
                isHighRisk 
                  ? 'bg-red-600 hover:bg-red-700' 
                  : 'bg-black hover:bg-gray-900'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {isSubmitting ? 'Submitting...' : 'Submit Exception Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
