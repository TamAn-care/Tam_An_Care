@echo off
:: ==============================================================================
:: TÂM AN CARE V7.5 — STANDALONE WINDOWS LAUNCHER (.BAT)
:: Double-click to launch Tâm An Care as a native desktop application on Windows
:: ==============================================================================
title Tâm An Care V7.5 — Standalone Desktop App

echo ==================================================================
echo   🚀 KHỞI CHẠY TÂM AN CARE V7.5 — WINDOWS DESKTOP APP
echo ==================================================================

cd /d "%~dp0..\..\frontend"

echo ✅ Đang khởi chạy server local tại http://127.0.0.1:5173...
start /b npx vite preview --host 127.0.0.1 --port 5173

timeout /t 2 /nobreak > nul

echo 📱 Đang mở cửa sổ ứng dụng Windows Desktop...
start msedge --app=http://127.0.0.1:5173 || start chrome --app=http://127.0.0.1:5173 || start http://127.0.0.1:5173

echo ==================================================================
echo   Tâm An Care V7.5 đang chạy độc lập trên Windows PC.
echo ==================================================================
