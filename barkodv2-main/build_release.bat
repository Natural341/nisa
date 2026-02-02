@echo off
setlocal enabledelayedexpansion

echo ========================================
echo Nexus Inventory - Release Build
echo ========================================
echo.

REM Find and setup Visual Studio environment
set "VSWHERE=%ProgramFiles(x86)%\Microsoft Visual Studio\Installer\vswhere.exe"

if exist "%VSWHERE%" (
    for /f "usebackq tokens=*" %%i in (`"%VSWHERE%" -latest -property installationPath`) do set "VS_PATH=%%i"
)

if defined VS_PATH (
    echo Found Visual Studio at: !VS_PATH!
    call "!VS_PATH!\VC\Auxiliary\Build\vcvars64.bat" >nul 2>&1
) else (
    echo Visual Studio not found via vswhere, trying default paths...
    if exist "C:\Program Files\Microsoft Visual Studio\2022\Community\VC\Auxiliary\Build\vcvars64.bat" (
        call "C:\Program Files\Microsoft Visual Studio\2022\Community\VC\Auxiliary\Build\vcvars64.bat" >nul 2>&1
    ) else if exist "C:\Program Files\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvars64.bat" (
        call "C:\Program Files\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvars64.bat" >nul 2>&1
    ) else (
        echo ERROR: Visual Studio not found!
        pause
        exit /b 1
    )
)

echo.
echo Environment configured. Starting build...
echo.

cd /d "%~dp0src-tauri"

REM Clean previous build artifacts
if exist "target\release" (
    echo Cleaning previous release build...
    rmdir /s /q "target\release" 2>nul
)

echo Building release executable...
cargo build --release

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================
    echo BUILD SUCCESSFUL!
    echo ========================================
    echo.
    echo Executable location:
    echo %~dp0src-tauri\target\release\nexus-inventory.exe
    echo.
) else (
    echo.
    echo ========================================
    echo BUILD FAILED!
    echo ========================================
    echo.
)

pause
