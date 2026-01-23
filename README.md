# FitLoop 🍎📸

> AI-powered food logging and nutrition analysis using Google Gemini

## Overview

FitLoop is a modern web app that uses computer vision and LLM-powered analysis to help users track their nutrition. Users photograph their meals, and Gemini AI handles:

- **Food Detection**: Identifies foods in images with confidence scores
- **Portion Estimation**: Estimates serving sizes in grams
- **Macro Calculation**: Computes calories, protein, carbs, fat, fiber
- **PID Recommendations**: Provides personalized nutritional guidance using Proportional-Integral-Derivative analysis

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Backend** | Python 3.11, FastAPI, Pydantic |
| **Frontend** | React 18, Vite, Tailwind CSS |
| **AI/ML** | Google Gemini Vision API |
| **Icons** | Lucide React |

## Project Structure

```
FitLoop/
├── README.md                    # This file
├── requirements.txt             # Python dependencies
│
├── docs/                        # Documentation
│   └── ARCHITECTURE.md          # Detailed MVP architecture
│
├── prompts/                     # Gemini prompt templates
│   ├── vision_prompt.json       # Food detection prompt
│   └── pid_prompt.json          # PID analysis prompt
│
├── schemas/                     # JSON schemas (v1)
│   ├── food_detect_response_v1.json
│   └── kpi_pid_response_v1.json
│
├── backend/                     # FastAPI backend
│   ├── config.py               # Configuration and thresholds
│   ├── models.py               # Pydantic models
│   ├── image_processor.py      # Image compression/processing
│   ├── gemini_client.py        # Gemini API wrapper
│   ├── orchestrator.py         # Pipeline orchestration
│   └── main.py                 # FastAPI application
│
├── api/                         # API documentation
│   └── openapi.yaml            # OpenAPI 3.1 specification
│
├── frontend/                    # React frontend
│   ├── index.html              # HTML entry point
│   ├── package.json            # Node dependencies
│   ├── vite.config.js          # Vite configuration
│   ├── tailwind.config.js      # Tailwind CSS config
│   ├── postcss.config.js       # PostCSS config
│   ├── public/                 # Static assets
│   └── src/
│       ├── main.jsx            # React entry point
│       ├── App.jsx             # Main application component
│       ├── index.css           # Global styles
│       ├── components/         # React components
│       │   ├── Header.jsx
│       │   ├── DailyProgress.jsx
│       │   ├── ImageUpload.jsx
│       │   ├── MealAnalysis.jsx
│       │   ├── MealConfirmation.jsx
│       │   └── PidRecommendations.jsx
│       └── services/
│           └── api.js          # API service layer
│
└── testing/                     # Test plan and data
    ├── test_plan.md
    └── sample_datasets.json
```

## Quick Start

### Prerequisites

- Python 3.11+
- Node.js 18+ and npm
- Google Cloud project with Gemini API enabled
- Gemini API key

### 1. Clone & Setup Python Environment

```bash
cd FitLoop

# Option A: Using pyenv (recommended)
pyenv install 3.11.7
pyenv local 3.11.7
pyenv virtualenv 3.11.7 fitloop
pyenv local fitloop

# Option B: Using venv
python3.11 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install Python dependencies
pip install -r requirements.txt

# Set environment variable
export GEMINI_API_KEY="your-api-key-here"
```

### 2. Start the Backend

```bash
cd backend
uvicorn main:app --reload --port 8000
```

The API will be available at `http://localhost:8000`

### 3. Start the Frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend will be available at `http://localhost:3000`

### 4. Open the App

Visit **http://localhost:3000** in your browser to start logging meals!

## API Documentation

Once the backend is running:
- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

## Frontend Features

The React frontend provides a beautiful, mobile-friendly interface with:

### 📷 Image Upload
- Drag & drop or click to upload meal photos
- Supports JPG, PNG, HEIC formats
- Visual meal type selector (Breakfast, Lunch, Dinner, Snack)

### 🔍 AI-Powered Analysis
- Real-time food detection with progress indicators
- Confidence scores for each detected item
- Alternative suggestions for uncertain detections

### ✅ Meal Confirmation
- Edit detected food items and portions
- Adjust quantities with +/- controls
- View nutrition breakdown per item
- See meal totals before confirming

### 📊 Daily Progress Dashboard
- Visual progress bars for Calories, Protein, Carbs, Fat
- Real-time updates after logging meals
- Color-coded progress indicators

### 💡 Smart Recommendations
- PID-based nutritional analysis
- Priority-ranked suggestions
- Food recommendations to hit daily targets
- Next meal ideas with nutrition estimates

## API Flow

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Upload Image  │────▶│  Analyze Meal   │────▶│ Review & Edit   │
│   Select Type   │     │  (Gemini AI)    │     │  Detected Items │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                                         │
                                                         ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│ View Next Meal  │◀────│  PID Analysis   │◀────│  Confirm Meal   │
│   Suggestions   │     │ Recommendations │     │   Log to DB     │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/api/v1/meals/analyze` | POST | Analyze food image |
| `/api/v1/meals/{meal_id}/confirm` | POST | Confirm/correct meal |
| `/api/v1/meals/{meal_id}/pid` | POST | Get PID recommendations |

## Configuration

### Backend Environment Variables

```bash
# Required
GEMINI_API_KEY=your-gemini-api-key

# Optional - Confidence Thresholds
FOOD_ID_AUTO_ACCEPT=0.80      # Auto-accept above this
FOOD_ID_CONFIRM_MIN=0.55      # Confirm between 0.55-0.79
PORTION_AUTO_ACCEPT=0.75      # Auto-accept above this

# Optional - Image Processing
IMAGE_MAX_DIMENSION=1024      # Max image dimension (pixels)
IMAGE_JPEG_QUALITY=85         # JPEG compression quality
```

### Frontend Configuration

The frontend uses Vite's proxy feature to forward `/api` requests to the backend. This is configured in `vite.config.js`:

```javascript
server: {
  port: 3000,
  proxy: {
    '/api': {
      target: 'http://localhost:8000',
      changeOrigin: true,
    },
  },
}
```

## Development

### Running in Development Mode

**Backend** (with hot reload):
```bash
cd backend
uvicorn main:app --reload --port 8000
```

**Frontend** (with hot module replacement):
```bash
cd frontend
npm run dev
```

### Building for Production

```bash
cd frontend
npm run build
npm run preview  # Preview production build locally
```

## Testing

```bash
# Run backend tests
pytest testing/ -v

# Run with coverage
pytest testing/ --cov=backend --cov-report=html
```

## Architecture Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Image Upload | Direct base64 | MVP simplicity, S3-ready abstraction |
| Frontend Framework | React + Vite | Fast development, modern DX |
| Styling | Tailwind CSS | Utility-first, rapid UI development |
| State Management | React useState | Simple state, no external deps |
| API Communication | Axios | Promise-based, interceptors support |
| Confidence Thresholds | Balanced (0.80/0.75) | Good UX/accuracy balance |
| Gemini Calls | Two-call flow | Vision → Confirm → PID for accuracy |

## Architecture Documentation

For detailed architecture decisions, UX design, and technical specifications, see:
- **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** - Complete MVP architecture document

## License

[Add your license here]

## Contributing

[Add contribution guidelines here]

