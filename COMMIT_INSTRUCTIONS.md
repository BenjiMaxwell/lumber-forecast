# Instructions to Commit to GitHub

## Prerequisites

1. **Install Git** (if not already installed):
   - Download from: https://git-scm.com/download/win
   - Or use winget: `winget install Git.Git`
   - Restart your terminal after installation

## Step 1: Initialize Git Repository

```powershell
# Navigate to project directory
cd C:\Users\benny\Desktop\lumberflow-inventory-system\lumber-forecast

# Initialize git repository
git init

# Check status
git status
```

## Step 2: Add and Commit Files

```powershell
# Add all files (respects .gitignore)
git add .

# Create initial commit
git commit -m "Initial commit: Migrate React app to Vite

- Migrated from Create React App to Vite
- Updated package.json with Vite dependencies and scripts
- Created vite.config.js with proper JSX handling for .js files
- Moved index.html to frontend root for Vite compatibility
- Updated API service to use Vite environment variables (import.meta.env)
- Improved error handling in login and API service
- Made TensorFlow optional in forecast service for easier setup
- Added comprehensive .gitignore file
- Improved connection error messages for better debugging"
```

## Step 3: Create GitHub Repository

1. Go to https://github.com/new
2. Repository name: `lumber-forecast` (or your preferred name)
3. Description: "AI-Powered Lumber Inventory Forecasting System"
4. Choose Public or Private
5. **DO NOT** initialize with README, .gitignore, or license (we already have these)
6. Click "Create repository"

## Step 4: Connect and Push to GitHub

After creating the repository, GitHub will show you commands. Use these:

```powershell
# Add remote repository (replace YOUR_USERNAME with your GitHub username)
git remote add origin https://github.com/YOUR_USERNAME/lumber-forecast.git

# Or if you prefer SSH (requires SSH key setup):
# git remote add origin git@github.com:YOUR_USERNAME/lumber-forecast.git

# Rename branch to main (if needed)
git branch -M main

# Push to GitHub
git push -u origin main
```

## Alternative: Using GitHub Desktop

If you prefer a graphical interface:

1. Download GitHub Desktop: https://desktop.github.com/
2. Install and sign in with your GitHub account
3. Click "File" → "Add Local Repository"
4. Select: `C:\Users\benny\Desktop\lumberflow-inventory-system\lumber-forecast`
5. Click "Publish repository" button
6. Choose name and visibility
7. Click "Publish Repository"

## Troubleshooting

### If you get authentication errors:
- Use a Personal Access Token instead of password
- Generate one at: https://github.com/settings/tokens
- Use the token as your password when pushing

### If Git is still not recognized:
- Restart your terminal/PowerShell
- Check if Git is in PATH: `$env:PATH -split ';' | Select-String git`
- Manually add Git to PATH if needed


