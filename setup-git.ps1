# Git Setup Script for Lumber Forecast Project
# Run this script after installing Git

Write-Host "Setting up Git repository..." -ForegroundColor Green

# Check if git is available
try {
    $gitVersion = git --version
    Write-Host "Git found: $gitVersion" -ForegroundColor Green
} catch {
    Write-Host "ERROR: Git is not installed or not in PATH" -ForegroundColor Red
    Write-Host "Please install Git from: https://git-scm.com/download/win" -ForegroundColor Yellow
    Write-Host "Or run: winget install Git.Git" -ForegroundColor Yellow
    exit 1
}

# Check if already a git repository
if (Test-Path .git) {
    Write-Host "Git repository already initialized" -ForegroundColor Yellow
} else {
    Write-Host "Initializing Git repository..." -ForegroundColor Cyan
    git init
}

# Check status
Write-Host "`nCurrent Git status:" -ForegroundColor Cyan
git status

Write-Host "`nNext steps:" -ForegroundColor Green
Write-Host "1. Review the files above" -ForegroundColor White
Write-Host "2. Run: git add ." -ForegroundColor White
Write-Host "3. Run: git commit -m 'Initial commit: Migrate React app to Vite'" -ForegroundColor White
Write-Host "4. Create a repository on GitHub and push using the commands shown" -ForegroundColor White
Write-Host "`nSee COMMIT_INSTRUCTIONS.md for detailed instructions" -ForegroundColor Cyan


