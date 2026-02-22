"""
Setup script for Generic PDF Parser
Run: python setup.py
"""

import subprocess
import sys
import os

def install_requirements():
    """Install Python requirements"""
    print("Installing Python dependencies...")
    try:
        subprocess.check_call([sys.executable, "-m", "pip", "install", "-r", "requirements.txt"])
        print("✓ Python dependencies installed successfully!")
        return True
    except subprocess.CalledProcessError as e:
        print(f"✗ Error installing dependencies: {e}")
        return False

def check_poppler():
    """Check if Poppler is installed"""
    print("\nChecking for Poppler...")
    try:
        # Try to run pdftoppm
        result = subprocess.run(["pdftoppm", "-h"], 
                              capture_output=True, 
                              text=True,
                              timeout=5)
        if result.returncode == 0 or "pdftoppm" in result.stderr.lower():
            print("✓ Poppler is installed!")
            return True
    except (subprocess.TimeoutExpired, FileNotFoundError, subprocess.SubprocessError):
        pass
    
    print("✗ Poppler is not installed or not in PATH")
    print("\nTo install Poppler:")
    print("  Windows: Download from https://github.com/oschwartz10612/poppler-windows/releases/")
    print("  macOS:   brew install poppler")
    print("  Linux:   sudo apt-get install poppler-utils")
    print("\nSee INSTALL.md for detailed instructions.")
    return False

def main():
    print("=" * 50)
    print("Generic PDF Parser - Setup")
    print("=" * 50)
    
    # Install Python dependencies
    if not install_requirements():
        print("\nSetup incomplete. Please install dependencies manually.")
        sys.exit(1)
    
    # Check Poppler
    poppler_installed = check_poppler()
    
    print("\n" + "=" * 50)
    if poppler_installed:
        print("Setup complete! You can now run: python app.py")
    else:
        print("Setup complete, but Poppler is required for PDF to Image conversion.")
        print("You can still use PDF parsing and PDF to DOCX conversion.")
        print("Run: python app.py")
    print("=" * 50)

if __name__ == "__main__":
    main()
