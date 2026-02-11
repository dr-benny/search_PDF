@echo off
title Search PDF App
echo Starting PDF Search Application...

echo Checking prerequisites...

:: Check Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo Error: Node.js is not installed.
    echo Please download and install Node.js from https://nodejs.org/
    pause
    exit
)

:: Check Python
where python >nul 2>nul
if %errorlevel% neq 0 (
    echo Error: Python is not installed.
    echo Please download and install Python from https://www.python.org/
    echo During installation, make sure to check "Add Python to PATH"
    pause
    exit
)

:: Install Node dependencies if needed
if not exist "node_modules" (
    echo Installing Node.js dependencies...
    call npm install
)

:: Install Python dependencies (pypdf)
echo Installing/Checking Python dependencies...
call pip install pypdf >nul 2>&1

:: Start the server
echo Starting server...
start http://localhost:3001
node server.js

pause
