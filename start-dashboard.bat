@echo off
echo ====================================
echo   TikTok Auto-Gen Dashboard - Javis
echo ====================================
echo.
echo [1/2] Starting HTTP Server on port 8080...
echo [2/2] Opening browser...
echo.

:: Try Python 3 first
python --version >nul 2>&1
if %errorlevel% == 0 (
    echo Using Python to serve...
    start "" "http://localhost:8080"
    python -m http.server 8080
    goto :end
)

:: Try Python (py launcher)
py --version >nul 2>&1
if %errorlevel% == 0 (
    echo Using Python (py) to serve...
    start "" "http://localhost:8080"
    py -m http.server 8080
    goto :end
)

:: Try Node.js npx serve
npx --version >nul 2>&1
if %errorlevel% == 0 (
    echo Using Node.js npx serve...
    start "" "http://localhost:8080"
    npx serve -l 8080 .
    goto :end
)

echo ERROR: ไม่พบ Python หรือ Node.js กรุณาติดตั้ง Python ก่อน
echo Download: https://www.python.org/downloads/
pause
:end
