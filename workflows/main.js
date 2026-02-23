// To run this backend server: 
// npm install busboy bcryptjs jsonwebtoken
// node workflows/main.js

const http = require('http');
const https = require('https');
const { URL } = require('url');
const busboy = require('busboy');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { mockExtractFromDocuments } = require('./mockExtraction');
const path = require('path');

// In-memory storage
const users = {};
const surveys = [];
const chatHistories = {};
const researchChatHistories = {}; 
const sessionFiles = []; 

const JWT_SECRET = 'your-super-secret-key';
const DEEPSEEK_API_KEY = "sk-3c594d38d93947d8b1b6bf93c161857b";
const DEEPSEEK_MODEL = "deepseek-chat";

// --- Python LangExtract Service Configuration ---
// Points to the production Render service
const PYTHON_SERVICE_URL = `https://afdmi-123.onrender.com/process`; 

const server = http.createServer((req, res) => {
    // FIX: Define reqUrl at the very beginning of the request handler
    const reqUrl = new URL(req.url, `http://${req.headers.host}`);

    // CORS Headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    // --- API ROUTING ---

    // Root Endpoint
    if (reqUrl.pathname === '/' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('ADMI Backend Server is Running');
    }
document.addEventListener('DOMContentLoaded', () => {
    // Port 0000 per your main.js configuration
    const NODE_API = 'http://localhost:0000'; 
    
    let uploadedFilename = null; 
    let base64Content = null;

    // --- UI Element Selectors ---
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const fileCount = document.getElementById('fileCount');
    const extractBtn = document.getElementById('extractBtn');
    const extractPrompt = document.getElementById('extractPrompt');
    const extractOutput = document.getElementById('extractOutput');
    const ingestionStatus = document.getElementById('ingestionStatus');
    
    // 1. Document Ingestion
    else if (reqUrl.pathname === '/api/documents/ingest' && req.method === 'POST') {
        let bb;
        try {
            bb = busboy({ headers: req.headers });
        } catch (err) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ error: 'Invalid upload request.' }));
        }

        const filePromises = [];
        bb.on('file', (fieldname, file, filename, encoding, mimetype) => {
            const chunks = [];
            file.on('data', (chunk) => chunks.push(chunk));
            file.on('end', () => {
                let safeFilename = typeof filename === 'string' ? filename : (filename?.filename || "unknown_file");
                safeFilename = path.basename(safeFilename);

                const buffer = Buffer.concat(chunks);
                const fileData = {
                    filename: safeFilename,
                    mimetype: mimetype,
                    content: buffer.toString('base64'),
                    size: buffer.length
                };
                sessionFiles.push(fileData);
                filePromises.push(fileData);
            });
        });

        bb.on('finish', () => {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ 
                success: true, 
                files: filePromises.map(f => ({ filename: f.filename, size: f.size, content: f.content })) 
            }));
        }); // Properly closed callback

        req.pipe(bb);
    } 

    // 2. Document Extraction
    else if (reqUrl.pathname === '/api/documents/extract' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk.toString());
        req.on('end', async () => {
            try {
                const parsedBody = JSON.parse(body);
                const { documentContent, prompt, outputFormat, filename } = parsedBody;
                let buffer;
                let safeFilename = filename || "document.pdf";

                if (documentContent) {
                    buffer = Buffer.from(documentContent, 'base64');
                } else if (filename) {
                    const found = sessionFiles.find(f => f.filename === filename);
                    if (found) buffer = Buffer.from(found.content, 'base64');
                }

                if (!buffer) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    return res.end(JSON.stringify({ error: 'File not found.' }));
                }

                const formData = new FormData();
                const blob = new Blob([buffer], { type: 'application/pdf' });
                formData.append('file', blob, safeFilename);
                formData.append('prompt', prompt || 'Extract data');

                try {
                    const pythonServiceRes = await fetch(PYTHON_SERVICE_URL, {
                        method: 'POST',
                        body: formData,
                    });

                    const pythonResult = await pythonServiceRes.json();
                    const data = pythonResult.extractions || pythonResult.data || pythonResult;
                    
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ data: data, outputFormat: outputFormat }));
                } catch (fetchError) {
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Python Service Unreachable' }));
                }
            } catch (e) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Invalid JSON body' }));
            }
        }); // Properly closed req.on callback
    }// This closes the 'else if' for extraction

    // 3. User Authentication
    else if (reqUrl.pathname === '/api/signup' && req.method === 'POST') {
        // ... rest of your code ...

    else if (reqUrl.pathname === '/api/login' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk.toString());
        req.on('end', async () => {
            try {
                const { email, password } = JSON.parse(body);
                const user = users[email];
                if (!user || !await bcrypt.compare(password, user.password)) {
                    res.writeHead(401, { 'Content-Type': 'application/json' });
                    return res.end(JSON.stringify({ error: 'Invalid login' }));
                }
                const token = jwt.sign({ email: user.email }, JWT_SECRET, { expiresIn: '1h' });
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ token, name: user.name }));
            } catch (e) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Invalid login data.' }));
            }
        });
    }

    // 4. Research Assistant (DeepSeek)
    else if (reqUrl.pathname === '/api/research-assistant' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk.toString());
        req.on('end', async () => {
            try {
                const { message, userId = 'default' } = JSON.parse(body);
                if (!researchChatHistories[userId]) researchChatHistories[userId] = [];
                researchChatHistories[userId].push({ role: 'user', content: message });

                const dsOptions = {
                    hostname: 'api.deepseek.com',
                    path: '/v1/chat/completions',
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${DEEPSEEK_API_KEY}` }
                };

                const dsReq = https.request(dsOptions, (dsRes) => {
                    let data = '';
                    dsRes.on('data', d => data += d);
                    dsRes.on('end', () => {
                        try {
                            const reply = JSON.parse(data).choices[0].message.content;
                            res.writeHead(200, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ reply }));
                        } catch (e) {
                            res.writeHead(500, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ error: 'API parse error' }));
                        }
                    });
                });
                dsReq.write(JSON.stringify({ model: DEEPSEEK_MODEL, messages: researchChatHistories[userId] }));
                dsReq.end();
            } catch (e) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Invalid assistant request.' }));
            }
        });
    }

    else {
        res.writeHead(404);
        res.end('Not Found');
    }
});

// Set port to 5001 for consistency with your request
const PORT = process.env.PORT || 0000;
server.listen(PORT, () => {
    console.log(`Node.js Backend listening on port ${PORT}`);
    console.log(`Targeting Python Service at: ${PYTHON_SERVICE_URL}`);
});
