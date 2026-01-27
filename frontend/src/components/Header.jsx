import { Sparkles, Moon, Sun } from 'lucide-react'
import { useTheme } from '../context/ThemeContext'

function Header() {
  const { isDark, toggleTheme } = useTheme()

  return (
    <header className="glass border-b border-white/5 dark:border-white/5 light:border-gray-200 light:bg-white/80">
      <div className="container mx-auto px-4 py-4 max-w-4xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 gradient-primary rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <span className="text-xl font-bold text-white">F</span>
            </div>
            <div>
              <h1 className="text-xl font-bold text-white light:text-gray-900">FitLoop</h1>
              <p className="text-xs text-white/40 light:text-gray-500">AI Nutrition Tracker</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all light:bg-gray-100 light:border-gray-200 light:hover:bg-gray-200"
              aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {isDark ? (
                <Sun className="w-5 h-5 text-amber-400" />
              ) : (
                <Moon className="w-5 h-5 text-slate-600" />
              )}
            </button>
            
            <div className="hidden sm:flex items-center gap-2 bg-white/5 border border-white/10 px-3 py-1.5 rounded-full light:bg-gray-100 light:border-gray-200">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400 light:text-emerald-500" />
              <span className="text-xs font-medium text-white/60 light:text-gray-600">Powered by Gemini</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}

export default Header
