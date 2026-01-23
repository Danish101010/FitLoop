import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import Header from './Header'
import ImageUpload from './ImageUpload'
import MealAnalysis from './MealAnalysis'
import MealConfirmation from './MealConfirmation'
import PidRecommendations from './PidRecommendations'
import DailyProgress from './DailyProgress'
import ProgressDashboard from './ProgressDashboard'
import { analyzeMeal, confirmMeal, getPidAnalysis, getTodayProgress } from '../services/api'
import toast from 'react-hot-toast'
import { Camera, BarChart3, History, User, LogOut, Settings } from 'lucide-react'

// App states
const STATES = {
  UPLOAD: 'upload',
  ANALYZING: 'analyzing',
  REVIEW: 'review',
  CONFIRMING: 'confirming',
  PID_LOADING: 'pid_loading',
  RESULTS: 'results',
}

const VIEWS = {
  LOG_MEAL: 'log_meal',
  PROGRESS: 'progress',
  PROFILE: 'profile',
}

export default function MainApp() {
  const { user, isAuthenticated, logout } = useAuth()
  
  const [currentView, setCurrentView] = useState(VIEWS.LOG_MEAL)
  const [appState, setAppState] = useState(STATES.UPLOAD)
  const [mealId, setMealId] = useState(null)
  const [detection, setDetection] = useState(null)
  const [confirmedMeal, setConfirmedMeal] = useState(null)
  const [pidAnalysis, setPidAnalysis] = useState(null)
  const [selectedImage, setSelectedImage] = useState(null)
  const [mealType, setMealType] = useState('lunch')

  // Daily progress state
  const [dailyProgress, setDailyProgress] = useState({
    calories: { consumed: 0, target: user?.calorie_target || 2000 },
    protein: { consumed: 0, target: user?.protein_target || 150 },
    carbs: { consumed: 0, target: user?.carbs_target || 250 },
    fat: { consumed: 0, target: user?.fat_target || 65 },
  })

  // Load today's progress for authenticated users
  useEffect(() => {
    if (isAuthenticated) {
      loadTodayProgress()
    }
  }, [isAuthenticated])

  const loadTodayProgress = async () => {
    try {
      const data = await getTodayProgress()
      setDailyProgress({
        calories: data.calories,
        protein: data.protein,
        carbs: data.carbs,
        fat: data.fat,
      })
    } catch (error) {
      console.error('Failed to load today progress:', error)
      // Keep default values
    }
  }

  const handleImageSelect = async (imageBase64, file) => {
    setSelectedImage(URL.createObjectURL(file))
    setAppState(STATES.ANALYZING)

    try {
      const response = await analyzeMeal(imageBase64, mealType)
      console.log('API Response:', response)
      
      if (response.success) {
        setMealId(response.meal_id)
        setDetection(response.detection)
        setAppState(STATES.REVIEW)
        toast.success('Food detected successfully!')
      } else {
        throw new Error(response.error || 'Analysis failed')
      }
    } catch (error) {
      console.error('Analysis error:', error)
      toast.error(error.message || 'Failed to analyze image')
      setAppState(STATES.UPLOAD)
      setSelectedImage(null)
    }
  }

  const handleConfirm = async (items) => {
    setAppState(STATES.CONFIRMING)

    try {
      const response = await confirmMeal(mealId, items)
      
      if (response.success) {
        setConfirmedMeal(response)
        
        // Update daily progress locally
        if (response.meal_totals) {
          setDailyProgress(prev => ({
            calories: { ...prev.calories, consumed: prev.calories.consumed + (response.meal_totals.calories || 0) },
            protein: { ...prev.protein, consumed: prev.protein.consumed + (response.meal_totals.protein_g || 0) },
            carbs: { ...prev.carbs, consumed: prev.carbs.consumed + (response.meal_totals.carbs_g || 0) },
            fat: { ...prev.fat, consumed: prev.fat.consumed + (response.meal_totals.fat_g || 0) },
          }))
        }

        toast.success('Meal logged successfully!')
        
        // Auto-fetch PID analysis
        setAppState(STATES.PID_LOADING)
        await fetchPidAnalysis()
      } else {
        throw new Error(response.error || 'Confirmation failed')
      }
    } catch (error) {
      console.error('Confirmation error:', error)
      toast.error(error.message || 'Failed to confirm meal')
      setAppState(STATES.REVIEW)
    }
  }

  const fetchPidAnalysis = async () => {
    try {
      const response = await getPidAnalysis(mealId, {
        user_profile: {
          age: 30,
          sex: 'male',
          activity_level: 'moderate',
          health_conditions: [],
          dietary_preferences: [],
        },
        daily_targets: {
          calories: dailyProgress.calories.target,
          protein_g: dailyProgress.protein.target,
          carbs_g: dailyProgress.carbs.target,
          fat_g: dailyProgress.fat.target,
          fiber_g: 30,
        },
        todays_intake: {
          calories: dailyProgress.calories.consumed,
          protein_g: dailyProgress.protein.consumed,
          carbs_g: dailyProgress.carbs.consumed,
          fat_g: dailyProgress.fat.consumed,
          fiber_g: 15,
          meals_logged: 2,
        },
      })

      if (response.success) {
        setPidAnalysis(response.analysis)
        setAppState(STATES.RESULTS)
      } else {
        setAppState(STATES.RESULTS)
        toast.error('Could not fetch recommendations')
      }
    } catch (error) {
      console.error('PID analysis error:', error)
      setAppState(STATES.RESULTS)
    }
  }

  const handleReset = () => {
    setAppState(STATES.UPLOAD)
    setMealId(null)
    setDetection(null)
    setConfirmedMeal(null)
    setPidAnalysis(null)
    setSelectedImage(null)
  }

  const renderMealLogging = () => {
    switch (appState) {
      case STATES.UPLOAD:
        return (
          <ImageUpload 
            onImageSelect={handleImageSelect}
            mealType={mealType}
            onMealTypeChange={setMealType}
          />
        )
      
      case STATES.ANALYZING:
        return (
          <MealAnalysis 
            imageUrl={selectedImage}
          />
        )
      
      case STATES.REVIEW:
        return (
          <MealConfirmation
            detection={detection}
            imageUrl={selectedImage}
            onConfirm={handleConfirm}
            onCancel={handleReset}
          />
        )
      
      case STATES.CONFIRMING:
      case STATES.PID_LOADING:
        return (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-16 h-16 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-gray-600 text-lg">
              {appState === STATES.CONFIRMING ? 'Saving your meal...' : 'Getting personalized recommendations...'}
            </p>
          </div>
        )
      
      case STATES.RESULTS:
        return (
          <PidRecommendations
            confirmedMeal={confirmedMeal}
            pidAnalysis={pidAnalysis}
            onLogAnother={handleReset}
          />
        )
      
      default:
        return null
    }
  }

  const renderContent = () => {
    switch (currentView) {
      case VIEWS.LOG_MEAL:
        return (
          <>
            <DailyProgress progress={dailyProgress} />
            <div className="mt-6">
              {renderMealLogging()}
            </div>
          </>
        )
      
      case VIEWS.PROGRESS:
        if (!isAuthenticated) {
          return (
            <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-100 text-center">
              <BarChart3 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Sign in to view progress</h3>
              <p className="text-gray-600 mb-4">Create an account to track your nutrition journey over time.</p>
            </div>
          )
        }
        return <ProgressDashboard user={user} />
      
      case VIEWS.PROFILE:
        return <ProfileView user={user} onLogout={logout} />
      
      default:
        return null
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header with user info */}
      <header className="bg-white shadow-sm border-b border-gray-100">
        <div className="container mx-auto px-4 py-4 max-w-4xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-xl flex items-center justify-center">
                <span className="text-white font-bold text-lg">F</span>
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">FitLoop</h1>
                <p className="text-xs text-gray-500">
                  {isAuthenticated ? `Welcome, ${user?.full_name || user?.username}` : 'Guest Mode'}
                </p>
              </div>
            </div>
            
            {isAuthenticated && (
              <button
                onClick={logout}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                title="Sign out"
              >
                <LogOut className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      </header>
      
      <main className="container mx-auto px-4 py-6 max-w-4xl pb-24">
        {renderContent()}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg">
        <div className="container mx-auto max-w-4xl">
          <div className="flex items-center justify-around py-2">
            <NavButton 
              icon={Camera}
              label="Log Meal"
              active={currentView === VIEWS.LOG_MEAL}
              onClick={() => {
                setCurrentView(VIEWS.LOG_MEAL)
                if (appState === STATES.RESULTS) handleReset()
              }}
            />
            <NavButton 
              icon={BarChart3}
              label="Progress"
              active={currentView === VIEWS.PROGRESS}
              onClick={() => setCurrentView(VIEWS.PROGRESS)}
            />
            <NavButton 
              icon={User}
              label="Profile"
              active={currentView === VIEWS.PROFILE}
              onClick={() => setCurrentView(VIEWS.PROFILE)}
            />
          </div>
        </div>
      </nav>
    </div>
  )
}

function NavButton({ icon: Icon, label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-1 px-6 py-2 rounded-xl transition-all ${
        active 
          ? 'text-emerald-600 bg-emerald-50' 
          : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
      }`}
    >
      <Icon className={`w-6 h-6 ${active ? 'stroke-2' : ''}`} />
      <span className="text-xs font-medium">{label}</span>
    </button>
  )
}

function ProfileView({ user, onLogout }) {
  const { isAuthenticated, updateUser } = useAuth()
  const [editing, setEditing] = useState(false)
  const [formData, setFormData] = useState({
    full_name: user?.full_name || '',
    calorie_target: user?.calorie_target || 2000,
    protein_target: user?.protein_target || 150,
    carbs_target: user?.carbs_target || 250,
    fat_target: user?.fat_target || 65,
  })

  if (!isAuthenticated) {
    return (
      <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-100 text-center">
        <User className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-gray-900 mb-2">Guest Mode</h3>
        <p className="text-gray-600 mb-4">Sign in to save your progress and customize your nutrition goals.</p>
        <button
          onClick={() => window.location.reload()}
          className="px-6 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors"
        >
          Sign In
        </button>
      </div>
    )
  }

  const handleSave = async () => {
    try {
      await updateUser(formData)
      toast.success('Profile updated!')
      setEditing(false)
    } catch (error) {
      toast.error('Failed to update profile')
    }
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900">Profile</h2>
          {!editing ? (
            <button
              onClick={() => setEditing(true)}
              className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Edit
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={() => setEditing(false)}
                className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="px-4 py-2 text-sm bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors"
              >
                Save
              </button>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
            <div className="w-16 h-16 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full flex items-center justify-center">
              <span className="text-2xl font-bold text-white">
                {user?.username?.[0]?.toUpperCase() || 'U'}
              </span>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">{user?.full_name || user?.username}</h3>
              <p className="text-gray-500">{user?.email}</p>
            </div>
          </div>

          {editing ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                <input
                  type="text"
                  value={formData.full_name}
                  onChange={(e) => setFormData(prev => ({ ...prev, full_name: e.target.value }))}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* Nutrition Goals */}
      <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Daily Nutrition Goals</h3>
        
        <div className="grid grid-cols-2 gap-4">
          {editing ? (
            <>
              <GoalInput label="Calories" value={formData.calorie_target} onChange={(v) => setFormData(p => ({...p, calorie_target: v}))} unit="kcal" />
              <GoalInput label="Protein" value={formData.protein_target} onChange={(v) => setFormData(p => ({...p, protein_target: v}))} unit="g" />
              <GoalInput label="Carbs" value={formData.carbs_target} onChange={(v) => setFormData(p => ({...p, carbs_target: v}))} unit="g" />
              <GoalInput label="Fat" value={formData.fat_target} onChange={(v) => setFormData(p => ({...p, fat_target: v}))} unit="g" />
            </>
          ) : (
            <>
              <GoalDisplay label="Calories" value={user?.calorie_target || 2000} unit="kcal" color="orange" />
              <GoalDisplay label="Protein" value={user?.protein_target || 150} unit="g" color="red" />
              <GoalDisplay label="Carbs" value={user?.carbs_target || 250} unit="g" color="amber" />
              <GoalDisplay label="Fat" value={user?.fat_target || 65} unit="g" color="blue" />
            </>
          )}
        </div>
      </div>

      {/* Sign Out */}
      <button
        onClick={onLogout}
        className="w-full py-3 bg-red-50 text-red-600 font-medium rounded-xl hover:bg-red-100 transition-colors flex items-center justify-center gap-2"
      >
        <LogOut className="w-5 h-5" />
        Sign Out
      </button>
    </div>
  )
}

function GoalInput({ label, value, onChange, unit }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <div className="relative">
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(parseInt(e.target.value) || 0)}
          className="w-full px-4 py-2 pr-12 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">{unit}</span>
      </div>
    </div>
  )
}

function GoalDisplay({ label, value, unit, color }) {
  const colorClasses = {
    orange: 'bg-orange-50 text-orange-600',
    red: 'bg-red-50 text-red-600',
    amber: 'bg-amber-50 text-amber-600',
    blue: 'bg-blue-50 text-blue-600',
  }

  return (
    <div className={`p-4 rounded-xl ${colorClasses[color]}`}>
      <div className="text-sm opacity-75 mb-1">{label}</div>
      <div className="text-xl font-bold">{value}<span className="text-sm font-normal ml-1">{unit}</span></div>
    </div>
  )
}
