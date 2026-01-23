# FitLoop 🍎📸

> AI-powered food logging and nutrition analysis using Google Gemini

## Overview

FitLoop is a modern web app that uses computer vision and LLM-powered analysis to help users track their nutrition. Users photograph their meals, and Gemini AI handles:

- **Food Detection**: Identifies foods in images with confidence scores
- **Portion Estimation**: Estimates serving sizes in grams
- **Macro Calculation**: Computes calories, protein, carbs, fat, fiber
- **PID Recommendations**: Provides personalized nutritional guidance using Proportional-Integral-Derivative analysis
- **User Authentication**: Secure signup/login with JWT tokens
- **Progress Tracking**: Daily, weekly, and monthly nutrition analytics

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Backend** | Python 3.11, FastAPI, Pydantic, SQLAlchemy |
| **Database** | Supabase (PostgreSQL), SQLite fallback |
| **Auth** | JWT tokens, bcrypt password hashing |
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
│   ├── database.py             # SQLAlchemy models & DB setup
│   ├── auth.py                 # JWT authentication
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
│       ├── context/            # React context providers
│       │   └── AuthContext.jsx # Authentication state
│       ├── components/         # React components
│       │   ├── Header.jsx
│       │   ├── DailyProgress.jsx
│       │   ├── ImageUpload.jsx
│       │   ├── MealAnalysis.jsx
│       │   ├── MealConfirmation.jsx
│       │   ├── PidRecommendations.jsx
│       │   ├── AuthPage.jsx    # Login/Signup page
│       │   └── ProgressDashboard.jsx
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
```

### 2. Environment Variables

Create a `.env` file in the `backend/` directory:

```bash
# backend/.env

# Required - Gemini API
GEMINI_API_KEY=your-gemini-api-key-here

# Required for production - Supabase Database
# Get this from: Supabase Dashboard > Project Settings > Database > Connection string (URI)
SUPABASE_DB_URL=postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres

# Optional - Use DATABASE_URL as alternative
# DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres

# Optional - JWT Secret (auto-generated if not set)
JWT_SECRET_KEY=your-super-secret-jwt-key-change-in-production
```

**Note:** If `SUPABASE_DB_URL` is not set, the app falls back to SQLite (`fitloop.db`) for local development.

### 3. Set Up Supabase (Recommended)

1. **Create a Supabase account** at [supabase.com](https://supabase.com)

2. **Create a new project** and note your:
   - Project Reference ID (in the URL)
   - Database Password (set during creation)

3. **Get your connection string:**
   - Go to **Project Settings** → **Database**
   - Copy the **URI** connection string
   - Replace `[YOUR-PASSWORD]` with your database password

4. **Add to your `.env` file:**
   ```bash
   SUPABASE_DB_URL=postgresql://postgres:YOUR_PASSWORD@db.YOUR_PROJECT_REF.supabase.co:5432/postgres
   ```

5. **Tables are created automatically** when you start the backend.

### 4. Start the Backend

```bash
cd backend
uvicorn main:app --reload --port 8000
```

The API will be available at `http://localhost:8000`

**Note**: On first run, database tables will be created automatically (in Supabase or local SQLite).

### 5. Start the Frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend will be available at `http://localhost:5173`

### 6. Open the App

Visit **http://localhost:5173** in your browser to start logging meals!

## Local Development

### Running Both Services (Recommended Setup)

Open two terminal windows:

**Terminal 1 - Backend:**
```bash
cd FitLoop/backend
source ../venv/bin/activate  # or use your pyenv
export GEMINI_API_KEY="your-key"
uvicorn main:app --reload --port 8000
```

**Terminal 2 - Frontend:**
```bash
cd FitLoop/frontend
npm run dev
```

### Database Management

FitLoop uses **Supabase (PostgreSQL)** in production or **SQLite** for local development.

#### Using Supabase (Recommended)

**View tables in Supabase Dashboard:**
1. Go to your Supabase project
2. Click **Table Editor** in the sidebar
3. You'll see: `users`, `meal_logs`, `daily_summaries`

