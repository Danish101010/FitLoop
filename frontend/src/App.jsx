import { useState } from 'react'
import Header from './components/Header'
import ImageUpload from './components/ImageUpload'
import MealAnalysis from './components/MealAnalysis'
import MealConfirmation from './components/MealConfirmation'
import PidRecommendations from './components/PidRecommendations'
import DailyProgress from './components/DailyProgress'
import { analyzeMeal, confirmMeal, getPidAnalysis } from './services/api'
import toast from 'react-hot-toast'

// App states
const STATES = {
  UPLOAD: 'upload',
  ANALYZING: 'analyzing',
  REVIEW: 'review',
  CONFIRMING: 'confirming',
  PID_LOADING: 'pid_loading',
  RESULTS: 'results',
}

function App() {
  const [appState, setAppState] = useState(STATES.UPLOAD)
  const [mealId, setMealId] = useState(null)
  const [detection, setDetection] = useState(null)
  const [confirmedMeal, setConfirmedMeal] = useState(null)
  const [pidAnalysis, setPidAnalysis] = useState(null)
  const [selectedImage, setSelectedImage] = useState(null)
  const [mealType, setMealType] = useState('lunch')

  // Daily progress state (starts at 0, updates as meals are logged)
  const [dailyProgress, setDailyProgress] = useState({
    calories: { consumed: 0, target: 2000 },
    protein: { consumed: 0, target: 150 },
    carbs: { consumed: 0, target: 250 },
    fat: { consumed: 0, target: 65 },
  })

  const handleImageSelect = async (imageBase64, file) => {
    setSelectedImage(URL.createObjectURL(file))
    setAppState(STATES.ANALYZING)

    try {
      const response = await analyzeMeal(imageBase64, mealType)
      console.log('API Response:', response) // Debug log
      
      if (response.success) {
        setMealId(response.meal_id)
        setDetection(response.detection)
        console.log('Detection data:', response.detection) // Debug log
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
        
        // Update daily progress
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

  const renderContent = () => {
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
            <div className="w-16 h-16 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mb-4"></div>
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <Header />
      
      <main className="container mx-auto px-4 py-6 max-w-4xl">
        <DailyProgress progress={dailyProgress} />
        
        <div className="mt-6">
          {renderContent()}
        </div>
      </main>
    </div>
  )
}

export default App
