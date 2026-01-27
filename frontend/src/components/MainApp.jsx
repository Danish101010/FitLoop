import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { PageHeader, PageContent, Card, CardBody } from './layout/AppLayout'
import ImageUpload from './ImageUpload'
import MealAnalysis from './MealAnalysis'
import MealConfirmation from './MealConfirmation'
import PidRecommendations from './PidRecommendations'
import DailyProgress from './DailyProgress'
import { analyzeMeal, confirmMeal, getPidAnalysis, getTodayProgress } from '../services/api'
import toast from 'react-hot-toast'
import { Camera, Sparkles, CheckCircle, ArrowLeft } from 'lucide-react'

const STATES = {
  UPLOAD: 'upload',
  ANALYZING: 'analyzing',
  REVIEW: 'review',
  CONFIRMING: 'confirming',
  PID_LOADING: 'pid_loading',
  RESULTS: 'results',
}

export default function MainApp() {
  const { user, isAuthenticated } = useAuth()
  
  const [appState, setAppState] = useState(STATES.UPLOAD)
  const [mealId, setMealId] = useState(null)
  const [detection, setDetection] = useState(null)
  const [confirmedMeal, setConfirmedMeal] = useState(null)
  const [pidAnalysis, setPidAnalysis] = useState(null)
  const [selectedImage, setSelectedImage] = useState(null)
  const [mealType, setMealType] = useState('lunch')
  const [mealDescription, setMealDescription] = useState('')

  const [dailyProgress, setDailyProgress] = useState({
    calories: { consumed: 0, target: user?.calorie_target || 2000 },
    protein: { consumed: 0, target: user?.protein_target || 150 },
    carbs: { consumed: 0, target: user?.carbs_target || 250 },
    fat: { consumed: 0, target: user?.fat_target || 65 },
  })

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
    }
  }

  const handleImageSelect = async (imageBase64, file) => {
    setSelectedImage(URL.createObjectURL(file))
    setAppState(STATES.ANALYZING)

    try {
      const response = await analyzeMeal(imageBase64, mealType, mealDescription)
      
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
        
        if (response.meal_totals) {
          setDailyProgress(prev => ({
            calories: { ...prev.calories, consumed: prev.calories.consumed + (response.meal_totals.calories || 0) },
            protein: { ...prev.protein, consumed: prev.protein.consumed + (response.meal_totals.protein_g || 0) },
            carbs: { ...prev.carbs, consumed: prev.carbs.consumed + (response.meal_totals.carbs_g || 0) },
            fat: { ...prev.fat, consumed: prev.fat.consumed + (response.meal_totals.fat_g || 0) },
          }))
        }

        toast.success('Meal logged successfully!')
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
      const now = new Date()
      const hour = now.getHours()
      let currentMealType = 'snack'
      if (hour >= 5 && hour < 11) currentMealType = 'breakfast'
      else if (hour >= 11 && hour < 15) currentMealType = 'lunch'
      else if (hour >= 17 && hour < 21) currentMealType = 'dinner'
      
      const timeOfDay = now.toTimeString().slice(0, 5)
      
      const response = await getPidAnalysis(mealId, {
        user_profile: {
          user_id: user?.id?.toString() || 'guest',
          age: 30,
          sex: 'male',
          weight_kg: 70,
          height_cm: 175,
          activity_level: 'moderately_active',
          primary_goal: 'maintain_weight',
          goal_intensity: 'moderate',
          health_conditions: [],
          allergies: [],
        },
        daily_targets: {
          calories: dailyProgress.calories.target,
          protein_g: dailyProgress.protein.target,
          carbs_g: dailyProgress.carbs.target,
          fat_g: dailyProgress.fat.target,
          fiber_g: 30,
        },
        todays_intake: {
          meals_logged: 2,
          totals: {
            calories: dailyProgress.calories.consumed,
            protein_g: dailyProgress.protein.consumed,
            carbs_g: dailyProgress.carbs.consumed,
            fat_g: dailyProgress.fat.consumed,
            fiber_g: 15,
          }
        },
        weekly_summary: {
          avg_daily_calories: dailyProgress.calories.target * 0.95,
          avg_daily_protein_g: dailyProgress.protein.target * 0.9,
          protein_goal_met_days: 4,
          fiber_goal_met_days: 3,
          trend_protein: 'stable',
          trend_fiber: 'stable',
        },
        current_meal_type: currentMealType,
        time_of_day: timeOfDay,
        meals_remaining: currentMealType === 'breakfast' ? 3 : currentMealType === 'lunch' ? 2 : currentMealType === 'dinner' ? 0 : 1,
      })

      if (response.success) {
        setPidAnalysis(response.analysis)
      }
      setAppState(STATES.RESULTS)
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
    setMealDescription('')
  }

  const getStepNumber = () => {
    switch (appState) {
      case STATES.UPLOAD: return 1
      case STATES.ANALYZING: return 2
      case STATES.REVIEW: return 3
      case STATES.CONFIRMING:
      case STATES.PID_LOADING:
      case STATES.RESULTS: return 4
      default: return 1
    }
  }

  const renderContent = () => {
    switch (appState) {
      case STATES.UPLOAD:
        return (
          <ImageUpload 
            onImageSelect={handleImageSelect}
            mealType={mealType}
            onMealTypeChange={setMealType}
            mealDescription={mealDescription}
            onMealDescriptionChange={setMealDescription}
          />
        )
      
      case STATES.ANALYZING:
        return <MealAnalysis imageUrl={selectedImage} />
      
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
          <Card>
            <CardBody className="text-center py-16">
              <div className="w-16 h-16 bg-brand-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Sparkles className="w-8 h-8 text-brand-600 animate-pulse" />
              </div>
              <h3 className="heading-3 mb-2">
                {appState === STATES.CONFIRMING ? 'Saving your meal...' : 'Getting recommendations...'}
              </h3>
              <p className="text-muted">This will only take a moment</p>
            </CardBody>
          </Card>
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
    <>
      <PageHeader 
        title="Log Meal" 
        subtitle="Take a photo or upload an image of your food"
        actions={
          appState !== STATES.UPLOAD && appState !== STATES.RESULTS && (
            <button onClick={handleReset} className="btn-ghost">
              <ArrowLeft className="w-4 h-4" />
              Start Over
            </button>
          )
        }
      />
      
      <PageContent narrow>
        <div className="space-y-6">
          {/* Daily Progress Summary */}
          <DailyProgress progress={dailyProgress} />

          {/* Step Indicator */}
          {appState !== STATES.RESULTS && (
            <div className="flex items-center justify-center gap-2 mb-2">
              {[1, 2, 3, 4].map((step) => (
                <div
                  key={step}
                  className={`h-1.5 rounded-full transition-all ${
                    step <= getStepNumber() 
                      ? 'w-8 bg-brand-500' 
                      : 'w-4 bg-gray-200'
                  }`}
                />
              ))}
            </div>
          )}

          {/* Main Content */}
          <div className="animate-fade-in">
            {renderContent()}
          </div>
        </div>
      </PageContent>
    </>
  )
}
