@echo off
setlocal

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
echo [2/5] Building Docker image...
echo       This may take a few minutes on first run...
docker build -t admi-app .
if %ERRORLEVEL% neq 0 (
    echo.
    echo ERROR: Docker build failed.
    echo Please check the Dockerfile and requirements.txt for errors.
    pause
    exit /b %ERRORLEVEL%
)
echo       Docker image 'admi-app' built successfully.

echo.
echo [3/5] Stopping existing container (if any)...
docker stop admi-container 2>nul
docker rm admi-container 2>nul
echo       Cleanup complete.

echo.
echo [4/5] Running Docker container...
echo       Starting services:
echo       - Node.js Backend: http://localhost:3001
echo       - Python Extraction Service: http://localhost:5001
echo.

:: Run container with both ports exposed
docker run -d ^
    -p 3001:3001 ^
    -p 5001:5001 ^
    --name admi-container ^
    --restart unless-stopped ^
    admi-app

if %ERRORLEVEL% neq 0 (
    echo.
    echo ERROR: Failed to start Docker container.
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo [5/5] Waiting for services to start...
timeout /t 5 /nobreak >nul

:: Check if container is running
docker ps | findstr admi-container >nul
if %ERRORLEVEL% neq 0 (
    echo.
    echo ERROR: Container is not running. Check logs with: docker logs admi-container
    pause
    exit /b 1
)

echo.
echo ============================================
echo Deployment Complete!
echo ============================================
echo.
echo Container 'admi-app' is running in Docker Desktop.
echo.
echo Services:
echo   - Node.js Backend:    http://localhost:3001
echo   - Python Extraction:  http://localhost:5001
echo   - Frontend:           http://localhost:3001/index.html
echo.
echo Docker Desktop Commands:
echo   - Open Docker Desktop to manage containers
echo   - View logs:     docker logs admi-container
echo   - Follow logs:   docker logs -f admi-container
echo   - Stop:          docker stop admi-container
echo   - Restart:       docker restart admi-container
echo   - Remove:        docker rm -f admi-container
echo.

:: Open Docker Desktop to show the container
echo Opening Docker Desktop...
start "" "%DOCKER_DESKTOP%"

:: Wait a moment then open browser
timeout /t 2 /nobreak >nul
start http://localhost:3001/index.html

endlocal
pause