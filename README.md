# FitLoop 🍎📸

> AI-powered food logging and nutrition tracking with Google Gemini Vision

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/template)
[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy)

## What is FitLoop?

FitLoop is a modern nutrition tracking app that uses AI to analyze your meals from photos. Simply snap a picture of your food, and Gemini AI will:

- 🔍 **Detect foods** in your image with confidence scores
- ⚖️ **Estimate portions** in grams with editable controls
- 📊 **Calculate macros** (calories, protein, carbs, fat, fiber)
- 💡 **Provide recommendations** using PID-based nutritional analysis
- 📈 **Track progress** with daily, weekly, and monthly analytics

## Features

### Core Features
- 📷 **Image-based meal logging** - Take a photo, get instant nutrition data
- ✏️ **Portion editing** - Adjust portions with unit conversion (g, cups, tbsp, pieces)
- 🎯 **Personalized targets** - Set custom calorie and macro goals
- 📱 **Responsive design** - Works on mobile and desktop

### Tracking & Analytics
- 💧 **Water tracking** - Log daily water intake with custom goals
- 🏋️ **Workout logging** - Track exercises and calories burned
- 📅 **Daily summaries** - View nutrition totals at a glance
- 📊 **Progress dashboard** - Weekly and monthly trends

### User Management
- 🔐 **Secure authentication** - JWT-based signup/login
- 👤 **User profiles** - Age, weight, height, activity level
- 🎯 **Fitness goals** - Lose weight, maintain, or build muscle

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React 18, Vite, Tailwind CSS, Lucide Icons |
| **Backend** | Python 3.11, FastAPI, Pydantic, SQLAlchemy |
| **Database** | PostgreSQL (Supabase) / SQLite (local) |
| **Auth** | JWT tokens, bcrypt password hashing |
| **AI** | Google Gemini 2.5 Flash Vision API |

## Quick Start

### Prerequisites

- Python 3.11+
- Node.js 18+
- [Gemini API Key](https://makersuite.google.com/app/apikey)

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/fitloop.git
cd FitLoop
```

### 2. Set Up Backend

```bash
# Create virtual environment
python3.11 -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Create .env file
cp backend/.env.example backend/.env
# Edit backend/.env and add your GEMINI_API_KEY
```

### 3. Set Up Frontend

```bash
cd frontend
npm install
```

### 4. Run the App

**Terminal 1 - Backend:**
```bash
cd backend
uvicorn main:app --reload --port 8000
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

Open **http://localhost:3000** in your browser 🎉

## Environment Variables

### Backend (`backend/.env`)

```bash
# Required
GEMINI_API_KEY=your_gemini_api_key_here
SECRET_KEY=your_jwt_secret_key  # Generate: openssl rand -hex 32

# Optional - Database (defaults to SQLite)
DATABASE_URL=postgresql://user:pass@host:5432/dbname

# Optional - CORS (defaults to allow all)
CORS_ORIGINS=https://your-frontend.com
```

### Frontend (`frontend/.env`)

```bash
# Required for production (leave empty for local dev)
VITE_API_URL=https://your-backend-api.com
```

## Project Structure

```
FitLoop/
├── backend/                 # FastAPI backend
│   ├── main.py             # API endpoints
│   ├── models.py           # Pydantic schemas
│   ├── database.py         # SQLAlchemy models
│   ├── auth.py             # JWT authentication
│   ├── gemini_client.py    # Gemini API wrapper
│   ├── orchestrator.py     # Meal analysis pipeline
│   ├── analytics.py        # Progress analytics
│   └── config.py           # Configuration
│
├── frontend/               # React frontend
│   └── src/
│       ├── components/     # React components
│       ├── context/        # Auth context
│       └── services/       # API client
│
├── prompts/                # Gemini prompt templates
├── schemas/                # JSON response schemas
├── docs/                   # Documentation
└── testing/                # Test plans & data
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/auth/signup` | Create account |
| `POST` | `/api/v1/auth/login` | Login |
| `GET` | `/api/v1/auth/me` | Get current user |
| `POST` | `/api/v1/meals/analyze` | Analyze meal image |
| `POST` | `/api/v1/meals/{id}/confirm` | Confirm meal |
| `POST` | `/api/v1/meals/{id}/pid` | Get recommendations |
| `GET` | `/api/v1/progress/today` | Today's nutrition |
| `GET` | `/api/v1/progress/weekly` | Weekly summary |
| `POST` | `/api/v1/water/log` | Log water intake |
| `POST` | `/api/v1/workouts/log` | Log workout |

Full API docs available at `/docs` when running the backend.

## Deployment

### Railway (Recommended)

1. Push to GitHub
2. Connect to [Railway](https://railway.app)
3. Deploy backend and frontend as separate services
4. Add PostgreSQL database
5. Set environment variables

### Render

1. Push to GitHub
2. Connect to [Render](https://render.com)
3. Use Blueprint (auto-detects `render.yaml`)
4. Set `GEMINI_API_KEY` in dashboard

See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed instructions.

## How It Works

### Meal Analysis Flow

```
1. User uploads photo
       ↓
2. Image compressed & sent to Gemini Vision
       ↓
3. AI detects foods with confidence scores
       ↓
4. User confirms/edits portions
       ↓
5. Nutrition calculated & saved
       ↓
6. PID analysis generates recommendations
```

### PID Recommendations

FitLoop uses a **Proportional-Integral-Derivative** approach:

- **P (Proportional)**: Current meal vs. remaining daily budget
- **I (Integral)**: Weekly trends and patterns
- **D (Derivative)**: Rate of change in eating habits

This provides balanced, context-aware nutrition advice.

## Configuration

### Confidence Thresholds

```python
# Auto-accept if confidence > 80%
FOOD_ID_AUTO_ACCEPT = 0.80

# Require confirmation if 55-80%
FOOD_ID_CONFIRM_MIN = 0.55

# Reject if < 55%
FOOD_ID_REJECT_BELOW = 0.55
```

### Portion Units

| Unit | Grams Equivalent |
|------|-----------------|
| g | 1 |
| pieces | 100 (default) |
| cups | 240 |
| tbsp | 15 |

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing`)
5. Open a Pull Request

## License

MIT License - see [LICENSE](LICENSE) for details.

## Acknowledgments

- [Google Gemini](https://deepmind.google/technologies/gemini/) for AI capabilities
- [FastAPI](https://fastapi.tiangolo.com/) for the backend framework
- [Tailwind CSS](https://tailwindcss.com/) for styling
- [Lucide](https://lucide.dev/) for icons

---

**Built with ❤️ for healthier eating habits**

