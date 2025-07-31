'use client'

import { Calendar, momentLocalizer, Views, View } from 'react-big-calendar'
import 'react-big-calendar/lib/css/react-big-calendar.css'
import '@/styles/calendar.css'
import { useEffect, useState } from 'react'
import { parseISO, format } from 'date-fns'
import moment from 'moment'
import Modal from 'react-modal'
import axios from 'axios'

type ShiftEvent = {
  id: string
  title: string
  start: Date
  end: Date
  team?: string
  isOverridden: boolean
}

type Props = {
  fetchShifts: () => void
}

const localizer = momentLocalizer(moment)

export default function ScheduleCalendar({ fetchShifts }: Props) {
  const [events, setEvents] = useState<ShiftEvent[]>([])
  const [defaultDate, setDefaultDate] = useState<Date>(new Date())
  const [view, setView] = useState<View>(Views.MONTH)
  const [currentDate, setCurrentDate] = useState<Date>(new Date())
  const [selectedEvent, setSelectedEvent] = useState<ShiftEvent | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  const fetchEvents = async () => {
    const res = await fetch('/api/shifts')
    const data = await res.json()

    const mapped: ShiftEvent[] = data.map((shift: any) => ({
      id: shift.id,
      title: `${shift.operator.name} (${shift.operator.employeeId})`,
      start: parseISO(shift.startTime),
      end: parseISO(shift.endTime),
      team: shift.operator.team,
      isOverridden: shift.isOverridden ?? false,
    }))

    setEvents(mapped)
    if (mapped.length > 0) setDefaultDate(mapped[0].start)
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

    await axios.put(`/api/shifts/${selectedEvent.id}`, payload)
    setIsModalOpen(false)
    setSelectedEvent(null)
    fetchEvents()
  }

  const handleDelete = async () => {
    if (!selectedEvent) return
    const confirm = window.confirm('Are you sure you want to delete this shift?')
    if (!confirm) return

    await axios.delete(`/api/shifts/${selectedEvent.id}`)
    setIsModalOpen(false)
    setSelectedEvent(null)
    fetchEvents()
  }

  const eventStyleGetter = (event: ShiftEvent) => {
    const teamColors: Record<string, string> = {
      A: '#60a5fa',
      B: '#34d399',
      C: '#fbbf24',
      D: '#f87171',
    }
    const backgroundColor = teamColors[event.team as string] || '#9ca3af'
    return {
      style: {
        backgroundColor,
        color: 'black',
        borderRadius: '6px',
        padding: '2px 4px',
        fontWeight: 600,
        border: 'none',
      },
    }
  }

  return (
    <div className="mt-16 w-full">
      <div className="max-w-6xl mx-auto px-4">
        <h2 className="text-2xl font-bold mb-4 text-white">Shift Calendar</h2>
        <div className="h-[700px] border border-white rounded-lg overflow-hidden shadow-lg">
          <Calendar
            localizer={localizer}
            events={events}
            view={view}
            onView={setView}
            onNavigate={setCurrentDate}
            defaultDate={defaultDate}
            startAccessor="start"
            endAccessor="end"
            eventPropGetter={eventStyleGetter}
            style={{ height: '100%', color: 'white' }}
            views={{ month: true, week: true, day: true, agenda: true }}
            onSelectEvent={(event: ShiftEvent) => {
              setSelectedEvent(event)
              setIsModalOpen(true)
            }}
          />
        </div>
      </div>

      {/* Modal for Edit/Delete */}
      {selectedEvent && (
        <Modal
          isOpen={isModalOpen}
          onRequestClose={() => setIsModalOpen(false)}
          className="bg-white max-w-md mx-auto mt-40 p-6 rounded-lg shadow-xl text-black"
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
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
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
