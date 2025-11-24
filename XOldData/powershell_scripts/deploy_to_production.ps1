# Deploy Contact Types Feature to Production
# Deploys both backend (Heroku) and frontend (Vercel)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Deploy to Production" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Ensure we're on main branch
$currentBranch = git branch --show-current
if ($currentBranch -ne "main") {
    Write-Host "Switching to main branch..." -ForegroundColor Yellow
    git checkout main
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERROR] Failed to switch to main branch" -ForegroundColor Red
        exit 1
    }
    Write-Host "[OK] Switched to main branch" -ForegroundColor Green
} else {
    Write-Host "[OK] Already on main branch" -ForegroundColor Green
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Step 1: Deploying Backend to Heroku..." -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Deploy to Heroku (push main branch to main on heroku remote)
git push heroku main:main

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "[ERROR] Failed to push to Heroku" -ForegroundColor Red
    Write-Host "Please check the error above" -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "[SUCCESS] Backend code deployed to Heroku!" -ForegroundColor Green
Write-Host ""

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Step 2: Running migrations on Heroku..." -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Run migrations on Heroku
& "C:\Program Files\heroku\bin\heroku.cmd" run rails db:migrate --app trapid-backend

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "[ERROR] Failed to run migrations" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "[SUCCESS] Migrations completed!" -ForegroundColor Green
Write-Host ""

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Step 3: Restarting Heroku app..." -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Restart Heroku app
& "C:\Program Files\heroku\bin\heroku.cmd" restart --app trapid-backend

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "[WARNING] Failed to restart app automatically" -ForegroundColor Yellow
} else {
    Write-Host ""
    Write-Host "[SUCCESS] Heroku app restarted!" -ForegroundColor Green
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Step 4: Incrementing Backend Version..." -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Increment backend version
& "C:\Program Files\heroku\bin\heroku.cmd" run rails runner "Version.increment!" --app trapid-backend

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "[SUCCESS] Backend version incremented!" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "[WARNING] Could not increment backend version" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Step 5: Deploying Frontend to Vercel..." -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Trigger Vercel deployment by pushing to GitHub (Vercel auto-deploys on push)
Write-Host "Vercel will auto-deploy from the main branch push" -ForegroundColor Yellow
Write-Host "Monitor deployment at: https://vercel.com/abodable-dev/trapid" -ForegroundColor Cyan
Write-Host ""

Write-Host "========================================" -ForegroundColor Green
Write-Host "DEPLOYMENT COMPLETE!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Backend: https://trapid-backend-447058022b51.herokuapp.com" -ForegroundColor White
Write-Host "Frontend: https://trapid.vercel.app" -ForegroundColor White
Write-Host ""
Write-Host "Migrations that ran:" -ForegroundColor Yellow
Write-Host "  1. change_contact_type_to_array" -ForegroundColor White
Write-Host "     - Converted contact_type (string) to contact_types (array)" -ForegroundColor Gray
Write-Host "  2. add_primary_contact_type_to_contacts" -ForegroundColor White
Write-Host "     - Added primary_contact_type field" -ForegroundColor Gray
Write-Host ""
Write-Host "New Features:" -ForegroundColor Yellow
Write-Host "  ✓ Filter contacts by Customer/Supplier/Sales/Land Agent" -ForegroundColor Green
Write-Host "  ✓ Assign multiple types to each contact" -ForegroundColor Green
Write-Host "  ✓ Set primary and secondary types with visual badges" -ForegroundColor Green
Write-Host "  ✓ Bulk update contact types" -ForegroundColor Green
Write-Host ""
Write-Host "The production site will be updated in ~2-3 minutes" -ForegroundColor Cyan
Write-Host ""
