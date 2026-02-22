@echo off
setlocal

echo Launching ADMI System...
echo.

:: Navigate to the project directory
cd /d "%~dp0"

:: --- Find Python Executable ---
echo [1/4] Looking for Python executable...
set "PYTHON_EXE="

:: Check if 'py' or 'python' is already in PATH
where py >nul 2>nul
if %ERRORLEVEL% equ 0 (
    set "PYTHON_EXE=py"
    echo      Found 'py' launcher in PATH.
    goto InstallPythonDeps
)

where python >nul 2>nul
if %ERRORLEVEL% equ 0 (
    set "PYTHON_EXE=python"
    echo      Found 'python' in PATH.
    goto InstallPythonDeps
)

:: If not in PATH, search common installation directories
echo      'py' or 'python' not found in PATH. Searching common directories...
for /d %%d in (C:\Python3*, %LOCALAPPDATA%\Programs\Python\Python3*) do (
    if exist "%%d\python.exe" (
        set "PYTHON_EXE="%%d\python.exe""
        echo      Found Python at: %PYTHON_EXE%
        goto InstallPythonDeps
    )
)

:: If still not found, exit with an error
if not defined PYTHON_EXE (
    echo.
    echo ERROR: Python executable not found.
    echo Please install Python from https://www.python.org/downloads/
    echo IMPORTANT: During installation, make sure to check the box "Add Python to PATH".
    echo.
    pause
    exit /b 1
)

:InstallPythonDeps
:: --- Install Python Dependencies ---
echo.
echo [2/4] Installing Python dependencies...
%PYTHON_EXE% -m pip install -r requirements.txt
if %ERRORLEVEL% neq 0 (
    echo.
    echo ERROR: Failed to install Python dependencies using pip.
    echo The command window will pause so you can see the error from pip.
    echo.
    pause
    exit /b 1
)
echo      Python dependencies installed successfully.

:: --- Install Node.js Dependencies ---
echo.
echo [3/4] Installing Node.js dependencies...
IF EXIST package.json (
    call npm install
    IF %ERRORLEVEL% NEQ 0 (
        echo npm install failed. Please check your Node.js installation and try again.
        pause
        exit /b %ERRORLEVEL%
    )
    echo      Node.js dependencies installed successfully.
) ELSE (
    echo      package.json not found. Skipping npm install.
)

:: --- Start Services ---
echo.
echo [4/4] Starting services...

echo      Starting Python LangExtract Service...
:: FIX: Use cmd /k to keep the window open, even if the script fails, so you can see the error.
start "ADMI Python Service" cmd /k ""%PYTHON_EXE%" workflows/langextract_service.py"
echo      (A new window should open for the Python service. It will now stay open.)
timeout /t 3 >nul

echo      Starting Node.js backend...
start "ADMI Node Backend" cmd /k "node workflows/main.js"
echo      (A new window should open for the Node.js backend)
timeout /t 2 >nul

echo.
echo --- ADMI System Launched ---
echo.
echo Please check the "ADMI Python Service" window.
echo If it shows an error, the service has failed. Please report the error message.
echo If it shows "Starting Python LangExtract Server...", it is running correctly.
echo.

start index.html

endlocal
pause
