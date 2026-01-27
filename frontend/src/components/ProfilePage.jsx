import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { PageHeader, PageContent, Card, CardBody, CardHeader } from './layout/AppLayout'
import { User, LogOut, Save, Calculator, ChevronRight } from 'lucide-react'
import toast from 'react-hot-toast'

// Activity level multipliers for TDEE calculation
const ACTIVITY_LEVELS = {
  sedentary: { label: 'Sedentary', description: 'Little or no exercise, desk job', multiplier: 1.2 },
  lightly_active: { label: 'Lightly Active', description: 'Light exercise 1-3 days/week', multiplier: 1.375 },
  moderately_active: { label: 'Moderately Active', description: 'Moderate exercise 3-5 days/week', multiplier: 1.55 },
  very_active: { label: 'Very Active', description: 'Hard exercise 6-7 days/week', multiplier: 1.725 },
  extra_active: { label: 'Extra Active', description: 'Very hard exercise, physical job', multiplier: 1.9 },
}

// Goal adjustments
const FITNESS_GOALS = {
  lose_weight: { label: 'Lose Weight', description: 'Lose ~0.5kg per week', calorieAdjust: -500, proteinMultiplier: 2.0 },
  lose_weight_slow: { label: 'Lose Weight (Slow)', description: 'Lose ~0.25kg per week', calorieAdjust: -250, proteinMultiplier: 1.8 },
  maintain: { label: 'Maintain Weight', description: 'Keep current weight', calorieAdjust: 0, proteinMultiplier: 1.6 },
  gain_muscle: { label: 'Build Muscle', description: 'Lean muscle gain', calorieAdjust: 300, proteinMultiplier: 2.2 },
  gain_weight: { label: 'Gain Weight', description: 'Gain ~0.5kg per week', calorieAdjust: 500, proteinMultiplier: 1.8 },
}

