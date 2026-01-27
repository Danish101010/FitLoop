import { useRef, useState } from 'react'
import { Camera, Upload, Image as ImageIcon } from 'lucide-react'
import { Card, CardBody } from './layout/AppLayout'

const MEAL_TYPES = [
  { id: 'breakfast', label: 'Breakfast', time: '6am - 10am' },
  { id: 'lunch', label: 'Lunch', time: '11am - 2pm' },
  { id: 'dinner', label: 'Dinner', time: '5pm - 9pm' },
  { id: 'snack', label: 'Snack', time: 'Anytime' },
]

export default function ImageUpload({ 
  onImageSelect, 
  mealType, 
  onMealTypeChange,
  mealDescription,
  onMealDescriptionChange 
}) {
  const fileInputRef = useRef(null)
  const cameraInputRef = useRef(null)
  const [dragActive, setDragActive] = useState(false)

  const handleFile = (file) => {
    if (!file || !file.type.startsWith('image/')) {
      return
    }

    const reader = new FileReader()
    reader.onload = (e) => {
      const base64 = e.target.result.split(',')[1]
      onImageSelect(base64, file)
    }
    reader.readAsDataURL(file)
  }

  const handleDrag = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0])
    }
  }

  return (
    <div className="space-y-6">
      {/* Meal Type Selection */}
      <Card>
        <CardBody>
          <label className="input-label mb-3">Meal Type</label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {MEAL_TYPES.map((type) => (
              <button
                key={type.id}
                onClick={() => onMealTypeChange(type.id)}
                className={`p-3 rounded-lg border-2 text-center transition-all ${
                  mealType === type.id
                    ? 'border-brand-500 bg-brand-50'
                    : 'border-gray-200 hover:border-gray-300 bg-white'
                }`}
              >
                <div className={`text-sm font-medium ${mealType === type.id ? 'text-brand-700' : 'text-gray-900'}`}>
                  {type.label}
                </div>
                <div className="text-xs text-gray-500 mt-0.5">{type.time}</div>
              </button>
            ))}
          </div>
        </CardBody>
      </Card>

      {/* Upload Area */}
      <Card>
        <CardBody>
          <div
            className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
              dragActive 
                ? 'border-brand-500 bg-brand-50' 
                : 'border-gray-300 hover:border-gray-400'
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <ImageIcon className="w-8 h-8 text-gray-400" />
            </div>
            
            <h3 className="heading-4 mb-2">Upload your meal photo</h3>
            <p className="text-muted mb-6">Drag and drop an image, or use the buttons below</p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                onClick={() => cameraInputRef.current?.click()}
                className="btn-primary w-full sm:w-auto"
              >
                <Camera className="w-4 h-4" />
                Take Photo
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="btn-secondary w-full sm:w-auto"
              >
                <Upload className="w-4 h-4" />
                Browse Files
              </button>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
              className="hidden"
            />
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
              className="hidden"
            />
          </div>

          <p className="text-xs text-gray-400 text-center mt-4">
            Supported formats: JPG, PNG, HEIC • Max size: 10MB
          </p>
        </CardBody>
      </Card>

      {/* Optional Description */}
      <Card>
        <CardBody>
          <label className="input-label">Additional Details (Optional)</label>
          <textarea
            value={mealDescription}
            onChange={(e) => onMealDescriptionChange(e.target.value)}
            placeholder="e.g., homemade, no sauce, extra vegetables..."
            rows={2}
            className="input mt-1.5 resize-none"
          />
          <p className="input-hint">Help improve accuracy by adding context about your meal</p>
        </CardBody>
      </Card>
    </div>
  )
}
