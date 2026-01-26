import { useRef, useState } from 'react'
import { Camera, Upload, Image as ImageIcon, Sun, Coffee, Moon, Cookie, MessageSquare } from 'lucide-react'

const mealTypes = [
  { value: 'breakfast', label: 'Breakfast', icon: Coffee },
  { value: 'lunch', label: 'Lunch', icon: Sun },
  { value: 'dinner', label: 'Dinner', icon: Moon },
  { value: 'snack', label: 'Snack', icon: Cookie },
]

function ImageUpload({ onImageSelect, mealType, onMealTypeChange, mealDescription, onMealDescriptionChange }) {
  const fileInputRef = useRef(null)
  const [isDragging, setIsDragging] = useState(false)

  const handleFileSelect = (file) => {
    if (!file || !file.type.startsWith('image/')) {
      return
    }

    const reader = new FileReader()
    reader.onloadend = () => {
      // Remove data URL prefix to get pure base64
      const base64 = reader.result.split(',')[1]
      onImageSelect(base64, file)
    }
    reader.readAsDataURL(file)
  }

  const handleInputChange = (e) => {
    const file = e.target.files?.[0]
    if (file) handleFileSelect(file)
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleFileSelect(file)
  }

  return (
    <div className="space-y-6">
      {/* Meal Type Selector */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
          What meal is this?
        </h3>
        <div className="grid grid-cols-4 gap-3">
          {mealTypes.map((type) => {
            const Icon = type.icon
            const isSelected = mealType === type.value
            
            return (
              <button
                key={type.value}
                onClick={() => onMealTypeChange(type.value)}
                className={`
                  flex flex-col items-center gap-2 p-4 rounded-xl transition-all
                  ${isSelected 
                    ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/30 scale-105' 
                    : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                  }
                `}
              >
                <Icon className={`w-6 h-6 ${isSelected ? 'text-white' : 'text-gray-400'}`} />
                <span className="text-sm font-medium">{type.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Optional Meal Description */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <div className="flex items-center gap-2 mb-3">
          <MessageSquare className="w-4 h-4 text-gray-400" />
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
            Describe your meal (optional)
          </h3>
        </div>
        <textarea
          value={mealDescription || ''}
          onChange={(e) => onMealDescriptionChange(e.target.value)}
          placeholder="Help the AI identify your food better, e.g., 'Chicken dumplings with soy sauce' or 'Veggie wrap with hummus and feta'"
          className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary-300 focus:ring focus:ring-primary-100 focus:ring-opacity-50 transition-all text-gray-700 placeholder-gray-400 resize-none"
          rows={2}
          maxLength={500}
        />
        <p className="text-xs text-gray-400 mt-2">
          💡 Especially useful for foods where contents aren't visible (dumplings, wraps, sandwiches, etc.)
        </p>
      </div>

      {/* Upload Area */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
          Upload your meal photo
        </h3>
        
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`
            relative border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer
            transition-all duration-200
            ${isDragging 
              ? 'border-primary-500 bg-primary-50' 
              : 'border-gray-200 hover:border-primary-300 hover:bg-gray-50'
            }
          `}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleInputChange}
            className="hidden"
          />
          
          <div className="flex flex-col items-center gap-4">
            <div className={`
              w-20 h-20 rounded-2xl flex items-center justify-center transition-colors
              ${isDragging ? 'bg-primary-100' : 'bg-gray-100'}
            `}>
              {isDragging ? (
                <Upload className="w-10 h-10 text-primary-500" />
              ) : (
                <ImageIcon className="w-10 h-10 text-gray-400" />
              )}
            </div>
            
            <div>
              <p className="text-lg font-semibold text-gray-700">
                {isDragging ? 'Drop your image here' : 'Drag & drop your meal photo'}
              </p>
              <p className="text-sm text-gray-500 mt-1">
                or click to browse from your device
              </p>
            </div>
            
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <Camera className="w-4 h-4" />
              <span>Supports JPG, PNG, HEIC up to 10MB</span>
            </div>
          </div>
        </div>

        {/* Tips */}
        <div className="mt-6 p-4 bg-gradient-secondary rounded-xl">
          <h4 className="text-sm font-semibold text-gray-700 mb-2">📸 Tips for best results</h4>
          <ul className="text-sm text-gray-600 space-y-1">
            <li>• Take photo from directly above your plate</li>
            <li>• Ensure good lighting - natural light works best</li>
            <li>• Include the full plate in the frame</li>
            <li>• Avoid blurry or shadowy images</li>
          </ul>
        </div>
      </div>
    </div>
  )
}

export default ImageUpload
