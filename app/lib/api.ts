const API_URL = process.env.NEXT_PUBLIC_API_URL!

export async function fetchJobs(token: string, filters?: {
  status?: string
  source?: string
  title?: string
}) {
  const params = new URLSearchParams()
  if (filters?.status) params.set('status', filters.status)
  if (filters?.source) params.set('source', filters.source)
  if (filters?.title) params.set('title', filters.title)

  const url = `${API_URL}/jobs/${params.toString() ? `?${params}` : ''}`
  const res = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    }
  })
  if (!res.ok) throw new Error('Failed to fetch jobs')
  return res.json()
}

export async function updateJobStatus(token: string, id: number, status: string) {
  const endpointMap: Record<string, string> = {
    saved: `/jobs/${id}/status?status=saved`,
    applied: `/jobs/${id}/apply`,
    interview: `/jobs/${id}/interview`,
    offer: `/jobs/${id}/offer`,
    rejected: `/jobs/${id}/reject`,
  }
  const endpoint = endpointMap[status]
  const method = status === 'saved' ? 'PATCH' : 'POST'

  const res = await fetch(`${API_URL}${endpoint}`, {
    method,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    
  })
  if (!res.ok) throw new Error('Failed to update job status')
  return res.json()
}

export async function deleteJob(token: string, id: number) {
  const res = await fetch(`${API_URL}/jobs/${id}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${token}` }
  })
  if (!res.ok) throw new Error('Failed to delete job')
}