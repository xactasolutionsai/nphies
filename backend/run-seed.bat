@echo off
REM Nafes Healthcare Management System - Database Seeding Script for Windows

echo 🌱 Nafes Healthcare Management System - Database Seeding
echo =====================================================
echo.

REM Check if Node.js is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js is not installed!
    echo Please install Node.js from: https://nodejs.org/
    pause
    exit /b 1
)

echo ✅ Node.js is installed

REM Check if .env file exists
if not exist .env (
    echo ⚠️  .env file not found. Creating from template...
    copy env.example .env
    echo.
    echo 📝 Please edit .env file with your database credentials before running again.
    echo Press any key to open .env file for editing...
    pause
    notepad .env
    exit /b 1
)

echo ✅ .env file found

REM Install dependencies if needed
if not exist node_modules (
    echo 📦 Installing dependencies...
    npm install
    if %errorlevel% neq 0 (
        echo ❌ Failed to install dependencies
        pause
        exit /b 1
    )
)

echo ✅ Dependencies installed

REM Run the seeding script
echo.
echo 🌱 Starting database seeding...
echo This will truncate all existing data and generate new test data.
echo seed.js refuses to run unless ALLOW_DESTRUCTIVE_SEED=true is set (in .env or with
echo "set ALLOW_DESTRUCTIVE_SEED=true") and never runs with NODE_ENV=production.
echo.
echo Press any key to continue or Ctrl+C to cancel...
pause

node seed.js

if %errorlevel% equ 0 (
    echo.
    echo 🎉 Database seeding completed successfully!
    echo.
    echo 📊 You can now:
    echo 1. Start the backend: npm run dev
    echo 2. Start the frontend: cd ..\frontend && npm run dev
    echo 3. View the data at: http://localhost:5173
) else (
    echo.
    echo ❌ Database seeding failed!
    echo Please check the error messages above.
)

echo.
pause
