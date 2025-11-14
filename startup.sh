#!/bin/bash
# Azure App Service startup script

echo "Starting Station Manager application..."

# Check if backend/dist exists
if [ ! -d "backend/dist" ]; then
  echo "Backend not built, building now..."
  cd backend && npm install && npm run build && cd ..
fi

# Start the application
echo "Starting backend server..."
cd backend && npm start
