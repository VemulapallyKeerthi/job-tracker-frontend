'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabase'
import { fetchJobs, updateJobStatus, deleteJob } from '../lib/api'

const COLUMNS = [
  { id: 'saved', label: 'Saved', lightColor: 'bg-blue-50 border-blue-200', darkColor: 'bg-blue-900/20 border-blue-800', dot: 'bg-blue-500' },
  { id: 'applied', label: 'Applied', lightColor: 'bg-purple-50 border-purple-200', darkColor: 'bg-purple-900/20 border-purple-800', dot: 'bg-purple-500' },
  { id: 'interview', label: 'Interview', lightColor: 'bg-amber-50 border-amber-200', darkColor: 'bg-amber-900/20 border-amber-800', dot: 'bg-amber-500' },
  { id: 'offer', label: 'Offer', lightColor: 'bg-green-50 border-green-200', darkColor: 'bg-green-900/20 border-green-800', dot: 'bg-green-500' },
  { id: 'rejected', label: 'Rejected', lightColor: 'bg-red-50 border-red-200', darkColor: 'bg-red-900/20 border-red-800', dot: 'bg-red-500' },
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
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays} days ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

type View = 'board' | 'table' | 'analytics'

export default function Dashboard() {
  const router = useRouter()
  const [jobs, setJobs] = useState<any[]>([])
  const [token, setToken] = useState<string>('')
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<View>('board')
  const [showAddJob, setShowAddJob] = useState(false)
  const [dark, setDark] = useState(false)

  // Filters
  const [search, setSearch] = useState('')
  const [sourceFilter, setSourceFilter] = useState('')
  const [locationFilter, setLocationFilter] = useState('')
  const [dateRange, setDateRange] = useState(0)
  const [sortNewest, setSortNewest] = useState(true)

  // Add Job form
  const [newJob, setNewJob] = useState({
    title: '', company: '', location: '', apply_link: '', source: 'other', status: 'applied'
  })
  const [adding, setAdding] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.push('/'); return }
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
    try { await updateJobStatus(token, jobId, newStatus) }
    catch { fetchJobs(token).then(setJobs) }
  }

  const handleDelete = async (jobId: number) => {
    if (!confirm('Remove this job?')) return
    setJobs(prev => prev.filter(j => j.id !== jobId))
    try { await deleteJob(token, jobId) }
    catch { fetchJobs(token).then(setJobs) }
  }

  const handleAddJob = async () => {
    if (!newJob.title || !newJob.company) return
    setAdding(true)
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL!
      const res = await fetch(`${API_URL}/jobs/`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...newJob, posted_date: new Date().toISOString().split('T')[0] })
      })
      if (res.ok) {
        const added = await res.json()
        setJobs(prev => [added, ...prev])
        setShowAddJob(false)
        setNewJob({ title: '', company: '', location: '', apply_link: '', source: 'other', status: 'applied' })
      }
    } catch (e) { console.error(e) }
    setAdding(false)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  const sources = [...new Set(jobs.map(j => j.source).filter(Boolean))]

  const filtered = jobs
    .filter(j => {
      const matchSearch = !search ||
        j.title?.toLowerCase().includes(search.toLowerCase()) ||
        j.company?.toLowerCase().includes(search.toLowerCase())
      const matchSource = !sourceFilter || j.source === sourceFilter
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
      return matchSearch && matchSource && matchLocation && matchDate
    })
    .sort((a, b) => {
      if (!sortNewest) return 0
      const dateA = a.posted_date ? new Date(a.posted_date).getTime() : 0
      const dateB = b.posted_date ? new Date(b.posted_date).getTime() : 0
      return dateB - dateA
    })

  const hasActiveFilters = search || sourceFilter || locationFilter || dateRange > 0
  const clearFilters = () => { setSearch(''); setSourceFilter(''); setLocationFilter(''); setDateRange(0) }

  const statusCounts = COLUMNS.map(col => ({ ...col, count: jobs.filter(j => j.status === col.id).length }))
  const sourceCounts = sources.map(s => ({ source: s, count: jobs.filter(j => j.source === s).length }))

  // Dark mode classes
  const bg = dark ? 'bg-gray-900' : 'bg-gray-50'
  const navBg = dark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
  const cardBg = dark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
  const jobCardBg = dark ? 'bg-gray-750' : 'bg-white'
  const textPrimary = dark ? 'text-white' : 'text-gray-800'
  const textSecondary = dark ? 'text-gray-300' : 'text-gray-500'
  const textMuted = dark ? 'text-gray-400' : 'text-gray-400'
  const inputClass = dark
    ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
    : 'bg-white border-gray-200 text-gray-800 placeholder-gray-400'
  const selectClass = dark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-200 text-gray-600'
  const rowHover = dark ? 'hover:bg-gray-700' : 'hover:bg-gray-50'
  const dividerClass = dark ? 'border-gray-700' : 'border-gray-100'

  if (loading) return (
    <div className={`min-h-screen flex items-center justify-center ${bg}`}>
      <div className={`text-lg ${textSecondary}`}>Loading jobs...</div>
    </div>
  )

  return (
    <div className={`min-h-screen ${bg} transition-colors duration-200`}>

      {/* Navbar */}
      <nav className={`${navBg} border-b px-6 py-3 flex items-center justify-between sticky top-0 z-20 shadow-sm`}>
        <div className="flex items-center gap-2">
          <span className="text-2xl">💼</span>
          <h1 className={`text-xl font-bold ${textPrimary}`}>JobTracker</h1>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowAddJob(true)}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition"
          >
            + Add Job
          </button>
          <span className={`text-sm ${textSecondary} hidden sm:block`}>{user?.email}</span>
          <button onClick={() => setDark(!dark)} className="text-xl p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition">
            {dark ? '☀️' : '🌙'}
          </button>
          <button onClick={handleLogout} className="text-sm text-red-500 hover:text-red-700 font-medium">
            Logout
          </button>
        </div>
      </nav>

      {/* Filters Bar */}
      <div className={`${navBg} border-b px-6 py-3 sticky top-14 z-10 shadow-sm`}>
        <div className="flex flex-wrap gap-3 items-center">
          <input
            type="text"
            placeholder="Search title or company..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className={`px-4 py-2 rounded-full border text-sm w-56 focus:outline-none focus:ring-2 focus:ring-blue-300 ${inputClass}`}
          />
          {view !== 'analytics' && <>
            <select value={sourceFilter} onChange={e => setSourceFilter(e.target.value)}
              className={`px-3 py-2 rounded-full border text-sm focus:outline-none ${selectClass}`}>
              <option value="">All Sources</option>
              {sources.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
            </select>
            <select value={locationFilter} onChange={e => setLocationFilter(e.target.value)}
              className={`px-3 py-2 rounded-full border text-sm focus:outline-none ${selectClass}`}>
              <option value="">All Locations</option>
              <option value="remote">Remote</option>
              <option value="onsite">On-site</option>
            </select>
            <select value={dateRange} onChange={e => setDateRange(Number(e.target.value))}
              className={`px-3 py-2 rounded-full border text-sm focus:outline-none ${selectClass}`}>
              {DATE_RANGES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
            <button onClick={() => setSortNewest(!sortNewest)}
              className={`px-3 py-2 rounded-full border text-sm font-medium transition ${sortNewest ? 'bg-blue-500 text-white border-blue-500' : `${selectClass}`}`}>
              {sortNewest ? '↓ Newest' : '↕ Default'}
            </button>
            {hasActiveFilters && (
              <button onClick={clearFilters} className="px-3 py-2 rounded-full border border-red-200 text-red-500 text-sm hover:bg-red-50 transition">
                ✕ Clear
              </button>
            )}
          </>}

          {/* View Toggle */}
          <div className={`flex rounded-lg border overflow-hidden ml-auto ${dark ? 'border-gray-600' : 'border-gray-200'}`}>
            {(['board', 'table', 'analytics'] as View[]).map(v => (
              <button key={v} onClick={() => setView(v)}
                className={`px-4 py-1.5 text-sm font-medium transition ${view === v ? 'bg-blue-500 text-white' : `${dark ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-600 hover:bg-gray-50'}`}`}>
                {v === 'board' ? '⊞ Board' : v === 'table' ? '☰ Table' : '📊 Analytics'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Board View */}
      {view === 'board' && (
        <div className="p-6 flex gap-4 overflow-x-auto">
          {COLUMNS.map(col => {
            const colJobs = filtered.filter(j => j.status === col.id)
            const colColor = dark ? col.darkColor : col.lightColor
            return (
              <div key={col.id} className={`flex-shrink-0 w-72 rounded-2xl border ${colColor} p-4`}>
                <div className="flex items-center gap-2 mb-4">
                  <div className={`w-3 h-3 rounded-full ${col.dot}`} />
                  <h2 className={`font-semibold ${dark ? 'text-gray-200' : 'text-gray-700'}`}>{col.label}</h2>
                  <span className={`ml-auto text-sm ${textMuted}`}>{colJobs.length}</span>
                </div>
                <div className="flex flex-col gap-3">
                  {colJobs.map(job => (
                    <div key={job.id} className={`${dark ? 'bg-gray-800' : 'bg-white'} rounded-xl p-4 shadow-sm hover:shadow-md transition`}>
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <h3 className={`font-semibold ${textPrimary} text-sm truncate`}>{job.title}</h3>
                          <p className={`text-xs ${textSecondary} truncate`}>{job.company}</p>
                          <p className={`text-xs ${textMuted} truncate mt-1`}>{job.location}</p>
                        </div>
                        <div className="flex gap-1 ml-2">
                          {job.apply_link && (
                            <a href={job.apply_link} target="_blank" rel="noopener noreferrer"
                              className="text-gray-400 hover:text-blue-500 text-xs">↗</a>
                          )}
                          <button onClick={() => handleDelete(job.id)} className="text-gray-400 hover:text-red-500 text-xs">✕</button>
                        </div>
                      </div>
                      {job.posted_date && (
                        <p className={`text-xs ${textMuted} mt-1`}>📅 {formatDate(job.posted_date)}</p>
                      )}
                      <div className="mt-3 flex items-center gap-2">
                        <span className={`text-xs ${dark ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-500'} px-2 py-1 rounded-full`}>
                          {job.source || 'manual'}
                        </span>
                        <select value={job.status} onChange={e => handleStatusChange(job.id, e.target.value)}
                          className={`ml-auto text-xs border rounded-lg px-2 py-1 focus:outline-none ${dark ? 'bg-gray-700 border-gray-600 text-gray-300' : 'border-gray-200 text-gray-600'}`}>
                          {COLUMNS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                        </select>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Table View */}
      {view === 'table' && (
        <div className="p-6">
          <div className={`rounded-xl overflow-hidden border ${dark ? 'border-gray-700' : 'border-gray-200'} shadow-sm`}>
            <table className="w-full text-sm">
              <thead className={`${dark ? 'bg-gray-800 text-gray-300' : 'bg-gray-50 text-gray-600'}`}>
                <tr>
                  {['Title', 'Company', 'Location', 'Source', 'Posted', 'Status', 'Actions'].map(h => (
                    <th key={h} className="text-left px-4 py-3 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(job => (
                  <tr key={job.id} className={`border-t ${dividerClass} ${rowHover} transition`}>
                    <td className={`px-4 py-3 font-medium max-w-xs truncate ${textPrimary}`}>{job.title}</td>
                    <td className={`px-4 py-3 ${textSecondary}`}>{job.company}</td>
                    <td className={`px-4 py-3 ${textSecondary} max-w-xs truncate`}>{job.location}</td>
                    <td className="px-4 py-3">
                      <span className={`${dark ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600'} px-2 py-1 rounded-full text-xs`}>{job.source}</span>
                    </td>
                    <td className={`px-4 py-3 ${textMuted} text-xs`}>{formatDate(job.posted_date)}</td>
                    <td className="px-4 py-3">
                      <select value={job.status} onChange={e => handleStatusChange(job.id, e.target.value)}
                        className={`text-xs border rounded-lg px-2 py-1 focus:outline-none ${dark ? 'bg-gray-700 border-gray-600 text-gray-300' : 'border-gray-200 text-gray-600'}`}>
                        {COLUMNS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        {job.apply_link && (
                          <a href={job.apply_link} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-700 text-xs">Apply ↗</a>
                        )}
                        <button onClick={() => handleDelete(job.id)} className="text-red-400 hover:text-red-600 text-xs">Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Analytics View */}
      {view === 'analytics' && (
        <div className="p-6 max-w-4xl mx-auto">
          <h2 className={`text-xl font-bold mb-6 ${textPrimary}`}>Application Analytics</h2>
          <div className="grid grid-cols-5 gap-4 mb-8">
            {statusCounts.map(col => (
              <div key={col.id} className={`rounded-xl p-4 border ${dark ? col.darkColor : col.lightColor} text-center`}>
                <div className={`text-3xl font-bold ${textPrimary}`}>{col.count}</div>
                <div className={`text-sm ${textSecondary} mt-1`}>{col.label}</div>
              </div>
            ))}
          </div>
          <div className={`rounded-xl p-4 mb-8 ${cardBg} border shadow-sm`}>
            <p className={`text-sm ${textSecondary}`}>Total jobs tracked</p>
            <p className={`text-4xl font-bold ${textPrimary}`}>{jobs.length}</p>
          </div>
          <div className={`rounded-xl p-6 ${cardBg} border shadow-sm mb-8`}>
            <h3 className={`font-semibold mb-4 ${textPrimary}`}>Jobs by Source</h3>
            <div className="space-y-3">
              {sourceCounts.map(s => (
                <div key={s.source} className="flex items-center gap-3">
                  <span className={`text-sm ${textSecondary} w-24 capitalize`}>{s.source}</span>
                  <div className={`flex-1 ${dark ? 'bg-gray-700' : 'bg-gray-100'} rounded-full h-3`}>
                    <div className="bg-blue-500 h-3 rounded-full" style={{ width: `${jobs.length ? (s.count / jobs.length) * 100 : 0}%` }} />
                  </div>
                  <span className={`text-sm ${textMuted} w-8 text-right`}>{s.count}</span>
                </div>
              ))}
            </div>
          </div>
          <div className={`rounded-xl p-6 ${cardBg} border shadow-sm`}>
            <h3 className={`font-semibold mb-4 ${textPrimary}`}>Application Funnel</h3>
            <div className="space-y-3">
              {statusCounts.map(col => (
                <div key={col.id} className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${col.dot}`} />
                  <span className={`text-sm ${textSecondary} w-24`}>{col.label}</span>
                  <div className={`flex-1 ${dark ? 'bg-gray-700' : 'bg-gray-100'} rounded-full h-3`}>
                    <div className={`${col.dot} h-3 rounded-full`} style={{ width: `${jobs.length ? (col.count / jobs.length) * 100 : 0}%` }} />
                  </div>
                  <span className={`text-sm ${textMuted} w-8 text-right`}>{col.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Add Job Modal */}
      {showAddJob && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className={`${dark ? 'bg-gray-800' : 'bg-white'} rounded-2xl p-6 w-full max-w-md shadow-xl`}>
            <h2 className={`text-lg font-bold mb-4 ${textPrimary}`}>Add Job Manually</h2>
            <div className="space-y-3">
              {[
                { placeholder: 'Job Title *', key: 'title' },
                { placeholder: 'Company *', key: 'company' },
                { placeholder: 'Location', key: 'location' },
                { placeholder: 'Apply Link (URL)', key: 'apply_link' },
              ].map(field => (
                <input
                  key={field.key}
                  placeholder={field.placeholder}
                  value={(newJob as any)[field.key]}
                  onChange={e => setNewJob({ ...newJob, [field.key]: e.target.value })}
                  className={`w-full px-4 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 ${inputClass}`}
                />
              ))}
              <select
                value={newJob.status}
                onChange={e => setNewJob({ ...newJob, status: e.target.value })}
                className={`w-full px-4 py-2 rounded-lg border text-sm focus:outline-none ${inputClass}`}
              >
                {COLUMNS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowAddJob(false)}
                className={`flex-1 py-2 border rounded-lg text-sm ${dark ? 'border-gray-600 text-gray-300 hover:bg-gray-700' : 'text-gray-600 hover:bg-gray-50'} transition`}>
                Cancel
              </button>
              <button onClick={handleAddJob} disabled={adding || !newJob.title || !newJob.company}
                className="flex-1 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition disabled:opacity-50">
                {adding ? 'Adding...' : 'Add Job'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}