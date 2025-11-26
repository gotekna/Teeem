#!/bin/bash

# ML Service Setup Script
# Run this to set up the ML service for the first time

set -e  # Exit on error

echo "========================================"
echo "TEEEM ML Service Setup"
echo "========================================"
echo ""

# Check Python version
echo "Checking Python version..."
python_version=$(python3 --version 2>&1 | awk '{print $2}')
echo "Python version: $python_version"

required_version="3.9"
if ! python3 -c "import sys; sys.exit(0 if sys.version_info >= (3, 9) else 1)"; then
    echo "ERROR: Python 3.9+ required"
    exit 1
fi

echo "✓ Python version OK"
echo ""

# Create virtual environment
echo "Creating virtual environment..."
if [ ! -d "venv" ]; then
    python3 -m venv venv
    echo "✓ Virtual environment created"
else
    echo "✓ Virtual environment already exists"
fi
echo ""

# Activate virtual environment
echo "Activating virtual environment..."
source venv/bin/activate
echo "✓ Virtual environment activated"
echo ""

# Install dependencies
echo "Installing Python dependencies..."
pip install --upgrade pip
pip install -r requirements.txt
echo "✓ Dependencies installed"
echo ""

# Check for .env file
echo "Checking environment configuration..."
if [ ! -f ".env" ]; then
    echo "WARNING: .env file not found"
    echo "Creating .env from .env.example..."
    cp .env.example .env
    echo "✓ Created .env file"
    echo ""
    echo "ACTION REQUIRED: Edit .env and set your DATABASE_URL"
    echo ""
else
    echo "✓ .env file exists"
fi
echo ""

# Create trained_models directory
echo "Creating model storage directory..."
mkdir -p trained_models
echo "✓ trained_models/ directory ready"
echo ""

# Test database connection
echo "Testing database connection..."
python3 -c "
from config import DATABASE_URL
import psycopg2

try:
    conn = psycopg2.connect(DATABASE_URL)
    conn.close()
    print('✓ Database connection successful')
except Exception as e:
    print(f'✗ Database connection failed: {e}')
    print('')
    print('ACTION REQUIRED: Update DATABASE_URL in .env file')
    exit(1)
"
echo ""

# Setup feature store
echo "Setting up feature store tables..."
python3 -c "
from data.feature_store import FeatureStore
import logging

logging.basicConfig(level=logging.WARNING)

try:
    with FeatureStore() as fs:
        fs.create_tables()
    print('✓ Feature store tables created')
except Exception as e:
    print(f'✗ Failed to create feature store: {e}')
    exit(1)
"
echo ""

echo "========================================"
echo "Setup Complete!"
echo "========================================"
echo ""
echo "Next steps:"
echo ""
echo "1. Verify DATABASE_URL in .env file"
echo "2. Test data extraction:"
echo "   python data/extractors.py"
echo ""
echo "3. Run full training pipeline:"
echo "   python training/train_models.py"
echo ""
echo "4. Check trained_models/ directory for saved models"
echo ""
echo "For more information, see README.md"
echo ""
