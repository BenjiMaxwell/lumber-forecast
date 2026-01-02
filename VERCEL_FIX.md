# Vercel Build Fix

If you're getting the error "Command 'cd frontend && npm install' exited with 1", you have two options:

## Option 1: Set Root Directory in Vercel Dashboard (Recommended)

1. Go to your Vercel project dashboard
2. Navigate to **Settings** → **General**
3. Under **Root Directory**, click **Edit**
4. Set it to: `frontend`
5. Save and redeploy

This tells Vercel to treat the `frontend` directory as the project root, so it will automatically:
- Run `npm install` in the frontend directory
- Run `npm run build` in the frontend directory
- Look for `dist` as the output directory

You can then remove or simplify `vercel.json` to just:

```json
{
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

## Option 2: Keep Current Setup

The current `vercel.json` should work, but make sure:
- Node.js version is 18+ (set in Vercel project settings)
- The build command uses `npm ci` instead of `npm install` (already updated)

## Quick Fix

The easiest solution is **Option 1** - just set the Root Directory to `frontend` in Vercel dashboard and redeploy.

