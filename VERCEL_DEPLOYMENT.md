# Vercel Deployment Guide

This guide will help you deploy the LumberFlow frontend to Vercel.

## Prerequisites

1. A GitHub account with this repository
2. A Vercel account (sign up at https://vercel.com)
3. Your backend API deployed somewhere (Railway, Render, Heroku, etc.)

## Quick Deploy

### Option 1: Deploy via Vercel Dashboard

1. Go to [Vercel Dashboard](https://vercel.com/new)
2. Import your GitHub repository: `BenjiMaxwell/lumber-forecast`
3. Configure the project:
   - **Framework Preset**: Vite
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Install Command**: `npm install`

4. Add Environment Variables:
   - `VITE_API_URL`: Your backend API URL (e.g., `https://your-backend.railway.app/api`)
   - Add any other environment variables your app needs

5. Click **Deploy**

### Option 2: Deploy via Vercel CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login

# Deploy (from project root)
vercel

# For production deployment
vercel --prod
```

## Environment Variables

Set these in your Vercel project settings:

| Variable | Description | Example |
|----------|-------------|---------|
| `VITE_API_URL` | Backend API URL | `https://your-backend.railway.app/api` |

### Setting Environment Variables

1. Go to your project on Vercel Dashboard
2. Navigate to **Settings** → **Environment Variables**
3. Add each variable for **Production**, **Preview**, and **Development**
4. Redeploy after adding variables

## Backend Deployment

The backend should be deployed separately. Recommended platforms:

- **Railway**: https://railway.app (Great for Node.js apps with MongoDB)
- **Render**: https://render.com (Free tier available)
- **Heroku**: https://heroku.com (Requires credit card for free tier)

### Backend Environment Variables

Your backend needs these environment variables:

```
MONGODB_URI=mongodb://... or mongodb+srv://...
PORT=5000
JWT_SECRET=your-secret-key
FRONTEND_URL=https://your-vercel-app.vercel.app
```

## Project Structure

```
lumber-forecast/
├── frontend/          # Vercel deploys this
│   ├── src/
│   ├── dist/          # Build output (generated)
│   ├── package.json
│   └── vite.config.js
├── backend/           # Deploy separately
├── vercel.json        # Vercel configuration
└── package.json       # Root package.json for Vercel
```

## Custom Domain

1. Go to **Settings** → **Domains** in Vercel
2. Add your custom domain
3. Follow DNS configuration instructions
4. SSL certificate is automatically provisioned

## Continuous Deployment

Vercel automatically deploys:
- **Production**: Pushes to `main` branch
- **Preview**: Pull requests and other branches

## Troubleshooting

### Build Fails

- Check that all dependencies are in `package.json`
- Verify Node.js version (18+)
- Check build logs in Vercel dashboard

### API Calls Fail

- Verify `VITE_API_URL` is set correctly
- Check CORS settings on backend
- Ensure backend is deployed and accessible

### Routing Issues

- Vercel automatically handles SPA routing via `vercel.json`
- All routes should redirect to `index.html`

## Support

- Vercel Docs: https://vercel.com/docs
- Vercel Discord: https://vercel.com/discord

