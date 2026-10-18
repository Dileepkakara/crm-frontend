import { apiClient } from './apiClient'

export const rolesApi = {
  list: async () => {
    const result = await apiClient.endpoint('/roles', 'GET')
    return { roles: result.data, permissions: result.meta?.permissions || [] }
  },
  create: async (payload) => (await apiClient.endpoint('/roles', 'POST', payload)).data,
  update: async (id, payload) => (await apiClient.endpoint(`/roles/${encodeURIComponent(id)}`, 'PATCH', payload)).data,
}
