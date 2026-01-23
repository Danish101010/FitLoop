import { Scan, Sparkles } from 'lucide-react'

function MealAnalysis({ imageUrl }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      {/* Image Preview */}
      <div className="relative">
        <img 
          src={imageUrl} 
          alt="Analyzing meal" 
          className="w-full h-64 object-cover"
        />
        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
          <div className="text-center text-white">
            <div className="w-20 h-20 mx-auto mb-4 relative">
              <div className="absolute inset-0 border-4 border-white/30 rounded-full animate-ping"></div>
              <div className="absolute inset-2 border-4 border-white/50 rounded-full animate-pulse"></div>
              <div className="absolute inset-4 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center">
                <Scan className="w-8 h-8 text-white" />
              </div>
            </div>
            <p className="text-lg font-semibold">Analyzing your meal...</p>
            <p className="text-sm text-white/70 mt-1">This usually takes 3-5 seconds</p>
          </div>
        </div>
      </div>

      {/* Analysis Steps */}
      <div className="p-6">
        <div className="space-y-4">
          <AnalysisStep 
            step={1} 
            title="Detecting food items" 
            description="Using AI vision to identify foods in your image"
            isActive={true}
          />
          <AnalysisStep 
            step={2} 
            title="Estimating portions" 
            description="Calculating serving sizes based on visual cues"
            isActive={false}
          />
          <AnalysisStep 
            step={3} 
            title="Calculating nutrition" 
            description="Computing calories, macros, and micronutrients"
            isActive={false}
          />
        </div>

        <div className="mt-6 flex items-center gap-2 text-sm text-gray-500">
          <Sparkles className="w-4 h-4 text-primary-500" />
          <span>Powered by Google Gemini AI</span>
        </div>
      </div>
    </div>
  )
}

function AnalysisStep({ step, title, description, isActive }) {
  return (
    <div className={`flex items-start gap-4 ${isActive ? 'opacity-100' : 'opacity-40'}`}>
      <div className={`
        w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold
        ${isActive ? 'bg-primary-500 text-white' : 'bg-gray-200 text-gray-500'}
      `}>
        {step}
      </div>
      <div className="flex-1">
        <h4 className={`font-semibold ${isActive ? 'text-gray-900' : 'text-gray-500'}`}>
          {title}
        </h4>
        <p className="text-sm text-gray-500">{description}</p>
        {isActive && (
          <div className="mt-2 h-1 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full w-2/3 bg-primary-500 rounded-full animate-pulse"></div>
          </div>
        )}
      </div>
    </div>
  )
}

export default MealAnalysis
