'use client'

import { useState } from 'react'

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
  email?: string
  lastActive?: string
  consoles?: string[]
}

interface OperatorCardProps {
  operator: Operator
  onEdit: (operator: Operator) => void
  onDelete: (id: string) => void
  onViewDetails: (operator: Operator) => void
  isSelected: boolean
  onSelect: (id: string, selected: boolean) => void
  canManage?: boolean
}

export default function OperatorCard({ 
  operator, 
  onEdit, 
  onDelete, 
  onViewDetails, 
  isSelected, 
  onSelect,
  canManage = true
}: OperatorCardProps) {
  const [showActions, setShowActions] = useState(false)

  const getTeamColor = (team: string) => {
    const colors = {
      'A': 'bg-blue-500',
      'B': 'bg-green-500', 
      'C': 'bg-purple-500',
      'D': 'bg-orange-500'
    }
    return colors[team as keyof typeof colors] || 'bg-gray-500'
  }

  const getConsoleColor = (console: string) => {
    const colors = {
      'FCC': 'bg-black text-white',
      'VRU': 'bg-purple-500 text-white'
    }
    return colors[console as keyof typeof colors] || 'bg-gray-500 text-white'
  }

  return (
    <div 
      className={`bg-white border border-gray-200 shadow-sm hover:shadow-md transition-shadow duration-200 ${
        isSelected ? 'ring-2 ring-red-500 border-red-500' : ''
      }`}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {/* Header section */}
      <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {canManage && (
            <input
              type="checkbox"
              checked={isSelected}
              onChange={(e) => onSelect(operator.id, e.target.checked)}
              className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded"
            />)}
            {/* Operator letter (only for non-APS operators) */}
            {operator.letter && operator.role !== 'APS' && (
              <div className="text-center">
                <div className="flex items-center justify-center w-10 h-10 bg-gray-700 text-white text-xl font-bold border-2 border-gray-800">
                  {operator.letter}
                </div>
                <div className="text-xs text-gray-600 mt-1">Letter</div>
              </div>
            )}
            {/* ID number */}
            <div className="text-center">
              <div className="text-lg font-bold text-gray-900">{operator.employeeId}</div>
              <div className="text-xs text-gray-600">ID</div>
            </div>
          </div>
          
          {/* Team badge */}
          <div className="text-center">
            <span className={`inline-flex items-center justify-center w-8 h-8 text-white text-sm font-bold ${getTeamColor(operator.team)}`}>
              {operator.team}
            </span>
            <div className="text-xs text-gray-600 mt-1">Team</div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="p-4">
        {/* Operator name */}
        <h3 className="text-lg font-semibold text-gray-900 mb-2">{operator.name}</h3>
        
        {/* Telephone number */}
        {operator.phone && (
          <div className="mb-3">
            <p className="text-xs text-gray-600 mb-1">Telephone</p>
            <p className="text-sm text-gray-900 font-mono">{operator.phone}</p>
          </div>
        )}

        {/* Role badge */}
        <div className="mb-3">
          <span className={`inline-flex items-center px-3 py-1 text-sm font-medium border ${
            operator.role === 'APS' 
              ? 'bg-red-50 text-red-800 border-red-200' 
              : 'bg-gray-100 text-gray-800 border-gray-200'
          }`}>
            {operator.role}
          </span>
        </div>

        {/* Console training indicators */}
        {operator.consoles && operator.consoles.length > 0 && (
          <div className="mb-3">
            <p className="text-xs text-gray-600 mb-1">Console Training</p>
            <div className="flex gap-1">
              {operator.consoles.map((console) => (
                <span
                  key={console}
                  className={`inline-flex items-center px-2 py-1 text-xs font-medium ${getConsoleColor(console)}`}
                >
                  {console}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Trained jobs (condensed) */}
        <div className="mb-3">
          <p className="text-xs text-gray-600 mb-1">Trained Jobs ({operator.trainedJobs.length})</p>
          <div className="flex flex-wrap gap-1">
            {operator.trainedJobs.slice(0, 2).map((job) => (
              <span
                key={job.id}
                className="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-800"
              >
                {job.title}
              </span>
            ))}
            {operator.trainedJobs.length > 2 && (
              <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-600">
                +{operator.trainedJobs.length - 2}
              </span>
            )}
          </div>
        </div>

        {/* Actions (show on hover) */}
        <div className={`flex justify-end space-x-2 transition-opacity duration-200 ${showActions ? 'opacity-100' : 'opacity-0'}`}>
          <button
            onClick={() => onViewDetails(operator)}
            className="px-2 py-1 text-xs text-gray-900 hover:text-gray-700 font-medium"
          >
            View
          </button>
          {canManage && (
            <>
              <button
                onClick={() => onEdit(operator)}
                className="px-2 py-1 text-xs text-gray-600 hover:text-gray-800 font-medium"
              >
                Edit
              </button>
              <button
                onClick={() => {
                  if (confirm('Are you sure you want to delete this operator?')) {
                    onDelete(operator.id)
                  }
                }}
                className="px-2 py-1 text-xs text-red-600 hover:text-red-800 font-medium"
              >
                Delete
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
