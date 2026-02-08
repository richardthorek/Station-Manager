#!/bin/bash
# Azure App Service startup script

set -e  # Exit on error

echo "Starting Station Manager application..."

# Verify backend/dist exists
if [ ! -d "backend/dist" ]; then
  echo "❌ Error: backend/dist directory not found!"
  echo "   The application was not built correctly during CI/CD."
  exit 1
fi

# Verify node_modules exists
if [ ! -d "backend/node_modules" ]; then
  echo "❌ Error: backend/node_modules directory not found!"
  echo "   Dependencies were not included in the deployment package."
  exit 1
fi

echo "✅ Backend built files found"
echo "✅ Node modules found"

# Start the application
echo "🚀 Starting backend server..."
cd backend && npm start
