import { Flame, Beef, Wheat, Droplets } from 'lucide-react'

function DailyProgress({ progress }) {
  const nutrients = [
    {
      name: 'Calories',
      icon: Flame,
      consumed: progress.calories.consumed,
      target: progress.calories.target,
      unit: 'kcal',
      color: 'orange',
    },
    {
      name: 'Protein',
      icon: Beef,
      consumed: progress.protein.consumed,
      target: progress.protein.target,
      unit: 'g',
      color: 'red',
    },
    {
      name: 'Carbs',
      icon: Wheat,
      consumed: progress.carbs.consumed,
      target: progress.carbs.target,
      unit: 'g',
      color: 'amber',
    },
    {
      name: 'Fat',
      icon: Droplets,
      consumed: progress.fat.consumed,
      target: progress.fat.target,
      unit: 'g',
      color: 'blue',
    },
  ]

  const colorClasses = {
    orange: {
      bg: 'bg-orange-100',
      fill: 'bg-orange-500',
      icon: 'text-orange-500',
      text: 'text-orange-600',
    },
    red: {
      bg: 'bg-red-100',
      fill: 'bg-red-500',
      icon: 'text-red-500',
      text: 'text-red-600',
    },
    amber: {
      bg: 'bg-amber-100',
      fill: 'bg-amber-500',
      icon: 'text-amber-500',
      text: 'text-amber-600',
    },
    blue: {
      bg: 'bg-blue-100',
      fill: 'bg-blue-500',
      icon: 'text-blue-500',
      text: 'text-blue-600',
    },
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
        Today's Progress
      </h2>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {nutrients.map((nutrient) => {
          const Icon = nutrient.icon
          const colors = colorClasses[nutrient.color]
          const percentage = Math.min((nutrient.consumed / nutrient.target) * 100, 100)
          
          return (
            <div key={nutrient.name} className="relative">
              <div className="flex items-center gap-2 mb-2">
                <div className={`w-8 h-8 ${colors.bg} rounded-lg flex items-center justify-center`}>
                  <Icon className={`w-4 h-4 ${colors.icon}`} />
                </div>
                <span className="text-sm font-medium text-gray-700">{nutrient.name}</span>
              </div>
              
              <div className="flex items-baseline gap-1 mb-2">
                <span className={`text-xl font-bold ${colors.text}`}>
                  {Math.round(nutrient.consumed)}
                </span>
                <span className="text-sm text-gray-400">
                  / {nutrient.target} {nutrient.unit}
                </span>
              </div>
              
              <div className={`h-2 ${colors.bg} rounded-full overflow-hidden`}>
                <div 
                  className={`h-full ${colors.fill} rounded-full transition-all duration-500 ease-out`}
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default DailyProgress
