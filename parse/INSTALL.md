# Installation Guide

## Quick Start

### Step 1: Install Python Dependencies

```bash
pip install -r requirements.txt
```

### Step 2: Install Poppler (Required for PDF to Image conversion)

#### Windows

1. Download Poppler from: https://github.com/oschwartz10612/poppler-windows/releases/
2. Extract the ZIP file
3. Copy the `bin` folder path (e.g., `C:\poppler\bin`)
4. Add to System PATH:
   - Press `Win + R`, type `sysdm.cpl`, press Enter
   - Go to "Advanced" tab → "Environment Variables"
   - Under "System Variables", find "Path" → Edit
   - Add the `bin` folder path
   - Click OK and restart your terminal/IDE

#### macOS

```bash
brew install poppler
```

#### Linux (Ubuntu/Debian)

```bash
sudo apt-get update
sudo apt-get install poppler-utils
```

#### Linux (Fedora/CentOS/RHEL)

```bash
sudo yum install poppler-utils
```

### Step 3: Run the Application

```bash
python app.py
```

The application will start on `http://localhost:5000`

## Verification

To verify Poppler is installed correctly:

**Windows:**
```bash
pdftoppm -h
```

**macOS/Linux:**
```bash
pdftoppm -h
```

If you see help text, Poppler is installed correctly.

## Troubleshooting

### Issue: "pdftoppm not found" or similar errors

**Solution:** Poppler is not in your PATH. Follow Step 2 above to install and configure Poppler.

### Issue: Import errors for pdf2image

**Solution:** 
```bash
pip install --upgrade pdf2image Pillow
```

### Issue: Import errors for pdf2docx

**Solution:**
```bash
pip install --upgrade pdf2docx
```

### Issue: Permission errors on Windows

**Solution:** Run your terminal/IDE as Administrator when installing Poppler or adding to PATH.
