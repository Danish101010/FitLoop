import { useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Mail, Lock, User, Eye, EyeOff, Loader2, ChevronRight, ChevronLeft, Check } from 'lucide-react'
import toast from 'react-hot-toast'

// Activity level multipliers for TDEE calculation
const ACTIVITY_LEVELS = {
  sedentary: { label: 'Sedentary', description: 'Little or no exercise', multiplier: 1.2 },
  lightly_active: { label: 'Lightly Active', description: 'Light exercise 1-3 days/week', multiplier: 1.375 },
  moderately_active: { label: 'Moderately Active', description: 'Moderate exercise 3-5 days/week', multiplier: 1.55 },
  very_active: { label: 'Very Active', description: 'Hard exercise 6-7 days/week', multiplier: 1.725 },
  extra_active: { label: 'Extra Active', description: 'Very intense exercise daily', multiplier: 1.9 },
}

// Goal adjustments
const FITNESS_GOALS = {
  lose_weight: { label: 'Lose Weight', description: 'Deficit of ~500 kcal/day', calorieAdjust: -500, proteinMultiplier: 2.0 },
  lose_weight_slow: { label: 'Lose Slowly', description: 'Deficit of ~250 kcal/day', calorieAdjust: -250, proteinMultiplier: 1.8 },
  maintain: { label: 'Maintain', description: 'Keep current weight', calorieAdjust: 0, proteinMultiplier: 1.6 },
  gain_muscle: { label: 'Build Muscle', description: 'Surplus of ~300 kcal/day', calorieAdjust: 300, proteinMultiplier: 2.2 },
  gain_weight: { label: 'Gain Weight', description: 'Surplus of ~500 kcal/day', calorieAdjust: 500, proteinMultiplier: 1.8 },
}

/**
 * Calculate BMR using Mifflin-St Jeor Equation
 */
function calculateBMR(weight, height, age, gender) {
  const base = 10 * weight + 6.25 * height - 5 * age
  return gender === 'male' ? base + 5 : base - 161
}

/**
 * Calculate all nutrition targets from user data
 */
function calculateNutritionTargets(userData) {
  const { weight_kg, height_cm, age, gender, activity_level, fitness_goal } = userData
  
  const bmr = calculateBMR(weight_kg, height_cm, age, gender)
  const activityMultiplier = ACTIVITY_LEVELS[activity_level]?.multiplier || 1.55
  const tdee = bmr * activityMultiplier
  
  const goalConfig = FITNESS_GOALS[fitness_goal] || FITNESS_GOALS.maintain
  const calorieTarget = Math.round(tdee + goalConfig.calorieAdjust)
  
  // Protein: based on body weight and goal (research-backed ranges)
  const proteinTarget = Math.round(weight_kg * goalConfig.proteinMultiplier)
  
  // Fat: 25% of total calories (within recommended 20-35% range)
  // 9 calories per gram of fat
  const fatTarget = Math.round((calorieTarget * 0.25) / 9)
  
  // Carbs: remaining calories after protein and fat
  // Protein = 4 cal/g, Fat = 9 cal/g, Carbs = 4 cal/g
  const proteinCalories = proteinTarget * 4
  const fatCalories = fatTarget * 9
  const remainingCalories = calorieTarget - proteinCalories - fatCalories
  const carbsTarget = Math.round(Math.max(remainingCalories / 4, 100)) // Minimum 100g carbs
  
  // Fiber: 14g per 1000 calories (USDA recommendation)
  const fiberTarget = Math.round((calorieTarget / 1000) * 14)
  
  return {
    calorie_target: calorieTarget,
    protein_target: proteinTarget,
    carbs_target: carbsTarget,
    fat_target: fatTarget,
    fiber_target: fiberTarget,
  }
}

