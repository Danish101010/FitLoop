import { Apple, Zap } from 'lucide-react'

function Header() {
  return (
    <header className="bg-white border-b border-gray-100 sticky top-0 z-50">
      <div className="container mx-auto px-4 py-4 max-w-4xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 gradient-primary rounded-xl flex items-center justify-center shadow-lg shadow-primary-500/30">
              <Apple className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">FitLoop</h1>
              <p className="text-xs text-gray-500">AI Nutrition Tracker</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 bg-primary-50 px-3 py-1.5 rounded-full">
            <Zap className="w-4 h-4 text-primary-600" />
            <span className="text-sm font-medium text-primary-700">Powered by Gemini</span>
          </div>
        </div>
      </div>
    </header>
  )
}

export default Header
