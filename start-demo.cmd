@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ==================================================
echo    AI Smart Entry Demo  -  starting up...
echo ==================================================
echo.
if not exist "node_modules\" (
  echo [first run] installing dependencies, please wait once...
  call npm install
  echo.
)
echo Launching local server. Your browser will open automatically.
echo Keep THIS window open during the demo.
echo To stop: close this window or press Ctrl+C.
echo.
call npm run dev
pause
