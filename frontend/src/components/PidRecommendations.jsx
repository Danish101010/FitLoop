import { 
  CheckCircle, 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  Lightbulb,
  ChefHat,
  Plus,
  Star
} from 'lucide-react'
import { Card, CardBody, CardHeader } from './layout/AppLayout'

export default function PidRecommendations({ confirmedMeal, pidAnalysis, onLogAnother }) {
  const recommendations = pidAnalysis?.recommendations || []
  const dailySummary = pidAnalysis?.daily_summary
  const nextMealSuggestions = pidAnalysis?.next_meal_suggestions || []

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Success Banner */}
      <Card className="bg-success-50 border-success-500/20">
        <CardBody>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-success-500 rounded-xl flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="heading-3 text-success-600">Meal Logged Successfully</h2>
              <p className="text-sm text-success-600/70 mt-0.5">
                {confirmedMeal?.confirmed_items?.length || 0} items • {' '}
                {Math.round(confirmedMeal?.meal_totals?.calories || 0)} calories
              </p>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Daily Summary */}
      {dailySummary && (
        <Card>
          <CardBody>
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-amber-50 rounded-lg flex items-center justify-center">
                  <Star className="w-5 h-5 text-amber-500" />
                </div>
                <div>
                  <h3 className="heading-4">Daily Score</h3>
                  <p className="text-muted">Based on your nutrition goals</p>
                </div>
              </div>
              <div className="text-3xl font-bold text-brand-600">
                {Math.round((dailySummary.overall_score || 0) * 100)}%
              </div>
            </div>
            
            <p className="text-gray-700">{dailySummary.headline}</p>
            
            {dailySummary.encouragement && (
              <p className="text-muted mt-2">{dailySummary.encouragement}</p>
            )}
          </CardBody>
        </Card>
      )}

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-purple-50 rounded-lg flex items-center justify-center">
                <Lightbulb className="w-4 h-4 text-purple-500" />
              </div>
              <div>
                <h3 className="heading-4">Recommendations</h3>
                <p className="text-muted">Personalized for your goals</p>
              </div>
            </div>
          </CardHeader>
          <div className="divide-y divide-gray-100">
            {recommendations.slice(0, 3).map((rec, index) => (
              <RecommendationRow key={index} recommendation={rec} />
            ))}
          </div>
        </Card>
      )}

      {/* Next Meal Suggestions */}
      {nextMealSuggestions.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
                <ChefHat className="w-4 h-4 text-blue-500" />
              </div>
              <div>
                <h3 className="heading-4">Next Meal Ideas</h3>
                <p className="text-muted">To hit your daily targets</p>
              </div>
            </div>
          </CardHeader>
          <CardBody className="pt-0">
            <div className="space-y-3">
              {nextMealSuggestions.slice(0, 2).map((meal, index) => (
                <MealSuggestion key={index} meal={meal} />
              ))}
            </div>
          </CardBody>
        </Card>
      )}

      {/* Log Another Button */}
      <button onClick={onLogAnother} className="btn-primary w-full">
        <Plus className="w-4 h-4" />
        Log Another Meal
      </button>
    </div>
  )
}

function RecommendationRow({ recommendation }) {
  const getTypeIcon = (type) => {
    switch (type) {
      case 'deficit':
        return <TrendingDown className="w-4 h-4 text-amber-500" />
      case 'surplus':
        return <TrendingUp className="w-4 h-4 text-red-500" />
      case 'trend_warning':
        return <AlertTriangle className="w-4 h-4 text-orange-500" />
      case 'goal_progress':
        return <CheckCircle className="w-4 h-4 text-green-500" />
      default:
        return <Lightbulb className="w-4 h-4 text-purple-500" />
    }
  }

  return (
    <div className="p-4">
      <div className="flex items-start gap-3">
        <div className="mt-0.5">{getTypeIcon(recommendation.type)}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-medium text-gray-500 uppercase">
              {recommendation.nutrient}
            </span>
            {recommendation.priority && (
              <span className="badge-gray">Priority {recommendation.priority}</span>
            )}
          </div>
          <p className="text-gray-700">{recommendation.suggestion}</p>
          
          {recommendation.food_suggestions?.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {recommendation.food_suggestions.slice(0, 3).map((food, i) => (
                <span key={i} className="badge-gray">
                  {food.name}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function MealSuggestion({ meal }) {
  return (
    <div className="p-4 bg-gray-50 rounded-lg">
      <h4 className="font-medium text-gray-900">{meal.meal_name}</h4>
      <p className="text-sm text-gray-600 mt-1">{meal.why}</p>
      
      {meal.estimated_nutrition && (
        <div className="flex gap-4 mt-2 text-xs text-gray-500">
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
    </div>
  )
}