**Run SQL queries:**
1. Go to **SQL Editor** in Supabase Dashboard
2. Run queries like:
   ```sql
   SELECT * FROM users;
   SELECT * FROM meal_logs ORDER BY created_at DESC LIMIT 10;
   ```

**Reset Database:**
```sql
-- Run in Supabase SQL Editor
TRUNCATE TABLE daily_summaries, meal_logs, users RESTART IDENTITY CASCADE;
```

#### Using SQLite (Local Fallback)

If `SUPABASE_DB_URL` is not set, SQLite is used automatically.

**View Database:**
```bash
sqlite3 backend/fitloop.db
.tables                    # List all tables
SELECT * FROM users;       # View users
.quit
```

**Reset Database:**
```bash
rm backend/fitloop.db      # Delete and restart backend
```

### API Testing

Use the built-in Swagger UI at `http://localhost:8000/docs` to test endpoints.

**Test Auth Flow:**
1. POST `/api/v1/auth/signup` - Create account
2. POST `/api/v1/auth/login` - Get JWT token
3. Use the "Authorize" button in Swagger to add your token
4. Access protected endpoints

### Hot Reload

Both backend and frontend support hot reload:
- **Backend**: Changes to Python files auto-reload uvicorn
- **Frontend**: Vite HMR updates the browser instantly

## API Documentation

Once the backend is running:
- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

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

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/health` | GET | No | Health check |
| `/api/v1/auth/signup` | POST | No | Create new account |
| `/api/v1/auth/login` | POST | No | Login & get JWT token |
| `/api/v1/auth/me` | GET | Yes | Get current user profile |
| `/api/v1/auth/me` | PUT | Yes | Update user profile |
| `/api/v1/meals/analyze` | POST | Optional | Analyze food image |
| `/api/v1/meals/{meal_id}/confirm` | POST | Optional | Confirm/correct meal |
| `/api/v1/meals/{meal_id}/pid` | POST | Optional | Get PID recommendations |
| `/api/v1/progress/today` | GET | Yes | Today's nutrition progress |
| `/api/v1/progress/weekly` | GET | Yes | Last 7 days progress |
| `/api/v1/progress/monthly` | GET | Yes | Last 30 days progress |
| `/api/v1/meals/history` | GET | Yes | User's meal history |

## Configuration

### Backend Environment Variables

```bash
# Required
GEMINI_API_KEY=your-gemini-api-key

# Required for production - Supabase
SUPABASE_DB_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres

# Alternative database URL (if SUPABASE_DB_URL not set)
# DATABASE_URL=sqlite:///./fitloop.db  # SQLite fallback (auto-used if no Supabase URL)

# Optional - Authentication
JWT_SECRET_KEY=your-secret-key    # For JWT token signing

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
  port: 5173,
  proxy: {
    '/api': {
      target: 'http://localhost:8000',
      changeOrigin: true,
    },
  },
}
```

## Features

### 🔐 User Authentication
- Secure signup with email/password
- JWT-based login sessions (7-day expiry)
- Customizable nutrition targets per user
- Guest mode for trying without an account

### 📊 Progress Tracking
- **Daily**: Real-time progress bars for all macros
- **Weekly**: 7-day charts with daily breakdowns
- **Monthly**: 30-day trends with weekly summaries
- Meal history with full nutrition details

### 📷 AI-Powered Meal Logging
- Drag & drop or click to upload meal photos
- Supports JPG, PNG, HEIC formats
- Real-time food detection with confidence scores
- Edit detected items and portions before confirming

### 💡 Smart Recommendations
- PID-based nutritional analysis
- Priority-ranked suggestions
- Food recommendations to hit daily targets
- Next meal ideas with nutrition estimates

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
| Database | Supabase (PostgreSQL) | Free tier, managed, real-time capable |
| Authentication | JWT + bcrypt | Stateless, secure password hashing |
| Image Upload | Direct base64 | MVP simplicity, S3-ready abstraction |
| Frontend Framework | React + Vite | Fast development, modern DX |
| Styling | Tailwind CSS | Utility-first, rapid UI development |
| State Management | React Context | Auth state + useState for components |
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

