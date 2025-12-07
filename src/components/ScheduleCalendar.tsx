'use client'

import { Calendar, momentLocalizer, Views, View } from 'react-big-calendar'
import 'react-big-calendar/lib/css/react-big-calendar.css'
import '@/styles/calendar.css'
import { useEffect, useState } from 'react'
import { parseISO, format } from 'date-fns'
import moment from 'moment'
import Modal from 'react-modal'
import axios from 'axios'
import { supabase } from '@/lib/supabaseClient'

type ShiftEvent = {
  id: string
  title: string
  start: Date
  end: Date
  team?: string
  shiftType?: 'day' | 'night'
  operatorName?: string
  employeeId?: string
  isOverridden: boolean
}

type Props = {
  fetchShifts?: () => void
  canManage?: boolean
}

const localizer = momentLocalizer(moment)

export default function ScheduleCalendar({ fetchShifts, canManage = true }: Props) {
  const [events, setEvents] = useState<ShiftEvent[]>([])
  const [view, setView] = useState<View>(Views.MONTH)
  const [currentDate, setCurrentDate] = useState<Date>(new Date())
  const [selectedEvent, setSelectedEvent] = useState<ShiftEvent | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  const fetchEvents = async () => {
    const res = await fetch('/api/shifts')
    const data = await res.json()

    const mapped: ShiftEvent[] = data.map((shift: any) => {
      const shiftType = shift.shiftType || 'day'
      const icon = shiftType === 'night' ? '🌙' : '☀️'
      return {
        id: shift.id,
        title: `${icon} ${shift.operator.name}`,
        start: parseISO(shift.startTime),
        end: parseISO(shift.endTime),
        team: shift.operator.team,
        shiftType: shiftType,
        operatorName: shift.operator.name,
        employeeId: shift.operator.employeeId,
        isOverridden: shift.isOverridden ?? false,
      }
    })

    setEvents(mapped)
  }

  useEffect(() => {
    fetchEvents()
  }, [])

  const handleEditChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    if (!selectedEvent) return
    const { name, value, type } = e.target

    setSelectedEvent((prev) => {
      if (!prev) return null
      return {
        ...prev,
        [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
      }
    })
  }

  const handleEditSubmit = async () => {
    if (!selectedEvent) return

    const payload = {
      startTime: selectedEvent.start.toISOString(),
      endTime: selectedEvent.end.toISOString(),
      isOverridden: selectedEvent.isOverridden,
    }

    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token
    await axios.put(`/api/shifts/${selectedEvent.id}`, payload, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    })
    setIsModalOpen(false)
    setSelectedEvent(null)
    fetchEvents()
  }

  const handleDelete = async () => {
    if (!selectedEvent) return
    const confirm = window.confirm('Are you sure you want to delete this shift?')
    if (!confirm) return

    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token
    await axios.delete(`/api/shifts/${selectedEvent.id}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    })
    setIsModalOpen(false)
    setSelectedEvent(null)
    fetchEvents()
  }

  // Team colors with names for legend
  const teamColors: Record<string, { bg: string; name: string }> = {
    A: { bg: '#3b82f6', name: 'Team A' },  // blue-500
    B: { bg: '#22c55e', name: 'Team B' },  // green-500
    C: { bg: '#a855f7', name: 'Team C' },  // purple-500
    D: { bg: '#f97316', name: 'Team D' },  // orange-500
  }

  const eventStyleGetter = (event: ShiftEvent) => {
    const teamColor = teamColors[event.team as string]
    const backgroundColor = teamColor?.bg || '#9ca3af'
    return {
      style: {
        backgroundColor,
        color: 'white',
        borderRadius: '6px',
        padding: '2px 6px',
        fontWeight: 500,
        border: 'none',
        fontSize: '0.85rem',
      },
    }
  }

  // Custom event component with tooltip
  const EventComponent = ({ event }: { event: ShiftEvent }) => {
    const [showTooltip, setShowTooltip] = useState(false)
    const shiftTypeLabel = event.shiftType === 'night' ? 'Night Shift' : 'Day Shift'
    const timeStr = `${format(event.start, 'h:mm a')} - ${format(event.end, 'h:mm a')}`

    return (
      <div
        className="relative h-full"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        <span className="truncate block">{event.title}</span>
        {showTooltip && (
          <div className="absolute z-50 bg-gray-900 text-white text-xs rounded-lg py-2 px-3 shadow-lg whitespace-nowrap left-0 top-full mt-1 pointer-events-none">
            <div className="font-semibold text-sm mb-1">{event.operatorName}</div>
            <div className="text-gray-300">ID: {event.employeeId}</div>
            <div className="text-gray-300">Team {event.team}</div>
            <div className="text-gray-300">{shiftTypeLabel}</div>
            <div className="text-gray-300">{timeStr}</div>
            {event.isOverridden && (
              <div className="text-red-400 mt-1">⚠️ RP-755 Override</div>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="w-full">
      <div className="max-w-6xl mx-auto px-4">
        {/* Legend */}
        <div className="mb-4 bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex flex-wrap items-center gap-6">
            <div className="text-sm font-medium text-gray-700">Team Colors:</div>
            {Object.entries(teamColors).map(([team, { bg, name }]) => (
              <div key={team} className="flex items-center gap-2">
                <div
                  className="w-4 h-4 rounded"
                  style={{ backgroundColor: bg }}
                ></div>
                <span className="text-sm text-gray-600">{name}</span>
              </div>
            ))}
            <div className="border-l border-gray-300 pl-6 flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span>☀️</span>
                <span className="text-sm text-gray-600">Day Shift</span>
              </div>
              <div className="flex items-center gap-2">
                <span>🌙</span>
                <span className="text-sm text-gray-600">Night Shift</span>
              </div>
            </div>
          </div>
        </div>

        <div className="h-[700px] border border-gray-200 rounded-lg overflow-hidden shadow-lg bg-white">
          <Calendar
            localizer={localizer}
            events={events}
            view={view}
            onView={setView}
            date={currentDate}
            onNavigate={setCurrentDate}
            startAccessor="start"
            endAccessor="end"
            eventPropGetter={eventStyleGetter}
            style={{ height: '100%' }}
            views={{ month: true, week: true, day: true, agenda: true }}
            components={{
              event: EventComponent,
            }}
            onSelectEvent={(event: ShiftEvent) => {
              if (!canManage) return
              setSelectedEvent(event)
              setIsModalOpen(true)
            }}
            step={30}
            timeslots={2}
            dayLayoutAlgorithm="no-overlap"
          />
        </div>
      </div>

      {/* Modal for Edit/Delete */}
      {canManage && selectedEvent && (
        <Modal
          isOpen={isModalOpen}
          onRequestClose={() => setIsModalOpen(false)}
          className="bg-white max-w-md mx-auto mt-40 rounded-lg shadow-xl text-black"
          overlayClassName="fixed inset-0 bg-black/50 z-50 flex items-center justify-center"
        >
          <h2 className="text-xl font-bold mb-4">Edit Shift</h2>
          <div className="space-y-4">
            <p><strong>Operator:</strong> {selectedEvent.title}</p>
            <p><strong>Start:</strong> {format(new Date(selectedEvent.start), 'Pp')}</p>
            <p><strong>End:</strong> {format(new Date(selectedEvent.end), 'Pp')}</p>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                name="isOverridden"
                checked={selectedEvent.isOverridden}
                onChange={handleEditChange}
              />
              Override Fatigue Policy
            </label>

            <div className="flex justify-end gap-4 mt-6">
              <button
                onClick={handleEditSubmit}
                className="bg-black text-white px-4 py-2 rounded hover:bg-gray-900"
              >
                Save
              </button>
              <button
                onClick={handleDelete}
                className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
