@echo off
echo ==========================================
echo  Ashland Public Transit - Installer
echo ==========================================
echo.
echo [1/3] Installing Server Dependencies...
cd server
call npm install
cd ..

echo.
echo [2/3] Installing Web Client Dependencies...
cd client
call npm install
cd ..

echo.
echo [3/3] Installing Mobile App Dependencies...
cd mobile
call npm install
cd ..

echo.
echo ==========================================
echo  Installation Complete!
echo  To run the app (in three terminals):
echo    1. cd server && npm run dev
echo    2. cd client && npm start
echo    3. cd mobile && npm start
echo ==========================================
pause
