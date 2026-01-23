import { useState, useEffect } from 'react'
import { Check, X, Edit2, Plus, Minus, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react'

function MealConfirmation({ detection, imageUrl, onConfirm, onCancel }) {
  // Normalize items from detection - handle different response structures
  const normalizeItems = (det) => {
    if (!det) return []
    const rawItems = det.items || []
    return rawItems.map((item, idx) => ({
      item_id: item.item_id || `item_${String(idx).padStart(3, '0')}`,
      food_name: item.food_name || item.name || 'Unknown Item',
      food_category: item.food_category || item.category || 'other',
      portion: {
        grams: item.portion?.grams || item.grams || 100,
        household_measure: item.portion?.household_measure || item.household_measure || '',
        confidence: item.portion?.confidence || 0.5,
      },
      identification: {
        confidence: item.identification?.confidence || item.confidence || 0.5,
        alternatives: item.identification?.alternatives || item.alternatives || [],
      },
      nutrition: {
        calories: item.nutrition?.calories || item.calories || 0,
        protein_g: item.nutrition?.protein_g || item.protein_g || item.protein || 0,
        carbs_g: item.nutrition?.carbs_g || item.carbs_g || item.carbs || 0,
        fat_g: item.nutrition?.fat_g || item.fat_g || item.fat || 0,
        fiber_g: item.nutrition?.fiber_g || item.fiber_g || item.fiber || 0,
      },
    }))
  }

  const [items, setItems] = useState(() => normalizeItems(detection))
  const [expandedItem, setExpandedItem] = useState(null)

  // Update items when detection changes
  useEffect(() => {
    setItems(normalizeItems(detection))
  }, [detection])

  const handleQuantityChange = (itemId, delta) => {
    setItems(prev => prev.map(item => {
      if (item.item_id === itemId) {
        const newGrams = Math.max(10, (item.portion?.grams || 100) + delta * 25)
        const ratio = newGrams / (item.portion?.grams || 100)
        return {
          ...item,
          portion: {
            ...item.portion,
            grams: newGrams,
          },
          nutrition: {
            ...item.nutrition,
            calories: Math.round((item.nutrition?.calories || 0) * ratio),
            protein_g: Math.round((item.nutrition?.protein_g || 0) * ratio * 10) / 10,
            carbs_g: Math.round((item.nutrition?.carbs_g || 0) * ratio * 10) / 10,
            fat_g: Math.round((item.nutrition?.fat_g || 0) * ratio * 10) / 10,
          }
        }
      }
      return item
    }))
  }

  const handleRemoveItem = (itemId) => {
    setItems(prev => prev.filter(item => item.item_id !== itemId))
  }

  const getTotals = () => {
    return items.reduce((acc, item) => ({
      calories: acc.calories + (item.nutrition?.calories || 0),
      protein: acc.protein + (item.nutrition?.protein_g || 0),
      carbs: acc.carbs + (item.nutrition?.carbs_g || 0),
      fat: acc.fat + (item.nutrition?.fat_g || 0),
    }), { calories: 0, protein: 0, carbs: 0, fat: 0 })
  }

  const totals = getTotals()
  const needsConfirmation = detection?.requires_confirmation
  const confirmationReason = detection?.confirmation_reason

  return (
    <div className="space-y-6">
      {/* Header with image */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="flex items-start gap-4 p-5">
          <img 
            src={imageUrl} 
            alt="Your meal" 
            className="w-24 h-24 object-cover rounded-xl"
          />
          <div className="flex-1">
            <h2 className="text-xl font-bold text-gray-900">Review Your Meal</h2>
            <p className="text-gray-500 mt-1">
              We found {items.length} item{items.length !== 1 ? 's' : ''} in your photo
            </p>
            {needsConfirmation && (
              <div className="mt-3 flex items-start gap-2 p-3 bg-amber-50 rounded-lg">
                <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-amber-700">{confirmationReason || 'Please review and confirm the detected items'}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Food Items */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 divide-y divide-gray-100">
        {items.map((item, index) => (
          <FoodItemCard
            key={item.item_id || index}
            item={item}
            isExpanded={expandedItem === item.item_id}
            onToggleExpand={() => setExpandedItem(expandedItem === item.item_id ? null : item.item_id)}
            onQuantityChange={(delta) => handleQuantityChange(item.item_id, delta)}
            onRemove={() => handleRemoveItem(item.item_id)}
          />
        ))}
        
        {items.length === 0 && (
          <div className="p-8 text-center text-gray-500">
            <p>No items detected. Try taking another photo.</p>
          </div>
        )}
      </div>

      {/* Meal Totals */}
      {items.length > 0 && (
        <div className="bg-gradient-to-r from-primary-500 to-primary-600 rounded-2xl p-5 text-white">
          <h3 className="font-semibold mb-4">Meal Totals</h3>
          <div className="grid grid-cols-4 gap-4">
            <div>
              <p className="text-2xl font-bold">{Math.round(totals.calories)}</p>
              <p className="text-sm text-white/70">Calories</p>
            </div>
            <div>
              <p className="text-2xl font-bold">{totals.protein.toFixed(1)}g</p>
              <p className="text-sm text-white/70">Protein</p>
            </div>
            <div>
              <p className="text-2xl font-bold">{totals.carbs.toFixed(1)}g</p>
              <p className="text-sm text-white/70">Carbs</p>
            </div>
            <div>
              <p className="text-2xl font-bold">{totals.fat.toFixed(1)}g</p>
              <p className="text-sm text-white/70">Fat</p>
            </div>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3">
        <button
          onClick={onCancel}
          className="flex-1 flex items-center justify-center gap-2 px-6 py-4 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-colors"
        >
          <X className="w-5 h-5" />
          Cancel
        </button>
        <button
          onClick={() => onConfirm(items)}
          disabled={items.length === 0}
          className="flex-1 flex items-center justify-center gap-2 px-6 py-4 gradient-primary text-white rounded-xl font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-primary-500/30"
        >
          <Check className="w-5 h-5" />
          Confirm & Log
        </button>
      </div>
    </div>
  )
}

function FoodItemCard({ item, isExpanded, onToggleExpand, onQuantityChange, onRemove }) {
  const confidence = item.identification?.confidence || 0
  const confidenceColor = confidence >= 0.8 ? 'text-green-500' : confidence >= 0.55 ? 'text-amber-500' : 'text-red-500'
  const confidenceBg = confidence >= 0.8 ? 'bg-green-50' : confidence >= 0.55 ? 'bg-amber-50' : 'bg-red-50'

  return (
    <div className="p-4">
      <div className="flex items-center gap-4">
        {/* Food Icon/Category */}
        <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center text-2xl">
          {getCategoryEmoji(item.food_category)}
        </div>

        {/* Food Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="font-semibold text-gray-900 truncate">{item.food_name}</h4>
            <span className={`text-xs px-2 py-0.5 rounded-full ${confidenceBg} ${confidenceColor}`}>
              {Math.round(confidence * 100)}%
            </span>
          </div>
          <p className="text-sm text-gray-500">
            {item.portion?.household_measure || `${item.portion?.grams || 100}g`}
          </p>
        </div>

        {/* Quantity Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => onQuantityChange(-1)}
            className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
          >
            <Minus className="w-4 h-4 text-gray-600" />
          </button>
          <span className="w-16 text-center font-medium">{item.portion?.grams || 100}g</span>
          <button
            onClick={() => onQuantityChange(1)}
            className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
          >
            <Plus className="w-4 h-4 text-gray-600" />
          </button>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1">
          <button
            onClick={onToggleExpand}
            className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center transition-colors"
          >
            {isExpanded ? (
              <ChevronUp className="w-5 h-5 text-gray-400" />
            ) : (
              <ChevronDown className="w-5 h-5 text-gray-400" />
            )}
          </button>
          <button
            onClick={onRemove}
            className="w-8 h-8 rounded-lg hover:bg-red-50 flex items-center justify-center transition-colors group"
          >
            <X className="w-5 h-5 text-gray-400 group-hover:text-red-500" />
          </button>
        </div>
      </div>

      {/* Expanded Details */}
      {isExpanded && (
        <div className="mt-4 pt-4 border-t border-gray-100">
          <div className="grid grid-cols-4 gap-4 text-center">
            <NutrientBadge label="Calories" value={item.nutrition?.calories || 0} unit="kcal" />
            <NutrientBadge label="Protein" value={item.nutrition?.protein_g || 0} unit="g" />
            <NutrientBadge label="Carbs" value={item.nutrition?.carbs_g || 0} unit="g" />
            <NutrientBadge label="Fat" value={item.nutrition?.fat_g || 0} unit="g" />
          </div>
          
          {item.identification?.alternatives?.length > 0 && (
            <div className="mt-4">
              <p className="text-xs text-gray-500 mb-2">Did you mean:</p>
              <div className="flex flex-wrap gap-2">
                {item.identification.alternatives.map((alt, i) => (
                  <button
                    key={i}
                    className="text-sm px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors"
                  >
                    {alt.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function NutrientBadge({ label, value, unit }) {
  return (
    <div className="bg-gray-50 rounded-lg p-2">
      <p className="text-lg font-semibold text-gray-900">
        {typeof value === 'number' ? value.toFixed(1) : value}
        <span className="text-xs text-gray-500 ml-0.5">{unit}</span>
      </p>
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  )
}

function getCategoryEmoji(category) {
  const emojis = {
    protein: '🥩',
    carbohydrate: '🍞',
    vegetable: '🥬',
    fruit: '🍎',
    dairy: '🧀',
    fat: '🥑',
    beverage: '🥤',
    condiment: '🧂',
    mixed_dish: '🍲',
    snack: '🍿',
    dessert: '🍰',
    other: '🍽️',
  }
  return emojis[category] || '🍽️'
}

export default MealConfirmation
