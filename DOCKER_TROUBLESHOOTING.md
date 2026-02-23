# Docker Deployment Troubleshooting Guide

This guide helps you troubleshoot and fix common issues when deploying the ADMI application using Docker.

## Common Issues and Solutions

### 1. Docker Build Failures

**Error:** `process "/bin/sh -c pip install -r requirements.txt" did not complete successfully`

**Solutions:**
- **Package Version Conflicts:** The requirements.txt now uses specific versions that are compatible with each other
- **Missing System Dependencies:** Added `libgomp1` to the Dockerfile for better PDF processing support
- **Network Issues:** Docker build includes fallback installation for individual packages

**To test:** Run `test_docker_build.bat` first to check if all files are present and Docker is working.

### 2. Docker Desktop Not Running

**Error:** Docker commands fail or timeout

**Solutions:**
- Ensure Docker Desktop is installed from [docker.com](https://www.docker.com/products/docker-desktop)
- Start Docker Desktop application
- Wait for the Docker whale icon to appear in the system tray
- Verify Docker is running with: `docker info`

### 3. Port Conflicts

**Error:** Container fails to start due to ports 3001 or 5001 being in use

**Solutions:**
- Stop other services using these ports
- Check what's using the ports: `netstat -ano | findstr :3001`
- Kill conflicting processes or change ports in the Docker run command

### 4. Memory Issues

**Error:** Build fails with memory-related errors

**Solutions:**
- Increase Docker Desktop memory allocation (Settings → Resources → Memory)
- Recommended: 4GB or more for this application
- Clean up Docker system: `docker system prune -f`

## Files Modified

### 1. `requirements.txt`
- Added specific package versions for compatibility
- Removed `concurrent.futures` (it's part of Python standard library)
- Fixed version conflicts that were causing build failures

### 2. `Dockerfile`
- Added `libgomp1` system dependency for better PDF processing
- Added fallback package installation if requirements.txt fails
- Improved pip installation with better error handling

### 3. `deploy_to_docker.bat`
- Added comprehensive error checking and debugging
- Added build context validation
- Added service connectivity testing
- Improved error messages with specific troubleshooting steps
- Added build log generation for debugging

### 4. `test_docker_build.bat` (New)
- Pre-deployment validation script
- Checks all required files are present
- Validates Docker availability
- Tests build context before actual build

## Deployment Steps

1. **Run the test script first:**
   ```cmd
   test_docker_build.bat
   ```

2. **If tests pass, deploy:**
   ```cmd
   deploy_to_docker.bat
   ```

3. **Monitor the deployment:**
   - The script will show progress at each step
   - If it fails, check the specific error message
   - Use the troubleshooting steps above

## Manual Testing

If the automated script fails, you can test manually:

```cmd
# Test Docker is working
docker info

# Build the image manually
docker build -t admi-app .

# Run the container manually
docker run -d -p 3001:3001 -p 5001:5001 --name admi-container admi-app

# Check container logs
docker logs admi-container

# Test services
curl http://localhost:3001/
curl http://localhost:5001/health
```

## Service URLs

After successful deployment:
- **Node.js Backend:** http://localhost:3001
- **Python Extraction Service:** http://localhost:5001
- **Frontend:** http://localhost:3001/index.html
- **API Health Check:** http://localhost:5001/health

## Container Management

```cmd
# View running containers
docker ps

# View container logs
docker logs admi-container

# Follow container logs (real-time)
docker logs -f admi-container

# Stop container
docker stop admi-container

# Restart container
docker restart admi-container

# Remove container
docker rm -f admi-container

# Remove image
docker rmi admi-app
```

## Getting Help

If you're still experiencing issues:

1. Run `test_docker_build.bat` and share the output
2. Check the build log if the build fails
3. Check container logs with `docker logs admi-container`
4. Verify Docker Desktop is running and has sufficient resources

## System Requirements

- **Docker Desktop** installed and running
- **4GB+ RAM** allocated to Docker (recommended)
- **Windows 10/11** with WSL2 backend enabled
- **Internet connection** for downloading base images and packages