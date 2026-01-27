import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { Camera, BarChart3, User, LogOut, Menu, X } from 'lucide-react'
import { useState } from 'react'

export function AppLayout({ children }) {
  const { user, isAuthenticated, logout } = useAuth()
  const location = useLocation()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const navigation = [
    { name: 'Log Meal', href: '/log', icon: Camera },
    { name: 'Progress', href: '/progress', icon: BarChart3 },
    { name: 'Profile', href: '/profile', icon: User },
  ]

  const isActive = (href) => location.pathname === href

  return (
    <div className="min-h-screen bg-[#f7f8fa]">
      {/* Top Navigation */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="page-container">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2.5">
              <div className="w-9 h-9 bg-brand-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg">F</span>
              </div>
              <span className="text-xl font-semibold text-gray-900">FitLoop</span>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-1">
              {navigation.map((item) => (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive(item.href)
                      ? 'bg-brand-50 text-brand-700'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  <item.icon className="w-4 h-4" />
                  {item.name}
                </Link>
              ))}
            </nav>

            {/* User Menu */}
            <div className="flex items-center gap-3">
              {isAuthenticated ? (
                <>
                  <span className="hidden sm:block text-sm text-gray-600">
                    {user?.full_name || user?.username}
                  </span>
                  <button
                    onClick={logout}
                    className="btn-icon"
                    title="Sign out"
                  >
                    <LogOut className="w-5 h-5" />
                  </button>
                </>
              ) : (
                <Link to="/auth" className="btn-primary btn-sm">
                  Sign In
                </Link>
              )}

              {/* Mobile menu button */}
              <button
                className="md:hidden btn-icon"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-gray-100 bg-white">
            <nav className="page-container py-3 space-y-1">
              {navigation.map((item) => (
                <Link
                  key={item.name}
                  to={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                    isActive(item.href)
                      ? 'bg-brand-50 text-brand-700'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <item.icon className="w-5 h-5" />
                  {item.name}
                </Link>
              ))}
            </nav>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="pb-8">
        {children}
      </main>
    </div>
  )
}

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="bg-white border-b border-gray-200">
      <div className="page-container py-6 sm:py-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="heading-2">{title}</h1>
            {subtitle && <p className="text-muted mt-1">{subtitle}</p>}
          </div>
          {actions && <div className="flex items-center gap-3">{actions}</div>}
        </div>
      </div>
    </div>
  )
}

export function PageContent({ children, narrow }) {
  return (
    <div className={narrow ? 'page-container-narrow py-6 sm:py-8' : 'page-container py-6 sm:py-8'}>
      {children}
    </div>
  )
}

export function Card({ children, className = '', hover = false }) {
  return (
    <div className={`${hover ? 'card-hover' : 'card'} ${className}`}>
      {children}
    </div>
  )
}

export function CardBody({ children, className = '' }) {
  return <div className={`card-body ${className}`}>{children}</div>
}

export function CardHeader({ children, className = '' }) {
  return <div className={`card-header ${className}`}>{children}</div>
}
