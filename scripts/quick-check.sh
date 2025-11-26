#!/bin/bash

# Quick Performance Check - Run anytime to see current state

echo "🔍 Quick Performance Check - $(date)"
echo ""

# System overview
echo "=== System Resources ==="
top -l 1 | grep -E "CPU usage|PhysMem|Load Avg"
echo ""

# VS Code
echo "=== VS Code ==="
VSCODE_CPU=$(ps aux | grep "Visual Studio Code Helper" | grep -v grep | awk '{sum+=$3} END {printf "%.1f", sum}')
VSCODE_MEM=$(ps aux | grep "Visual Studio Code" | grep -v grep | awk '{sum+=$4} END {printf "%.1f", sum}')
echo "Total CPU: ${VSCODE_CPU}%"
echo "Total Memory: ${VSCODE_MEM}%"

if (( $(echo "$VSCODE_CPU > 30" | bc -l) )); then
    echo "⚠️  HIGH CPU - Consider reloading window"
fi
echo ""

# Development servers
echo "=== Development Servers ==="
ps aux | grep -E "(vite|node.*teeem|rails s)" | grep -v grep | awk '{printf "%-20s CPU: %5s%% MEM: %5s%%\n", $11, $3, $4}'
echo ""

# File system
echo "=== File System ==="
echo "Temp files: $(find /Users/rob/Projects/teeem/tmp -type f 2>/dev/null | wc -l | xargs)"
echo "Modified files: $(cd /Users/rob/Projects/teeem && git status --short 2>/dev/null | wc -l | xargs)"
echo ""

# Recommendations
echo "=== Recommendations ==="
IDLE=$(top -l 1 | grep "CPU usage" | awk '{print $7}' | sed 's/%//')
if (( $(echo "$IDLE > 70" | bc -l) )); then
    echo "✅ System running efficiently (${IDLE}% idle)"
elif (( $(echo "$IDLE > 50" | bc -l) )); then
    echo "⚠️  Moderate load (${IDLE}% idle)"
else
    echo "🔴 High load (${IDLE}% idle) - Consider closing apps"
fi

if (( $(echo "$VSCODE_CPU > 20" | bc -l) )); then
    echo "💡 Tip: Reload VS Code window (Cmd+Shift+P → 'Reload Window')"
fi
