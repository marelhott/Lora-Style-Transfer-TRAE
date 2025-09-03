#!/bin/bash

# Start development script pro frontend + backend
echo "🚀 Starting LoRA Style Transfer development servers..."

# Kontrola závislostí
if ! command -v python3 &> /dev/null; then
    echo "❌ Python3 not found. Install Python3 first."
    exit 1
fi

if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Install Node.js first."
    exit 1
fi

# Install Python dependencies if needed
if [ ! -f "backend/.deps_installed" ]; then
    echo "📦 Installing Python dependencies..."
    cd backend
    pip3 install -r requirements.txt
    touch .deps_installed
    cd ..
fi

# Start backend server
echo "🐍 Starting Python backend on port 8000..."
cd backend
python3 main.py &
BACKEND_PID=$!
cd ..

# Wait a bit for backend to start
sleep 3

# Start frontend server
echo "⚛️ Starting Next.js frontend on port 3000..."
npm run dev &
FRONTEND_PID=$!

# Function to cleanup on exit
cleanup() {
    echo "🛑 Stopping servers..."
    kill $BACKEND_PID 2>/dev/null
    kill $FRONTEND_PID 2>/dev/null
    exit 0
}

# Trap signals
trap cleanup SIGINT SIGTERM

echo "✅ Both servers started:"
echo "   - Frontend: http://localhost:3000"
echo "   - Backend:  http://localhost:8000"
echo "   - API:      http://localhost:8000/api/models"
echo ""
echo "Press Ctrl+C to stop both servers"

# Wait for processes
wait
