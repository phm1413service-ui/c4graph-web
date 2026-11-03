@echo off
rem ============================================
rem  C4Graph Ver 2.0 起動バッチ (Chrome アプリモード)
rem  このファイルと同じフォルダの index.html を開きます
rem ============================================
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0Launch.ps1"
exit /b 0
