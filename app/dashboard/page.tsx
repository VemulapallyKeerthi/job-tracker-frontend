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

const DATE_RANGES = [
  { label: 'All time', value: 0 },
  { label: 'Last 24 hours', value: 1 },
  { label: 'Last 7 days', value: 7 },
  { label: 'Last 30 days', value: 30 },
]

function formatDate(dateStr: string | null): string {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays} days ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function Dashboard() {
  const router = useRouter()
  const [jobs, setJobs] = useState<any[]>([])
  const [token, setToken] = useState<string>('')
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  // Filters
  const [search, setSearch] = useState('')
  const [sourceFilter, setSourceFilter] = useState('')
  const [jobTypeFilter, setJobTypeFilter] = useState('')
  const [locationFilter, setLocationFilter] = useState('')
  const [dateRange, setDateRange] = useState(0)
  const [sortNewest, setSortNewest] = useState(true)

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
    setJobs(prev => prev.map(j => j.id === jobId ? { ...j, status: newStatus } : j))
    try {
      await updateJobStatus(token, jobId, newStatus)
    } catch {
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

  // Get unique sources from jobs
  const sources = [...new Set(jobs.map(j => j.source).filter(Boolean))]

  // Apply all filters
  const filtered = jobs
    .filter(j => {
      const matchSearch = !search ||
        j.title?.toLowerCase().includes(search.toLowerCase()) ||
        j.company?.toLowerCase().includes(search.toLowerCase())

      const matchSource = !sourceFilter || j.source === sourceFilter

      const matchJobType = !jobTypeFilter || j.job_type === jobTypeFilter

      const matchLocation = !locationFilter ||
        (locationFilter === 'remote' && j.location?.toLowerCase().includes('remote')) ||
        (locationFilter === 'onsite' && !j.location?.toLowerCase().includes('remote'))

      const matchDate = dateRange === 0 || (() => {
        if (!j.posted_date) return true
        const posted = new Date(j.posted_date)
        const cutoff = new Date()
        cutoff.setDate(cutoff.getDate() - dateRange)
        return posted >= cutoff
      })()

      return matchSearch && matchSource && matchJobType && matchLocation && matchDate
    })
    .sort((a, b) => {
      if (!sortNewest) return 0
      const dateA = a.posted_date ? new Date(a.posted_date).getTime() : 0
      const dateB = b.posted_date ? new Date(b.posted_date).getTime() : 0
      return dateB - dateA
    })

  const hasActiveFilters = search || sourceFilter || jobTypeFilter || locationFilter || dateRange > 0

  const clearFilters = () => {
    setSearch('')
    setSourceFilter('')
    setJobTypeFilter('')
    setLocationFilter('')
    setDateRange(0)
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-gray-500 text-lg">Loading jobs...</div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navbar */}
      <nav className="bg-white border-b px-6 py-4 flex items-center justify-between sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="text-2xl">💼</span>
          <h1 className="text-xl font-bold text-gray-800">JobTracker</h1>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500">{user?.email}</span>
          <button onClick={handleLogout} className="text-sm text-red-500 hover:text-red-700 font-medium">
            Logout
          </button>
        </div>
      </nav>

      {/* Filters Bar */}
      <div className="px-6 py-3 bg-white border-b sticky top-16 z-10 shadow-sm">
        <div className="flex flex-wrap gap-3 items-center">
          {/* Search */}
          <input
            type="text"
            placeholder="Search title or company..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="px-4 py-2 rounded-full border border-gray-200 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-300 text-sm w-64"
          />

          {/* Source filter */}
          <select
            value={sourceFilter}
            onChange={e => setSourceFilter(e.target.value)}
            className="px-3 py-2 rounded-full border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
          >
            <option value="">All Sources</option>
            {sources.map(s => (
              <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
            ))}
          </select>

          {/* Job type filter */}
          <select
            value={jobTypeFilter}
            onChange={e => setJobTypeFilter(e.target.value)}
            className="px-3 py-2 rounded-full border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
          >
            <option value="">All Types</option>
            <option value="full_time">Full-time</option>
            <option value="contract">Contract</option>
            <option value="internship">Internship</option>
            <option value="part_time">Part-time</option>
          </select>

          {/* Location filter */}
          <select
            value={locationFilter}
            onChange={e => setLocationFilter(e.target.value)}
            className="px-3 py-2 rounded-full border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
          >
            <option value="">All Locations</option>
            <option value="remote">Remote</option>
            <option value="onsite">On-site</option>
          </select>

          {/* Date range filter */}
          <select
            value={dateRange}
            onChange={e => setDateRange(Number(e.target.value))}
            className="px-3 py-2 rounded-full border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
          >
            {DATE_RANGES.map(r => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>

          {/* Sort newest */}
          <button
            onClick={() => setSortNewest(!sortNewest)}
            className={`px-3 py-2 rounded-full border text-sm font-medium transition ${
              sortNewest
                ? 'bg-blue-500 text-white border-blue-500'
                : 'bg-white text-gray-600 border-gray-200'
            }`}
          >
            {sortNewest ? '↓ Newest first' : '↕ Default order'}
          </button>

          {/* Clear filters */}
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="px-3 py-2 rounded-full border border-red-200 text-red-500 text-sm hover:bg-red-50 transition"
            >
              ✕ Clear filters
            </button>
          )}
        </div>
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
                  <div key={job.id} className="bg-white rounded-xl p-4 shadow-sm hover:shadow-md transition">
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

                    {/* Posted date */}
                    {job.posted_date && (
                      <p className="text-xs text-gray-400 mt-1">
                        📅 {formatDate(job.posted_date)}
                      </p>
                    )}

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