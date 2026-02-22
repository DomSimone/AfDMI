#!/bin/bash

# --- Setup ---
echo "Launching ADMI System..."
echo ""

# In Linux/Render, the script starts in the project root by default.
# No need for 'cd /d %~dp0'

# --- 1/4 Find Python ---
# On Render, the command is usually 'python' or 'python3'
if command -v python3 &>/dev/null; then
    PYTHON_EXE="python3"
elif command -v python &>/dev/null; then
    PYTHON_EXE="python"
else
    echo "ERROR: Python not found."
    exit 1
fi
echo "[1/4] Found Python: $PYTHON_EXE"

# --- 2/4 Install Python Dependencies ---
echo ""
echo "[2/4] Installing Python dependencies..."
$PYTHON_EXE -m pip install -r requirements.txt
if [ $? -ne 0 ]; then
    echo "ERROR: Failed to install Python dependencies."
    exit 1
fi

# --- 3/4 Install Node.js Dependencies ---
echo ""
echo "[3/4] Installing Node.js dependencies..."
if [ -f "package.json" ]; then
    npm install
    if [ $? -ne 0 ]; then
        echo "ERROR: npm install failed."
        exit 1
    fi
else
    echo "package.json not found. Skipping npm install."
fi

# --- 4/4 Start Services ---
echo ""
echo "[4/4] Starting services..."

# IMPORTANT: Render can only run ONE persistent process per Web Service.
# To run two services, we run the first one in the background using '&'.

echo "Starting Python LangExtract Service..."
$PYTHON_EXE workflows/langextract_service.py & 

# Give the Python service a moment to bind to its port
sleep 3

echo "Starting Node.js backend..."
# The last command must stay in the foreground so the Render service doesn't "finish" and stop.
node workflows/main.js
