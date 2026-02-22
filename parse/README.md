# Generic PDF Parser

A flexible web application that extracts and parses any section from PDF documents based on user-defined prompts and column definitions. Also supports PDF to image and PDF to DOCX conversion.

## Features

- 📄 **Generic PDF Parsing**: Extract any section from PDFs using custom prompts
- 🎯 **Custom Column Definitions**: Define your own columns with extraction patterns
- 📊 **CSV Export**: Export parsed data as CSV with custom column segmentation
- 🖼️ **PDF to Images**: Convert PDF pages to PNG images
- 📝 **PDF to DOCX**: Convert PDF documents to DOCX format
- 🎨 **Modern UI**: Clean, responsive web interface with tabbed navigation
- 🔍 **Pattern Matching**: Support for regex patterns for advanced extraction

## Installation

### 1. Install Python Dependencies

```bash
pip install -r requirements.txt
```

### 2. Install System Dependencies

#### For PDF to Image Conversion (pdf2image)

**Windows:**
- Download Poppler from: https://github.com/oschwartz10612/poppler-windows/releases/
- Extract and add `bin` folder to your system PATH

**macOS:**
```bash
brew install poppler
```

**Linux (Ubuntu/Debian):**
```bash
sudo apt-get install poppler-utils
```

**Linux (Fedora/CentOS):**
```bash
sudo yum install poppler-utils
```

## Usage

1. Start the Flask application:
```bash
python app.py
```

2. Open your web browser and navigate to:
```
http://localhost:5000
```

3. **Parse PDF Tab:**
   - Enter a section name to extract (e.g., "REFERENCES", "ABSTRACT", "METHODOLOGY") or leave empty to parse entire document
   - Define columns:
     - Column Name: e.g., "Author Name", "Title", "Date Published"
     - Pattern (optional): Regex pattern for extraction
     - Type: Choose from Text, Name, Title, Date, or Institution
   - Upload PDF file
   - Click "Parse PDF"
   - View results in table
   - Download as CSV

4. **Convert PDF Tab:**
   - Upload PDF file
   - Click "Convert to Images" or "Convert to DOCX"
   - Download converted files

## How It Works

### Parsing Configuration

1. **Section Extraction**: 
   - Enter a section name (e.g., "REFERENCES")
   - The app searches for this section in the PDF
   - Extracts text from that section until the next major section

2. **Column Definitions**:
   - **Column Name**: The name that will appear in CSV headers
   - **Pattern**: Optional regex pattern for custom extraction
     - Example: `\((\d{4})\)` to extract year in parentheses
     - Example: `([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)` to extract capitalized names
   - **Type**: Predefined extraction logic:
     - **Text**: General text extraction
     - **Name**: Extracts author/name patterns
     - **Title**: Extracts document titles
     - **Date**: Extracts years/dates
     - **Institution**: Extracts university/publisher names

3. **Data Parsing**:
   - Text is split into items (by newlines, numbering, etc.)
   - Each item is parsed according to column definitions
   - Results are displayed in a table

### Example Use Cases

**Extract References:**
- Section Prompt: "REFERENCES"
- Columns:
  - Name: "Author Name", Type: "Name"
  - Name: "Title", Type: "Title"
  - Name: "Year", Type: "Date"
  - Name: "Publisher", Type: "Institution"

**Extract Contact Information:**
- Section Prompt: "CONTACT"
- Columns:
  - Name: "Name", Pattern: `([A-Z][a-z]+\s+[A-Z][a-z]+)`
  - Name: "Email", Pattern: `([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})`
  - Name: "Phone", Pattern: `(\+?\d{1,3}[-.\s]?\(?\d{1,4}\)?[-.\s]?\d{1,4}[-.\s]?\d{1,9})`

**Extract Table Data:**
- Section Prompt: (leave empty for full document)
- Columns: Define based on table structure

## Requirements

- Python 3.11+ (required if you install `unstract-client`)
- Flask
- pdfplumber
- pdf2image (requires Poppler)
- pdf2docx
- Pillow
 - unstract-client (optional: Unstract API Deployment integration)
 - requests

## File Structure

```
.
├── app.py                 # Flask application
├── requirements.txt       # Python dependencies
├── templates/
│   └── index.html        # Frontend UI
├── uploads/              # Temporary upload storage
└── outputs/              # Converted files
    ├── images/           # PDF to image outputs
    └── documents/        # PDF to DOCX outputs
```

## Unstract Integration (optional)

This app can use **Unstract API Deployments** as a parsing engine (end-to-end automation):

1. In Unstract, create a Prompt Studio project and export it as an **API Deployment** that outputs structured JSON.
2. Set environment variables:

```bash
set UNSTRACT_API_URL=https://us-central.unstract.com/deployment/api/{org_id}/{deployment_id}/
set UNSTRACT_API_DEPLOYMENT_KEY=your_deployment_key
```

Optional:

```bash
set UNSTRACT_TIMEOUT_SECONDS=300
set UNSTRACT_POLL_INTERVAL_SECONDS=2.5
set UNSTRACT_INCLUDE_METADATA=false
```

3. In the UI, choose **Parsing Engine → Unstract (API Deployment)**.

Notes:
- Your Unstract tool should return **JSON rows** (a JSON array of objects, or an object with a `rows` array).
- The app will map Unstract keys to your UI column names using a case-insensitive normalized match.

## Notes

- Maximum file size: 50MB
- PDF parsing accuracy depends on PDF text quality and formatting
- Regex patterns are case-insensitive by default
- For best results, use clear section headers in your PDFs
- PDF to image conversion requires Poppler to be installed

## Troubleshooting

**PDF to Image conversion fails:**
- Ensure Poppler is installed and in your system PATH
- On Windows, restart your terminal/IDE after adding Poppler to PATH

**Parsing returns empty results:**
- Check that the section name matches exactly (case-insensitive)
- Try leaving section prompt empty to parse entire document
- Verify column patterns are correct regex

**CSV download issues:**
- Ensure you've parsed data successfully before downloading
- Check browser console for errors

## License

MIT
