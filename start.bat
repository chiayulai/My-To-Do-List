@echo off
chcp 65001 >nul
title My To-Do List 本地伺服器
echo 正在啟動 My To-Do List...
powershell -ExecutionPolicy Bypass -NoProfile -File "%~dp0start-server.ps1"
pause
