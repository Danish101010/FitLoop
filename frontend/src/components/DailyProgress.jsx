import { Card, CardBody } from './layout/AppLayout'

export default function DailyProgress({ progress }) {
  const nutrients = [
    { 
      key: 'calories', 
      label: 'Calories', 
      unit: 'kcal',
      color: 'bg-brand-500'
    },
    { 
      key: 'protein', 
      label: 'Protein', 
      unit: 'g',
      color: 'bg-blue-500'
    },
    { 
      key: 'carbs', 
      label: 'Carbs', 
      unit: 'g',
      color: 'bg-amber-500'
    },
    { 
      key: 'fat', 
      label: 'Fat', 
      unit: 'g',
      color: 'bg-rose-500'
    },
  ]

  return (
    <Card>
      <CardBody>
        <div className="flex items-center justify-between mb-4">
          <h2 className="heading-4">Today's Progress</h2>
          <span className="text-muted">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</span>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {nutrients.map((nutrient) => {
            const data = progress[nutrient.key]
            const percentage = Math.min((data.consumed / data.target) * 100, 100)
            const remaining = Math.max(data.target - data.consumed, 0)
            
            return (
              <div key={nutrient.key} className="space-y-2">
                <div className="flex items-baseline justify-between">
                  <span className="text-sm text-gray-500">{nutrient.label}</span>
                  <span className="text-xs text-gray-400">{Math.round(remaining)} left</span>
                </div>
                
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-bold text-gray-900">
                    {Math.round(data.consumed)}
                  </span>
                  <span className="text-sm text-gray-400">
                    / {data.target} {nutrient.unit}
                  </span>
                </div>

                <div className="progress-bar">
                  <div 
                    className={`progress-fill ${nutrient.color}`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </CardBody>
    </Card>
  )
}
