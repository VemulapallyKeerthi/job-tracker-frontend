'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabase'
import { fetchJobs, updateJobStatus, deleteJob } from '../lib/api'

const COLUMNS = [
  { id: 'saved', label: 'Saved', color: 'bg-blue-50 border-blue-200', dot: 'bg-blue-500' },
  { id: 'applied', label: 'Applied', color: 'bg-purple-50 border-purple-200', dot: 'bg-purple-500' },
  { id: 'interview', label: 'Interview', color: 'bg-amber-50 border-amber-200', dot: 'bg-amber-500' },
  { id: 'offer', label: 'Offer', color: 'bg-green-50 border-green-200', dot: 'bg-green-500' },
  { id: 'rejected', label: 'Rejected', color: 'bg-red-50 border-red-200', dot: 'bg-red-500' },
]

export default function Dashboard() {
  const router = useRouter()
  const [jobs, setJobs] = useState<any[]>([])
  const [token, setToken] = useState<string>('')
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.push('/')
        return
      }
      setToken(session.access_token)
      setUser(session.user)
      fetchJobs(session.access_token).then(data => {
        setJobs(data)
        setLoading(false)
      }).catch(() => setLoading(false))
    })
  }, [router])

  const handleStatusChange = async (jobId: number, newStatus: string) => {
    // Optimistic update
    setJobs(prev => prev.map(j => j.id === jobId ? { ...j, status: newStatus } : j))
    try {
      await updateJobStatus(token, jobId, newStatus)
    } catch {
      // Revert on error
      fetchJobs(token).then(setJobs)
    }
  }

  const handleDelete = async (jobId: number) => {
    if (!confirm('Remove this job?')) return
    setJobs(prev => prev.filter(j => j.id !== jobId))
    try {
      await deleteJob(token, jobId)
    } catch {
      fetchJobs(token).then(setJobs)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  const filtered = jobs.filter(j =>
    j.title?.toLowerCase().includes(search.toLowerCase()) ||
    j.company?.toLowerCase().includes(search.toLowerCase())
  )

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-gray-500 text-lg">Loading jobs...</div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navbar */}
      <nav className="bg-white border-b px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <span className="text-2xl">💼</span>
          <h1 className="text-xl font-bold text-gray-800">JobTracker</h1>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500">{user?.email}</span>
          <button onClick={handleLogout} className="text-sm text-red-500 hover:text-red-700">
            Logout
          </button>
        </div>
      </nav>

      {/* Filters */}
      <div className="px-6 py-4 sticky top-16 bg-gray-50 z-10 border-b">
        <input
          type="text"
          placeholder="Search by title or company..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full max-w-md px-4 py-2 rounded-full border border-gray-200 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
        />
      </div>

      {/* Kanban Board */}
      <div className="p-6 flex gap-4 overflow-x-auto">
        {COLUMNS.map(col => {
          const colJobs = filtered.filter(j => j.status === col.id)
          return (
            <div key={col.id} className={`flex-shrink-0 w-72 rounded-2xl border ${col.color} p-4`}>
              <div className="flex items-center gap-2 mb-4">
                <div className={`w-3 h-3 rounded-full ${col.dot}`} />
                <h2 className="font-semibold text-gray-700">{col.label}</h2>
                <span className="ml-auto text-sm text-gray-400">{colJobs.length}</span>
              </div>
              <div className="flex flex-col gap-3">
                {colJobs.map(job => (
                  <div key={job.id} className="bg-white rounded-xl p-4 shadow-sm hover:shadow-md transition group">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-800 text-sm truncate">{job.title}</h3>
                        <p className="text-xs text-gray-500 truncate">{job.company}</p>
                        <p className="text-xs text-gray-400 truncate mt-1">{job.location}</p>
                      </div>
                      <div className="flex gap-1 ml-2">
                        {job.apply_link && (
                          <a href={job.apply_link} target="_blank" rel="noopener noreferrer"
                            className="text-gray-400 hover:text-blue-500 text-xs">↗</a>
                        )}
                        <button onClick={() => handleDelete(job.id)}
                          className="text-gray-400 hover:text-red-500 text-xs">✕</button>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      <span className="text-xs bg-gray-100 px-2 py-1 rounded-full text-gray-500">
                        {job.source || 'manual'}
                      </span>
                      <select
                        value={job.status}
                        onChange={e => handleStatusChange(job.id, e.target.value)}
                        className="ml-auto text-xs border rounded-lg px-2 py-1 text-gray-600 focus:outline-none"
                      >
                        {COLUMNS.map(c => (
                          <option key={c.id} value={c.id}>{c.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}