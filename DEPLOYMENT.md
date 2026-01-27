# FitLoop Deployment Guide

This guide covers deploying FitLoop to **Railway** or **Render**.

## Prerequisites

1. A GitHub account with this repo pushed
2. A [Google AI Studio](https://makersuite.google.com/app/apikey) account for Gemini API key
3. Account on [Railway](https://railway.app) or [Render](https://render.com)

---

## Option 1: Deploy to Railway (Recommended)

Railway is simpler for monorepo deployments.

### Step 1: Create Railway Project

1. Go to [railway.app](https://railway.app) and sign in with GitHub
2. Click **"New Project"** → **"Deploy from GitHub repo"**
3. Select your FitLoop repository

### Step 2: Deploy Backend Service

1. In your Railway project, click **"New"** → **"GitHub Repo"**
2. Select the same repo
3. Configure the service:
   - **Root Directory**: `backend`
   - **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`

4. Add environment variables (Settings → Variables):
   ```
   GEMINI_API_KEY=your_gemini_api_key
   SECRET_KEY=your_secret_key_generate_with_openssl_rand_hex_32
   DATABASE_URL=${{Postgres.DATABASE_URL}}  # If using Railway Postgres
   CORS_ORIGINS=https://your-frontend-url.up.railway.app
   ```

5. (Optional) Add PostgreSQL:
   - Click **"New"** → **"Database"** → **"PostgreSQL"**
   - The `DATABASE_URL` will be auto-injected

### Step 3: Deploy Frontend Service

1. Click **"New"** → **"GitHub Repo"** (same repo again)
2. Configure the service:
   - **Root Directory**: `frontend`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npx serve dist -s -l $PORT`

3. Add environment variables:
   ```
   VITE_API_URL=https://your-backend-url.up.railway.app
   ```

4. Install serve: Add to build command:
   ```
   npm install && npm install -g serve && npm run build
   ```

### Step 4: Generate Domain

1. For each service, go to **Settings** → **Networking** → **Generate Domain**
2. Update the `CORS_ORIGINS` in backend with your frontend URL
3. Update `VITE_API_URL` in frontend with your backend URL

---

## Option 2: Deploy to Render

Render has a Blueprint feature for easy multi-service deployment.

### Step 1: One-Click Deploy (Blueprint)

1. Go to [render.com](https://render.com) and sign in with GitHub
2. Click **"New"** → **"Blueprint"**
3. Connect your GitHub repo
4. Render will detect `render.yaml` and create all services automatically

### Step 2: Configure Environment Variables

After Blueprint deployment:

1. Go to **Dashboard** → **fitloop-api** service
2. Click **"Environment"** tab
3. Add:
   ```
   GEMINI_API_KEY=your_gemini_api_key
   ```
   (SECRET_KEY and DATABASE_URL are auto-generated)

4. Go to **fitloop-web** service
5. Update `VITE_API_URL` to your backend URL:
   ```
   VITE_API_URL=https://fitloop-api.onrender.com
   ```

### Manual Deployment (Without Blueprint)

#### Backend:
1. **New** → **Web Service**
2. Connect repo, set:
   - **Root Directory**: `backend`
   - **Build Command**: `pip install -r ../requirements.txt`
   - **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`
   - **Environment**: Python 3

#### Frontend:
1. **New** → **Static Site**
2. Connect repo, set:
   - **Root Directory**: `frontend`
   - **Build Command**: `npm install && npm run build`
   - **Publish Directory**: `dist`

#### Database:
1. **New** → **PostgreSQL**
2. Copy Internal Database URL to backend's `DATABASE_URL`

---

## Environment Variables Reference

### Backend (`backend/`)

| Variable | Required | Description |
|----------|----------|-------------|
| `GEMINI_API_KEY` | ✅ Yes | Google AI Studio API key |
| `SECRET_KEY` | ✅ Yes | JWT signing key (use `openssl rand -hex 32`) |
| `DATABASE_URL` | No | PostgreSQL URL (defaults to SQLite) |
| `CORS_ORIGINS` | No | Comma-separated allowed origins (defaults to `*`) |
| `GEMINI_MODEL_VISION` | No | Vision model (default: `gemini-2.5-flash-lite`) |
| `GEMINI_MODEL_PID` | No | PID model (default: `gemini-2.5-flash-lite`) |

### Frontend (`frontend/`)

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_API_URL` | ✅ Yes (prod) | Full backend URL (e.g., `https://api.example.com`) |

---

## Post-Deployment Checklist

- [ ] Backend health check works: `https://your-api/health`
- [ ] Frontend loads without errors
- [ ] User registration/login works
- [ ] Meal image upload and analysis works
- [ ] CORS errors are resolved (check browser console)

---

## Troubleshooting

### CORS Errors
Set `CORS_ORIGINS` in backend to your exact frontend URL:
```
CORS_ORIGINS=https://fitloop-web.onrender.com
```

### Database Connection Issues
- Ensure `DATABASE_URL` uses `postgresql://` not `postgres://`
- Railway auto-fixes this, Render may need manual update

### Build Failures
- Check that `requirements.txt` is in the root folder
- Frontend needs `node_modules` rebuilt on deploy

### Gemini API Errors
- Verify API key is valid at [AI Studio](https://makersuite.google.com/app/apikey)
- Check API quotas haven't been exceeded

---

## Updating Your Deployment

Both Railway and Render support automatic deploys on git push:

```bash
git add .
git commit -m "Update deployment"
git push origin main
```

Services will automatically rebuild and redeploy.
