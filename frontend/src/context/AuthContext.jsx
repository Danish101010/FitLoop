import { createContext, useContext, useState, useEffect } from 'react'
import api from '../services/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  // Check for existing token on mount and verify it's still valid
  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem('fitloop_token')
      const savedUser = localStorage.getItem('fitloop_user')
      
      if (token && savedUser) {
        try {
          // First, restore state from localStorage for immediate UI
          const parsedUser = JSON.parse(savedUser)
          setUser(parsedUser)
          setIsAuthenticated(true)
          
          // Then verify token is still valid by calling /me endpoint
          try {
            const response = await api.get('/api/v1/auth/me')
            // Update user data from server (in case it changed)
            setUser(response.data)
            localStorage.setItem('fitloop_user', JSON.stringify(response.data))
          } catch (verifyError) {
            // Token is invalid/expired - clear auth state
            console.log('[Auth] Token verification failed, logging out')
            localStorage.removeItem('fitloop_token')
            localStorage.removeItem('fitloop_user')
            setUser(null)
            setIsAuthenticated(false)
          }
        } catch (e) {
          console.error('[Auth] Failed to parse saved user:', e)
          localStorage.removeItem('fitloop_token')
          localStorage.removeItem('fitloop_user')
        }
      }
      setLoading(false)
    }
    
    initAuth()
  }, [])

  const login = async (email, password) => {
    const response = await api.post('/api/v1/auth/login', { email, password })
    const { access_token, user: userData } = response.data
    
    localStorage.setItem('fitloop_token', access_token)
    localStorage.setItem('fitloop_user', JSON.stringify(userData))
    
    setUser(userData)
    setIsAuthenticated(true)
    
    return userData
  }

  const signup = async (userData) => {
    const response = await api.post('/api/v1/auth/signup', userData)
    const { access_token, user: newUser } = response.data
    
    console.log('[Auth] Signup successful, saving token:', access_token?.substring(0, 20) + '...')
    localStorage.setItem('fitloop_token', access_token)
    localStorage.setItem('fitloop_user', JSON.stringify(newUser))
    
    // Verify token was saved
    const savedToken = localStorage.getItem('fitloop_token')
    console.log('[Auth] Token saved to localStorage:', !!savedToken)
    
    setUser(newUser)
    setIsAuthenticated(true)
    
    return newUser
  }

  const logout = () => {
    localStorage.removeItem('fitloop_token')
    localStorage.removeItem('fitloop_user')
    
    setUser(null)
    setIsAuthenticated(false)
  }

  const updateUser = async (userData) => {
    const response = await api.put('/api/v1/auth/me', userData)
    const updatedUser = response.data
    
    localStorage.setItem('fitloop_user', JSON.stringify(updatedUser))
    setUser(updatedUser)
    
    return updatedUser
  }

  const value = {
    user,
    loading,
    isAuthenticated,
    login,
    signup,
    logout,
    updateUser,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export default AuthContext
