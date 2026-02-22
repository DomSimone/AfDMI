/**
 * Docs with Umbuzo - Backend Server
 * AI Native Vision & OCR Document Processing + Data Processing Terminal
 */

const express = require('express');
const cors = require('cors');
const path = require('path');

const documentRoutes = require('./routes/documents');
const terminalRoutes = require('./routes/terminal');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve static frontend
app.use(express.static(path.join(__dirname, '../frontend')));

// API Routes
app.use('/api/documents', documentRoutes);
app.use('/api/terminal', terminalRoutes);

// SPA fallback - serve index.html for root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

app.listen(PORT, () => {
  console.log(`Docs with Umbuzo server running at http://localhost:${PORT}`);
});
