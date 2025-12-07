'use client'

import { useState, useEffect, useRef } from 'react'

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

  // Calculate which labels to show based on data density (industry standard: ~7 labels max)
  const getLabelInterval = () => {
    const len = chartData.length
    if (len <= 7) return 1 // Show all for 7 days
    if (len <= 30) return 5 // Every 5th for 30 days (~6 labels)
    return 15 // Every 15th for 90 days (~6 labels)
  }

  const shouldShowLabel = (index: number) => {
    const interval = getLabelInterval()
    const len = chartData.length
    // Always show first and last
    if (index === 0 || index === len - 1) return true
    // Show at regular intervals
    return index % interval === 0
  }

  // Drag to scroll functionality
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [startX, setStartX] = useState(0)
  const [scrollLeft, setScrollLeft] = useState(0)

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!scrollContainerRef.current) return
    setIsDragging(true)
    setStartX(e.pageX - scrollContainerRef.current.offsetLeft)
    setScrollLeft(scrollContainerRef.current.scrollLeft)
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !scrollContainerRef.current) return
    e.preventDefault()
    const x = e.pageX - scrollContainerRef.current.offsetLeft
    const walk = (x - startX) * 2
    scrollContainerRef.current.scrollLeft = scrollLeft - walk
  }

  // Calculate minimum width for chart based on data points
  const getChartMinWidth = () => {
    const barWidth = 40 // minimum pixels per bar group
    return Math.max(chartData.length * barWidth, 100)
  }

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
            <div className="relative pl-8">
              {/* Y-Axis Labels */}
              <div className="absolute left-0 top-0 flex flex-col justify-between text-xs text-gray-500 w-8 pr-2 text-right" style={{ height: '160px' }}>
                <span>{maxShifts}</span>
                <span>{Math.round(maxShifts * 0.75)}</span>
                <span>{Math.round(maxShifts * 0.5)}</span>
                <span>{Math.round(maxShifts * 0.25)}</span>
                <span>0</span>
              </div>

              {/* Scrollable chart container */}
              <div
                ref={scrollContainerRef}
                className={`overflow-x-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
                onMouseDown={handleMouseDown}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onMouseMove={handleMouseMove}
                style={{ scrollbarWidth: 'thin' }}
              >
                <div style={{ minWidth: `${getChartMinWidth()}px` }}>
                  {/* Bar chart area */}
                  <div className="flex items-end justify-between gap-1" style={{ height: '160px' }}>
                    {chartData.map((data, index) => {
                      const shiftHeight = (data.totalShifts / maxShifts) * 140
                      const violationHeight = (data.violations / maxViolations) * 140
                      const complianceOpacity = data.complianceRate / 100

                      return (
                        <div key={data.date} className="flex flex-col items-center flex-1 h-full group relative" style={{ minWidth: '36px' }}>
                          <div className="relative w-full flex items-end justify-center gap-0.5 flex-1">
                            {/* Total Shifts Bar */}
                            <div
                              className="bg-gray-800 rounded-t w-1/3 transition-all duration-200 group-hover:bg-gray-900"
                              style={{ height: `${Math.max(shiftHeight, 2)}px` }}
                            ></div>

                            {/* Violations Bar */}
                            <div
                              className="bg-red-500 rounded-t w-1/3 transition-all duration-200 group-hover:bg-red-600"
                              style={{ height: `${Math.max(violationHeight, 2)}px` }}
                            ></div>

                            {/* Compliance Indicator */}
                            <div
                              className="bg-green-500 rounded-t w-1/3 transition-all duration-200 group-hover:bg-green-600"
                              style={{
                                height: '20px',
                                opacity: complianceOpacity
                              }}
                            ></div>
                          </div>

                          {/* Tooltip on Hover - positioned at top of bar area */}
                          <div className="opacity-0 group-hover:opacity-100 absolute top-0 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white text-xs rounded py-1.5 px-2.5 whitespace-nowrap z-20 transition-opacity pointer-events-none shadow-lg">
                            <div className="font-medium border-b border-gray-700 pb-1 mb-1">
                              {new Date(data.date).toLocaleDateString('en-US', {
                                weekday: 'short',
                                month: 'short',
                                day: 'numeric'
                              })}
                            </div>
                            <div>{data.totalShifts} shifts</div>
                            <div>{data.violations} violations</div>
                            <div>{data.complianceRate}% compliant</div>
                            <div>{data.avgHours}h avg</div>
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {/* Date labels - separate row below the chart */}
                  <div className="flex justify-between gap-1 mt-2 pt-2 border-t border-gray-100" style={{ height: '24px' }}>
                    {chartData.map((data, index) => (
                      <div
                        key={`label-${data.date}`}
                        className="flex-1 flex justify-center"
                        style={{ minWidth: '36px' }}
                      >
                        {shouldShowLabel(index) && (
                          <span className="text-xs text-gray-500 whitespace-nowrap">
                            {new Date(data.date).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric'
                            })}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Scroll hint for larger datasets */}
              {chartData.length > 14 && (
                <div className="text-xs text-gray-400 text-center mt-2 italic">
                  Drag to scroll or use mouse wheel
                </div>
              )}
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
