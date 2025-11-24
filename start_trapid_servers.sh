#!/bin/bash

# Trapid Development Servers Startup Script
# This script starts both the Rails backend and Vite frontend servers

PROJECT_DIR="/Users/robdev/Documents/GitHub/trapid"
LOG_DIR="$PROJECT_DIR/logs"

# Create logs directory if it doesn't exist
mkdir -p "$LOG_DIR"

echo "Starting Trapid development servers..."

# Check if servers are already running
if lsof -ti:3000 > /dev/null 2>&1; then
    echo "❌ Port 3000 is already in use. Backend may already be running."
else
    echo "✓ Starting Rails backend on port 3000..."
    cd "$PROJECT_DIR/backend" && bin/rails server > "$LOG_DIR/backend.log" 2>&1 &
    echo "  Backend PID: $!"
fi

if lsof -ti:5173 > /dev/null 2>&1; then
    echo "❌ Port 5173 is already in use. Frontend may already be running."
else
    echo "✓ Starting Vite frontend on port 5173..."
    cd "$PROJECT_DIR" && npm --prefix frontend run dev > "$LOG_DIR/frontend.log" 2>&1 &
    echo "  Frontend PID: $!"
fi

echo ""
echo "✅ Trapid servers started!"
echo "   Backend:  http://localhost:3000"
echo "   Frontend: http://localhost:5173"
echo ""
echo "📝 Logs are saved in: $LOG_DIR"
echo "   Backend:  tail -f $LOG_DIR/backend.log"
echo "   Frontend: tail -f $LOG_DIR/frontend.log"
echo ""
echo "To stop servers: pkill -f 'rails server' && pkill -f 'vite'"
