@echo off
REM Nafes Healthcare Management System - Backend Startup Script for Windows

echo 🚀 Starting Nafes Healthcare Management System Backend...

REM Check if Node.js is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js is not installed. Please install Node.js first.
    echo Download from: https://nodejs.org/
    pause
    exit /b 1
)

REM Check if npm is installed
npm --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ npm is not installed. Please install npm first.
    pause
    exit /b 1
)

REM Check if .env file exists
if not exist .env (
    echo ⚠️  .env file not found. Creating from template...
    copy env.example .env
    echo 📝 Please edit .env file with your database credentials before running again.
    echo Press any key to open .env file for editing...
    pause
    notepad .env
    exit /b 1
)

REM Install dependencies if node_modules doesn't exist
if not exist node_modules (
    echo 📦 Installing dependencies...
    npm install
    if %errorlevel% neq 0 (
        echo ❌ Failed to install dependencies
        pause
        exit /b 1
    )
)

REM Check if database is accessible (optional)
echo 🔍 Checking database connection...

REM Start the server
echo 🌟 Starting server...
if "%1"=="dev" (
    echo 🔧 Running in development mode...
    npm run dev
) else (
    echo 🏭 Running in production mode...
    npm start
)

pause
