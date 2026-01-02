# Troubleshooting Login Issues on Vercel

## Problem: Login button does nothing / No error messages

### Most Common Cause: Missing API URL Configuration

The frontend needs to know where your backend is deployed. If `VITE_API_URL` is not set in Vercel, API calls will fail silently.

## Solution Steps

### 1. Check Browser Console

Open your browser's Developer Tools (F12) and check the Console tab when you try to log in. You should see:
- API URL being used
- Network errors
- Detailed error messages

### 2. Set VITE_API_URL in Vercel

1. Go to your Vercel project dashboard
2. Navigate to **Settings** → **Environment Variables**
3. Add a new variable:
   - **Name**: `VITE_API_URL`
   - **Value**: Your backend URL (e.g., `https://your-backend.railway.app/api`)
   - **Environment**: Select all (Production, Preview, Development)
4. Click **Save**
5. **Redeploy** your application (go to Deployments → ... → Redeploy)

### 3. Verify Backend is Running

Make sure your backend is:
- ✅ Deployed and accessible
- ✅ Has CORS configured to allow your Vercel domain
- ✅ Has the correct environment variables set

### 4. Check Backend CORS Settings

In `backend/server.js`, ensure CORS includes your Vercel URL:

```javascript
app.use(cors({
  origin: process.env.FRONTEND_URL || 'https://your-app.vercel.app',
  credentials: true
}));
```

### 5. Test API Endpoint Directly

Try accessing your backend directly:
```
https://your-backend.railway.app/api/health
```

Should return: `{"status":"ok","timestamp":"..."}`

## Common Error Messages

### "Cannot connect to backend server"
- **Cause**: `VITE_API_URL` not set or incorrect
- **Fix**: Set `VITE_API_URL` in Vercel environment variables

### "CORS error"
- **Cause**: Backend not allowing requests from Vercel domain
- **Fix**: Update backend CORS settings to include Vercel URL

### "Network Error"
- **Cause**: Backend is down or unreachable
- **Fix**: Verify backend is deployed and running

### "Invalid credentials"
- **Cause**: Wrong email/password or user doesn't exist
- **Fix**: Use correct credentials or seed the database

## Debugging Checklist

- [ ] `VITE_API_URL` is set in Vercel environment variables
- [ ] Application has been redeployed after setting environment variables
- [ ] Backend is deployed and accessible
- [ ] Backend CORS allows your Vercel domain
- [ ] Browser console shows API URL being used
- [ ] Network tab shows the login request being made
- [ ] Backend `/api/auth/login` endpoint is working

## Quick Test

Open browser console and run:
```javascript
console.log('API URL:', import.meta.env.VITE_API_URL);
```

If it shows `undefined`, the environment variable is not set correctly.

