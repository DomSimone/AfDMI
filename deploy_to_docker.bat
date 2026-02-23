@echo off
setlocal enabledelayedexpansion

echo ============================================
echo ADMI Docker Desktop Deployment
echo ============================================
echo.

:: Navigate to the project directory
cd /d "%~dp0"

:: Check if Docker Desktop is installed
set "DOCKER_DESKTOP="
if exist "C:\Program Files\Docker\Docker\Docker Desktop.exe" (
    set "DOCKER_DESKTOP=C:\Program Files\Docker\Docker\Docker Desktop.exe"
) else if exist "%PROGRAMFILES%\Docker\Docker\Docker Desktop.exe" (
    set "DOCKER_DESKTOP=%PROGRAMFILES%\Docker\Docker\Docker Desktop.exe"
) else if exist "%LOCALAPPDATA%\Docker\Docker Desktop.exe" (
    set "DOCKER_DESKTOP=%LOCALAPPDATA%\Docker\Docker Desktop.exe"
)

if not defined DOCKER_DESKTOP (
    echo ERROR: Docker Desktop is not installed.
    echo.
    echo Please download and install Docker Desktop from:
    echo https://www.docker.com/products/docker-desktop
    echo.
    pause
    exit /b 1
)

echo Found Docker Desktop at: %DOCKER_DESKTOP%
echo.

:: Check if Docker daemon is running
echo [1/5] Checking Docker Desktop status...
docker info >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo       Docker Desktop is not running. Starting it now...
    start "" "%DOCKER_DESKTOP%"
    
    :: Wait for Docker to start (up to 60 seconds)
    echo       Waiting for Docker Desktop to initialize...
    set /a count=0
    :wait_docker
    timeout /t 3 /nobreak >nul
    docker info >nul 2>nul
    if %ERRORLEVEL% neq 0 (
        set /a count+=1
        if !count! lss 20 (
            echo       Still waiting... (!count!/20)
            goto wait_docker
        ) else (
            echo.
            echo ERROR: Docker Desktop failed to start within 60 seconds.
            echo Please start Docker Desktop manually and try again.
            pause
            exit /b 1
        )
    )
    echo       Docker Desktop is now running.
) else (
    echo       Docker Desktop is running.
)

echo.
echo [2/5] Checking Docker build context...
echo       Current directory: %CD%
echo       Files to be included in build:
for %%f in (Dockerfile requirements.txt package*.json start.sh workflows\*.py) do (
    if exist "%%f" (
        echo         ✓ %%f
    ) else (
        echo         ✗ %%f (MISSING)
    )
)

echo.
echo [3/5] Building Docker image...
echo       This may take a few minutes on first run...
echo       Building with verbose output for debugging...

:: Build with verbose output and save logs
docker build -t admi-app . --progress=plain > build.log 2>&1
if %ERRORLEVEL% neq 0 (
    echo.
    echo ERROR: Docker build failed.
    echo.
    echo Build log saved to: build.log
    echo.
    echo Common issues and solutions:
    echo 1. Check that requirements.txt has compatible package versions
    echo 2. Ensure Docker Desktop has enough memory allocated (4GB+ recommended)
    echo 3. Try running: docker system prune -f (to clean up disk space)
    echo 4. Check build.log for specific error details
    echo.
echo Last 20 lines of build log:
    echo ---------------------------
    for /f "skip=1 delims=" %%a in ('findstr /n "^" build.log') do @echo %%a
    echo ---------------------------
    echo.
    pause
    exit /b %ERRORLEVEL%
)

echo       Docker image 'admi-app' built successfully.
del build.log 2>nul

echo.
echo [4/5] Stopping existing container (if any)...
docker stop admi-container 2>nul >nul
docker rm admi-container 2>nul >nul
echo       Cleanup complete.

echo.
echo [5/5] Running Docker container...
echo       Starting services:
echo       - Node.js Backend: http://localhost:3001
echo       - Python Extraction Service: http://localhost:5001
echo       - Multi-file processing enabled (20 files max, 15MB each)
echo       - Batch processing with parallel execution
echo.

:: Run container with both ports exposed and interactive mode for debugging
docker run -d ^
    -p 3001:3001 ^
    -p 5001:5001 ^
    --name admi-container ^
    --restart unless-stopped ^
    admi-app

if %ERRORLEVEL% neq 0 (
    echo.
    echo ERROR: Failed to start Docker container.
    echo.
    echo Container logs (last 50 lines):
    echo -------------------------------
    docker logs admi-container 2>&1 | tail -50
    echo -------------------------------
    echo.
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo [6/6] Waiting for services to start...
timeout /t 10 /nobreak >nul

:: Check if container is running
docker ps | findstr admi-container >nul
if %ERRORLEVEL% neq 0 (
    echo.
    echo ERROR: Container is not running. Check logs with: docker logs admi-container
    echo.
    echo Container logs (last 50 lines):
    echo -------------------------------
    docker logs admi-container 2>&1 | tail -50
    echo -------------------------------
    echo.
    pause
    exit /b 1
)

:: Check if services are responding
echo.
echo [7/7] Testing service connectivity...
echo       Testing Node.js backend...
timeout /t 2 /nobreak >nul
curl -s https://afdmi-123.onrender.com:5001/process/ >nul 2>&1
if %ERRORLEVEL% equ 0 (
    echo         ✓ Node.js backend is responding
) else (
    echo         ✗ Node.js backend is not responding
    echo         This is normal if the service is still starting up
)

echo       Testing Python extraction service...
timeout /t 2 /nobreak >nul
curl -s https://afdmi-123.onrender.com:5001/process/health >nul 2>&1
if %ERRORLEVEL% equ 0 (
    echo         ✓ Python extraction service is responding
) else (
    echo         ✗ Python extraction service is not responding
    echo         This is normal if the service is still starting up
)

echo.
echo ============================================
echo Deployment Complete!
echo ============================================
echo.
echo Container 'admi-app' is running in Docker Desktop.
echo.
echo Services:
echo   - Node.js Backend:    https://afdmi-123.onrender.com:5001
echo   - Python Extraction:  https://afdmi-123.onrender.com:5001
echo   - Frontend:           https://afdmi-123.onrender.com:5001
echo.
echo Docker Desktop Commands:
echo   - Open Docker Desktop to manage containers
echo   - View logs:     docker logs admi-container
echo   - Follow logs:   docker logs -f admi-container
echo   - Stop:          docker stop admi-container
echo   - Restart:       docker restart admi-container
echo   - Remove:        docker rm -f admi-container
echo.
echo Troubleshooting:
echo   - If services don't respond, check: docker logs admi-container
echo   - If build fails, check: build.log (created during build)
echo   - If ports are in use, stop other services using ports 3001 or 5001
echo.

:: Open Docker Desktop to show the container
echo Opening Docker Desktop...
start "" "%DOCKER_DESKTOP%"

:: Wait a moment then open browser
timeout /t 3 /nobreak >nul
start https://afdmi-123.onrender.com

endlocal
pause

