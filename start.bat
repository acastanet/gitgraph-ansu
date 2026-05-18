@echo off
:: Set UTF-8 codepage to display icons and clean characters
chcp 65001 > nul
title GitGraph Launcher

:menu
cls
echo =======================================================================
echo    ██████╗ ██╗████████╗ ██████╗ ██████╗  █████╗ ██████╗ ██╗  ██╗
echo   ██╔════╝ ██║╚══██╔══╝██╔════╝ ██╔══██╗██╔══██╗██╔══██╗██║  ██║
echo   ██║  ███╗██║   ██║   ██║  ███╗██████╔╝███████║██████╔╝███████║
echo   ██║   ██║██║   ██║   ██║   ██║██╔══██╗██╔══██║██╔═══╝ ██╔══██║
echo   ╚██████╔╝██║   ██║   ╚██████╔╝██║  ██║██║  ██║██║     ██║  ██║
echo    ╚═════╝ ╚═╝   ╚═╝    ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝     ╚═╝  ╚═╝
echo =======================================================================
echo          GitGraph Local Development Environment Launcher
echo =======================================================================
echo.

:: Check for Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [❌ ERROR] Node.js was not found on your system!
    echo Please download and install Node.js from: https://nodejs.org/
    echo.
    pause
    exit /b 1
)

:: Check for package.json
if not exist "package.json" (
    echo [❌ ERROR] package.json not found!
    echo Please make sure this script is run in the GitGraph root directory.
    echo.
    pause
    exit /b 1
)

:: Check if node_modules exists
if not exist "node_modules" (
    echo [⚡ INFO] node_modules not found. First-time setup is required.
    echo [⚡ INFO] Installing dependencies - npm install... This may take a minute.
    echo.
    call npm install
    if %errorlevel% neq 0 (
        echo [❌ ERROR] Dependency installation failed! Please check your network connection.
        echo.
        pause
        goto menu
    )
    echo [✔ SUCCESS] Dependencies installed successfully!
    echo.
)

:: Check for .env.local
if not exist ".env.local" (
    echo [⚡ INFO] .env.local not found. Creating it from .env.example...
    copy .env.example ".env.local" > nul
)

:: Read .env.local to check if GEMINI_API_KEY is configured
set "API_KEY_CONFIGURED=1"
findstr /C:"GEMINI_API_KEY=\"\"" .env.local >nul
if %errorlevel% equ 0 (
    set "API_KEY_CONFIGURED=0"
)
findstr /C:"GEMINI_API_KEY=\"MY_GEMINI_API_KEY\"" .env.local >nul
if %errorlevel% equ 0 (
    set "API_KEY_CONFIGURED=0"
)
findstr /C:"GEMINI_API_KEY=MY_GEMINI_API_KEY" .env.local >nul
if %errorlevel% equ 0 (
    set "API_KEY_CONFIGURED=0"
)

if "%API_KEY_CONFIGURED%"=="0" (
    echo -----------------------------------------------------------------------
    echo  ⚠️  WARNING: GEMINI_API_KEY is not configured in .env.local!
    echo  The application will run, but AI features may not work until you configure it.
    echo  Tip: Select Option 3 to configure your key now.
    echo -----------------------------------------------------------------------
    echo.
)

echo [1] Start GitGraph Server (opens http://localhost:3000)
echo [2] Synchronize Repository with GitHub (Pull & Push)
echo [3] Install / Reinstall Dependencies (npm install)
echo [4] Configure / Open .env.local
echo [5] Exit
echo.
set /p opt="Select an option (1-5) [Default is 1]: "

if "%opt%"=="" set opt=1
if "%opt%"=="1" goto start_server
if "%opt%"=="2" goto sync_repo
if "%opt%"=="3" goto reinstall
if "%opt%"=="4" goto config_env
if "%opt%"=="5" goto exit_script

echo Invalid option, please try again.
timeout /t 2 >nul
goto menu

:start_server
echo.
echo Launching browser to http://localhost:3000...
start http://localhost:3000
echo Starting GitGraph development server in a new persistent window...
echo.
start "GitGraph Dev Server" cmd /k "npm run dev"
goto menu

:reinstall
echo.
echo [⚡ INFO] Reinstalling dependencies...
echo [⚡ INFO] Deleting existing node_modules...
if exist "node_modules" rd /s /q node_modules
echo [⚡ INFO] Running npm install...
call npm install
if %errorlevel% neq 0 (
    echo [❌ ERROR] Reinstallation failed!
) else (
    echo [✔ SUCCESS] Dependencies successfully reinstalled!
)
pause
goto menu

:config_env
echo.
echo Opening .env.local in Notepad...
start notepad.exe .env.local
echo.
echo Please save the file after editing.
pause
goto menu

:sync_repo
echo.
echo =======================================================================
echo  🔄  REPOSITORY SYNCHRONIZATION (GITHUB)
echo =======================================================================
echo.

:: 1. Verify Git
where git >nul 2>nul
if %errorlevel% neq 0 (
    echo [❌ ERROR] Git was not found on your system!
    echo Please make sure Git is installed and in your PATH.
    echo.
    pause
    goto menu
)

:: 2. Fetch updates
echo [⚡ INFO] Fetching updates from remote repository (git fetch)...
git fetch origin
if %errorlevel% neq 0 (
    echo [❌ ERROR] Failed to fetch from remote repository.
    echo Please check your internet connection or git configuration/credentials.
    echo.
    pause
    goto menu
)
echo [✔ SUCCESS] Fetch complete.
echo.

:: 3. Commit local changes if any
echo [⚡ INFO] Checking for local changes...
git status --porcelain | findstr /r "^" >nul
if %errorlevel% equ 0 (
    echo [⚠️ WARNING] Local modifications detected.
    echo.
    git status -s
    echo.
    setlocal Enabledelayedexpansion
    set /p confirm_commit="Do you want to commit and push these changes? (Y/N) [Default is Y]: "
    if "!confirm_commit!"=="" set confirm_commit=Y
    if /I "!confirm_commit!"=="Y" (
        set /p commit_msg="Enter commit message [Default: Sauvegarde automatique]: "
        if "!commit_msg!"=="" set commit_msg=Sauvegarde automatique
        
        echo [⚡ INFO] Staging all files...
        git add -A
        
        echo [⚡ INFO] Committing changes...
        git commit -m "!commit_msg!"
        if %errorlevel% neq 0 (
            echo [❌ ERROR] Failed to commit changes.
            echo.
            endlocal
            pause
            goto menu
        )
        echo [✔ SUCCESS] Local changes committed.
    ) else (
        echo [⚡ INFO] Skipping commit of local changes.
    )
    endlocal
) else (
    echo [✔ SUCCESS] No local changes to commit.
)
echo.

:: 4. Pull remote changes
echo [⚡ INFO] Pulling remote changes (git pull --rebase)...
git pull --rebase origin main
if %errorlevel% neq 0 (
    echo [❌ ERROR] Failed to pull changes. There might be conflicts.
    echo Please resolve any conflicts manually.
    echo.
    pause
    goto menu
)
echo [✔ SUCCESS] Pull complete.
echo.

:: 5. Push changes
echo [⚡ INFO] Pushing local commits to GitHub (git push)...
git push origin main
if %errorlevel% neq 0 (
    echo [❌ ERROR] Failed to push changes to GitHub.
    echo.
    pause
    goto menu
)
echo [✔ SUCCESS] Repository is fully synchronized!
echo.
pause
goto menu


:exit_script
echo Goodbye!
timeout /t 2 >nul
exit /b 0
