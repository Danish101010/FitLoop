import { useState, useEffect } from 'react'
import { Dumbbell, Plus, Clock, Flame, Trash2, X, Zap, Heart, Footprints, Bike, Waves } from 'lucide-react'
import { logWorkout, getTodayWorkouts, deleteWorkoutLog } from '../services/api'
import { Card, CardBody } from './layout/AppLayout'
import toast from 'react-hot-toast'

export default function WorkoutLogging() {
  const [todayData, setTodayData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [logging, setLogging] = useState(false)
  const [showForm, setShowForm] = useState(false)

  // Form state
  const [selectedType, setSelectedType] = useState(null)
  const [workoutName, setWorkoutName] = useState('')
  const [duration, setDuration] = useState(30)
  const [intensity, setIntensity] = useState('moderate')
  const [calories, setCalories] = useState('')

  // Workout categories with better organization
  const workoutCategories = [
    { 
      value: 'running', 
      label: 'Running', 
      icon: Footprints,
      color: 'bg-orange-500',
      lightColor: 'bg-orange-100',
      textColor: 'text-orange-600'
    },
    { 
      value: 'strength', 
      label: 'Strength', 
      icon: Dumbbell,
      color: 'bg-purple-500',
      lightColor: 'bg-purple-100',
      textColor: 'text-purple-600'
    },
    { 
      value: 'cycling', 
      label: 'Cycling', 
      icon: Bike,
      color: 'bg-green-500',
      lightColor: 'bg-green-100',
      textColor: 'text-green-600'
    },
    { 
      value: 'hiit', 
      label: 'HIIT', 
      icon: Zap,
      color: 'bg-red-500',
      lightColor: 'bg-red-100',
      textColor: 'text-red-600'
    },
    { 
      value: 'yoga', 
      label: 'Yoga', 
      icon: Heart,
      color: 'bg-pink-500',
      lightColor: 'bg-pink-100',
      textColor: 'text-pink-600'
    },
    { 
      value: 'swimming', 
      label: 'Swimming', 
      icon: Waves,
      color: 'bg-cyan-500',
      lightColor: 'bg-cyan-100',
      textColor: 'text-cyan-600'
    },
  ]

  const durations = [15, 30, 45, 60, 90]
  
  const intensityOptions = [
    { value: 'low', label: 'Light', emoji: '😊' },
    { value: 'moderate', label: 'Moderate', emoji: '💪' },
    { value: 'high', label: 'Intense', emoji: '🔥' },
  ]

  useEffect(() => {
    fetchTodayWorkouts()
  }, [])

  const fetchTodayWorkouts = async () => {
    try {
      setLoading(true)
      const data = await getTodayWorkouts()
      setTodayData(data)
    } catch (err) {
      console.error('Failed to fetch workouts:', err)
      toast.error('Failed to load workouts')
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setSelectedType(null)
    setWorkoutName('')
    setDuration(30)
    setIntensity('moderate')
    setCalories('')
  }

  const handleSubmit = async () => {
    if (!selectedType || !duration) {
      toast.error('Please select a workout type and duration')
      return
    }

    try {
      setLogging(true)
      await logWorkout({
        workoutType: selectedType,
        workoutName: workoutName || null,
        durationMinutes: duration,
        caloriesBurned: calories ? parseInt(calories) : null,
        intensity,
      })
      toast.success('Workout logged! 💪')
      resetForm()
      setShowForm(false)
      await fetchTodayWorkouts()
    } catch (err) {
      console.error('Failed to log workout:', err)
      toast.error('Failed to log workout')
    } finally {
      setLogging(false)
    }
  }

  const handleDeleteLog = async (logId) => {
    try {
      await deleteWorkoutLog(logId)
      toast.success('Workout removed')
      await fetchTodayWorkouts()
    } catch (err) {
      console.error('Failed to delete workout:', err)
      toast.error('Failed to delete')
    }
  }

  const getWorkoutConfig = (type) => {
    return workoutCategories.find(w => w.value === type) || workoutCategories[0]
  }

  if (loading) {
    return (
      <Card>
        <CardBody>
          <div className="animate-pulse space-y-4">
            <div className="h-6 bg-gray-200 rounded w-1/3"></div>
            <div className="h-24 bg-gray-200 rounded"></div>
            <div className="h-12 bg-gray-200 rounded"></div>
          </div>
        </CardBody>
      </Card>
    )
  }

  const totalDuration = todayData?.total_duration_minutes || 0
  const totalCalories = todayData?.total_calories_burned || 0
  const workoutCount = todayData?.workouts_count || 0

  return (
    <div className="space-y-4">
      {/* Main Stats Card */}
      <Card>
        <CardBody>
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
                <Dumbbell className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Today's Activity</h3>
                <p className="text-sm text-gray-500">
                  {workoutCount === 0 ? 'No workouts yet' : `${workoutCount} workout${workoutCount > 1 ? 's' : ''} completed`}
                </p>
              </div>
            </div>
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="p-4 bg-gradient-to-br from-orange-50 to-amber-50 rounded-xl border border-orange-100">
              <div className="flex items-center gap-2 text-orange-600 mb-1">
                <Clock className="w-4 h-4" />
                <span className="text-sm font-medium">Duration</span>
              </div>
              <div className="text-2xl font-bold text-gray-900">
                {totalDuration}
                <span className="text-sm font-normal text-gray-500 ml-1">min</span>
              </div>
            </div>
            <div className="p-4 bg-gradient-to-br from-red-50 to-rose-50 rounded-xl border border-red-100">
              <div className="flex items-center gap-2 text-red-600 mb-1">
                <Flame className="w-4 h-4" />
                <span className="text-sm font-medium">Burned</span>
              </div>
              <div className="text-2xl font-bold text-gray-900">
                {totalCalories}
                <span className="text-sm font-normal text-gray-500 ml-1">cal</span>
              </div>
            </div>
          </div>

          {/* Add Workout Button */}
          {!showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="w-full py-4 border-2 border-dashed border-gray-200 rounded-xl text-gray-500 hover:border-brand-300 hover:text-brand-600 hover:bg-brand-50/50 transition-all flex items-center justify-center gap-2"
            >
              <Plus className="w-5 h-5" />
              <span className="font-medium">Log a Workout</span>
            </button>
          )}

          {/* Workout Form */}
          {showForm && (
            <div className="space-y-5">
              {/* Form Header */}
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-gray-900">New Workout</h4>
                <button
                  onClick={() => { setShowForm(false); resetForm() }}
                  className="btn-icon"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Workout Type Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  What did you do?
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {workoutCategories.map((type) => {
                    const Icon = type.icon
                    const isSelected = selectedType === type.value
                    return (
                      <button
                        key={type.value}
                        type="button"
                        onClick={() => setSelectedType(type.value)}
                        className={`p-3 rounded-xl border-2 transition-all ${
                          isSelected
                            ? `${type.lightColor} border-current ${type.textColor}`
                            : 'border-gray-100 hover:border-gray-200 bg-gray-50'
                        }`}
                      >
                        <div className={`w-8 h-8 rounded-lg mx-auto mb-2 flex items-center justify-center ${
                          isSelected ? type.color : 'bg-gray-200'
                        }`}>
                          <Icon className={`w-4 h-4 ${isSelected ? 'text-white' : 'text-gray-500'}`} />
                        </div>
                        <span className={`text-xs font-medium ${isSelected ? type.textColor : 'text-gray-600'}`}>
                          {type.label}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Duration Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  How long?
                </label>
                <div className="flex gap-2">
                  {durations.map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDuration(d)}
                      className={`flex-1 py-3 rounded-lg font-medium text-sm transition-all ${
                        duration === d
                          ? 'bg-brand-600 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {d}m
                    </button>
                  ))}
                </div>
              </div>

              {/* Intensity Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Intensity
                </label>
                <div className="flex gap-2">
                  {intensityOptions.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setIntensity(opt.value)}
                      className={`flex-1 py-3 px-4 rounded-lg transition-all flex items-center justify-center gap-2 ${
                        intensity === opt.value
                          ? 'bg-brand-100 text-brand-700 border-2 border-brand-500'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border-2 border-transparent'
                      }`}
                    >
                      <span>{opt.emoji}</span>
                      <span className="font-medium text-sm">{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Optional: Custom name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Name <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  value={workoutName}
                  onChange={(e) => setWorkoutName(e.target.value)}
                  placeholder="e.g., Morning run in the park"
                  className="input-field"
                />
              </div>

              {/* Submit Button */}
              <button
                onClick={handleSubmit}
                disabled={logging || !selectedType}
                className="btn-primary w-full py-3"
              >
                {logging ? 'Saving...' : 'Log Workout'}
              </button>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Workout History */}
      {todayData?.workouts?.length > 0 && (
        <Card>
          <CardBody className="p-0">
            <div className="px-4 py-3 border-b border-gray-100">
              <h4 className="font-semibold text-gray-900">Today's Workouts</h4>
            </div>
            <div className="divide-y divide-gray-50">
              {todayData.workouts.map((workout) => {
                const config = getWorkoutConfig(workout.workout_type)
                const Icon = config.icon
                return (
                  <div
                    key={workout.id}
                    className="flex items-center gap-4 px-4 py-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${config.lightColor}`}>
                      <Icon className={`w-6 h-6 ${config.textColor}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">
                        {workout.workout_name || config.label}
                      </p>
                      <div className="flex items-center gap-3 text-sm text-gray-500">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          {workout.duration_minutes} min
                        </span>
                        {workout.calories_burned && (
                          <span className="flex items-center gap-1">
                            <Flame className="w-3.5 h-3.5" />
                            {workout.calories_burned} cal
                          </span>
                        )}
                        {workout.intensity && (
                          <span className="capitalize">{workout.intensity}</span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteLog(workout.id)}
                      className="btn-icon text-gray-400 hover:text-red-500 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )
              })}
            </div>
          </CardBody>
        </Card>
      )}

      {/* Empty State */}
      {!showForm && workoutCount === 0 && (
        <div className="text-center py-8">
          <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Dumbbell className="w-8 h-8 text-gray-400" />
          </div>
          <p className="text-gray-500 mb-2">No workouts logged today</p>
          <p className="text-sm text-gray-400">Tap the button above to log your first workout!</p>
        </div>
      )}
    </div>
  )
}
