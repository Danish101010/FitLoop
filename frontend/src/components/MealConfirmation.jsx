import { useState } from 'react'
import { Check, X, Plus, Minus, ChevronDown } from 'lucide-react'
import { Card, CardBody, CardHeader } from './layout/AppLayout'

// Unit conversion factors to grams
const UNIT_CONVERSIONS = {
  g: 1,
  pieces: 100,  // Default piece weight, will be food-specific
  cups: 240,    // Approximate grams per cup
  tbsp: 15,     // Grams per tablespoon
}

const UNIT_OPTIONS = [
  { value: 'g', label: 'g' },
  { value: 'pieces', label: 'pieces' },
  { value: 'cups', label: 'cups' },
  { value: 'tbsp', label: 'tbsp' },
]

// Calculate nutrition based on grams
const calculateNutrition = (baseNutrition, baseGrams, newGrams) => {
  if (!baseNutrition || !baseGrams || baseGrams === 0) return baseNutrition
  const multiplier = newGrams / baseGrams
  return {
    calories: Math.round((baseNutrition.calories || 0) * multiplier),
    protein_g: Math.round((baseNutrition.protein_g || 0) * multiplier * 10) / 10,
    carbs_g: Math.round((baseNutrition.carbs_g || 0) * multiplier * 10) / 10,
    fat_g: Math.round((baseNutrition.fat_g || 0) * multiplier * 10) / 10,
    fiber_g: Math.round((baseNutrition.fiber_g || 0) * multiplier * 10) / 10,
  }
}

export default function MealConfirmation({ detection, imageUrl, onConfirm, onCancel }) {
  const [items, setItems] = useState(() => {
    return (detection?.items || []).map((item, index) => {
      const baseGrams = item.portion?.grams || 100
      return {
        ...item,
        id: index,
        included: true,
        // Portion editing state
        portionAmount: baseGrams,
        portionUnit: 'g',
        gramsEquivalent: baseGrams,
        baseGrams: baseGrams, // Original grams for ratio calculations
        baseNutrition: { ...item.nutrition }, // Store original nutrition for recalculation
      }
    })
  })

  const toggleItem = (id) => {
    setItems(items.map(item => 
      item.id === id ? { ...item, included: !item.included } : item
    ))
  }

  // Update portion with new amount and unit
  const updatePortion = (id, newAmount, newUnit) => {
    setItems(items.map(item => {
      if (item.id !== id) return item
      
      const amount = Math.max(0.1, newAmount)
      const gramsEquivalent = amount * UNIT_CONVERSIONS[newUnit]
      const nutrition = calculateNutrition(item.baseNutrition, item.baseGrams, gramsEquivalent)
      
      return {
        ...item,
        portionAmount: amount,
        portionUnit: newUnit,
        gramsEquivalent,
        nutrition,
        portion: {
          ...item.portion,
          grams: gramsEquivalent,
          amount,
          unit: newUnit,
        }
      }
    }))
  }

  // Quick increment/decrement portion
  const adjustPortion = (id, delta) => {
    const item = items.find(i => i.id === id)
    if (!item) return
    
    // Delta is in the current unit
    const increment = item.portionUnit === 'g' ? 10 : 0.25
    const newAmount = Math.max(0.1, item.portionAmount + (delta * increment))
    updatePortion(id, newAmount, item.portionUnit)
  }

  const includedItems = items.filter(item => item.included)
  
  const totals = includedItems.reduce((acc, item) => ({
    calories: acc.calories + (item.nutrition?.calories || 0),
    protein: acc.protein + (item.nutrition?.protein_g || 0),
    carbs: acc.carbs + (item.nutrition?.carbs_g || 0),
    fat: acc.fat + (item.nutrition?.fat_g || 0),
  }), { calories: 0, protein: 0, carbs: 0, fat: 0 })

  const handleConfirm = () => {
    onConfirm(includedItems)
  }

  return (
    <div className="space-y-6">
      {/* Image and Overview */}
      <Card>
        <CardBody>
          <div className="flex flex-col sm:flex-row gap-6">
            {/* Image */}
            <div className="sm:w-40 flex-shrink-0">
              <div className="aspect-square rounded-lg overflow-hidden bg-gray-100">
                <img 
                  src={imageUrl} 
                  alt="Meal" 
                  className="w-full h-full object-cover"
                />
              </div>
            </div>

            {/* Summary */}
            <div className="flex-1">
              <h3 className="heading-3 mb-1">Review Detected Items</h3>
              <p className="text-muted mb-4">
                {items.length} items found • {includedItems.length} selected
              </p>

              {/* Quick Stats */}
              <div className="grid grid-cols-4 gap-4">
                <div>
                  <div className="text-2xl font-bold text-gray-900">{Math.round(totals.calories)}</div>
                  <div className="text-xs text-gray-500">Calories</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-gray-900">{Math.round(totals.protein)}g</div>
                  <div className="text-xs text-gray-500">Protein</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-gray-900">{Math.round(totals.carbs)}g</div>
                  <div className="text-xs text-gray-500">Carbs</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-gray-900">{Math.round(totals.fat)}g</div>
                  <div className="text-xs text-gray-500">Fat</div>
                </div>
              </div>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Food Items List */}
      <Card>
        <CardHeader>
          <h3 className="heading-4">Detected Items</h3>
        </CardHeader>
        <div className="divide-y divide-gray-100">
          {items.map((item) => (
            <FoodItemRow 
              key={item.id} 
              item={item}
              onToggle={() => toggleItem(item.id)}
              onUpdatePortion={(amount, unit) => updatePortion(item.id, amount, unit)}
              onAdjustPortion={(delta) => adjustPortion(item.id, delta)}
            />
          ))}
        </div>
      </Card>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3">
        <button
          onClick={onCancel}
          className="btn-secondary flex-1 sm:flex-none"
        >
          <X className="w-4 h-4" />
          Cancel
        </button>
        <button
          onClick={handleConfirm}
          disabled={includedItems.length === 0}
          className="btn-primary flex-1"
        >
          <Check className="w-4 h-4" />
          Confirm & Log Meal
        </button>
      </div>
    </div>
  )
}

