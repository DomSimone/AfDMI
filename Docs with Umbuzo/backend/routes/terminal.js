/**
 * Data Processing Terminal Routes
 * Handles CSV input, CLI commands: linear regression, histogram, describe, head
 */

const express = require('express');
const { parse } = require('csv-parse/sync');
const { SLR } = require('ml-regression');
const ss = require('simple-statistics');

const router = express.Router();

function parseCSV(csvText) {
  try {
    const parsed = parse(csvText, { 
      columns: true, 
      skip_empty_lines: true, 
      relax_column_count: true,
      trim: true 
    });
    if (!parsed.length) return { headers: [], records: [], error: 'No data rows' };
    const headers = Object.keys(parsed[0]);
    const records = parsed.map(row => {
      const arr = [];
      headers.forEach(h => arr.push(row[h]));
      return arr;
    });
    return { headers, records };
  } catch (e) {
    return { headers: [], records: [], error: e.message };
  }
}

function getNumericColumn(data, colName) {
  const idx = data.headers.indexOf(colName);
  if (idx === -1) return null;
  const values = data.records.map(r => parseFloat(r[idx])).filter(v => !isNaN(v));
  return values;
}

// Execute terminal command
router.post('/execute', (req, res) => {
  try {
    const { csvData, command } = req.body;
    if (!csvData) return res.status(400).json({ error: 'CSV data is required' });

    const data = parseCSV(csvData);
    if (data.error) return res.json({ success: false, textOutput: `Error: ${data.error}` });

    const cmd = String(command || '').trim().toLowerCase();

    // head - first few rows
    if (cmd === 'head' || cmd.startsWith('head ')) {
      const match = cmd.match(/head\s+(\d+)/);
      const n = match ? Math.min(parseInt(match[1], 10), 50) : 5;
      const rows = data.records.slice(0, n);
      const text = [data.headers.join(', '), ...rows.map(r => r.join(', '))].join('\n');
      return res.json({ success: true, command: 'head', textOutput: text, data: { headers: data.headers, rows } });
    }

    // describe - descriptive statistics
    if (cmd === 'describe') {
      const stats = [];
      data.headers.forEach((h, i) => {
        const nums = data.records.map(r => parseFloat(r[i])).filter(v => !isNaN(v));
        if (nums.length > 0) {
          stats.push({
            column: h,
            count: nums.length,
            mean: ss.mean(nums).toFixed(4),
            std: ss.standardDeviation(nums).toFixed(4),
            min: ss.min(nums).toFixed(4),
            max: ss.max(nums).toFixed(4),
            median: ss.median(nums).toFixed(4)
          });
        } else {
          stats.push({ column: h, count: data.records.length, type: 'non-numeric' });
        }
      });
      const text = stats.map(s => 
        s.type ? `${s.column}: ${s.count} values (non-numeric)` : 
        `${s.column}: count=${s.count}, mean=${s.mean}, std=${s.std}, min=${s.min}, max=${s.max}, median=${s.median}`
      ).join('\n');
      return res.json({ success: true, command: 'describe', textOutput: text, stats });
    }

    // linear regression on X vs Y
    const lrMatch = cmd.match(/linear\s+regression\s+on\s+(\w+)\s+vs\s+(\w+)/i) ||
                    cmd.match(/regression\s+(\w+)\s+vs\s+(\w+)/i) ||
                    cmd.match(/linear\s+regression\s+(\w+)\s+vs\s+(\w+)/i);
    if (lrMatch) {
      const xCol = lrMatch[1].trim();
      const yCol = lrMatch[2].trim();
      const xVals = getNumericColumn(data, xCol);
      const yVals = getNumericColumn(data, yCol);
      if (!xVals || !yVals || xVals.length < 2) {
        return res.json({ success: false, textOutput: `Could not find numeric columns "${xCol}" and "${yCol}" or insufficient data` });
      }
      const len = Math.min(xVals.length, yVals.length);
      const x = xVals.slice(0, len);
      const y = yVals.slice(0, len);
      const regression = new SLR(x, y);
      const slope = regression.slope;
      const intercept = regression.intercept;
      const r2 = regression.score(x, y);
      const predictions = x.map((xi, i) => ({ x: xi, y: y[i], predicted: regression.predict(xi) }));
      const text = `Linear Regression: ${yCol} ~ ${xCol}\n  Slope: ${slope.toFixed(4)}\n  Intercept: ${intercept.toFixed(4)}\n  R²: ${(r2 * 100).toFixed(2)}%\n  Equation: y = ${slope.toFixed(4)}x + ${intercept.toFixed(4)}`;
      return res.json({ 
        success: true, 
        command: 'linear_regression', 
        textOutput: text, 
        regression: { xCol, yCol, slope, intercept, r2 },
        chartData: { x, y, slope, intercept, predictions }
      });
    }

    // plot histogram of Z
    const histMatch = cmd.match(/plot\s+histogram\s+of\s+(\w+)/i) || cmd.match(/histogram\s+(\w+)/i);
    if (histMatch) {
      const col = histMatch[1].trim();
      const vals = getNumericColumn(data, col);
      if (!vals || vals.length < 1) {
        return res.json({ success: false, textOutput: `Could not find numeric column "${col}"` });
      }
      const bins = Math.min(20, Math.max(5, Math.ceil(Math.sqrt(vals.length))));
      const min = Math.min(...vals);
      const max = Math.max(...vals);
      const binWidth = (max - min) / bins || 1;
      const histogram = Array(bins).fill(0).map((_, i) => ({
        binStart: min + i * binWidth,
        binEnd: min + (i + 1) * binWidth,
        count: 0,
        label: `${(min + i * binWidth).toFixed(2)}-${(min + (i + 1) * binWidth).toFixed(2)}`
      }));
      vals.forEach(v => {
        let idx = Math.min(Math.floor((v - min) / binWidth), bins - 1);
        if (idx < 0) idx = 0;
        histogram[idx].count++;
      });
      const text = `Histogram of ${col}\n${histogram.map(h => `${h.label}: ${'█'.repeat(Math.min(h.count, 40))} ${h.count}`).join('\n')}`;
      return res.json({ 
        success: true, 
        command: 'histogram', 
        textOutput: text, 
        chartData: { 
          labels: histogram.map(h => h.label), 
          values: histogram.map(h => h.count),
          column: col
        } 
      });
    }

    return res.json({ success: false, textOutput: `Unknown command: "${command}". Supported: head, describe, linear regression on X vs Y, plot histogram of Z` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Parse CSV from upload or paste
router.post('/parse', (req, res) => {
  try {
    const { csvData } = req.body;
    if (!csvData) return res.status(400).json({ error: 'CSV data is required' });
    const data = parseCSV(csvData);
    res.json(data.error ? { success: false, error: data.error } : { success: true, ...data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
