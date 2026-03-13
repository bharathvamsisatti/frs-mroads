@echo off
REM PowerShell version:
REM powershell -ExecutionPolicy Bypass -Command "cd 'C:\Users\Mroads\Downloads\mroads-fra-main\mroads-fra-main\frontend' ; npm run dev"

cd /d "C:\Users\Mroads\Downloads\mroads-fra-main\mroads-fra-main\frontend"
echo Starting frontend on http://localhost:5173
npm run dev
pause