function FoodItemRow({ item, onToggle, onUpdatePortion, onAdjustPortion }) {
  const [showUnitDropdown, setShowUnitDropdown] = useState(false)
  const nutrition = item.nutrition || {}

  const handleAmountChange = (e) => {
    const value = parseFloat(e.target.value) || 0
    onUpdatePortion(value, item.portionUnit)
  }

  const handleUnitChange = (unit) => {
    // Convert current amount to new unit
    const currentGrams = item.gramsEquivalent || item.baseGrams
    const newAmount = currentGrams / UNIT_CONVERSIONS[unit]
    onUpdatePortion(Math.round(newAmount * 100) / 100, unit)
    setShowUnitDropdown(false)
  }

  return (
    <div className={`p-4 transition-opacity ${!item.included ? 'opacity-50' : ''}`}>
      <div className="flex items-start gap-4">
        {/* Toggle */}
        <button
          onClick={onToggle}
          className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-colors flex-shrink-0 mt-1 ${
            item.included 
              ? 'bg-brand-500 border-brand-500 text-white' 
              : 'border-gray-300 hover:border-gray-400'
          }`}
        >
          {item.included && <Check className="w-4 h-4" />}
        </button>

        {/* Main Content */}
        <div className="flex-1 min-w-0">
          {/* Food Name */}
          <div className="font-medium text-gray-900 truncate mb-2">
            {item.food_name || item.name || 'Unknown Item'}
          </div>

          {/* Portion Controls */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Numeric Input */}
            <input
              type="number"
              value={item.portionAmount}
              onChange={handleAmountChange}
              disabled={!item.included}
              className="w-20 px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
              min="0.1"
              step={item.portionUnit === 'g' ? 1 : 0.25}
            />

            {/* Unit Selector */}
            <div className="relative">
              <button
                onClick={() => item.included && setShowUnitDropdown(!showUnitDropdown)}
                disabled={!item.included}
                className="flex items-center gap-1 px-2 py-1.5 text-sm border border-gray-300 rounded-md bg-white hover:bg-gray-50 disabled:bg-gray-100 disabled:cursor-not-allowed min-w-[70px]"
              >
                <span>{item.portionUnit}</span>
                <ChevronDown className="w-3 h-3 text-gray-500" />
              </button>
              
              {showUnitDropdown && (
                <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-10 min-w-[80px]">
                  {UNIT_OPTIONS.map(option => (
                    <button
                      key={option.value}
                      onClick={() => handleUnitChange(option.value)}
                      className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-100 ${
                        item.portionUnit === option.value ? 'bg-brand-50 text-brand-600' : ''
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* +/- Buttons */}
            <div className="flex items-center gap-1 ml-2">
              <button
                onClick={() => onAdjustPortion(-1)}
                className="btn-icon p-1.5"
                disabled={!item.included}
                title={`-${item.portionUnit === 'g' ? '10g' : '0.25'}`}
              >
                <Minus className="w-4 h-4" />
              </button>
              <button
                onClick={() => onAdjustPortion(1)}
                className="btn-icon p-1.5"
                disabled={!item.included}
                title={`+${item.portionUnit === 'g' ? '10g' : '0.25'}`}
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            {/* Grams equivalent (when not in grams) */}
            {item.portionUnit !== 'g' && (
              <span className="text-xs text-gray-400 ml-2">
                ≈ {Math.round(item.gramsEquivalent)}g
              </span>
            )}
          </div>
        </div>

        {/* Nutrition - Desktop */}
        <div className="hidden sm:flex items-center gap-3 text-sm text-gray-500 flex-shrink-0">
          <span className="min-w-[50px] text-right">{Math.round(nutrition.calories || 0)} cal</span>
          <span className="min-w-[40px] text-right">{Math.round(nutrition.protein_g || 0)}g P</span>
          <span className="min-w-[40px] text-right">{Math.round(nutrition.carbs_g || 0)}g C</span>
          <span className="min-w-[40px] text-right">{Math.round(nutrition.fat_g || 0)}g F</span>
        </div>
      </div>

      {/* Nutrition - Mobile */}
      <div className="sm:hidden mt-2 ml-10 flex items-center gap-3 text-xs text-gray-500">
        <span>{Math.round(nutrition.calories || 0)} cal</span>
        <span>{Math.round(nutrition.protein_g || 0)}g P</span>
        <span>{Math.round(nutrition.carbs_g || 0)}g C</span>
        <span>{Math.round(nutrition.fat_g || 0)}g F</span>
      </div>
    </div>
  )
}
