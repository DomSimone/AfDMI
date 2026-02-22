/**
 * Document Processing Routes
 * Handles PDF/CSV uploads, AI extraction (mocked), and analog study metadata
 */

const express = require('express');
const multer = require('multer');
const { parse } = require('csv-parse/sync');
const fs = require('fs');
const path = require('path');

const router = express.Router();

// Configure multer - store in memory for processing
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB per file
  fileFilter: (req, file, cb) => {
    const allowed = /\.(pdf|csv)$/i;
    if (allowed.test(path.extname(file.originalname))) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF and CSV files are allowed'));
    }
  }
});

const MAX_FILES = 30;

/**
 * Mock AI Extraction - Simulates document context understanding and extraction
 * Parses prompt for field names and generates plausible extracted data from document content
 */
function mockAIExtract(documentContent, prompt) {
  const fields = parseExtractionPrompt(prompt);
  const results = [];
  
  // For CSV: extract headers and sample rows as "extracted" data
  if (documentContent.type === 'csv') {
    const records = documentContent.records || [];
    const headers = documentContent.headers || [];
    
    records.slice(0, Math.min(50, records.length)).forEach((row, idx) => {
      const extracted = {};
      fields.forEach((field, i) => {
        const colIdx = Math.min(i, headers.length - 1);
        extracted[field] = row[colIdx] !== undefined ? String(row[colIdx]) : `Extracted_${idx + 1}_${field}`;
      });
      results.push(extracted);
    });
  } else {
    // For PDF (or generic): generate mock extracted data based on field names
    const mockCount = Math.min(10, Math.max(1, documentContent.text?.split('\n').length || 5));
    for (let i = 0; i < mockCount; i++) {
      const extracted = {};
      fields.forEach(field => {
        extracted[field] = generateMockValue(field, i + 1);
      });
      results.push(extracted);
    }
  }
  
  return results;
}

function parseExtractionPrompt(prompt) {
  // Extract field names from natural language (e.g., "Invoice Number, Date, Vendor Name")
  const commaSeparated = prompt.split(/,|and|&/).map(s => s.trim()).filter(Boolean);
  if (commaSeparated.length > 0) return commaSeparated;
  
  // Fallback: try quoted strings
  const quoted = prompt.match(/"([^"]+)"/g);
  if (quoted) return quoted.map(s => s.replace(/"/g, ''));
  
  return ['Field_1', 'Field_2', 'Field_3'];
}

function generateMockValue(fieldName, index) {
  const lower = fieldName.toLowerCase();
  if (lower.includes('invoice') || lower.includes('id') || lower.includes('number')) return `INV-${1000 + index}`;
  if (lower.includes('date')) return new Date(2024, index % 12, (index % 28) + 1).toISOString().split('T')[0];
  if (lower.includes('vendor') || lower.includes('name')) return `Vendor ${String.fromCharCode(65 + (index % 26))}`;
  if (lower.includes('amount') || lower.includes('total') || lower.includes('price')) return (Math.random() * 1000 + 10).toFixed(2);
  if (lower.includes('email')) return `contact${index}@example.com`;
  if (lower.includes('description')) return `Item description ${index}`;
  return `Value_${index}`;
}

// Document ingestion (up to 30 files)
router.post('/ingest', upload.array('files', MAX_FILES), (req, res) => {
  try {
    const files = req.files || [];
    if (files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }
    if (files.length > MAX_FILES) {
      return res.status(400).json({ error: `Maximum ${MAX_FILES} files allowed` });
    }

    const processed = files.map(file => {
      const ext = path.extname(file.originalname).toLowerCase();
      let content = { type: ext === '.csv' ? 'csv' : 'pdf', text: '', headers: [], records: [] };

      if (ext === '.csv') {
        const text = file.buffer.toString('utf-8');
        try {
          const parsed = parse(text, { columns: true, skip_empty_lines: true, relax_column_count: true });
          content.headers = Object.keys(parsed[0] || {});
          content.records = parsed.map(row => Object.values(row));
          content.text = text.substring(0, 5000);
        } catch (e) {
          content.text = text.substring(0, 5000);
          content.error = 'CSV parse error';
        }
      } else {
        content.text = `[PDF: ${file.originalname}] Simulated OCR text. Document contains multiple pages of structured data.`;
      }

      return { filename: file.originalname, content };
    });

    res.json({ success: true, files: processed });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// AI extraction with structured output prompting
router.post('/extract', (req, res) => {
  try {
    const { documentContent, prompt, outputFormat = 'json' } = req.body;
    if (!documentContent || !prompt) {
      return res.status(400).json({ error: 'documentContent and prompt are required' });
    }

    const extracted = mockAIExtract(documentContent, prompt);

    if (outputFormat === 'csv') {
      const headers = Object.keys(extracted[0] || {});
      const csv = [headers.join(','), ...extracted.map(row => headers.map(h => `"${String(row[h] || '').replace(/"/g, '""')}"`).join(','))].join('\n');
      return res.json({ success: true, outputFormat: 'csv', data: csv, records: extracted });
    }

    res.json({ success: true, outputFormat: 'json', data: extracted });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Analog Study Metadata Upload - dedicated endpoint
router.post('/analog-metadata', upload.array('files', MAX_FILES), (req, res) => {
  try {
    const files = req.files || [];
    if (files.length === 0) {
      return res.status(400).json({ error: 'No metadata files uploaded' });
    }

    const processed = files.map(file => {
      const ext = path.extname(file.originalname).toLowerCase();
      let metadata = { filename: file.originalname, type: ext, records: [], summary: '' };

      if (ext === '.csv') {
        const text = file.buffer.toString('utf-8');
        try {
          const parsed = parse(text, { columns: true, skip_empty_lines: true });
          metadata.records = parsed;
          metadata.summary = `${parsed.length} records, columns: ${Object.keys(parsed[0] || {}).join(', ')}`;
        } catch (e) {
          metadata.summary = 'Parse error';
        }
      } else {
        metadata.summary = `PDF metadata file: ${file.originalname} - ready for processing`;
      }

      return metadata;
    });

    res.json({ success: true, message: 'Analog study metadata uploaded', files: processed });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
