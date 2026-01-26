import axios from 'axios'

// API base URL - uses Vite proxy in development
const API_BASE = '/api/v1'

const api = axios.create({
  baseURL: '',
  headers: {
    'Content-Type': 'application/json',
  },
})

// Add request interceptor to always include fresh token from localStorage
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('fitloop_token')
    console.log('[API] Request to:', config.url, '| Token present:', !!token)
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
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

export default api
