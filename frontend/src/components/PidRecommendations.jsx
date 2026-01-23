import { 
  CheckCircle2, 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  Lightbulb,
  ChefHat,
  Plus,
  Star,
  Sparkles
} from 'lucide-react'

function PidRecommendations({ confirmedMeal, pidAnalysis, onLogAnother }) {
  const recommendations = pidAnalysis?.recommendations || []
  const dailySummary = pidAnalysis?.daily_summary
  const nextMealSuggestions = pidAnalysis?.next_meal_suggestions || []

  return (
    <div className="space-y-6">
      {/* Success Banner */}
      <div className="bg-gradient-to-r from-primary-500 to-primary-600 rounded-2xl p-6 text-white">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center">
            <CheckCircle2 className="w-10 h-10" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">Meal Logged!</h2>
            <p className="text-white/80 mt-1">
              {confirmedMeal?.confirmed_items?.length || 0} items • {' '}
              {Math.round(confirmedMeal?.meal_totals?.calories || 0)} calories
            </p>
          </div>
        </div>
      </div>

      {/* Daily Summary */}
      {dailySummary && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
              <Star className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Daily Score</h3>
              <p className="text-sm text-gray-500">Based on your nutrition goals</p>
            </div>
            <div className="ml-auto text-right">
              <p className="text-3xl font-bold text-primary-600">
                {Math.round((dailySummary.overall_score || 0) * 100)}%
              </p>
            </div>
          </div>
          
          <p className="text-gray-700 font-medium">{dailySummary.headline}</p>
          
          {dailySummary.encouragement && (
            <p className="text-gray-500 mt-2 text-sm">{dailySummary.encouragement}</p>
          )}
        </div>
      )}

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-5 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
                <Lightbulb className="w-5 h-5 text-purple-500" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Smart Recommendations</h3>
                <p className="text-sm text-gray-500">Personalized for your goals</p>
              </div>
            </div>
          </div>
          
          <div className="divide-y divide-gray-100">
            {recommendations.slice(0, 3).map((rec, index) => (
              <RecommendationCard key={index} recommendation={rec} />
            ))}
          </div>
        </div>
      )}

      {/* Next Meal Suggestions */}
      {nextMealSuggestions.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
              <ChefHat className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Next Meal Ideas</h3>
              <p className="text-sm text-gray-500">To hit your daily targets</p>
            </div>
          </div>
          
          <div className="space-y-3">
            {nextMealSuggestions.slice(0, 2).map((meal, index) => (
              <MealSuggestionCard key={index} meal={meal} />
            ))}
          </div>
        </div>
      )}

      {/* No Recommendations Fallback */}
      {!pidAnalysis && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Sparkles className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="font-semibold text-gray-900 mb-2">Recommendations Coming Soon</h3>
          <p className="text-gray-500 text-sm">
            Keep logging your meals to get personalized nutrition insights
          </p>
        </div>
      )}

      {/* Log Another Button */}
      <button
        onClick={onLogAnother}
        className="w-full flex items-center justify-center gap-2 px-6 py-4 gradient-primary text-white rounded-xl font-semibold hover:opacity-90 transition-opacity shadow-lg shadow-primary-500/30"
      >
        <Plus className="w-5 h-5" />
        Log Another Meal
      </button>
    </div>
  )
}

function RecommendationCard({ recommendation }) {
  const getTypeIcon = (type) => {
    switch (type) {
      case 'deficit':
        return <TrendingDown className="w-5 h-5 text-amber-500" />
      case 'surplus':
        return <TrendingUp className="w-5 h-5 text-red-500" />
      case 'trend_warning':
        return <AlertTriangle className="w-5 h-5 text-orange-500" />
      case 'goal_progress':
        return <CheckCircle2 className="w-5 h-5 text-green-500" />
      default:
        return <Lightbulb className="w-5 h-5 text-purple-500" />
    }
  }

  const getTypeBg = (type) => {
    switch (type) {
      case 'deficit':
        return 'bg-amber-50'
      case 'surplus':
        return 'bg-red-50'
      case 'trend_warning':
        return 'bg-orange-50'
      case 'goal_progress':
        return 'bg-green-50'
      default:
        return 'bg-purple-50'
    }
  }

  const severityWidth = Math.round((recommendation.severity || 0) * 100)

  return (
    <div className="p-4">
      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 ${getTypeBg(recommendation.type)} rounded-xl flex items-center justify-center flex-shrink-0`}>
          {getTypeIcon(recommendation.type)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-medium text-gray-500 uppercase">
              {recommendation.nutrient}
            </span>
            {recommendation.priority && (
              <span className="text-xs px-2 py-0.5 bg-gray-100 rounded-full text-gray-500">
                Priority {recommendation.priority}
              </span>
            )}
          </div>
          <p className="text-gray-800">{recommendation.suggestion}</p>
          
          {recommendation.food_suggestions?.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {recommendation.food_suggestions.slice(0, 3).map((food, i) => (
                <span 
                  key={i}
                  className="text-sm px-3 py-1 bg-gray-100 rounded-full text-gray-700"
                >
                  {food.name}
                </span>
              ))}
            </div>
          )}

          {/* Severity indicator */}
          {recommendation.severity !== undefined && (
            <div className="mt-3">
              <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                <span>Severity</span>
                <span>{severityWidth}%</span>
              </div>
              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all ${
                    severityWidth > 70 ? 'bg-red-500' : severityWidth > 40 ? 'bg-amber-500' : 'bg-green-500'
                  }`}
                  style={{ width: `${severityWidth}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function MealSuggestionCard({ meal }) {
  return (
    <div className="p-4 bg-gray-50 rounded-xl">
      <h4 className="font-semibold text-gray-900">{meal.meal_name}</h4>
      <p className="text-sm text-gray-600 mt-1">{meal.why}</p>
      
      {meal.estimated_nutrition && (
        <div className="flex gap-4 mt-3 text-xs text-gray-500">
          {meal.estimated_nutrition.calories && (
            <span>{Math.round(meal.estimated_nutrition.calories)} cal</span>
          )}
          {meal.estimated_nutrition.protein_g && (
            <span>{meal.estimated_nutrition.protein_g}g protein</span>
          )}
          {meal.estimated_nutrition.carbs_g && (
            <span>{meal.estimated_nutrition.carbs_g}g carbs</span>
          )}
        </div>
      )}
      
      {meal.recipe_hint && (
        <p className="text-xs text-primary-600 mt-2">💡 {meal.recipe_hint}</p>
      )}
    </div>
  )
}

export default PidRecommendations
