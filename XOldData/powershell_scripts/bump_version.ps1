# Bump Version Script
# Increments the frontend version and optionally the backend version

param(
    [Parameter(Mandatory=$false)]
    [ValidateSet('patch', 'minor', 'major')]
    [string]$Level = 'patch',

    [Parameter(Mandatory=$false)]
    [switch]$Backend
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Bump Version" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Get current frontend version from package.json
$packageJson = Get-Content "frontend/package.json" -Raw | ConvertFrom-Json
$currentVersion = $packageJson.version

# Parse version
$versionParts = $currentVersion -split '\.'
$major = [int]$versionParts[0]
$minor = [int]$versionParts[1]
$patch = [int]$versionParts[2]

# Increment based on level
switch ($Level) {
    'major' {
        $major++
        $minor = 0
        $patch = 0
    }
    'minor' {
        $minor++
        $patch = 0
    }
    'patch' {
        $patch++
    }
}

$newVersion = "$major.$minor.$patch"

Write-Host "Frontend Version:" -ForegroundColor Yellow
Write-Host "  Current: $currentVersion" -ForegroundColor White
Write-Host "  New:     $newVersion" -ForegroundColor Green
Write-Host ""

# Update package.json
$packageJsonContent = Get-Content "frontend/package.json" -Raw
$packageJsonContent = $packageJsonContent -replace "`"version`": `"$currentVersion`"", "`"version`": `"$newVersion`""
$packageJsonContent | Set-Content "frontend/package.json" -NoNewline

Write-Host "[SUCCESS] Updated frontend/package.json" -ForegroundColor Green
Write-Host ""

# Optionally increment backend version
if ($Backend) {
    Write-Host "Backend Version:" -ForegroundColor Yellow
    Write-Host "  Incrementing on Heroku..." -ForegroundColor White

    & "C:\Program Files\heroku\bin\heroku.cmd" run rails runner "puts 'Current: ' + Version.current_version_string; Version.increment!; puts 'New: ' + Version.current_version_string" --app trapid-backend

    if ($LASTEXITCODE -eq 0) {
        Write-Host "[SUCCESS] Backend version incremented on Heroku" -ForegroundColor Green
    } else {
        Write-Host "[WARNING] Could not increment backend version" -ForegroundColor Yellow
    }
    Write-Host ""
}

# Stage the change
git add frontend/package.json

Write-Host "========================================" -ForegroundColor Green
Write-Host "Version bumped successfully!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. Review changes: git diff --staged" -ForegroundColor White
Write-Host "  2. Commit: git commit -m 'Bump version to $newVersion'" -ForegroundColor White
Write-Host "  3. Push: git push origin main" -ForegroundColor White
Write-Host ""
