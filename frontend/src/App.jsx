import { useState } from 'react'
import { Toaster } from 'react-hot-toast'
import { AuthProvider, useAuth } from './context/AuthContext'
import AuthPage from './components/AuthPage'
import MainApp from './components/MainApp'

function AppContent() {
  const { isAuthenticated, loading } = useAuth()
  const [guestMode, setGuestMode] = useState(false)

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-blue-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
      </div>
    )
  }

  // Show auth page if not authenticated and not in guest mode
  if (!isAuthenticated && !guestMode) {
    return <AuthPage onGuestMode={() => setGuestMode(true)} />
  }

  return <MainApp />
}

function App() {
  return (
    <AuthProvider>
      <Toaster 
        position="top-center"
        toastOptions={{
          duration: 3000,
          style: {
            background: '#1f2937',
            color: '#fff',
            borderRadius: '12px',
          },
        }}
      />
      <AppContent />
    </AuthProvider>
  )
}

export default App
