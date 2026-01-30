import axios from 'axios'

// API base URL - uses environment variable in production, Vite proxy in development
let API_URL = import.meta.env.VITE_API_URL || ''
// Normalize common configs:
// - remove trailing slash
// - allow users to (incorrectly) include /api/v1 in VITE_API_URL
API_URL = API_URL.replace(/\/+$/, '')
API_URL = API_URL.replace(/\/api\/v1$/, '')

const API_BASE = `${API_URL}/api/v1`

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json', // Always request JSON responses
  },
  timeout: 30000, // 30 second timeout
})

// Add request interceptor to always include fresh token from localStorage
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('fitloop_token')
    console.log('[API] Request to:', config.url, '| Token present:', !!token)
    if (token) {
      // Axios v1 may use AxiosHeaders (with .set)
      if (config.headers && typeof config.headers.set === 'function') {
        config.headers.set('Authorization', `Bearer ${token}`)
      } else {
        config.headers = {
          ...(config.headers || {}),
          Authorization: `Bearer ${token}`,
        }
      }
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Add response interceptor to handle non-JSON responses (prevents .txt download on mobile)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Handle network errors (no response)
    if (!error.response) {
      console.error('[API] Network error:', error.message)
      return Promise.reject(new Error('Network error. Please check your connection.'))
    }

    // Handle non-JSON responses (prevents mobile download prompt)
    const contentType = error.response.headers?.['content-type'] || ''
    if (!contentType.includes('application/json')) {
      console.error('[API] Non-JSON response:', error.response.status, contentType)
      return Promise.reject(new Error('Server returned an invalid response. Please try again.'))
    }

    // Handle 401 Unauthorized - redirect to login
    if (error.response.status === 401) {
      console.log('[API] Unauthorized, clearing auth state')
      localStorage.removeItem('fitloop_token')
      localStorage.removeItem('fitloop_user')
      // Only redirect if not already on auth page
      if (!window.location.pathname.includes('/auth')) {
        window.location.href = '/auth'
      }
    }

    return Promise.reject(error)
  }
)

/**
 * Analyze a meal image
 * @param {string} imageBase64 - Base64 encoded image
 * @param {string} mealType - Type of meal (breakfast, lunch, dinner, snack)
 * @param {string} mealDescription - Optional description to help AI identify foods
 * @returns {Promise} API response
 */
export async function analyzeMeal(imageBase64, mealType = 'lunch', mealDescription = null) {
  try {
    const payload = {
      image_base64: imageBase64,
      meal_type: mealType,
      dietary_preferences: "no specific restrictions",
      allergies: "none",
    }
    
    // Only include description if provided
    if (mealDescription && mealDescription.trim()) {
      payload.meal_description = mealDescription.trim()
    }
    
    const response = await api.post(`${API_BASE}/meals/analyze`, payload)
    return response.data
  } catch (error) {
    console.error('Analyze meal error:', error)
    throw new Error(error.response?.data?.detail || 'Failed to analyze meal')
  }
}

/**
 * Confirm or correct meal items
 * @param {string} mealId - Meal ID from analyze response
 * @param {Array} items - Confirmed/corrected food items
 * @returns {Promise} API response
 */
export async function confirmMeal(mealId, items) {
  try {
    const response = await api.post(`${API_BASE}/meals/${mealId}/confirm`, {
      meal_id: mealId,
      items: items,
      user_confirmed: true,
    })
    return response.data
  } catch (error) {
    console.error('Confirm meal error:', error)
    throw new Error(error.response?.data?.detail || 'Failed to confirm meal')
  }
}

/**
 * Get PID-based nutritional recommendations
 * @param {string} mealId - Meal ID
 * @param {object} pidRequest - PID analysis request parameters
 * @returns {Promise} API response
 */
export async function getPidAnalysis(mealId, pidRequest) {
  try {
    const response = await api.post(`${API_BASE}/meals/${mealId}/pid`, pidRequest)
    return response.data
  } catch (error) {
    console.error('PID analysis error:', error)
    throw new Error(error.response?.data?.detail || 'Failed to get recommendations')
  }
}

/**
 * Health check
 * @returns {Promise} API status
 */
export async function checkHealth() {
  try {
    const response = await api.get('/health')
    return response.data
  } catch (error) {
    console.error('Health check error:', error)
    throw new Error('API is not available')
  }
}

// =============================================================================
// PROGRESS TRACKING API
// =============================================================================

/**
 * Get today's nutrition progress
 * @returns {Promise} Today's progress data
 */
export async function getTodayProgress() {
  try {
    const response = await api.get(`${API_BASE}/progress/today`)
    return response.data
  } catch (error) {
    console.error('Get today progress error:', error)
    throw new Error(error.response?.data?.detail || 'Failed to get today progress')
  }
}

/**
 * Get weekly nutrition progress
 * @returns {Promise} Weekly progress data
 */
export async function getWeeklyProgress() {
  try {
    const response = await api.get(`${API_BASE}/progress/weekly`)
    return response.data
  } catch (error) {
    console.error('Get weekly progress error:', error)
    throw new Error(error.response?.data?.detail || 'Failed to get weekly progress')
  }
}

/**
 * Get monthly nutrition progress
 * @returns {Promise} Monthly progress data
 */
export async function getMonthlyProgress() {
  try {
    const response = await api.get(`${API_BASE}/progress/monthly`)
    return response.data
  } catch (error) {
    console.error('Get monthly progress error:', error)
    throw new Error(error.response?.data?.detail || 'Failed to get monthly progress')
  }
}

/**
 * Get meal history
 * @param {number} limit - Number of meals to fetch
 * @param {number} offset - Offset for pagination
 * @returns {Promise} Meal history data
 */
