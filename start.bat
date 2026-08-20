@echo off
title Store Management System
echo ==========================================
echo   Store Management System - Starting...
echo ==========================================
echo.

:: Start backend in a new window
start "Backend Server" cmd /k "cd /d %~dp0 && node server/index.js"

:: Wait for the backend to complete its database startup retries
timeout /t 8 /nobreak >nul

:: Start frontend in a new window  
start "Frontend (Vite)" cmd /k "cd /d %~dp0 && npm run dev"

echo.
echo Both servers are starting in separate windows.
echo Backend:  http://localhost:5000
echo Frontend: http://localhost:5173
echo.
echo You can close this window.
pause
