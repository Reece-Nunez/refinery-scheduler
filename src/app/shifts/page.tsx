'use client'

import { useEffect, useState } from 'react'
import axios from 'axios'
import dynamic from 'next/dynamic'

type Operator = {
  id: string
  name: string
  employeeId: string
}

type Shift = {
  id: string
  operator: Operator
  startTime: string
  endTime: string
  isOverridden: boolean
}

export default function ShiftsPage() {
  const [operators, setOperators] = useState<Operator[]>([])
  const [shifts, setShifts] = useState<Shift[]>([])
  const [form, setForm] = useState({
    operatorId: '',
    shiftDate: '', // <-- user picks date only
    shiftType: 'day', // 'day' or 'night'
    isOverridden: false,
  })

  const [violations, setViolations] = useState<string[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    fetchOperators()
    fetchShifts()
  }, [])

  const fetchOperators = async () => {
    const res = await axios.get('/api/operators')
    setOperators(res.data)
  }

  const fetchShifts = async () => {
    const res = await axios.get('/api/shifts')
    const parsed = res.data.map((s: any) => ({
      ...s,
      isOverridden: Boolean(s.isOverridden), // 👈 force boolean
    }))
    setShifts(parsed)
  }


  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const target = e.target as HTMLInputElement | HTMLSelectElement
    const { name, value, type } = target
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? (target as HTMLInputElement).checked : value,
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setViolations([])
    setError('')

    try {
      const { operatorId, shiftDate, shiftType, isOverridden } = form

      if (!operatorId || !shiftDate) {
        setError('Operator and shift date are required.')
        return
      }

      const start = new Date(shiftDate)
      const startTime = new Date(start)
      const endTime = new Date(start)

      if (shiftType === 'day') {
        startTime.setHours(4, 45)
        endTime.setHours(16, 45)
      } else {
        startTime.setHours(16, 45)
        endTime.setDate(endTime.getDate() + 1)
        endTime.setHours(4, 45)
      }

      const payload = {
        operatorId,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        isOverridden,
      }

      const res = await axios.post('/api/shifts', payload)

      // ✅ only clear if successful
      setForm({ operatorId: '', shiftDate: '', shiftType: 'day', isOverridden: false })
      fetchShifts()
    } catch (err: any) {
      if (err.response?.data?.violations?.length > 0) {
        setViolations(err.response.data.violations)
        return // ⛔ do NOT continue or clear form
      }
      setError(err.response?.data?.error || 'Something went wrong')
    }
  }



  const ScheduleCalendar = dynamic(() => import('@/components/ScheduleCalendar'), {
    ssr: false,
  })

  return (
    <div className="px-4 py-10 min-h-screen bg-gradient-to-br from-gray-900 via-slate-800 to-gray-900 text-white">
      <div className="max-w-6xl mx-auto space-y-10">
        <form
          onSubmit={handleSubmit}
          className="bg-white/10 backdrop-blur-sm rounded-lg shadow-lg p-6 space-y-5 border border-white/20"
        >
          <h2 className="text-2xl font-bold text-white">Assign a New Shift</h2>

          <div className="space-y-2">
            <select
              name="operatorId"
              value={form.operatorId}
              onChange={handleChange}
              className="bg-white/10 border border-white/20 text-white placeholder:text-gray-300 px-4 py-2 rounded w-full cursor-pointer"
            >
              <option value="" className="bg-gray-800 hover:bg-gray-700 transition">Select Operator</option>
              {operators.map((op) => (
                <option key={op.id} value={op.id}
                  className="bg-gray-800 hover:bg-gray-700 transition"
                >
                  {op.name} ({op.employeeId})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Shift Date */}
            <label
              onClick={(e) => {
                const input = e.currentTarget.querySelector('input') as HTMLInputElement
                input?.showPicker?.()
              }}
              className="relative w-full"
            >
              <input
                type="date"
                name="shiftDate"
                value={form.shiftDate}
                onChange={handleChange}
                className="bg-white/10 border border-white/20 text-white placeholder:text-gray-300 px-4 py-2 rounded w-full cursor-pointer"
              />
            </label>

            {/* Shift Type */}
            <label className="relative w-full">
              <select
                name="shiftType"
                value={form.shiftType}
                onChange={handleChange}
                className="bg-white/10 border border-white/20 text-white placeholder:text-gray-300 px-4 py-2 rounded w-full cursor-pointer"
              >
                <option
                  value="day"
                  className="bg-gray-800 hover:bg-gray-700 transition"
                >
                  Day Shift (4:45 AM – 4:45 PM)
                </option>
                <option
                  value="night"
                  className="bg-gray-800 hover:bg-gray-700 transition"
                >
                  Night Shift (4:45 PM – 4:45 AM)
                </option>
              </select>
            </label>
          </div>

          <label className="flex items-center gap-2 text-white">
            <input
              type="checkbox"
              name="isOverridden"
              checked={form.isOverridden}
              onChange={handleChange}
              className="accent-blue-500"
            />
            <span>Override fatigue policy (admin only)</span>
          </label>

          <div className="flex gap-4 items-center">
            <button
              type="submit"
              className="bg-green-600 hover:bg-green-700 transition px-6 py-2 rounded text-white font-semibold shadow cursor-pointer"
            >
              Assign Shift
            </button>
            <button
              type="button"
              onClick={() =>
                setForm({ operatorId: '', shiftDate: '', shiftType: 'day', isOverridden: false })
              }
              className="bg-gray-600 hover:bg-gray-700 transition px-6 py-2 rounded text-white font-semibold shadow cursor-pointer"
            >
              Clear
            </button>
          </div>

          {violations.length > 0 && (
            <div className="bg-red-100 text-red-800 px-4 py-2 rounded border border-red-400">
              <strong>Fatigue Policy Violations:</strong>
              <ul className="list-disc ml-5 mt-1">
                {violations.map((v, i) => (
                  <li key={i}>{v}</li>
                ))}
              </ul>
            </div>
          )}

          {error && <p className="text-red-500 font-semibold">{error}</p>}
        </form>

        <div className="bg-white/10 backdrop-blur-sm border border-white/20 p-6 rounded-lg shadow-lg">
          <h3 className="text-xl font-bold mb-4 text-white">Scheduled Shifts</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-white border-separate border-spacing-y-2">
              <thead>
                <tr className="bg-slate-700/70">
                  <th className="text-left p-2">Operator</th>
                  <th className="text-left p-2">Start</th>
                  <th className="text-left p-2">End</th>
                  <th className="text-left p-2">Overriden?</th>
                </tr>
              </thead>
              <tbody>
                {shifts.map((s, i) => (
                  <tr
                    key={s.id}
                    className={`bg-slate-${i % 2 === 0 ? '800' : '700'} rounded`}
                  >
                    <td className="p-2">{s.operator.name} ({s.operator.employeeId})</td>
                    <td className="p-2">{new Date(s.startTime).toLocaleString()}</td>
                    <td className="p-2">{new Date(s.endTime).toLocaleString()}</td>
                    <td className="p-2">
                      {s.isOverridden ? (
                        <span className="text-green-400 text-lg">Yes</span>
                      ) : (
                        <span className="text-red-400 text-lg">No</span>
                      )}
                    </td>

                  </tr>
                ))}
                {shifts.length === 0 && (
                  <tr>
                    <td colSpan={4} className="text-center text-gray-400 p-4">
                      No shifts scheduled yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <ScheduleCalendar fetchShifts={fetchShifts} />
      </div>
    </div>
  )
}