export async function getMealHistory(limit = 20, offset = 0) {
  try {
    const response = await api.get(`${API_BASE}/meals/history`, {
      params: { limit, offset }
    })
    return response.data
  } catch (error) {
    console.error('Get meal history error:', error)
    throw new Error(error.response?.data?.detail || 'Failed to get meal history')
  }
}

// =============================================================================
// WATER TRACKING API
// =============================================================================

/**
 * Log water intake
 * @param {number} amountMl - Amount in milliliters
 * @param {string} note - Optional note
 * @returns {Promise} Created water log
 */
export async function logWater(amountMl, note = null) {
  try {
    const payload = { amount_ml: amountMl }
    if (note) payload.note = note
    
    const response = await api.post(`${API_BASE}/water/log`, payload)
    return response.data
  } catch (error) {
    console.error('Log water error:', error)
    throw new Error(error.response?.data?.detail || 'Failed to log water')
  }
}

/**
 * Delete a water log entry
 * @param {number} logId - Water log ID
 * @returns {Promise} Success response
 */
export async function deleteWaterLog(logId) {
  try {
    const response = await api.delete(`${API_BASE}/water/log/${logId}`)
    return response.data
  } catch (error) {
    console.error('Delete water log error:', error)
    throw new Error(error.response?.data?.detail || 'Failed to delete water log')
  }
}

/**
 * Get today's water intake summary
 * @returns {Promise} Today's water data
 */
export async function getTodayWater() {
  try {
    const response = await api.get(`${API_BASE}/water/today`)
    return response.data
  } catch (error) {
    console.error('Get today water error:', error)
    throw new Error(error.response?.data?.detail || 'Failed to get water data')
  }
}

/**
 * Get weekly water intake summary
 * @returns {Promise} Weekly water data
 */
export async function getWeeklyWater() {
  try {
    const response = await api.get(`${API_BASE}/water/weekly`)
    return response.data
  } catch (error) {
    console.error('Get weekly water error:', error)
    throw new Error(error.response?.data?.detail || 'Failed to get weekly water data')
  }
}

/**
 * Get user's water goal
 * @returns {Promise} Water goal data
 */
export async function getWaterGoal() {
  try {
    const response = await api.get(`${API_BASE}/water/goal`)
    return response.data
  } catch (error) {
    console.error('Get water goal error:', error)
    throw new Error(error.response?.data?.detail || 'Failed to get water goal')
  }
}

/**
 * Update user's water goal
 * @param {number} dailyGoalMl - New daily goal in milliliters
 * @returns {Promise} Updated water goal
 */
export async function updateWaterGoal(dailyGoalMl) {
  try {
    const response = await api.put(`${API_BASE}/water/goal`, {
      daily_goal_ml: dailyGoalMl
    })
    return response.data
  } catch (error) {
    console.error('Update water goal error:', error)
    throw new Error(error.response?.data?.detail || 'Failed to update water goal')
  }
}

// =============================================================================
// WORKOUT LOGGING API
// =============================================================================

/**
 * Log a workout
 * @param {object} workout - Workout details
 * @param {string} workout.workoutType - Type (cardio, strength, etc.)
 * @param {number} workout.durationMinutes - Duration in minutes
 * @param {string} workout.workoutName - Optional workout name
 * @param {number} workout.caloriesBurned - Optional calories burned
 * @param {string} workout.intensity - Optional intensity (low, moderate, high)
 * @param {string} workout.notes - Optional notes
 * @returns {Promise} Created workout log
 */
export async function logWorkout(workout) {
  try {
    const payload = {
      workout_type: workout.workoutType,
      duration_minutes: workout.durationMinutes,
    }
    if (workout.workoutName) payload.workout_name = workout.workoutName
    if (workout.caloriesBurned) payload.calories_burned = workout.caloriesBurned
    if (workout.intensity) payload.intensity = workout.intensity
    if (workout.notes) payload.notes = workout.notes
    
    const response = await api.post(`${API_BASE}/workouts/log`, payload)
    return response.data
  } catch (error) {
    console.error('Log workout error:', error)
    throw new Error(error.response?.data?.detail || 'Failed to log workout')
  }
}

/**
 * Delete a workout log entry
 * @param {number} logId - Workout log ID
 * @returns {Promise} Success response
 */
export async function deleteWorkoutLog(logId) {
  try {
    const response = await api.delete(`${API_BASE}/workouts/log/${logId}`)
    return response.data
  } catch (error) {
    console.error('Delete workout log error:', error)
    throw new Error(error.response?.data?.detail || 'Failed to delete workout log')
  }
}

/**
 * Get today's workouts summary
 * @returns {Promise} Today's workout data
 */
export async function getTodayWorkouts() {
  try {
    const response = await api.get(`${API_BASE}/workouts/today`)
    return response.data
  } catch (error) {
    console.error('Get today workouts error:', error)
    throw new Error(error.response?.data?.detail || 'Failed to get workout data')
  }
}

/**
 * Get weekly workouts summary
 * @returns {Promise} Weekly workout data
 */
export async function getWeeklyWorkouts() {
  try {
    const response = await api.get(`${API_BASE}/workouts/weekly`)
    return response.data
  } catch (error) {
    console.error('Get weekly workouts error:', error)
    throw new Error(error.response?.data?.detail || 'Failed to get weekly workout data')
  }
}

// =============================================================================
// FULL PROGRESS API (includes water & workouts)
// =============================================================================

/**
 * Get today's full progress (nutrition + water + workouts)
 * @returns {Promise} Full progress data
 */
export async function getTodayFullProgress() {
  try {
    const response = await api.get(`${API_BASE}/progress/today/full`)
    return response.data
  } catch (error) {
    console.error('Get full progress error:', error)
    throw new Error(error.response?.data?.detail || 'Failed to get full progress')
  }
}

export default api
