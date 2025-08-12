@echo off
chcp 65001 >nul
title Game Collection Server

:: Switch to script directory
cd /d "%~dp0"

:: Find available port
set PORT=8000
netstat -ano | findstr ":8000" >nul 2>&1
if %errorlevel% equ 0 (
    set PORT=8001
    netstat -ano | findstr ":8001" >nul 2>&1
    if %errorlevel% equ 0 (
        set PORT=8002
        netstat -ano | findstr ":8002" >nul 2>&1
        if %errorlevel% equ 0 (
            set PORT=8003
        )
    )
)

echo.
echo ========================================
echo    Game Collection Server
echo ========================================
echo.
echo Opening browser at: http://localhost:%PORT%
echo.
start http://localhost:%PORT%

:: Run server (blocks until stopped)
python api_server.py %PORT%
