@echo off
setlocal enabledelayedexpansion

echo Starting Nexus Inventory in Dev Mode...
echo.

REM Setup VS environment
set "VSWHERE=%ProgramFiles(x86)%\Microsoft Visual Studio\Installer\vswhere.exe"
if exist "%VSWHERE%" (
    for /f "usebackq tokens=*" %%i in (`"%VSWHERE%" -latest -property installationPath`) do set "VS_PATH=%%i"
)
if defined VS_PATH (
    call "!VS_PATH!\VC\Auxiliary\Build\vcvars64.bat" >nul 2>&1
)

cd /d "%~dp0"
npm run tauri dev
