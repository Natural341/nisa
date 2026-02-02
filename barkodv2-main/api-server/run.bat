@echo off
echo ========================================
echo   Nexus API Server - Starting...
echo ========================================
echo.

set PORT=3000
set RUST_LOG=info

cargo run --release

pause
