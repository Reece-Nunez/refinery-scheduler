'use client'

import { useState, useEffect } from 'react'

interface ShiftData {
  date: string
  totalShifts: number
  violations: number
  avgHours: number
  complianceRate: number
}

interface ShiftAnalyticsProps {
  shifts: any[]
}

export default function ShiftAnalyticsChart({ shifts }: ShiftAnalyticsProps) {
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('7d')
  const [chartData, setChartData] = useState<ShiftData[]>([])

  useEffect(() => {
    if (shifts.length === 0) return

    const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90
    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(endDate.getDate() - days)

    const data: ShiftData[] = []

    for (let i = 0; i < days; i++) {
      const date = new Date(startDate)
      date.setDate(startDate.getDate() + i)
      const dateStr = date.toISOString().split('T')[0]

      const dayShifts = shifts.filter(shift => {
        const shiftDate = new Date(shift.startTime).toISOString().split('T')[0]
        return shiftDate === dateStr
      })

      const violatedShifts = dayShifts.filter(shift => 
        shift.violations && shift.violations.length > 0
      )

      const totalHours = dayShifts.reduce((total, shift) => {
        const start = new Date(shift.startTime)
        const end = new Date(shift.endTime)
        return total + ((end.getTime() - start.getTime()) / (1000 * 60 * 60))
      }, 0)

      const avgHours = dayShifts.length > 0 ? totalHours / dayShifts.length : 0
      const complianceRate = dayShifts.length > 0 
        ? ((dayShifts.length - violatedShifts.length) / dayShifts.length) * 100 
        : 100

      data.push({
        date: dateStr,
        totalShifts: dayShifts.length,
        violations: violatedShifts.length,
        avgHours: Math.round(avgHours * 10) / 10,
        complianceRate: Math.round(complianceRate * 10) / 10
      })
    }

    setChartData(data)
  }, [shifts, timeRange])

  const maxShifts = Math.max(...chartData.map(d => d.totalShifts), 1)
  const maxViolations = Math.max(...chartData.map(d => d.violations), 1)

  return (
    <div className="bg-white shadow rounded-lg">
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-gray-900">Shift Analytics</h3>
          <div className="flex space-x-2">
            {(['7d', '30d', '90d'] as const).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-3 py-1 text-sm rounded-md transition-colors ${
                  timeRange === range
                    ? 'bg-black text-white font-medium'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                }`}
              >
                {range === '7d' ? '7 Days' : range === '30d' ? '30 Days' : '90 Days'}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="p-6">
        {chartData.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No shift data available for the selected period
          </div>
        ) : (
          <div className="space-y-6">
            {/* Chart Legend */}
            <div className="flex items-center justify-center space-x-6 text-sm">
              <div className="flex items-center">
                <div className="w-3 h-3 bg-black rounded-full mr-2"></div>
                <span className="text-gray-600">Total Shifts</span>
              </div>
              <div className="flex items-center">
                <div className="w-3 h-3 bg-red-500 rounded-full mr-2"></div>
                <span className="text-gray-600">Violations</span>
              </div>
              <div className="flex items-center">
                <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
                <span className="text-gray-600">Compliance Rate</span>
              </div>
            </div>

            {/* Simple Bar Chart */}
            <div className="relative">
              <div className="flex items-end justify-between space-x-1" style={{ height: '200px' }}>
                {chartData.map((data, index) => {
                  const shiftHeight = (data.totalShifts / maxShifts) * 160
                  const violationHeight = (data.violations / maxViolations) * 160
                  const complianceOpacity = data.complianceRate / 100

                  return (
                    <div key={data.date} className="flex flex-col items-center flex-1 group">
                      <div className="relative w-full flex items-end justify-center space-x-1 mb-2">
                        {/* Total Shifts Bar */}
                        <div 
                          className="bg-gray-800 rounded-t w-1/3 transition-all duration-200 group-hover:bg-gray-900"
                          style={{ height: `${Math.max(shiftHeight, 2)}px` }}
                          title={`${data.totalShifts} total shifts`}
                        ></div>
                        
                        {/* Violations Bar */}
                        <div 
                          className="bg-red-500 rounded-t w-1/3 transition-all duration-200 group-hover:bg-red-600"
                          style={{ height: `${Math.max(violationHeight, 2)}px` }}
                          title={`${data.violations} violations`}
                        ></div>
                        
                        {/* Compliance Indicator */}
                        <div 
                          className="bg-green-500 rounded-t w-1/3 transition-all duration-200 group-hover:bg-green-600"
                          style={{ 
                            height: '20px',
                            opacity: complianceOpacity 
                          }}
                          title={`${data.complianceRate}% compliance`}
                        ></div>
                      </div>

                      {/* Date Label */}
                      <div className="text-xs text-gray-500 text-center transform -rotate-45 origin-top-left">
                        {new Date(data.date).toLocaleDateString('en-US', { 
                          month: 'short', 
                          day: 'numeric' 
                        })}
                      </div>

                      {/* Tooltip on Hover */}
                      <div className="opacity-0 group-hover:opacity-100 absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white text-xs rounded py-1 px-2 whitespace-nowrap z-10 transition-opacity">
                        <div>{data.totalShifts} shifts</div>
                        <div>{data.violations} violations</div>
                        <div>{data.complianceRate}% compliant</div>
                        <div>{data.avgHours}h avg</div>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Y-Axis Labels */}
              <div className="absolute left-0 top-0 h-40 flex flex-col justify-between text-xs text-gray-500 -ml-8">
                <span>{maxShifts}</span>
                <span>{Math.round(maxShifts * 0.75)}</span>
                <span>{Math.round(maxShifts * 0.5)}</span>
                <span>{Math.round(maxShifts * 0.25)}</span>
                <span>0</span>
              </div>
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-gray-200">
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900">
                  {chartData.reduce((sum, d) => sum + d.totalShifts, 0)}
                </div>
                <div className="text-sm text-gray-500">Total Shifts</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">
                  {chartData.reduce((sum, d) => sum + d.violations, 0)}
                </div>
                <div className="text-sm text-gray-500">Violations</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {Math.round((chartData.reduce((sum, d) => sum + d.complianceRate, 0) / chartData.length) * 10) / 10}%
                </div>
                <div className="text-sm text-gray-500">Avg Compliance</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900">
                  {Math.round((chartData.reduce((sum, d) => sum + d.avgHours, 0) / chartData.length) * 10) / 10}h
                </div>
                <div className="text-sm text-gray-500">Avg Duration</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
