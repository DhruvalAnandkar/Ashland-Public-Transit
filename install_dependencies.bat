@echo off
echo ==========================================
echo  Ashland Public Transit - Installer
echo ==========================================
echo.
echo [1/2] Installing Server Dependencies...
cd server
call npm install
cd ..

echo.
echo [2/2] Installing Client Dependencies...
cd client
call npm install
cd ..

echo.
echo ==========================================
echo  Installation Complete!
echo  To run the app:
echo    1. cd server && npm run dev
echo    2. cd client && npm start
echo ==========================================
pause
