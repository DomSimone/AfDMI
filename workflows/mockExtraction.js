/**
 * Mock AI/ML extraction: simulates document vision and structured output.
 * In production this would call an external OCR/AI API.
 */
const PAPER_NAMES = ['Invoice', 'Receipt', 'Study Report', 'Memo', 'Form A'];
const VENDORS = ['Acme Corp', 'Global Supplies', 'Lab Equip Inc', 'Sigma Research'];
const DATES = ['2024-01-15', '2024-02-20', '2024-03-10', '2024-04-05'];
const ID_PREFIX = ['INV', 'RCP', 'STY', 'MEM'];

function parseCSVBuffer(buffer) {
  const text = buffer.toString('utf8');
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (lines.length === 0) return { headers: [], rows: [] };
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  const rows = lines.slice(1).map(line => {
    const values = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') inQuotes = !inQuotes;
      else if ((c === ',' && !inQuotes)) { values.push(current.trim()); current = ''; }
      else current += c;
    }
    values.push(current.trim());
    return values;
  });
  return { headers, rows };
}

function mockValueForHint(hint, rowIndex) {
  const h = (hint || '').toLowerCase();
  const i = rowIndex;
  if (h.includes('invoice') || h.includes('number') || h.includes('id')) return `${ID_PREFIX[i % 4]}-${1000 + i}`;
  if (h.includes('date')) return DATES[i % DATES.length];
  if (h.includes('vendor') || h.includes('name') || h.includes('company')) return VENDORS[i % VENDORS.length];
  if (h.includes('amount') || h.includes('total') || h.includes('value')) return (99.5 + i * 10.25).toFixed(2);
  if (h.includes('description') || h.includes('type')) return PAPER_NAMES[i % PAPER_NAMES.length];
  return `Value_${rowIndex}_${hint || 'field'}`;
}

function mockExtractFromDocuments({ files, csvText, prompt, outputFormat, fieldHints }) {
  const allRows = [];
  let headers = [];

  if (csvText) {
    const parsed = parseCSVBuffer(Buffer.from(csvText, 'utf8'));
    headers = parsed.headers;
    allRows.push(...parsed.rows);
  }

  (files || []).forEach((file, fileIdx) => {
    // Check for CSV by mimetype or extension
    const isCSV = (file.mimetype === 'text/csv') || 
                  (file.fileName && file.fileName.toLowerCase().endsWith('.csv')) ||
                  (file.mimetype === 'text/plain') || 
                  (file.mimetype === 'application/vnd.ms-excel');
                  
    if (isCSV) {
      const parsed = parseCSVBuffer(file.buffer);
      if (parsed.headers.length) headers = headers.length ? headers : parsed.headers;
      allRows.push(...parsed.rows);
    } else {
      // PDF/Image: simulate one row per "page" or segment
      // Use buffer length to simulate page count if size not available
      const size = file.buffer ? file.buffer.length : 0;
      const numPages = Math.min(5, Math.max(1, Math.floor(size / 2000)));
      for (let p = 0; p < numPages; p++) {
        allRows.push(fieldHints.map(h => mockValueForHint(h, fileIdx * 5 + p)));
      }
      if (!headers.length && fieldHints.length) headers = fieldHints;
    }
  });

  if (!headers.length) headers = fieldHints.length ? fieldHints : ['Field_1', 'Field_2', 'Field_3'];
  if (allRows.length && headers.length !== allRows[0].length && fieldHints.length) {
    allRows.forEach((row, idx) => {
      while (row.length < headers.length) row.push(mockValueForHint(headers[row.length], idx));
    });
  }

  const extractList = allRows.map((row, i) => {
    const obj = {};
    headers.forEach((h, j) => { obj[h] = row[j] != null ? row[j] : mockValueForHint(h, i); });
    return obj;
  });

  if (outputFormat === 'csv') {
    const csvHeader = headers.join(',');
    const csvRows = extractList.map(obj => headers.map(h => `"${String(obj[h] || '').replace(/"/g, '""')}"`).join(','));
    return {
      success: true,
      outputFormat: 'csv',
      data: [csvHeader, ...csvRows].join('\n'),
      rowCount: extractList.length,
      message: 'Mock AI extraction complete. Replace with real API for production.'
    };
  }

  return {
    success: true,
    outputFormat: 'json',
    data: extractList,
    rowCount: extractList.length,
    message: 'Mock AI extraction complete. Replace with real API for production.'
  };
}

module.exports = { mockExtractFromDocuments, parseCSVBuffer };
