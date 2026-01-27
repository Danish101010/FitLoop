import { useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider, useAuth } from './context/AuthContext'
import LandingPage from './components/LandingPage'
import AuthPage from './components/AuthPage'
import MainApp from './components/MainApp'
import ProgressDashboard from './components/ProgressDashboard'
import ProfilePage from './components/ProfilePage'
import { AppLayout } from './components/layout/AppLayout'

function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth()
  
  if (loading) {
    return (
      <div className="min-h-screen bg-[#f7f8fa] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-brand-600 border-t-transparent"></div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />
  }

  return <AppLayout>{children}</AppLayout>
}

function PublicRoute({ children }) {
  const { isAuthenticated, loading } = useAuth()
  
  if (loading) {
    return (
      <div className="min-h-screen bg-[#f7f8fa] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-brand-600 border-t-transparent"></div>
      </div>
    )
  }

  if (isAuthenticated) {
    return <Navigate to="/log" replace />
  }

  return children
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route 
        path="/auth" 
        element={
          <PublicRoute>
            <AuthPage />
          </PublicRoute>
        } 
      />
      <Route 
        path="/log" 
        element={
          <ProtectedRoute>
            <MainApp />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/progress" 
        element={
          <ProtectedRoute>
            <ProgressDashboard />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/profile" 
        element={
          <ProtectedRoute>
            <ProfilePage />
          </ProtectedRoute>
        } 
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Toaster 
          position="top-center"
          toastOptions={{
            duration: 3000,
            style: {
              background: '#1f2937',
              color: '#fff',
              borderRadius: '8px',
              fontSize: '14px',
            },
          }}
        />
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
