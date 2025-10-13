'use client'

import { useEffect, useState } from 'react'
import axios from 'axios'

type Job = { id: string; title: string }
type Operator = {
  id: string
  name: string
  employeeId: string
  role: string
  team: string
  trainedJobs: Job[]
}

const teamOptions = ['A', 'B', 'C', 'D']

export default function OperatorForm() {
  const [form, setForm] = useState({
    id: '',
    name: '',
    employeeId: '',
    email: '',
    role: 'Operator',
    team: 'A',
    trainedJobIds: [] as string[],
  })
  const [jobs, setJobs] = useState<Job[]>([])
  const [operators, setOperators] = useState<Operator[]>([])
  const [editing, setEditing] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    fetchJobs()
    fetchOperators()
  }, [])

  const fetchJobs = async () => {
    const res = await axios.get('/api/jobs')
    setJobs(res.data)
  }

  const fetchOperators = async () => {
    const res = await axios.get('/api/operators')
    setOperators(res.data)
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const toggleJob = (jobId: string) => {
    setForm((prev) => ({
      ...prev,
      trainedJobIds: prev.trainedJobIds.includes(jobId)
        ? prev.trainedJobIds.filter((id) => id !== jobId)
        : [...prev.trainedJobIds, jobId],
    }))
  }

  const resetForm = () => {
    setForm({
      id: '',
      name: '',
      employeeId: '',
      email: '',
      role: 'Operator',
      team: 'A',
      trainedJobIds: [],
    })
    setEditing(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage('')
    try {
      if (editing) {
        await axios.put('/api/operators', form)
        setMessage('✅ Operator updated.')
      } else {
        if (!form.email) return setMessage('❌ Email is required.')
        await axios.post('/api/operators', form)
        setMessage('✅ Operator created.')
      }
      resetForm()
      fetchOperators()
    } catch (err: any) {
      setMessage(err.response?.data?.error || '❌ Error saving operator.')
    }
  }

  const handleEdit = (op: Operator) => {
    setEditing(true)
    setForm({
      id: op.id,
      name: op.name,
      employeeId: op.employeeId,
      email: '',
      role: op.role,
      team: op.team,
      trainedJobIds: op.trainedJobs.map((j) => j.id),
    })
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this operator?')) return
    try {
      await axios.delete('/api/operators', { data: { id } })
      setMessage('✅ Operator deleted.')
      fetchOperators()
    } catch (err) {
      setMessage('❌ Error deleting operator.')
    }
  }

  return (
    <div className="px-4 py-10 min-h-screen bg-gradient-to-br from-gray-900 via-slate-800 to-gray-900 text-white">
      <div className="max-w-4xl mx-auto space-y-10">
        <form
          onSubmit={handleSubmit}
          className="bg-white/10 backdrop-blur-sm rounded-lg shadow-lg p-6 space-y-5 border border-white/20"
        >
          <h2 className="text-2xl font-bold text-white">
            {editing ? 'Edit Operator' : 'Add New Operator'}
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <input
              name="name"
              value={form.name}
              onChange={handleChange}
              placeholder="Name"
              className="bg-white/10 border border-white/20 text-white placeholder:text-gray-300 px-4 py-2 rounded focus:outline-none focus:ring-2 focus:ring-red-500"
            />
            <input
              name="employeeId"
              value={form.employeeId}
              onChange={handleChange}
              placeholder="Employee ID"
              disabled={editing}
              className="bg-white/10 border border-white/20 text-white placeholder:text-gray-300 px-4 py-2 rounded"
            />
            {!editing && (
              <input
                name="email"
                value={form.email}
                onChange={handleChange}
                placeholder="Email"
                className="bg-white/10 border border-white/20 text-white placeholder:text-gray-300 px-4 py-2 rounded"
              />
            )}
            <select
              name="team"
              value={form.team}
              onChange={handleChange}
              className="bg-white/10 border border-white/20 text-red-500 px-4 py-2 rounded"
            >
              {teamOptions.map((team) => (
                <option key={team} value={team}>
                  Team {team}
                </option>
              ))}
            </select>
          </div>

          <fieldset className="border border-white/20 p-4 rounded">
            <legend className="text-sm font-semibold text-white mb-2">Trained Jobs</legend>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {jobs.map((job) => (
                <label key={job.id} className="flex items-center space-x-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.trainedJobIds.includes(job.id)}
                    onChange={() => toggleJob(job.id)}
                    className="accent-red-600"
                  />
                  <span>{job.title}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="flex gap-4 items-center">
            <button
              type="submit"
              className="bg-black hover:bg-gray-900 transition px-6 py-2 rounded text-white font-semibold shadow cursor-pointer"
            >
              {editing ? 'Update' : 'Create'}
            </button>
            {editing && (
              <button
                type="button"
                onClick={resetForm}
                className="bg-black hover:bg-gray-900 transition px-6 py-2 rounded text-white font-semibold shadow cursor-pointer"
              >
                Cancel
              </button>
            )}
          </div>

          {message && (
            <p className="text-sm mt-2 text-white/80">
              {message}
            </p>
          )}
        </form>

        <div className="bg-white/10 backdrop-blur-sm border border-white/20 p-6 rounded-lg shadow-lg">
          <h3 className="text-xl font-bold mb-4 text-white">Current Operators</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-white border-separate border-spacing-y-2">
              <thead>
                <tr className="bg-slate-700/70">
                  <th className="text-left p-2">Name</th>
                  <th className="text-left p-2">Emp. ID</th>
                  <th className="text-left p-2">Team</th>
                  <th className="text-left p-2">Jobs</th>
                  <th className="text-left p-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {operators.map((op, i) => (
                  <tr
                    key={op.id}
                    className={`bg-slate-${i % 2 === 0 ? '800' : '700'} rounded`}
                  >
                    <td className="p-2">{op.name}</td>
                    <td className="p-2">{op.employeeId}</td>
                    <td className="p-2">{op.team}</td>
                    <td className="p-2 text-xs">
                      <div className="flex flex-wrap gap-2">
                        {op.trainedJobs.length > 0 ? (
                          op.trainedJobs.map((j) => (
                            <span
                              key={j.id}
                            className="bg-red-600/80 text-white px-2 py-0.5 rounded-full text-[11px] font-medium shadow-sm"
                            >
                              {j.title}
                            </span>
                          ))
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </div>
                    </td>

                    <td className="p-2 space-x-3">
                      <button
                        onClick={() => handleEdit(op)}
                        className="text-gray-900 bg-white px-4 py-1 rounded hover:bg-gray-200 cursor-pointer"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(op.id)}
                        className="text-red-400 bg-white px-4 py-1 rounded hover:bg-red-500 hover:text-white cursor-pointer"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
                {operators.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center text-gray-400 p-4">
                      No operators yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )

}
