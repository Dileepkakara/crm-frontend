const SESSION_KEY = 'designblocks-crm-demo-session'

export function readSessionId() {
  try {
    return window.localStorage.getItem(SESSION_KEY)
  } catch (error) {
    console.warn('Could not restore the demo sign-in session.', error)
    return null
  }
}

export function writeSessionId(userId) {
  try {
    window.localStorage.setItem(SESSION_KEY, userId)
  } catch (error) {
    console.warn('Could not persist the demo sign-in session.', error)
  }
}

export function clearSession() {
  try {
    window.localStorage.removeItem(SESSION_KEY)
  } catch (error) {
    console.warn('Could not clear the demo sign-in session.', error)
  }
}
