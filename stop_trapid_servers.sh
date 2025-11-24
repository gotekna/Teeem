#!/bin/bash

# Trapid Development Servers Stop Script

echo "Stopping Trapid development servers..."

# Stop Rails backend
if lsof -ti:3000 > /dev/null 2>&1; then
    echo "✓ Stopping Rails backend (port 3000)..."
    lsof -ti:3000 | xargs kill -9
else
    echo "  Backend not running on port 3000"
fi

# Stop Vite frontend
if lsof -ti:5173 > /dev/null 2>&1; then
    echo "✓ Stopping Vite frontend (port 5173)..."
    lsof -ti:5173 | xargs kill -9
else
    echo "  Frontend not running on port 5173"
fi

echo ""
echo "✅ Trapid servers stopped!"
