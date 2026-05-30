@echo off
echo ====================================
echo   TikTok Auto-Gen Dashboard - Javis
echo ====================================
echo.
echo [1/2] Starting HTTP Server on port 8081...
echo [2/2] Opening browser...
echo.

:: Try Python (py launcher) first as it is confirmed working
py --version >nul 2>&1
if %errorlevel% == 0 (
    echo Using Python (py) Custom Server...
    start "" "http://localhost:8081"
    py dashboard_server.py
    goto :end
)

:: Try Python 3
python --version >nul 2>&1
if %errorlevel% == 0 (
    echo Using Python Custom Server...
    start "" "http://localhost:8081"
    python dashboard_server.py
    goto :end
)

:: Try Node.js npx serve
npx --version >nul 2>&1
if %errorlevel% == 0 (
    echo Using Node.js npx serve...
    start "" "http://localhost:8081"
    npx serve -l 8081 .
    goto :end
)

echo ERROR: ไม่พบ Python หรือ Node.js กรุณาติดตั้ง Python ก่อน
echo Download: https://www.python.org/downloads/
pause
:end
