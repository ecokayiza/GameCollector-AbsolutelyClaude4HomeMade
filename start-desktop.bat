@echo off
chcp 65001 >nul
title 游戏收藏记录 - 桌面应用
echo 正在启动游戏收藏记录桌面应用...
echo.

cd /d "%~dp0"

if not exist "node_modules" (
    echo 正在安装依赖包...
    call pnpm install
    echo.
)

echo 启动应用...
call pnpm start

pause
