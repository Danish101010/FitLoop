# FitLoop Deployment Guide

This guide covers deploying FitLoop to **Railway** or **Render** using **Supabase** as the database.

## Prerequisites

1. A GitHub account with this repo pushed
2. A [Google AI Studio](https://makersuite.google.com/app/apikey) account for Gemini API key
3. A [Supabase](https://supabase.com) account with a project created
4. Account on [Railway](https://railway.app) or [Render](https://render.com)

---

## Step 1: Set Up Supabase Database

Before deploying, configure your Supabase database:

### 1.1 Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign in
2. Click **"New Project"**
3. Choose your organization
4. Enter project details:
   - **Name**: `fitloop` (or your preferred name)
   - **Database Password**: Generate a strong password (save this!)
   - **Region**: Choose closest to your users
5. Click **"Create new project"** and wait for setup (~2 minutes)

### 1.2 Get Connection String

1. In your Supabase project, go to **Project Settings** (gear icon)
2. Click **Database** in the sidebar
3. Scroll to **Connection string** section
4. Select **URI** tab
5. Copy the connection string:
   ```
   postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres
   ```
6. Replace `[password]` with your database password

> **Important**: Use the **Transaction pooler** (port 6543) for serverless deployments like Railway/Render.

### 1.3 Connection String Format

Your `DATABASE_URL` should look like:
```
postgresql://postgres.abcdefghijk:YourPassword123@aws-0-us-east-1.pooler.supabase.com:6543/postgres
```

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
   DATABASE_URL=postgresql://postgres.xxxxx:password@aws-0-region.pooler.supabase.com:6543/postgres
   CORS_ORIGINS=https://your-frontend-url.up.railway.app
   ```

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

### Step 1: Deploy Backend

1. Go to [render.com](https://render.com) and sign in with GitHub
2. Click **"New"** → **"Web Service"**
3. Connect your GitHub repo
4. Configure:
   - **Name**: `fitloop-api`
   - **Root Directory**: `backend`
   - **Runtime**: `Python 3`
   - **Build Command**: `pip install -r ../requirements.txt`
   - **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`

5. Add environment variables:
   ```
   GEMINI_API_KEY=your_gemini_api_key
   SECRET_KEY=your_secret_key_here
   DATABASE_URL=postgresql://postgres.xxxxx:password@aws-0-region.pooler.supabase.com:6543/postgres
   CORS_ORIGINS=https://fitloop-web.onrender.com
   ```

6. Click **"Create Web Service"**

### Step 2: Deploy Frontend

1. Click **"New"** → **"Static Site"**
2. Connect your GitHub repo
3. Configure:
   - **Name**: `fitloop-web`
   - **Root Directory**: `frontend`
   - **Build Command**: `npm install && npm run build`
   - **Publish Directory**: `dist`

4. Add environment variable:
   ```
   VITE_API_URL=https://fitloop-api.onrender.com
   ```

5. Click **"Create Static Site"**

### Step 3: Configure Redirects (SPA Routing)

The `frontend/public/_redirects` file is already configured for SPA routing:
```
/* /index.html 200
```

---

## Environment Variables Reference

### Backend (`backend/`)

| Variable | Required | Description |
|----------|----------|-------------|
| `GEMINI_API_KEY` | ✅ Yes | Google AI Studio API key |
| `SECRET_KEY` | ✅ Yes | JWT signing key (use `openssl rand -hex 32`) |
| `DATABASE_URL` | ✅ Yes | Supabase PostgreSQL connection string |
| `CORS_ORIGINS` | ✅ Yes (prod) | Your frontend URL (e.g., `https://fitloop-web.onrender.com`) |
| `GEMINI_MODEL_VISION` | No | Vision model (default: `gemini-2.5-flash-lite`) |
| `GEMINI_MODEL_PID` | No | PID model (default: `gemini-2.5-flash-lite`) |

### Frontend (`frontend/`)

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_API_URL` | ✅ Yes (prod) | Full backend URL (e.g., `https://fitloop-api.onrender.com`) |

---

## Supabase Configuration Tips

### Use Connection Pooler

For serverless deployments, always use the **Transaction Pooler** connection:
- Port: `6543` (not `5432`)
- URL format: `postgresql://postgres.[ref]:[pass]@aws-0-[region].pooler.supabase.com:6543/postgres`

### Enable Row Level Security (Optional)

If you want additional security, enable RLS in Supabase:
1. Go to **Database** → **Tables**
2. Click on each table → **RLS** → **Enable**
3. Add policies as needed

> Note: FitLoop uses backend authentication (JWT), so RLS is optional.

### Monitor Database Usage

1. Go to **Project Settings** → **Usage**
2. Check database connections and storage
3. Free tier: 500MB storage, 2GB bandwidth

---

## Post-Deployment Checklist

- [ ] Backend health check works: `https://your-api/health`
- [ ] Frontend loads without errors
- [ ] User registration works (creates user in Supabase)
- [ ] User login works
- [ ] Meal image upload and analysis works
- [ ] Data persists in Supabase (check Table Editor)
- [ ] No CORS errors in browser console

---

## Troubleshooting

### "Connection Refused" or Database Errors

1. **Check connection string format**:
   - Must start with `postgresql://` (not `postgres://`)
   - Use port `6543` for pooler connection

2. **Check Supabase project is active**:
   - Free projects pause after 1 week of inactivity
   - Go to Supabase dashboard and resume if paused

3. **Verify password**:
   - No special characters that need URL encoding
   - Or URL-encode special characters (e.g., `@` → `%40`)

### CORS Errors

Set `CORS_ORIGINS` in backend to your **exact** frontend URL:
```
CORS_ORIGINS=https://fitloop-web.onrender.com
```

Multiple origins (comma-separated):
```
CORS_ORIGINS=https://fitloop-web.onrender.com,https://fitloop.yourdomain.com
```

### Supabase Project Paused

Free tier projects pause after 7 days of inactivity:
1. Go to [supabase.com/dashboard](https://supabase.com/dashboard)
2. Select your project
3. Click **"Restore project"**

### Tables Not Created

Tables are auto-created on first backend startup. If missing:
1. Check backend logs for errors
2. Verify `DATABASE_URL` is correct
3. Restart the backend service

### Gemini API Errors

- Verify API key at [AI Studio](https://makersuite.google.com/app/apikey)
- Check you haven't exceeded quota
- Ensure API is enabled for your project

---

## Updating Your Deployment

Both Railway and Render support automatic deploys on git push:

```bash
git add .
git commit -m "Update deployment"
git push origin main
```

Services will automatically rebuild and redeploy.

---

## Cost Summary

| Service | Free Tier |
|---------|-----------|
| **Supabase** | 500MB DB, 2GB bandwidth, 50K auth users |
| **Railway** | $5 free credit/month |
| **Render** | 750 hours/month (static sites free) |
| **Gemini API** | Free tier with rate limits |

For a small-scale deployment, you can run FitLoop completely free!
