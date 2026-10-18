import { apiClient, isBackendMode } from './apiClient'
import { readPreferences } from '../services/storageService'

export async function loadCompanySettings() {
  if (!isBackendMode) return readPreferences()
  return (await apiClient.get('companySettings')).data
}
