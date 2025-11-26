#!/bin/bash

# Performance Monitor Script for TEEEM Development
# Monitors VS Code, Node, Ruby processes and logs performance data

LOG_DIR="/Users/rob/Projects/teeem/tmp/performance-logs"
mkdir -p "$LOG_DIR"

TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")
LOG_FILE="$LOG_DIR/perf-log-$TIMESTAMP.txt"

echo "=== Performance Monitor Started at $(date) ===" | tee -a "$LOG_FILE"
echo "Logging to: $LOG_FILE"
echo ""

# Monitor for specified duration (default 4 hours)
DURATION_HOURS=${1:-4}
INTERVAL_SECONDS=300  # Check every 5 minutes
END_TIME=$(($(date +%s) + (DURATION_HOURS * 3600)))

SAMPLE_COUNT=0

while [ $(date +%s) -lt $END_TIME ]; do
    SAMPLE_COUNT=$((SAMPLE_COUNT + 1))
    echo "" | tee -a "$LOG_FILE"
    echo "=== Sample #$SAMPLE_COUNT at $(date) ===" | tee -a "$LOG_FILE"

    # Overall system stats
    echo "" | tee -a "$LOG_FILE"
    echo "--- System Resources ---" | tee -a "$LOG_FILE"
    top -l 1 | grep -E "CPU usage|PhysMem|Load Avg" | tee -a "$LOG_FILE"

    # VS Code processes
    echo "" | tee -a "$LOG_FILE"
    echo "--- VS Code CPU Usage ---" | tee -a "$LOG_FILE"
    VSCODE_CPU=$(ps aux | grep "Visual Studio Code Helper" | grep -v grep | awk '{sum+=$3} END {printf "%.1f%%\n", sum}')
    echo "Total VS Code CPU: $VSCODE_CPU" | tee -a "$LOG_FILE"

    # Top VS Code processes
    ps aux | grep "Visual Studio Code" | grep -v grep | awk '$3 > 1 {printf "  %s %5s%% CPU %5s%% MEM\n", $11, $3, $4}' | head -5 | tee -a "$LOG_FILE"

    # Node processes
    echo "" | tee -a "$LOG_FILE"
    echo "--- Node Processes ---" | tee -a "$LOG_FILE"
    ps aux | grep node | grep -v grep | awk '{printf "  CPU: %5s%% MEM: %5s%% %s\n", $3, $4, $11}' | head -3 | tee -a "$LOG_FILE"

    # Ruby processes
    echo "" | tee -a "$LOG_FILE"
    echo "--- Ruby Processes ---" | tee -a "$LOG_FILE"
    ps aux | grep ruby | grep -v grep | awk '{printf "  CPU: %5s%% MEM: %5s%% %s\n", $3, $4, $11}' | head -3 | tee -a "$LOG_FILE"

    # File watcher stats
    echo "" | tee -a "$LOG_FILE"
    echo "--- File System ---" | tee -a "$LOG_FILE"
    echo "  Temp files: $(find /Users/rob/Projects/teeem/tmp -type f 2>/dev/null | wc -l | xargs)" | tee -a "$LOG_FILE"
    echo "  Git status: $(cd /Users/rob/Projects/teeem && git status --short | wc -l | xargs) modified files" | tee -a "$LOG_FILE"

    # Disk usage
    echo "  Project size: $(du -sh /Users/rob/Projects/teeem 2>/dev/null | awk '{print $1}')" | tee -a "$LOG_FILE"
    echo "  node_modules: $(du -sh /Users/rob/Projects/teeem/frontend/node_modules 2>/dev/null | awk '{print $1}')" | tee -a "$LOG_FILE"

    # Analysis: Flag issues
    echo "" | tee -a "$LOG_FILE"
    VSCODE_CPU_NUM=$(echo $VSCODE_CPU | sed 's/%//')
    if (( $(echo "$VSCODE_CPU_NUM > 30" | bc -l) )); then
        echo "⚠️  WARNING: High VS Code CPU usage detected!" | tee -a "$LOG_FILE"
    fi

    SYSTEM_IDLE=$(top -l 1 | grep "CPU usage" | awk '{print $7}' | sed 's/%//')
    if (( $(echo "$SYSTEM_IDLE < 50" | bc -l) )); then
        echo "⚠️  WARNING: System under heavy load (low idle)" | tee -a "$LOG_FILE"
    fi

    echo "Sleeping for $INTERVAL_SECONDS seconds..."
    sleep $INTERVAL_SECONDS
done

echo "" | tee -a "$LOG_FILE"
echo "=== Monitoring Complete at $(date) ===" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"
echo "📊 Summary of $SAMPLE_COUNT samples:" | tee -a "$LOG_FILE"
echo "Review the full log at: $LOG_FILE"
echo ""
echo "To analyze the log for issues, run:"
echo "  grep '⚠️' $LOG_FILE"
