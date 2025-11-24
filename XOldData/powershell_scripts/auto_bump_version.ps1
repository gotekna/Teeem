# Auto Bump Version (used by git pre-commit hook)
# Increments the patch version automatically

try {
    # Get current version from package.json
    $packageJsonPath = "frontend/package.json"
    $packageJson = Get-Content $packageJsonPath -Raw | ConvertFrom-Json
    $currentVersion = $packageJson.version

    # Parse version
    $versionParts = $currentVersion -split '\.'
    $major = [int]$versionParts[0]
    $minor = [int]$versionParts[1]
    $patch = [int]$versionParts[2]

    # Increment patch version
    $patch++
    $newVersion = "$major.$minor.$patch"

    # Update package.json
    $packageJsonContent = Get-Content $packageJsonPath -Raw
    $packageJsonContent = $packageJsonContent -replace "`"version`": `"$currentVersion`"", "`"version`": `"$newVersion`""
    $packageJsonContent | Set-Content $packageJsonPath -NoNewline

    Write-Host "Version: $currentVersion -> $newVersion" -ForegroundColor Green

    exit 0
} catch {
    Write-Host "Error incrementing version: $_" -ForegroundColor Red
    exit 1
}
