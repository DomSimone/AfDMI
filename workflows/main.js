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

    // 1. Document Ingestion
    if (dropZone) {
        dropZone.addEventListener('click', () => fileInput.click());
        dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('active'); });
        dropZone.addEventListener('dragleave', () => dropZone.classList.remove('active'));
        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            handleFiles(e.dataTransfer.files);
        });
    }

    fileInput?.addEventListener('change', (e) => handleFiles(e.target.files));

    async function handleFiles(files) {
        if (files.length === 0) return;
        const file = files[0];
        fileCount.textContent = `Selected: ${file.name}`;
        
        // Immediate Ingestion to Backend
        const formData = new FormData();
        formData.append('file', file);

        ingestionStatus.innerHTML = '<i>Uploading to server...</i>';

        try {
            const response = await fetch(`${NODE_API}/api/documents/ingest`, {
                method: 'POST',
                body: formData
            });
            const result = await response.json();
            
            if (result.success) {
                // Store file reference for extraction step
                uploadedFilename = result.files[0].filename;
                base64Content = result.files[0].content;
                ingestionStatus.innerHTML = '<b style="color:green;">✓ File Ready</b>';
            }
        } catch (err) {
            ingestionStatus.innerHTML = '<b style="color:red;">Upload failed.</b>';
        }
    }

    //  2. AI Extraction Step 
    extractBtn?.addEventListener('click', async () => {
        if (!uploadedFilename) return alert("Please upload a document first.");
        
        const prompt = extractPrompt.value || "Extract structured data";
        const format = document.getElementById('outputFormat')?.value || 'json';

        extractOutput.innerHTML = '<div class="loading">Processing with AI...</div>';

        try {
            const response = await fetch(`${NODE_API}/api/documents/extract`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    filename: uploadedFilename,
                    documentContent: base64Content,
                    prompt: prompt,
                    outputFormat: format
                })
            });

            const result = await response.json();
            renderResults(result.data);
        } catch (err) {
            extractOutput.innerHTML = `<div class="error">Extraction Error: ${err.message}</div>`;
        }
    });

    function renderResults(data) {
        if (!data) return;
        // Check if data is an array (table format) or object
        if (Array.isArray(data)) {
            let html = '<table class="result-table"><thead><tr>';
            Object.keys(data[0]).forEach(key => html += `<th>${key}</th>`);
            html += '</tr></thead><tbody>';
            data.forEach(row => {
                html += '<tr>';
                Object.values(row).forEach(val => html += `<td>${val}</td>`);
                html += '</tr>';
            });
            html += '</tbody></table>';
            extractOutput.innerHTML = html;
        } else {
            extractOutput.innerHTML = `<pre>${JSON.stringify(data, null, 2)}</pre>`;
        }
    }

    // Health Check for the Node backend
    async function checkStatus() {
        try {
            const res = await fetch(NODE_API);
            const statusBox = document.getElementById('service-status');
            if (res.ok && statusBox) {
                statusBox.innerHTML = '<span style="color:green">● System Online</span>';
            }
        } catch (e) {}
    }
    checkStatus();
});

    // 3. User Authentication
    else if (reqUrl.pathname === '/api/signup' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk.toString());
        req.on('end', async () => {
            try {
                const { name, email, password } = JSON.parse(body);
                const salt = await bcrypt.genSalt(10);
                const hashedPassword = await bcrypt.hash(password, salt);
                users[email] = { name, email, password: hashedPassword };
                res.writeHead(201, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ message: 'User created.' }));
            } catch (e) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Invalid signup data.' }));
            }
        });
    }

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