export default function AuthPage() {
  const [searchParams] = useSearchParams()
  const [isLogin, setIsLogin] = useState(!searchParams.get('signup'))
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [signupStep, setSignupStep] = useState(1) // 1: Account, 2: Body Metrics, 3: Goals
  const { login, signup } = useAuth()

  const [formData, setFormData] = useState({
    // Account info
    email: '',
    password: '',
    username: '',
    full_name: '',
    // Body metrics
    age: 30,
    gender: 'male',
    height_cm: 170,
    weight_kg: 70,
    activity_level: 'moderately_active',
    fitness_goal: 'maintain',
  })

  const [calculatedTargets, setCalculatedTargets] = useState(null)

  // Calculate targets when body metrics change
  useEffect(() => {
    if (formData.weight_kg && formData.height_cm && formData.age) {
      const targets = calculateNutritionTargets(formData)
      setCalculatedTargets(targets)
    }
  }, [formData.weight_kg, formData.height_cm, formData.age, formData.gender, formData.activity_level, formData.fitness_goal])

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (isLogin) {
      setLoading(true)
      try {
        await login(formData.email, formData.password)
        toast.success('Welcome back!')
      } catch (error) {
        console.error('Auth error:', error)
        const message = error.response?.data?.detail || 'Authentication failed'
        toast.error(message)
      } finally {
        setLoading(false)
      }
    } else {
      // Multi-step signup
      if (signupStep < 3) {
        setSignupStep(signupStep + 1)
      } else {
        // Final step - create account
        setLoading(true)
        try {
          const targets = calculateNutritionTargets(formData)
          await signup({
            ...formData,
            ...targets,
          })
          toast.success('Account created successfully!')
        } catch (error) {
          console.error('Auth error:', error)
          const message = error.response?.data?.detail || 'Signup failed'
          toast.error(message)
        } finally {
          setLoading(false)
        }
      }
    }
  }

  const handleChange = (e) => {
    const { name, value, type } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? parseFloat(value) || 0 : value
    }))
  }

  const canProceed = () => {
    if (signupStep === 1) {
      return formData.email && formData.password && formData.username
    }
    if (signupStep === 2) {
      return formData.age && formData.height_cm && formData.weight_kg
    }
    return true
  }

  return (
    <div className="min-h-screen bg-[#f7f8fa] flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="page-container">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-2.5">
              <div className="w-9 h-9 bg-brand-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg">F</span>
              </div>
              <span className="text-xl font-semibold text-gray-900">FitLoop</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Auth Form */}
      <div className="flex-1 flex items-center justify-center p-4 py-12">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="heading-2">
              {isLogin ? 'Welcome back' : 'Create your account'}
            </h1>
            <p className="text-muted mt-2">
              {isLogin 
                ? 'Sign in to continue tracking your nutrition' 
                : signupStep === 1 ? 'Start your journey to better nutrition'
                : signupStep === 2 ? 'Tell us about yourself'
                : 'We\'ll calculate your personalized targets'}
            </p>
          </div>

          <div className="card card-body">
            {/* Tab Switcher (only show for login or step 1) */}
            {(isLogin || signupStep === 1) && (
              <div className="flex border-b border-gray-200 mb-6">
                <button
                  onClick={() => { setIsLogin(true); setSignupStep(1) }}
                  className={`flex-1 pb-3 text-sm font-medium border-b-2 transition-colors ${
                    isLogin 
                      ? 'border-brand-600 text-brand-600' 
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Sign In
                </button>
                <button
                  onClick={() => { setIsLogin(false); setSignupStep(1) }}
                  className={`flex-1 pb-3 text-sm font-medium border-b-2 transition-colors ${
                    !isLogin 
                      ? 'border-brand-600 text-brand-600' 
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Sign Up
                </button>
              </div>
            )}

            {/* Progress Steps (signup only) */}
            {!isLogin && (
              <div className="flex items-center justify-center gap-2 mb-6">
                {[1, 2, 3].map((step) => (
                  <div key={step} className="flex items-center">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                      step < signupStep 
                        ? 'bg-brand-600 text-white' 
                        : step === signupStep 
                          ? 'bg-brand-600 text-white' 
                          : 'bg-gray-100 text-gray-400'
                    }`}>
                      {step < signupStep ? <Check className="w-4 h-4" /> : step}
                    </div>
                    {step < 3 && (
                      <div className={`w-8 h-0.5 ${step < signupStep ? 'bg-brand-600' : 'bg-gray-200'}`} />
                    )}
                  </div>
                ))}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* LOGIN FORM */}
              {isLogin && (
                <>
                  <div>
                    <label className="input-label">Email</label>
                    <div className="input-group">
                      <Mail className="input-icon-left" />
                      <input
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                        required
                        className="input input-with-icon"
                        placeholder="you@example.com"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="input-label">Password</label>
                    <div className="input-group">
                      <Lock className="input-icon-left" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        name="password"
                        value={formData.password}
                        onChange={handleChange}
                        required
                        className="input input-with-icon pr-10"
                        placeholder="••••••••"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>
                </>
              )}

              {/* SIGNUP STEP 1: Account Info */}
              {!isLogin && signupStep === 1 && (
                <div className="space-y-4 animate-fade-in">
                  <div>
                    <label className="input-label">Email</label>
                    <div className="input-group">
                      <Mail className="input-icon-left" />
                      <input
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                        required
                        className="input input-with-icon"
                        placeholder="you@example.com"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="input-label">Username</label>
                    <div className="input-group">
                      <User className="input-icon-left" />
                      <input
                        type="text"
                        name="username"
                        value={formData.username}
                        onChange={handleChange}
                        required
                        className="input input-with-icon"
                        placeholder="johndoe"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="input-label">Full Name</label>
                    <input
                      type="text"
                      name="full_name"
                      value={formData.full_name}
                      onChange={handleChange}
                      className="input"
                      placeholder="John Doe"
                    />
                  </div>

                  <div>
                    <label className="input-label">Password</label>
                    <div className="input-group">
                      <Lock className="input-icon-left" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        name="password"
                        value={formData.password}
                        onChange={handleChange}
                        required
                        minLength={6}
                        className="input input-with-icon pr-10"
                        placeholder="••••••••"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* SIGNUP STEP 2: Body Metrics */}
              {!isLogin && signupStep === 2 && (
                <div className="space-y-4 animate-fade-in">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="input-label">Age</label>
                      <input
                        type="number"
                        name="age"
                        value={formData.age}
                        onChange={handleChange}
                        className="input"
                        min="15"
                        max="100"
                      />
                    </div>
                    <div>
                      <label className="input-label">Gender</label>
                      <select
                        name="gender"
                        value={formData.gender}
                        onChange={handleChange}
                        className="input"
                      >
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="input-label">Height</label>
                      <div className="relative">
                        <input
                          type="number"
                          name="height_cm"
                          value={formData.height_cm}
                          onChange={handleChange}
                          className="input pr-10"
                          min="100"
                          max="250"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">cm</span>
                      </div>
                    </div>
                    <div>
                      <label className="input-label">Weight</label>
                      <div className="relative">
                        <input
                          type="number"
                          name="weight_kg"
                          value={formData.weight_kg}
                          onChange={handleChange}
                          className="input pr-10"
                          min="30"
                          max="300"
                          step="0.1"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">kg</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="input-label">Activity Level</label>
                    <div className="space-y-2 mt-2">
                      {Object.entries(ACTIVITY_LEVELS).map(([key, { label, description }]) => (
                        <label
                          key={key}
                          className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                            formData.activity_level === key
                              ? 'border-brand-500 bg-brand-50'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <input
                            type="radio"
                            name="activity_level"
                            value={key}
                            checked={formData.activity_level === key}
                            onChange={handleChange}
                            className="sr-only"
                          />
                          <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                            formData.activity_level === key ? 'border-brand-500' : 'border-gray-300'
                          }`}>
                            {formData.activity_level === key && (
                              <div className="w-2 h-2 rounded-full bg-brand-500" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-gray-900">{label}</div>
                            <div className="text-xs text-gray-500">{description}</div>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* SIGNUP STEP 3: Goals & Summary */}
              {!isLogin && signupStep === 3 && (
                <div className="space-y-4 animate-fade-in">
                  <div>
                    <label className="input-label">What's your goal?</label>
                    <div className="space-y-2 mt-2">
                      {Object.entries(FITNESS_GOALS).map(([key, { label, description }]) => (
                        <label
                          key={key}
                          className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                            formData.fitness_goal === key
                              ? 'border-brand-500 bg-brand-50'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <input
                            type="radio"
                            name="fitness_goal"
                            value={key}
                            checked={formData.fitness_goal === key}
                            onChange={handleChange}
                            className="sr-only"
                          />
                          <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                            formData.fitness_goal === key ? 'border-brand-500' : 'border-gray-300'
                          }`}>
                            {formData.fitness_goal === key && (
                              <div className="w-2 h-2 rounded-full bg-brand-500" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-gray-900">{label}</div>
                            <div className="text-xs text-gray-500">{description}</div>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Calculated Targets Preview */}
                  {calculatedTargets && (
                    <div className="p-4 bg-brand-50 rounded-xl border border-brand-100">
                      <h4 className="text-sm font-medium text-brand-700 mb-3">Your Personalized Daily Targets</h4>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-white rounded-lg p-3 text-center">
                          <div className="text-2xl font-bold text-brand-600">{calculatedTargets.calorie_target}</div>
                          <div className="text-xs text-gray-500">Calories</div>
                        </div>
                        <div className="bg-white rounded-lg p-3 text-center">
                          <div className="text-2xl font-bold text-gray-900">{calculatedTargets.protein_target}g</div>
                          <div className="text-xs text-gray-500">Protein</div>
                        </div>
                        <div className="bg-white rounded-lg p-3 text-center">
                          <div className="text-2xl font-bold text-gray-900">{calculatedTargets.carbs_target}g</div>
                          <div className="text-xs text-gray-500">Carbs</div>
                        </div>
                        <div className="bg-white rounded-lg p-3 text-center">
                          <div className="text-2xl font-bold text-gray-900">{calculatedTargets.fat_target}g</div>
                          <div className="text-xs text-gray-500">Fat</div>
                        </div>
                      </div>
                      <p className="text-xs text-brand-600 mt-3 text-center">
                        Calculated using the Mifflin-St Jeor equation
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Navigation Buttons */}
              <div className="flex gap-3 mt-6">
                {!isLogin && signupStep > 1 && (
                  <button
                    type="button"
                    onClick={() => setSignupStep(signupStep - 1)}
                    className="btn-secondary"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Back
                  </button>
                )}
                
                <button
                  type="submit"
                  disabled={loading || (!isLogin && !canProceed())}
                  className="btn-primary flex-1"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {isLogin ? 'Signing in...' : 'Creating account...'}
                    </>
                  ) : isLogin ? (
                    'Sign In'
                  ) : signupStep < 3 ? (
                    <>
                      Continue
                      <ChevronRight className="w-4 h-4" />
                    </>
                  ) : (
                    'Create Account'
                  )}
                </button>
              </div>
            </form>
          </div>

          <p className="text-center text-muted mt-6">
            {isLogin ? "Don't have an account? " : "Already have an account? "}
            <button
              onClick={() => { setIsLogin(!isLogin); setSignupStep(1) }}
              className="text-brand-600 hover:text-brand-700 font-medium"
            >
              {isLogin ? 'Sign up' : 'Sign in'}
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}
