# Vercel Setup Instructions

## IMPORTANT: Set Root Directory in Vercel Dashboard

The build is failing because Vercel needs to know the frontend directory is the root.

### Steps to Fix:

1. **Go to Vercel Dashboard**
   - Navigate to your project: https://vercel.com/dashboard
   - Click on your `lumber-forecast` project

2. **Go to Settings**
   - Click **Settings** in the top menu
   - Click **General** in the left sidebar

3. **Set Root Directory**
   - Scroll down to **Root Directory**
   - Click **Edit**
   - Enter: `frontend`
   - Click **Save**

4. **Redeploy**
   - Go to **Deployments** tab
   - Click the **...** menu on the latest deployment
   - Click **Redeploy**

## What This Does

Setting Root Directory to `frontend` tells Vercel to:
- Treat `frontend/` as the project root
- Automatically run `npm install` in the frontend directory
- Automatically run `npm run build` in the frontend directory
- Look for `dist/` as the output directory
- Auto-detect Vite framework

## Alternative: If Root Directory Setting Doesn't Work

If you can't set root directory, you can manually configure in Vercel dashboard:

1. Go to **Settings** → **General**
2. Under **Build & Development Settings**:
   - **Framework Preset**: Vite
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Install Command**: `npm install`

Then save and redeploy.

