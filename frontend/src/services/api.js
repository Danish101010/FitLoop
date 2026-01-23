import axios from 'axios'

// API base URL - uses Vite proxy in development
const API_BASE = '/api/v1'

const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
})

/**
 * Analyze a meal image
 * @param {string} imageBase64 - Base64 encoded image
 * @param {string} mealType - Type of meal (breakfast, lunch, dinner, snack)
 * @returns {Promise} API response
 */
export async function analyzeMeal(imageBase64, mealType = 'lunch') {
  try {
    const response = await api.post('/meals/analyze', {
      image_base64: imageBase64,
      meal_type: mealType,
      dietary_preferences: "no specific restrictions",
      allergies: "none",
    })
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
    const response = await api.post(`/meals/${mealId}/confirm`, {
      items: items,
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
    const response = await api.post(`/meals/${mealId}/pid`, pidRequest)
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

export default api
