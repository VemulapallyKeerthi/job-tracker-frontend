const API_URL = process.env.NEXT_PUBLIC_API_URL!

async function fetchWithRetry(url: string, options: RequestInit = {}, retries = 3): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, { ...options, redirect: 'follow' })
      if (res.ok) return res
      if (res.status === 307 && i < retries - 1) {
        await new Promise(r => setTimeout(r, 2000))
        continue
      }
      return res
    } catch (err) {
      if (i === retries - 1) throw err
      await new Promise(r => setTimeout(r, 2000))
    }
  }
  throw new Error('Max retries reached')
}

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
  const res = await fetchWithRetry(url, {
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

  const res = await fetchWithRetry(`${API_URL}${endpoint}`, {
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
  const res = await fetchWithRetry(`${API_URL}/jobs/${id}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${token}` }
  })
  if (!res.ok) throw new Error('Failed to delete job')
}