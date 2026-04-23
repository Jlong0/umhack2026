#!/bin/bash

# PermitIQ Quick Start Script
# Starts both backend and frontend services

echo "🚀 Starting PermitIQ System..."
echo ""

# Check if Python is available
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is not installed"
    exit 1
fi

# Check if Node.js is available
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed"
    exit 1
fi

BACKEND_PID=""
cleanup() {
    echo ""
    echo "🛑 Stopping services..."
    if [ -n "$BACKEND_PID" ]; then
        kill "$BACKEND_PID" 2>/dev/null || true
    fi
    exit
}
trap cleanup INT TERM

# Start backend in background only if not already running on 8001
if lsof -nP -iTCP:8001 -sTCP:LISTEN >/dev/null 2>&1; then
    echo "ℹ️  Backend already running on http://127.0.0.1:8001"
else
    echo "📦 Starting Backend (FastAPI)..."
    if [ -x "venv/bin/python" ]; then
        venv/bin/python run.py &
    else
        python3 run.py &
    fi
    BACKEND_PID=$!
    echo "   Backend PID: $BACKEND_PID"
    echo "   Backend URL: http://127.0.0.1:8001"
    echo ""
    sleep 3
fi

# Start frontend
echo "🎨 Starting Frontend (Vite)..."
echo "   Frontend URL: http://localhost:5173"
echo ""
echo "✅ System Ready!"
echo ""
echo "Press Ctrl+C to stop all services"
echo ""

# Start frontend (this will run in foreground)
npm run dev
