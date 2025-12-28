@echo off
echo ========================================
echo   Starting InDrive Backend Server
echo ========================================
echo.

echo Starting server on port 3001...
echo.
echo Server will be available at:
echo   📊 Health Check: http://localhost:3001/health
echo   📈 Dashboard: http://localhost:3001/api/dashboard/stats
echo   🚗 API Base: http://localhost:3001/api
echo.
echo Press Ctrl+C to stop the server
echo.

node simple-server.js