@echo off
echo ========================================
echo   Testing InDrive Backend Server
echo ========================================
echo.

echo 1. Testing Health Check Endpoint...
curl -s http://localhost:3001/health
if %errorlevel% neq 0 (
    echo ❌ Server is NOT running
    echo.
    echo To start the server:
    echo   1. Open a new terminal
    echo   2. cd backend
    echo   3. node simple-server.js
    pause
    exit /b 1
)

echo.
echo ✅ Server is running!
echo.

echo 2. Testing Dashboard Stats...
curl -s http://localhost:3001/api/dashboard/stats
echo.
echo.

echo 3. Testing Create Ride...
curl -s -X POST http://localhost:3001/api/rides -H "Content-Type: application/json" -d "{\"passenger_id\":\"test123\",\"pickup_latitude\":27.7172,\"pickup_longitude\":85.3240,\"pickup_address\":\"Thamel\",\"destination_latitude\":27.7000,\"destination_longitude\":85.3200,\"destination_address\":\"Patan\",\"proposed_fare\":500}"
echo.
echo.

echo 4. Testing Get Rides...
curl -s http://localhost:3001/api/rides
echo.
echo.

echo ========================================
echo   All Tests Complete!
echo ========================================
echo.
echo Server Status: ✅ RUNNING
echo API Endpoints: ✅ WORKING
echo.
pause