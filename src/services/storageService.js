import { initialData } from '../mockData'

const STORAGE_KEY = 'designblocks-crm-demo-v1'
let memoryData = null

export function readStore() {
  try {
    const serialized = window.localStorage.getItem(STORAGE_KEY)
    if (serialized) {
      const parsed = JSON.parse(serialized)
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed
      console.warn('CRM demo data was malformed; restoring the sample dataset.')
    }
    return structuredClone(initialData)
  } catch (error) {
    console.warn('Browser storage is unavailable; using in-memory demo data.', error)
    return structuredClone(initialData)
  }
}

export function getStore() {
  if (memoryData) return memoryData
  memoryData = readStore()
  persistStore(memoryData)
  return memoryData
}

export function persistStore(value) {
  memoryData = value
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
  } catch (error) {
    console.warn('Could not persist CRM demo data; changes will last for this session.', error)
  }
}

export function resetStore() {
  const fresh = structuredClone(initialData)
  persistStore(fresh)
  return fresh
}

export function readPreferences() {
  return getStore().preferences || {
    companyName: 'Design Blocks',
    subtitle: 'CRM & Project Management',
    currency: 'INR · Indian Rupee',
  }
}

export function savePreferences(preferences) {
  const store = getStore()
  store.preferences = { ...readPreferences(), ...preferences }
  persistStore(store)
}
