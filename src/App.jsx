import { BrowserRouter } from 'react-router-dom'
import { AppProvider } from './context/AppContext'
import { AuthProvider } from './auth/AuthProvider'
import AppRoutes from './routes/AppRoutes'

export default function App() {
  return <AppProvider><AuthProvider><BrowserRouter><AppRoutes /></BrowserRouter></AuthProvider></AppProvider>
}
