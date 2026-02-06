#!/bin/bash
set -e

echo "=== Therapy Companion Setup ==="
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "Error: Node.js is not installed. Please install Node.js 18+."
    exit 1
fi

# Check Python
if ! command -v python3 &> /dev/null; then
    echo "Error: Python 3 is not installed. Please install Python 3.10+."
    exit 1
fi

# Check sox for audio recording
if ! command -v rec &> /dev/null; then
    echo "Warning: sox is not installed. Audio recording will not work."
    echo "Install with: brew install sox (macOS) or apt install sox (Linux)"
fi

echo "1/3 Installing Node.js dependencies..."
npm install

echo ""
echo "2/3 Creating Python virtual environment..."
python3 -m venv python/venv

echo ""
echo "3/3 Installing Python dependencies..."
source python/venv/bin/activate
pip install -r python/requirements.txt

echo ""
echo "=== Setup Complete ==="
echo ""
echo "Next steps:"
echo "  1. Download AI models (see MODELS.md)"
echo "  2. Copy .env.example to .env and configure paths"
echo "  3. Run: npm run dev"
