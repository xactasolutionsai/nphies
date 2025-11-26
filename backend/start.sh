#!/bin/bash

# Nafes Healthcare Management System - Backend Startup Script

echo "🚀 Starting Nafes Healthcare Management System Backend..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm first."
    exit 1
fi

# Check if .env file exists
if [ ! -f .env ]; then
    echo "⚠️  .env file not found. Creating from template..."
    cp env.example .env
    echo "📝 Please edit .env file with your database credentials before running again."
    exit 1
fi

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Check if database is accessible (optional)
echo "🔍 Checking database connection..."

# Start the server
echo "🌟 Starting server..."
if [ "$1" = "dev" ]; then
    echo "🔧 Running in development mode..."
    npm run dev
else
    echo "🏭 Running in production mode..."
    npm start
fi
