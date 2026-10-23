import { apiClient, isBackendMode } from './apiClient'

function requireBackend() {
  if (!isBackendMode) throw new Error('Client signup requests require the connected CRM backend.')
}

export const clientSignupApi = {
  submit: async (payload) => {
    requireBackend()
    return (await apiClient.endpoint('/client-signup-requests', 'POST', payload)).data
  },
  list: async (status = 'Pending') => {
    requireBackend()
    const query = new URLSearchParams({ status })
    return (await apiClient.endpoint(`/client-signup-requests?${query}`, 'GET')).data
  },
  approve: async (id, existingClientId) => {
    requireBackend()
    return (await apiClient.endpoint(`/client-signup-requests/${encodeURIComponent(id)}/approve`, 'POST', {
      ...(existingClientId ? { existingClientId } : {}),
    })).data
  },
  reject: async (id, reason) => {
    requireBackend()
    return (await apiClient.endpoint(`/client-signup-requests/${encodeURIComponent(id)}/reject`, 'POST', { reason })).data
  },
}
