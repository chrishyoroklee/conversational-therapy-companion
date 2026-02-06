Write-Host "=== Therapy Companion Setup ==="
Write-Host ""

# Check Node.js
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Error "Error: Node.js is not installed."
    if (Get-Command winget -ErrorAction SilentlyContinue) {
        Write-Host "Tip: You can install it using winget:"
        Write-Host "  winget install -e --id OpenJS.NodeJS.LTS"
    }
    else {
        Write-Host "Please install Node.js 18+ from https://nodejs.org/"
    }
    exit 1
}

# Check Python
if (-not (Get-Command python -ErrorAction SilentlyContinue)) {
    Write-Error "Error: Python is not installed. Please install Python 3.10+."
    exit 1
}

# Check sox
if (-not (Get-Command sox -ErrorAction SilentlyContinue)) {
    Write-Warning "Warning: sox is not installed. Audio recording may not work."
    Write-Host "Download from http://sox.sourceforge.net/"
}

Write-Host "1/3 Installing Node.js dependencies..."
npm install

Write-Host ""
Write-Host "2/3 Creating Python virtual environment..."
python -m venv python/venv

Write-Host ""
Write-Host "3/3 Installing Python dependencies..."
# Use the pip inside the venv directly to avoid activation script complexity
if (Test-Path "python/venv/Scripts/python.exe") {
    & "python/venv/Scripts/python.exe" -m pip install -r python/requirements.txt
}
else {
    Write-Error "Error: Virtual environment python.exe not found. Setup may have failed."
    exit 1
}

Write-Host ""
Write-Host "=== Setup Complete ==="
Write-Host ""
Write-Host "Next steps:"
Write-Host "  1. Download AI models (see MODELS.md)"
Write-Host "  2. Copy .env.example to .env and configure paths"
Write-Host "  3. Run: npm run dev"
