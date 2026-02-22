# Docs with Umbuzo

AI-Native Vision & OCR Document Processing with Data Processing Terminal — a full-stack web application for document ingestion, structured AI extraction (mocked), and CSV data analysis.

## Features

### 4. AI Native Vision & OCR Document Processing
- **Document Ingestion**: Upload PDF or CSV files (up to 30 items at a time)
- **Structured Output Prompting**: Natural language prompts to instruct extraction (e.g., "Invoice Number, Date, Vendor Name")
- **Generative AI Extraction (Mocked)**: Simulates AI/ML models to extract specified information
- **Output Formats**: CSV or JSON for spreadsheet conversion
- **Analog Study Metadata Upload**: Dedicated section for CSV/PDF metadata from analog studies

### 5. Data Processing Terminal
- **CSV Data Input**: Paste raw CSV or upload a CSV file
- **CLI Commands**:
  - `head` / `head N` — first N rows (default 5)
  - `describe` — descriptive statistics (count, mean, std, min, max, median)
  - `linear regression on X vs Y` — linear regression between two columns
  - `plot histogram of Z` — histogram for a specified column
- **Output**: Text results and interactive charts (regression plots, histograms)

## Setup

```bash
npm install
npm start
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Tech Stack

- **Backend**: Node.js, Express, Multer, csv-parse, ml-regression, simple-statistics
- **Frontend**: Vanilla HTML/CSS/JS, Chart.js for visualizations
