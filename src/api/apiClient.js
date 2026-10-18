import { API_ENDPOINTS } from './endpoints'
import { getStore, persistStore, resetStore } from '../services/storageService'
import { clearAccessToken, getAccessToken, setAccessToken } from './authToken'

export const apiMode = import.meta.env.VITE_API_MODE || 'backend'
export const isBackendMode = apiMode === 'backend'
//const baseUrl = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/v1').replace(/\/+$/, '')
const baseUrl = (import.meta.env.VITE_API_BASE_URL || 'https://crm-backend-9lji.onrender.com/api/v1').replace(/\/+$/, '')
const wait = (ms = 140) => new Promise((resolve) => window.setTimeout(resolve, ms))

let refreshPromise

async function parseResponse(response) {
  if (response.status === 204) return { success: true, data: null }
  const text = await response.text()
  if (!text) return { success: true, data: null }
  try {
    return JSON.parse(text)
  } catch (cause) {
    throw new Error(`The API returned invalid JSON (${response.status}).`, { cause })
  }
}

async function backendRequest(path, method, payload, { retry = true } = {}) {
  const token = getAccessToken()
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    credentials: 'include',
    headers: {
      ...(payload === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
  })
  if (response.status === 401 && retry && token && !path.startsWith('/auth/')) {
    const refreshed = await refreshAccessToken()
    if (refreshed) return backendRequest(path, method, payload, { retry: false })
  }
  const result = await parseResponse(response)
  if (!response.ok) {
    const message = result?.error?.message || `Request failed (${response.status}).`
    const validationDetails = Array.isArray(result?.error?.details)
      ? result.error.details
        .map((detail) => [detail.path, detail.message].filter(Boolean).join(': '))
        .filter(Boolean)
      : []
    const error = new Error(validationDetails.length ? `${message} ${validationDetails.join(' ')}` : message)
    error.status = response.status
    error.code = result?.error?.code
    error.requestId = result?.error?.requestId
    error.details = result?.error?.details
    throw error
  }
  return result
}

export async function refreshAccessToken() {
  if (!refreshPromise) {
    refreshPromise = backendRequest('/auth/refresh', 'POST', undefined, { retry: false })
      .then((result) => {
        setAccessToken(result.data?.accessToken)
        return result.data?.accessToken || null
      })
      .catch((error) => {
        clearAccessToken()
        throw error
      })
      .finally(() => { refreshPromise = null })
  }
  return refreshPromise
}

function apiPath(resource, params = {}) {
  const endpoint = API_ENDPOINTS[resource]
  if (!endpoint) throw new Error(`Unknown API resource: ${resource}`)
  let path = endpoint
  if (params.id !== undefined) path += `/${encodeURIComponent(params.id)}`
  if (params.action) path += `/${encodeURIComponent(params.action)}`
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (key !== 'id' && key !== 'action' && value !== undefined && value !== null && value !== '') {
      query.set(key, String(value))
    }
  }
  const search = query.toString()
  return search ? `${path}?${search}` : path
}

async function request(method, resource, payload, params = {}) {
  const action = resource === 'notifications' && payload?.__action === 'read-all' ? 'read-all' : params.action
  const path = apiPath(resource, { ...params, ...(action ? { action } : {}) })
  if (isBackendMode) return backendRequest(path, method, payload)
  if (apiMode !== 'mock') throw new Error(`Unsupported VITE_API_MODE: ${apiMode}`)
  if (resource === 'dashboard' || resource === 'portal' || resource === 'companySettings' || resource === 'auditLogs') {
    throw new Error(`${resource} is available only in backend mode.`)
  }
  await wait()
  const store = getStore()
  const rows = store[resource] || []
  const id = params.id
  let result
  if (method === 'GET' && id) result = rows.find((row) => String(row.id) === String(id)) || null
  else if (method === 'GET') result = rows
  else if (method === 'POST' && payload?.__action === 'read-all') {
    rows.forEach((row) => { row.read = true })
    store[resource] = rows
    persistStore(store)
    result = { modifiedCount: rows.length }
  } else if (method === 'POST' && payload?.__reset) {
    const fresh = resetStore()
    return { success: true, data: structuredClone(fresh), message: 'Demo data reset.' }
  } else if (method === 'POST') {
    const prefixes = { leads: 'LD', followups: 'FU', clients: 'CL', quotations: 'QT-2026', agreements: 'WO-2026', invoices: 'INV-2026', payments: 'PAY-2026', projects: 'PR', tasks: 'TS', users: 'US', notifications: 'NT' }
    const prefix = prefixes[resource] || resource.slice(0, 2).toUpperCase()
    result = { ...payload, id: payload.id || `${prefix}-${Date.now().toString().slice(-6)}` }
    delete result.__reset
    rows.unshift(result)
    store[resource] = rows
    persistStore(store)
  } else if (method === 'PATCH' || method === 'PUT') {
    const index = rows.findIndex((row) => String(row.id) === String(id))
    if (index < 0) throw new Error(`${resource} record ${id} was not found.`)
    rows[index] = { ...rows[index], ...payload }
    result = rows[index]
    store[resource] = rows
    persistStore(store)
  } else if (method === 'DELETE') {
    const remaining = rows.filter((row) => String(row.id) !== String(id))
    if (remaining.length === rows.length) throw new Error(`${resource} record ${id} was not found.`)
    store[resource] = remaining
    persistStore(store)
    result = { id }
  } else throw new Error(`Unsupported mock operation: ${method}`)
  if (method === 'GET' && id && !result) throw new Error(`${resource} record ${id} was not found.`)
  return { success: true, data: structuredClone(result), message: `${resource} ${method.toLowerCase()} successful` }
}

export const apiClient = {
  get: (resource, params) => request('GET', resource, undefined, params),
  post: (resource, payload) => request('POST', resource, payload),
  patch: (resource, id, payload) => request('PATCH', resource, payload, { id }),
  put: (resource, id, payload) => request('PUT', resource, payload, { id }),
  delete: (resource, id) => request('DELETE', resource, undefined, { id }),
  action: (resource, id, action, payload) => request('POST', resource, payload, { id, action }),
  auth: (action, payload, method = 'POST') => backendRequest(`/auth/${encodeURIComponent(action)}`, method, payload),
  endpoint: (path, method, payload) => backendRequest(path, method, payload),
}

export const resetDemoData = async () => {
  if (isBackendMode) throw new Error('Demo data reset is only available in mock mode.')
  return request('POST', 'leads', { __reset: true })
}
