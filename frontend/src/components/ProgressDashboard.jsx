import { useState, useEffect } from 'react'
import { 
  Calendar, 
  TrendingUp, 
  Flame, 
  Beef, 
  Wheat, 
  Droplets,
  ChevronLeft,
  ChevronRight,
  Award,
  Target,
  BarChart3
} from 'lucide-react'
import { getWeeklyProgress, getMonthlyProgress, getTodayProgress } from '../services/api'
import toast from 'react-hot-toast'

export default function ProgressDashboard({ user }) {
  const [activeTab, setActiveTab] = useState('weekly')
  const [loading, setLoading] = useState(true)
  const [weeklyData, setWeeklyData] = useState(null)
  const [monthlyData, setMonthlyData] = useState(null)
  const [todayData, setTodayData] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    loadProgressData()
  }, [])

  const loadProgressData = async () => {
    setLoading(true)
    setError(null)
    try {
      const [today, weekly, monthly] = await Promise.all([
        getTodayProgress(),
        getWeeklyProgress(),
        getMonthlyProgress()
      ])
      setTodayData(today)
      setWeeklyData(weekly)
      setMonthlyData(monthly)
    } catch (error) {
      console.error('Failed to load progress:', error)
      setError(error.message || 'Failed to load progress data')
      toast.error('Failed to load progress data')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <div className="text-red-500 text-lg mb-2">⚠️ {error}</div>
        <button
          onClick={loadProgressData}
          className="px-4 py-2 text-sm bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors"
        >
          Try Again
        </button>
      </div>
    )
  }

  // Default values if data is missing
  const safeToday = todayData || {
    calories: { consumed: 0, target: 2000 },
    protein: { consumed: 0, target: 150 },
    carbs: { consumed: 0, target: 250 },
    fat: { consumed: 0, target: 65 },
    meals_logged: 0
  }

  const safeWeekly = weeklyData || {
    days: Array(7).fill(null).map((_, i) => ({
      date: new Date(Date.now() - (6 - i) * 86400000).toISOString().split('T')[0],
      day_name: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date(Date.now() - (6 - i) * 86400000).getDay()],
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      meals_logged: 0,
      calorie_goal_met: false
    })),
    targets: { calories: 2000, protein: 150, carbs: 250, fat: 65 },
    averages: { calories: 0, protein: 0, carbs: 0, fat: 0 },
    totals: { meals: 0 }
  }

  const safeMonthly = monthlyData || {
    days: Array(30).fill(null).map((_, i) => ({
      date: new Date(Date.now() - (29 - i) * 86400000).toISOString().split('T')[0],
      calories: 0,
      meals_logged: 0
    })),
    targets: { calories: 2000 },
    averages: { calories: 0, protein: 0 },
    totals: { meals: 0 },
    days_active: 0
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Your Progress</h2>
          <p className="text-gray-600 mt-1">Track your nutrition journey</p>
        </div>
        <button
          onClick={loadProgressData}
          className="px-4 py-2 text-sm bg-emerald-100 text-emerald-700 rounded-lg hover:bg-emerald-200 transition-colors"
        >
          Refresh
        </button>
      </div>

      {/* Today's Summary Card */}
      <div className="bg-gradient-to-r from-emerald-500 to-teal-500 rounded-2xl p-6 text-white shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold opacity-90">Today's Progress</h3>
          <span className="text-sm opacity-75">{safeToday.meals_logged} meals logged</span>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <ProgressStat 
            icon={Flame}
            label="Calories"
            value={safeToday.calories.consumed}
            target={safeToday.calories.target}
            unit="kcal"
          />
          <ProgressStat 
            icon={Beef}
            label="Protein"
            value={safeToday.protein.consumed}
            target={safeToday.protein.target}
            unit="g"
          />
          <ProgressStat 
            icon={Wheat}
            label="Carbs"
            value={safeToday.carbs.consumed}
            target={safeToday.carbs.target}
            unit="g"
          />
          <ProgressStat 
            icon={Droplets}
            label="Fat"
            value={safeToday.fat.consumed}
            target={safeToday.fat.target}
            unit="g"
          />
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex bg-gray-100 rounded-xl p-1">
        <button
          onClick={() => setActiveTab('weekly')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium rounded-lg transition-all ${
            activeTab === 'weekly' 
              ? 'bg-white text-emerald-600 shadow-sm' 
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <Calendar className="w-4 h-4" />
          Weekly
        </button>
        <button
          onClick={() => setActiveTab('monthly')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium rounded-lg transition-all ${
            activeTab === 'monthly' 
              ? 'bg-white text-emerald-600 shadow-sm' 
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          Monthly
        </button>
      </div>

      {/* Weekly View */}
      {activeTab === 'weekly' && (
        <div className="space-y-6">
          {/* Weekly Chart */}
          <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Calorie Intake</h3>
            <div className="flex items-end justify-between gap-2 h-48">
              {safeWeekly.days.map((day, index) => {
                const percentage = Math.min((day.calories / safeWeekly.targets.calories) * 100, 100)
                const isToday = index === 6
                
                return (
                  <div key={day.date} className="flex-1 flex flex-col items-center gap-2">
                    <div className="w-full bg-gray-100 rounded-t-lg relative" style={{ height: '140px' }}>
                      <div 
                        className={`absolute bottom-0 w-full rounded-t-lg transition-all ${
                          day.calorie_goal_met 
                            ? 'bg-gradient-to-t from-emerald-500 to-emerald-400' 
                            : 'bg-gradient-to-t from-gray-300 to-gray-200'
                        } ${isToday ? 'ring-2 ring-emerald-500 ring-offset-2' : ''}`}
                        style={{ height: `${percentage}%` }}
                      />
                    </div>
                    <span className={`text-xs font-medium ${isToday ? 'text-emerald-600' : 'text-gray-500'}`}>
                      {day.day_name}
                    </span>
                    <span className="text-xs text-gray-400">{Math.round(day.calories)}</span>
                  </div>
                )
              })}
            </div>
            <div className="flex items-center justify-center gap-2 mt-4 text-sm text-gray-500">
              <div className="w-3 h-3 bg-emerald-500 rounded" />
              <span>Goal met</span>
              <div className="w-3 h-3 bg-gray-300 rounded ml-4" />
              <span>Below goal</span>
            </div>
          </div>

          {/* Weekly Averages */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <AverageCard 
              label="Avg Calories"
              value={safeWeekly.averages.calories}
              target={safeWeekly.targets.calories}
              unit="kcal"
              color="orange"
            />
            <AverageCard 
              label="Avg Protein"
              value={safeWeekly.averages.protein}
              target={safeWeekly.targets.protein}
              unit="g"
              color="red"
            />
            <AverageCard 
              label="Avg Carbs"
              value={safeWeekly.averages.carbs}
              target={safeWeekly.targets.carbs}
              unit="g"
              color="amber"
            />
            <AverageCard 
              label="Avg Fat"
              value={safeWeekly.averages.fat}
              target={safeWeekly.targets.fat}
              unit="g"
              color="blue"
            />
          </div>

          {/* Weekly Stats */}
          <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Weekly Stats</h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-4 bg-emerald-50 rounded-xl">
                <div className="text-3xl font-bold text-emerald-600">{safeWeekly.totals.meals || 0}</div>
                <div className="text-sm text-gray-600 mt-1">Meals Logged</div>
              </div>
              <div className="text-center p-4 bg-orange-50 rounded-xl">
                <div className="text-3xl font-bold text-orange-600">{Math.round(safeWeekly.totals.calories || 0).toLocaleString()}</div>
                <div className="text-sm text-gray-600 mt-1">Total Calories</div>
              </div>
              <div className="text-center p-4 bg-red-50 rounded-xl">
                <div className="text-3xl font-bold text-red-600">{Math.round(safeWeekly.totals.protein || 0)}g</div>
                <div className="text-sm text-gray-600 mt-1">Total Protein</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Monthly View */}
      {activeTab === 'monthly' && (
        <div className="space-y-6">
          {/* Monthly Heatmap */}
          <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">30-Day Activity</h3>
            <div className="grid grid-cols-7 gap-1">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <div key={day} className="text-center text-xs text-gray-400 py-1">{day}</div>
              ))}
              {safeMonthly.days.map((day, index) => {
                const percentage = day.calories / safeMonthly.targets.calories
                const intensity = 
                  percentage === 0 ? 'bg-gray-100' :
                  percentage < 0.5 ? 'bg-emerald-200' :
                  percentage < 0.8 ? 'bg-emerald-300' :
                  percentage < 1 ? 'bg-emerald-400' :
                  'bg-emerald-500'
                
                return (
                  <div 
                    key={day.date}
                    className={`aspect-square rounded ${intensity} cursor-pointer hover:ring-2 hover:ring-emerald-500 hover:ring-offset-1 transition-all`}
                    title={`${day.date}: ${Math.round(day.calories)} kcal`}
                  />
                )
              })}
            </div>
            <div className="flex items-center justify-center gap-2 mt-4 text-xs text-gray-500">
              <span>Less</span>
              <div className="w-3 h-3 bg-gray-100 rounded" />
              <div className="w-3 h-3 bg-emerald-200 rounded" />
              <div className="w-3 h-3 bg-emerald-300 rounded" />
              <div className="w-3 h-3 bg-emerald-400 rounded" />
              <div className="w-3 h-3 bg-emerald-500 rounded" />
              <span>More</span>
            </div>
          </div>

          {/* Weekly Breakdown */}
          {safeMonthly.weeks && safeMonthly.weeks.length > 0 && (
            <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Weekly Breakdown</h3>
              <div className="space-y-4">
                {safeMonthly.weeks.map((week) => (
                  <div key={week.week} className="flex items-center gap-4">
                    <div className="w-20 text-sm font-medium text-gray-600">Week {week.week}</div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-gray-600">{Math.round(week.avg_calories)} avg cal/day</span>
                        <span className="text-gray-400">{Math.round(week.total_calories).toLocaleString()} total</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 rounded-full transition-all"
                          style={{ width: `${Math.min((week.avg_calories / safeMonthly.targets.calories) * 100, 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Monthly Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl p-4 shadow border border-gray-100 text-center">
              <div className="text-2xl font-bold text-gray-900">{safeMonthly.days_logged || safeMonthly.days_active || 0}</div>
              <div className="text-sm text-gray-500">Days Active</div>
            </div>
            <div className="bg-white rounded-xl p-4 shadow border border-gray-100 text-center">
              <div className="text-2xl font-bold text-gray-900">{safeMonthly.totals.meals || 0}</div>
              <div className="text-sm text-gray-500">Total Meals</div>
            </div>
            <div className="bg-white rounded-xl p-4 shadow border border-gray-100 text-center">
              <div className="text-2xl font-bold text-gray-900">{Math.round(safeMonthly.averages.calories || 0)}</div>
              <div className="text-sm text-gray-500">Avg Calories</div>
            </div>
            <div className="bg-white rounded-xl p-4 shadow border border-gray-100 text-center">
              <div className="text-2xl font-bold text-gray-900">{Math.round(safeMonthly.averages.protein || 0)}g</div>
              <div className="text-sm text-gray-500">Avg Protein</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ProgressStat({ icon: Icon, label, value, target, unit }) {
  const percentage = Math.min((value / target) * 100, 100)
  
  return (
    <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-4 h-4 opacity-75" />
        <span className="text-sm opacity-75">{label}</span>
      </div>
      <div className="text-xl font-bold">{Math.round(value)}<span className="text-sm font-normal opacity-75">/{target} {unit}</span></div>
      <div className="h-1.5 bg-white/20 rounded-full mt-2 overflow-hidden">
        <div 
          className="h-full bg-white rounded-full transition-all"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}

function AverageCard({ label, value, target, unit, color }) {
  const percentage = Math.round((value / target) * 100)
  const colorClasses = {
    orange: 'bg-orange-50 text-orange-600',
    red: 'bg-red-50 text-red-600',
    amber: 'bg-amber-50 text-amber-600',
    blue: 'bg-blue-50 text-blue-600',
  }
  
  return (
    <div className="bg-white rounded-xl p-4 shadow border border-gray-100">
      <div className="text-sm text-gray-500 mb-1">{label}</div>
      <div className="text-2xl font-bold text-gray-900">
        {Math.round(value)}<span className="text-sm font-normal text-gray-400 ml-1">{unit}</span>
      </div>
      <div className={`inline-flex items-center gap-1 mt-2 px-2 py-0.5 rounded-full text-xs font-medium ${colorClasses[color]}`}>
        {percentage}% of goal
      </div>
    </div>
  )
}
