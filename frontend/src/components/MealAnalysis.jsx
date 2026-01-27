import { Sparkles } from 'lucide-react'
import { Card, CardBody } from './layout/AppLayout'

export default function MealAnalysis({ imageUrl }) {
  return (
    <Card>
      <CardBody>
        <div className="flex flex-col md:flex-row gap-6">
          {/* Image Preview */}
          <div className="md:w-1/2">
            <div className="aspect-[4/3] rounded-lg overflow-hidden bg-gray-100">
              <img 
                src={imageUrl} 
                alt="Meal being analyzed" 
                className="w-full h-full object-cover"
              />
            </div>
          </div>

          {/* Analysis Status */}
          <div className="md:w-1/2 flex flex-col items-center justify-center text-center py-8">
            <div className="w-16 h-16 bg-brand-50 rounded-2xl flex items-center justify-center mb-4">
              <Sparkles className="w-8 h-8 text-brand-600 animate-pulse" />
            </div>
            
            <h3 className="heading-3 mb-2">Analyzing your meal</h3>
            <p className="text-muted max-w-xs">
              Our AI is identifying food items and calculating nutrition information
            </p>

            {/* Progress indicator */}
            <div className="mt-6 space-y-2 w-full max-w-xs">
              <AnalysisStep label="Detecting food items" active />
              <AnalysisStep label="Estimating portions" />
              <AnalysisStep label="Calculating nutrition" />
            </div>
          </div>
        </div>
      </CardBody>
    </Card>
  )
}

function AnalysisStep({ label, active, complete }) {
  return (
    <div className={`flex items-center gap-3 text-sm ${active ? 'text-brand-600' : 'text-gray-400'}`}>
      <div className={`w-2 h-2 rounded-full ${
        complete ? 'bg-brand-500' : active ? 'bg-brand-500 animate-pulse' : 'bg-gray-300'
      }`} />
      <span>{label}</span>
    </div>
  )
}