/**
 * Calculate BMR using Mifflin-St Jeor Equation
 * Men: BMR = 10 × weight(kg) + 6.25 × height(cm) − 5 × age(years) + 5
 * Women: BMR = 10 × weight(kg) + 6.25 × height(cm) − 5 × age(years) − 161
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
  
  // Calculate BMR
  const bmr = calculateBMR(weight_kg, height_cm, age, gender)
  
  // Calculate TDEE (Total Daily Energy Expenditure)
  const activityMultiplier = ACTIVITY_LEVELS[activity_level]?.multiplier || 1.55
  const tdee = bmr * activityMultiplier
  
  // Adjust calories based on goal
  const goalConfig = FITNESS_GOALS[fitness_goal] || FITNESS_GOALS.maintain
  const calorieTarget = Math.round(tdee + goalConfig.calorieAdjust)
  
  // Calculate macros
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
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
  }
}

export default function ProfilePage() {
  const { user, logout, updateUser } = useAuth()
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showCalculator, setShowCalculator] = useState(false)
  const [calculatedTargets, setCalculatedTargets] = useState(null)
  
  const [formData, setFormData] = useState({
    full_name: user?.full_name || '',
    age: user?.age || 30,
    gender: user?.gender || 'male',
    height_cm: user?.height_cm || 170,
    weight_kg: user?.weight_kg || 70,
    activity_level: user?.activity_level || 'moderately_active',
    fitness_goal: user?.fitness_goal || 'maintain',
  })

  // Recalculate targets when form data changes
  useEffect(() => {
    if (formData.weight_kg && formData.height_cm && formData.age) {
      const targets = calculateNutritionTargets(formData)
      setCalculatedTargets(targets)
    }
  }, [formData])

  const handleSave = async () => {
    setSaving(true)
    try {
      // Include calculated nutrition targets in the update
      const targets = calculateNutritionTargets(formData)
      await updateUser({
        ...formData,
        calorie_target: targets.calorie_target,
        protein_target: targets.protein_target,
        carbs_target: targets.carbs_target,
        fat_target: targets.fat_target,
        fiber_target: targets.fiber_target,
      })
      toast.success('Profile updated!')
      setEditing(false)
      setShowCalculator(false)
    } catch (error) {
      toast.error('Failed to update profile')
    } finally {
      setSaving(false)
    }
  }

  const handleChange = (e) => {
    const { name, value, type } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? parseFloat(value) || 0 : value
    }))
  }

  return (
    <>
      <PageHeader 
        title="Profile" 
        subtitle="Manage your account and nutrition goals"
        actions={
          !editing ? (
            <button onClick={() => setEditing(true)} className="btn-secondary">
              Edit Profile
            </button>
          ) : (
            <div className="flex gap-2">
              <button 
                onClick={() => { setEditing(false); setShowCalculator(false) }} 
                className="btn-ghost"
                disabled={saving}
              >
                Cancel
              </button>
              <button 
                onClick={handleSave} 
                className="btn-primary"
                disabled={saving}
              >
                <Save className="w-4 h-4" />
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          )
        }
      />
      
      <PageContent narrow>
        <div className="space-y-6">
          {/* Account Info */}
          <Card>
            <CardHeader>
              <h3 className="heading-4">Account Information</h3>
            </CardHeader>
            <CardBody>
              <div className="flex items-center gap-4 mb-6">
                <div className="w-16 h-16 bg-brand-100 rounded-full flex items-center justify-center">
                  <span className="text-2xl font-bold text-brand-600">
                    {user?.username?.[0]?.toUpperCase() || 'U'}
                  </span>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    {user?.full_name || user?.username}
                  </h3>
                  <p className="text-muted">{user?.email}</p>
                </div>
              </div>

              {editing && (
                <div className="space-y-4 animate-fade-in">
                  <div>
                    <label className="input-label">Full Name</label>
                    <input
                      type="text"
                      name="full_name"
                      value={formData.full_name}
                      onChange={handleChange}
                      className="input"
                      placeholder="Your full name"
                    />
                  </div>
                </div>
              )}
            </CardBody>
          </Card>

          {/* Body Metrics & Goals - Always show when editing */}
          {editing && (
            <Card className="animate-fade-in">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-brand-50 rounded-lg flex items-center justify-center">
                    <Calculator className="w-4 h-4 text-brand-600" />
                  </div>
                  <div>
                    <h3 className="heading-4">Calculate Your Goals</h3>
                    <p className="text-muted">We'll compute your ideal nutrition targets</p>
                  </div>
                </div>
              </CardHeader>
              <CardBody>
                <div className="grid grid-cols-2 gap-4">
                  {/* Age */}
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

                  {/* Gender */}
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

                  {/* Height */}
                  <div>
                    <label className="input-label">Height</label>
                    <div className="relative">
                      <input
                        type="number"
                        name="height_cm"
                        value={formData.height_cm}
                        onChange={handleChange}
                        className="input pr-12"
                        min="100"
                        max="250"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">cm</span>
                    </div>
                  </div>

                  {/* Weight */}
                  <div>
                    <label className="input-label">Weight</label>
                    <div className="relative">
                      <input
                        type="number"
                        name="weight_kg"
                        value={formData.weight_kg}
                        onChange={handleChange}
                        className="input pr-12"
                        min="30"
                        max="300"
                        step="0.1"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">kg</span>
                    </div>
                  </div>
                </div>

                {/* Activity Level */}
                <div className="mt-4">
                  <label className="input-label">Activity Level</label>
                  <div className="grid gap-2 mt-2">
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
                        <div className="flex-1">
                          <div className="font-medium text-gray-900">{label}</div>
                          <div className="text-sm text-gray-500">{description}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Fitness Goal */}
                <div className="mt-4">
                  <label className="input-label">Fitness Goal</label>
                  <div className="grid gap-2 mt-2">
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
                        <div className="flex-1">
                          <div className="font-medium text-gray-900">{label}</div>
                          <div className="text-sm text-gray-500">{description}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Calculated Results */}
                {calculatedTargets && (
                  <div className="mt-6 p-4 bg-gray-50 rounded-xl">
                    <h4 className="font-medium text-gray-900 mb-3">Your Calculated Targets</h4>
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div className="text-center p-3 bg-white rounded-lg">
                        <div className="text-xs text-gray-500 mb-1">BMR</div>
                        <div className="text-lg font-bold text-gray-700">{calculatedTargets.bmr}</div>
                        <div className="text-xs text-gray-400">kcal/day</div>
                      </div>
                      <div className="text-center p-3 bg-white rounded-lg">
                        <div className="text-xs text-gray-500 mb-1">TDEE</div>
                        <div className="text-lg font-bold text-gray-700">{calculatedTargets.tdee}</div>
                        <div className="text-xs text-gray-400">kcal/day</div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <TargetPreview label="Calories" value={calculatedTargets.calorie_target} unit="kcal" highlight />
                      <TargetPreview label="Protein" value={calculatedTargets.protein_target} unit="g" />
                      <TargetPreview label="Carbs" value={calculatedTargets.carbs_target} unit="g" />
                      <TargetPreview label="Fat" value={calculatedTargets.fat_target} unit="g" />
                    </div>
                    <p className="text-xs text-gray-500 mt-3">
                      * BMR = Basal Metabolic Rate (calories burned at rest)<br />
                      * TDEE = Total Daily Energy Expenditure
                    </p>
                  </div>
                )}
              </CardBody>
            </Card>
          )}

          {/* Current Nutrition Goals - Show when not editing */}
          {!editing && (
            <Card>
              <CardHeader>
                <div>
                  <h3 className="heading-4">Daily Nutrition Goals</h3>
                  <p className="text-muted">Based on your profile</p>
                </div>
              </CardHeader>
              <CardBody>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <GoalDisplay 
                    label="Calories" 
                    value={user?.calorie_target || 2000} 
                    unit="kcal"
                  />
                  <GoalDisplay 
                    label="Protein" 
                    value={user?.protein_target || 150} 
                    unit="g"
                  />
                  <GoalDisplay 
                    label="Carbs" 
                    value={user?.carbs_target || 250} 
                    unit="g"
                  />
                  <GoalDisplay 
                    label="Fat" 
                    value={user?.fat_target || 65} 
                    unit="g"
                  />
                </div>
                
                {/* Show user's settings summary */}
                {user?.activity_level && (
                  <div className="pt-4 border-t border-gray-100">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500">Activity Level:</span>
                        <span className="ml-2 text-gray-900">{ACTIVITY_LEVELS[user.activity_level]?.label || user.activity_level}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Goal:</span>
                        <span className="ml-2 text-gray-900">{FITNESS_GOALS[user.fitness_goal]?.label || user.fitness_goal}</span>
                      </div>
                    </div>
                  </div>
                )}
              </CardBody>
            </Card>
          )}

          {/* Sign Out */}
          <button
            onClick={logout}
            className="btn-secondary w-full text-error-500 hover:bg-error-50 hover:border-error-200"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </PageContent>
    </>
  )
}

function GoalDisplay({ label, value, unit }) {
  return (
    <div className="p-4 bg-gray-50 rounded-lg text-center">
      <div className="text-sm text-gray-500 mb-1">{label}</div>
      <div className="text-2xl font-bold text-gray-900">
        {value}
        <span className="text-sm font-normal text-gray-400 ml-1">{unit}</span>
      </div>
    </div>
  )
}

function TargetPreview({ label, value, unit, highlight }) {
  return (
    <div className={`p-3 rounded-lg text-center ${highlight ? 'bg-brand-100' : 'bg-white'}`}>
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className={`text-xl font-bold ${highlight ? 'text-brand-600' : 'text-gray-900'}`}>
        {value}
        <span className="text-xs font-normal text-gray-400 ml-1">{unit}</span>
      </div>
    </div>
  )
}
